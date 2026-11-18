#!/usr/bin/env node
// Print and social preflight (D-054, checks/preflight.md). Opens each built format page in
// headless Chrome and checks:
//   size    the frame is the format’s exact size: Letter flyer 612×792 and postcard side 306×396
//           at 1px per pt (D-006, D-007, D-034); feed 1080×1350, story 1080×1920 and event cover
//           1920×1005px (D-008)
//   margin  every word, image and filled box sits inside the template’s padding (D-006, D-054)
//   pages   print saves to one page of the right paper size (D-006, D-007)
//   fonts   print embeds every font, and every font is Alegreya Sans (D-020, D-054)
//   images  raster images are at least 150ppi at their placed size in print, and never shown
//           larger than their pixel size on social (D-054)
// Print color is left out until O-21 settles black and white print.
// Usage: node tools/preflight.mjs [--report] [--json] [--all] [--out <folder>] [--origin <url>] <built folder> [page paths...]
//   --out  also saves each format as it would be sent: PDF for print, PNG for social (D-005)
// Without page paths it checks every built page that holds a format frame.
// Writes a Markdown report to $GITHUB_STEP_SUMMARY when set. Exit 1 on a size, margin, pages or
// fonts finding, unless --report (every check warns until launch).

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib';
import { fileFor, pagesIn, serve, launch, routeContext } from './lib/serve-build.mjs';

// Each format’s frame in CSS px, and for print the paper it prints on in pt. Print frames are
// drawn at 1px per pt and zoomed by 96/72 to fill the paper (D-034).
export const FORMATS = {
  flyer: { w: 612, h: 792, paper: [612, 792], print: true, decision: 'D-006', name: 'Letter flyer' },
  postcard: { w: 306, h: 396, paper: [306, 396], print: true, decision: 'D-007', name: 'postcard side' },
  sheet: { w: 612, h: 792, paper: [612, 792], print: true, decision: 'D-007', name: 'postcard sheet of four' },
  'social-feed': { w: 1080, h: 1350, decision: 'D-008', name: 'feed post' },
  'social-story': { w: 1080, h: 1920, decision: 'D-008', name: 'story' },
  'social-cover': { w: 1920, h: 1005, decision: 'D-008', name: 'event cover' },
};
export const MIN_PPI = 150;
const LEVEL = { size: 'error', margin: 'error', pages: 'error', fonts: 'error', images: 'warn' };

// Built pages that hold a format frame.
export function formatPagesIn(root) {
  return pagesIn(root).filter((p) => /class="gg-format gg-format--/.test(readFileSync(fileFor(root, p), 'utf8')));
}

// Runs in the page: the frame, its padding box, anything drawn outside it, and its images.
const MEASURE = () => {
  const root = document.querySelector('.gg-format');
  if (!root) return null;
  const kind = ([...root.classList].find((c) => c.startsWith('gg-format--')) || '').slice('gg-format--'.length);
  let format = kind;
  let frame = root;
  let boxes = [root];
  if (kind === 'social') {
    frame = root.querySelector('.gg-social') || root;
    format = `social-${([...frame.classList].find((c) => c.startsWith('gg-social--')) || 'gg-social--feed').slice('gg-social--'.length)}`;
    boxes = [frame];
  }
  if (kind === 'sheet') boxes = [...root.querySelectorAll('.gg-sheet__card')];
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join('')}`;
  const shown = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (cs.position === 'absolute' && cs.clip === 'rect(0px, 0px, 0px, 0px)') return false;
      if (e.classList.contains('gg-visually-hidden')) return false;
    }
    return true;
  };
  const painted = (el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    return ['IMG', 'svg', 'CANVAS', 'VIDEO'].includes(el.tagName) || (bg && !/rgba\(.*, 0\)$|transparent/.test(bg)) || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0;
  };
  const outside = [];
  for (const box of boxes) {
    const r = box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const px = (v) => parseFloat(v) || 0;
    const inner = { l: r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft), t: r.top + px(cs.borderTopWidth) + px(cs.paddingTop), r: r.right - px(cs.borderRightWidth) - px(cs.paddingRight), b: r.bottom - px(cs.borderBottomWidth) - px(cs.paddingBottom) };
    const seen = new Set();
    const note = (el, rect, what) => {
      const over = Math.max(inner.l - rect.left, rect.right - inner.r, inner.t - rect.top, rect.bottom - inner.b);
      if (over <= 0.5 || rect.width < 0.5 || rect.height < 0.5) return;
      const key = `${name(el)} ${what}`;
      if (seen.has(key)) return;
      seen.add(key);
      const side = [['left', inner.l - rect.left], ['right', rect.right - inner.r], ['top', inner.t - rect.top], ['bottom', rect.bottom - inner.b]].filter(([, v]) => v > 0.5).map(([s, v]) => `${Math.round(v)}px ${s}`).join(', ');
      outside.push({ target: name(el), what, side, clipped: rect.right > r.right + 0.5 || rect.bottom > r.bottom + 0.5 || rect.left < r.left - 0.5 || rect.top < r.top - 0.5 });
    };
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        if (!n.textContent.trim() || !shown(n.parentElement)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const rect of range.getClientRects()) note(n.parentElement, rect, 'text');
      } else if (n !== box && shown(n) && painted(n)) {
        note(n, n.getBoundingClientRect(), n.tagName === 'IMG' || n.tagName === 'svg' ? 'image' : 'box');
      }
    }
  }
  const fr = frame.getBoundingClientRect();
  const images = [...root.querySelectorAll('img')].filter(shown).map((img) => {
    const r = img.getBoundingClientRect();
    return { src: img.currentSrc || img.src, natural: [img.naturalWidth, img.naturalHeight], placed: [r.width, r.height], fit: getComputedStyle(img).objectFit, target: name(img) };
  });
  return { kind, format, size: [Math.round(fr.width * 100) / 100, Math.round(fr.height * 100) / 100], outside, images };
};

// The fonts in a PDF, as [base font name, embedded].
export function pdfFonts(doc) {
  const fonts = [];
  const N = (s) => PDFName.of(s);
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.lookup(N('Type')) !== N('Font')) continue;
    const subtype = obj.lookup(N('Subtype'));
    if (subtype === N('CIDFontType0') || subtype === N('CIDFontType2')) continue; // read through their Type0 parent
    const base = String(obj.lookup(N('BaseFont')) || '').replace(/^\//, '');
    if (subtype === N('Type3')) { fonts.push({ name: base || 'Type3', embedded: true }); continue; }
    let desc = obj.lookup(N('FontDescriptor'));
    if (subtype === N('Type0')) {
      const kids = obj.lookup(N('DescendantFonts'));
      const kid = kids instanceof PDFArray ? kids.lookup(0) : null;
      desc = kid instanceof PDFDict ? kid.lookup(N('FontDescriptor')) : null;
    }
    const embedded = desc instanceof PDFDict && ['FontFile', 'FontFile2', 'FontFile3'].some((k) => desc.has(N(k)));
    fonts.push({ name: base, embedded });
  }
  return fonts;
}

// Saves a print format as PDF. Returns the bytes.
export async function printPdf(page, spec) {
  const [w, h] = spec.paper;
  return page.pdf({ width: `${w / 72}in`, height: `${h / 72}in`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
}

// The findings for one measured page and, for print, its PDF.
export async function judge(path, m, pdf = null) {
  const out = [];
  const add = (check, rule, help, target = '') => out.push({ check, rule, level: LEVEL[check], help, page: path, target, format: m?.format });
  const spec = FORMATS[m.format];
  if (!spec) { add('size', 'D-054', `unknown format ‘${m.format}’`); return out; }
  if (Math.abs(m.size[0] - spec.w) > 0.5 || Math.abs(m.size[1] - spec.h) > 0.5) add('size', spec.decision, `the ${spec.name} is ${m.size[0]}×${m.size[1]}px; it should be ${spec.w}×${spec.h}px`);
  for (const o of m.outside) add('margin', m.format === 'flyer' ? 'D-006' : 'D-054', `${o.what} outside the template’s padding by ${o.side}${o.clipped ? ', and cut off at the edge' : ''}`, o.target);
  for (const img of m.images) {
    if (/\.svg(\?|$)|^data:image\/svg/i.test(img.src) || !img.natural[0]) continue;
    const sx = img.placed[0] / img.natural[0];
    const sy = img.placed[1] / img.natural[1];
    const scale = img.fit === 'contain' || img.fit === 'scale-down' ? Math.min(sx, sy) : Math.max(sx, sy);
    const file = img.src.split('/').pop();
    if (spec.print) {
      const ppi = Math.round(72 / scale);
      if (ppi < MIN_PPI) add('images', 'D-054', `${file} prints at ${ppi}ppi; it needs ${MIN_PPI}ppi at this size (${img.natural.join('×')}px placed at ${(img.placed[0] / 72).toFixed(2)}×${(img.placed[1] / 72).toFixed(2)}in)`, img.target);
    } else if (scale > 1.01) {
      add('images', 'D-054', `${file} is shown at ${scale.toFixed(2)}× its pixel size (${img.natural.join('×')}px placed at ${Math.round(img.placed[0])}×${Math.round(img.placed[1])}px)`, img.target);
    }
  }
  if (spec.print && pdf) {
    const doc = await PDFDocument.load(pdf, { updateMetadata: false });
    const pages = doc.getPages();
    if (pages.length !== 1) add('pages', spec.decision, `prints on ${pages.length} pages; it should print on one`);
    const { width, height } = pages[0].getSize();
    if (Math.abs(width - spec.paper[0]) > 1 || Math.abs(height - spec.paper[1]) > 1) add('pages', spec.decision, `prints on ${Math.round(width)}×${Math.round(height)}pt paper; it should be ${spec.paper[0]}×${spec.paper[1]}pt`);
    for (const f of pdfFonts(doc)) {
      if (!f.embedded) add('fonts', 'D-054', `font ${f.name} is not embedded`);
      if (!/AlegreyaSans/i.test(f.name.replace(/[\s-]/g, ''))) add('fonts', 'D-020', `font ${f.name || 'unnamed'} is not Alegreya Sans`);
    }
  }
  return out;
}

export async function checkFormats(root, { pages = null, origin = '', out = null } = {}) {
  const dir = resolve(root);
  const list = pages || formatPagesIn(dir);
  const browser = await launch();
  if (!browser) return { skipped: 'no Chrome or Chromium found', pages: list.length, findings: [] };
  const server = await serve(dir);
  const local = `http://127.0.0.1:${server.address().port}`;
  const blocked = new Set();
  const findings = [];
  const saved = [];
  if (out) mkdirSync(out, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 2000, height: 2100 }, deviceScaleFactor: 1 });
    await routeContext(context, { dir, local, origin, blocked });
    const page = await context.newPage();
    for (const path of list) {
      try {
        await page.goto(`${local}${path}`, { waitUntil: 'load', timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
      } catch (e) {
        findings.push({ check: 'size', rule: 'D-054', level: 'error', help: `the page did not load: ${e.message.split('\n')[0]}`, page: path, target: '' });
        continue;
      }
      const m = await page.evaluate(MEASURE);
      if (!m) continue;
      const spec = FORMATS[m.format];
      const pdf = spec?.print ? await printPdf(page, spec) : null;
      findings.push(...await judge(path, m, pdf));
      if (out && spec) {
        const base = join(out, path.replace(/^\/|\/$/g, '').replace(/\.html$/, '').replace(/[/]/g, '-') || 'index');
        if (pdf) { writeFileSync(`${base}.pdf`, pdf); saved.push(`${base}.pdf`); }
        else { await page.locator('.gg-social').first().screenshot({ path: `${base}.png` }); saved.push(`${base}.png`); }
      }
    }
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
  return { pages: list.length, findings, blocked: [...blocked].sort(), saved };
}

export function formatText(result, { all = false } = {}) {
  if (result.skipped) return `preflight: not checked: ${result.skipped}`;
  const lines = [`preflight: ${result.pages} format pages, ${result.findings.length} findings`];
  const byCheck = new Map();
  for (const f of result.findings) (byCheck.get(f.check) ?? byCheck.set(f.check, []).get(f.check)).push(f);
  for (const [check, list] of byCheck) {
    lines.push('', `${check}: ${list.length} (${list[0].level})`);
    for (const f of all ? list : list.slice(0, 8)) lines.push(`  ${f.rule}  ${f.page}${f.target ? `  ${f.target}` : ''}  ${f.help}`);
    if (!all && list.length > 8) lines.push(`  and ${list.length - 8} more`);
  }
  if (result.saved?.length) lines.push('', `Saved: ${result.saved.join(', ')}`);
  return lines.join('\n');
}

export function formatSummary(result, title = 'Print and social preflight') {
  if (result.skipped) return `### ${title}\n\nNot checked: ${result.skipped}.\n`;
  if (!result.findings.length) return `### ${title}\n\nNo findings on ${result.pages} format pages: sizes, padding, pages, fonts and image resolution pass. Print color waits on O-21.\n`;
  const rows = result.findings.map((f) => `| ${f.check} | ${f.rule} | \`${f.page}\` | ${f.target ? `\`${f.target}\`` : ''} | ${f.help.replace(/\|/g, ' ')} |`).join('\n');
  return `### ${title}\n\n${result.findings.length} findings on ${result.pages} format pages. Size, margin, pages and fonts are proposed to block at launch, image resolution to warn; every check warns until then (D-054).\n\n| Check | Rule | Page | Element | What |\n|---|---|---|---|---|\n${rows}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const valued = new Set(['--origin', '--out']);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const value = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : '');
  const rest = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
  if (!rest.length) { console.error('Usage: node tools/preflight.mjs [--report] [--json] [--all] [--out <folder>] [--origin <url>] <built folder> [page paths...]'); process.exit(2); }
  const [root, ...pages] = rest;
  const result = await checkFormats(root, { pages: pages.length ? pages : null, origin: value('--origin'), out: value('--out') || null });
  console.log(flags.has('--json') ? JSON.stringify(result, null, 2) : formatText(result, { all: flags.has('--all') }));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(result));
  if (!flags.has('--report') && result.findings.some((f) => f.level === 'error')) process.exit(1);
}

#!/usr/bin/env node
// Accessibility check (D-054, checks/a11y.md, brand/system/accessibility.md). Serves a built
// folder, opens every page in headless Chrome at 320px and 1280px, and runs axe-core: WCAG 2.2
// A and AA rules, plus heading order. At 320px it also checks for sideways scroll (A11Y-008),
// except on print and social frames, which are fixed sizes. Findings are grouped by A11Y rule;
// one repeated across pages, such as in the footer, is listed once.
// Usage: node tools/a11y.mjs [--report] [--json] [--all] [--origin <site url>] [--skip <folder>]... <built folder>
//   --skip    a folder of the build to leave out, such as reference (repeatable)
//   --origin  the site’s own address, such as https://growgoodgardens.com: requests to it are
//             answered from the built folder, so the check sees this build, not the live site.
// Fonts and unpkg load; analytics, reCAPTCHA and every other outside request are blocked.
// Uses the installed Chrome, else Playwright’s Chromium; with neither, it says so and stops.
// Writes a Markdown report to $GITHUB_STEP_SUMMARY when set. Exit 1 on a serious or critical
// finding, unless --report (every check warns until launch).

import { readFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { availableParallelism } from 'node:os';
import { fileFor, pagesIn, serve, launch, routeContext } from './lib/serve-build.mjs';

export { fileFor, pagesIn };

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
export const WIDTHS = [320, 1280];
const WCAG = new Set(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']);
const EXTRA = new Set(['heading-order', 'page-has-heading-one', 'empty-heading']);
// The logo and wordmark, whose text is exempt from contrast (WCAG 1.4.3).
const LOGO = '.logo, .gg-wordmark';

// axe rule → brand rule. Anything else is A11Y-001, WCAG 2.2 AA in general.
const RULES = {
  'A11Y-002': ['color-contrast', 'link-in-text-block'],
  'A11Y-003': ['image-alt', 'input-image-alt', 'role-img-alt', 'svg-img-alt', 'object-alt', 'area-alt', 'image-redundant-alt'],
  'A11Y-004': ['link-name', 'button-name', 'input-button-name', 'label', 'select-name', 'aria-input-field-name', 'aria-toggle-field-name', 'aria-command-name', 'frame-title', 'form-field-multiple-labels', 'label-title-only', 'summary-name', 'aria-tooltip-name', 'aria-progressbar-name', 'aria-meter-name'],
  'A11Y-005': ['html-has-lang', 'html-lang-valid', 'valid-lang', 'document-title', 'heading-order', 'page-has-heading-one', 'empty-heading'],
  'A11Y-006': ['target-size'],
};
const BRAND_RULE = Object.fromEntries(Object.entries(RULES).flatMap(([id, list]) => list.map((r) => [r, id])));
export const brandRule = (axeId) => BRAND_RULE[axeId] || (axeId === 'reflow' ? 'A11Y-008' : 'A11Y-001');
const levelOf = (impact) => (impact === 'serious' || impact === 'critical' ? 'error' : 'warn');

// Runs in the page at 320px: how far the page scrolls sideways, and the widest elements.
const REFLOW = () => {
  if (document.querySelector('.gg-format, .gg-social')) return null; // fixed-size print and social frames
  const over = document.documentElement.scrollWidth - window.innerWidth;
  if (over <= 1) return null;
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join('')}`;
  const wide = [...document.body.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getBoundingClientRect().width > 0);
  const outer = wide.filter((el) => !wide.includes(el.parentElement)).slice(0, 3).map(name);
  return { over, outer };
};

export async function checkPages(root, { origin = '', widths = WIDTHS, pages = null, skip = [], concurrency = Math.min(4, Math.max(1, availableParallelism() - 1)) } = {}) {
  const dir = resolve(root);
  const list = pages || pagesIn(dir, skip);
  const browser = await launch();
  if (!browser) return { skipped: 'no Chrome or Chromium found', pages: list.length, findings: [] };
  const server = await serve(dir);
  const local = `http://127.0.0.1:${server.address().port}`;
  const findings = [];
  const blocked = new Set();
  const checkPage = async (page, path, width) => {
    const started = Date.now();
    try {
      await page.goto(`${local}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Fonts and images get a few seconds more; axe reads computed styles, not loaded fonts.
      await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
    } catch (e) {
      findings.push({ axe: 'page-load', rule: 'A11Y-001', impact: 'serious', level: 'error', help: `the page did not load: ${e.message.split('\n')[0]}`, page: path, width, target: 'html', html: '' });
      return;
    }
    await page.addScriptTag({ content: AXE });
    // Only the rules this check reports: WCAG 2.2 A and AA, and heading order. Rules axe marks
    // experimental stay off, as they are in axe by default.
    const violations = await page.evaluate(async ({ wcag, extra, exempt }) => {
      const ids = window.axe.getRules().filter((r) => !r.tags.includes('experimental') && (r.tags.some((t) => wcag.includes(t)) || extra.includes(r.ruleId))).map((r) => r.ruleId);
      const { violations: v } = await window.axe.run(document, { runOnly: { type: 'rule', values: ids }, resultTypes: ['violations'] });
      // Text in the logo has no contrast requirement (WCAG 1.4.3, A11Y-002).
      const inLogo = (n) => { try { return !!document.querySelector(n.target.join(' '))?.closest(exempt); } catch { return false; } };
      return v.map((x) => ({ id: x.id, impact: x.impact, help: x.help, tags: x.tags, nodes: x.nodes.filter((n) => x.id !== 'color-contrast' || !inLogo(n)).map((n) => ({ target: n.target.join(' '), html: n.html })) })).filter((x) => x.nodes.length);
    }, { wcag: [...WCAG], extra: [...EXTRA], exempt: LOGO });
    for (const v of violations) {
      for (const n of v.nodes) findings.push({ axe: v.id, rule: brandRule(v.id), impact: v.impact, level: levelOf(v.impact), help: v.help, page: path, width, target: n.target, html: n.html.slice(0, 160) });
    }
    if (width <= 320) {
      const reflow = await page.evaluate(REFLOW);
      if (reflow) findings.push({ axe: 'reflow', rule: 'A11Y-008', impact: 'serious', level: 'error', help: `the page scrolls ${reflow.over}px sideways at ${width}px`, page: path, width, target: reflow.outer.join(', ') || 'html', html: '' });
    }    if (process.env.A11Y_TIMING) console.error(`${((Date.now() - started) / 1000).toFixed(1)}s ${path} @${width}`);
  };
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await routeContext(context, { dir, local, origin, blocked });
      // Several pages at once: axe’s contrast rule is slow on long pages.
      const queue = [...list];
      const worker = async () => {
        const page = await context.newPage();
        for (let path = queue.shift(); path; path = queue.shift()) await checkPage(page, path, width);
        await page.close();
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  return { pages: list.length, widths, findings, blocked: [...blocked].sort() };
}

// Findings with the same axe rule and element fold into one, listing the pages and widths.
export function group(findings) {
  const out = new Map();
  for (const f of findings) {
    const key = `${f.axe}\u0000${f.target}`;
    const g = out.get(key) ?? out.set(key, { ...f, where: [] }).get(key);
    g.where.push(`${f.page} @${f.width}`);
  }
  return [...out.values()].sort((a, b) => a.rule.localeCompare(b.rule, 'en', { numeric: true }) || a.axe.localeCompare(b.axe));
}

const whereText = (g) => `${g.where[0]}${g.where.length > 1 ? ` and ${g.where.length - 1} more` : ''}`;

export function formatText(result, { all = false } = {}) {
  if (result.skipped) return `a11y: not checked: ${result.skipped}`;
  const groups = group(result.findings);
  const lines = [`a11y: ${result.pages} pages at ${result.widths.join('px and ')}px, ${result.findings.length} findings, ${groups.length} distinct`, ''];
  const byRule = new Map();
  for (const g of groups) (byRule.get(g.rule) ?? byRule.set(g.rule, []).get(g.rule)).push(g);
  for (const [rule, list] of byRule) {
    lines.push(`${rule}: ${list.length}`);
    for (const g of all ? list : list.slice(0, 6)) lines.push(`  ${g.axe} (${g.impact})  ${g.target}  ${whereText(g)}  ${g.help}`);
  }
  if (result.blocked?.length) lines.push('', `Blocked outside requests: ${result.blocked.join(', ')}`);
  return lines.join('\n');
}

export function formatSummary(result, title = 'Accessibility') {
  if (result.skipped) return `### ${title}\n\nNot checked: ${result.skipped}.\n`;
  const groups = group(result.findings);
  if (!groups.length) return `### ${title}\n\nNo findings on ${result.pages} pages at ${result.widths.join('px and ')}px.\n`;
  const rows = new Map();
  for (const g of groups) {
    const r = rows.get(g.axe) ?? rows.set(g.axe, { rule: g.rule, axe: g.axe, impact: g.impact, help: g.help, n: 0 }).get(g.axe);
    r.n += 1;
  }
  const table = [...rows.values()].map((r) => `| ${r.rule} | ${r.axe} | ${r.impact} | ${r.n} | ${r.help.replace(/\|/g, ' ')} |`).join('\n');
  const detail = [...rows.values()].map((r) => {
    const list = groups.filter((g) => g.axe === r.axe);
    return `<details><summary>${r.rule} ${r.axe}: ${list.length}</summary>\n\n${list.slice(0, 20).map((g) => `- \`${g.target.replace(/`/g, '')}\` ${whereText(g)}`).join('\n')}${list.length > 20 ? `\n- and ${list.length - 20} more` : ''}\n\n</details>`;
  }).join('\n');
  return `### ${title}\n\n${groups.length} distinct findings on ${result.pages} pages at ${result.widths.join('px and ')}px. Serious and critical are proposed to block at launch; every check warns until then (D-054).\n\n| Rule | axe | Impact | Distinct | What |\n|---|---|---|---|---|\n${table}\n\n${detail}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const valued = new Set(['--origin', '--skip']);
  const flags = new Set(args.filter((a) => a.startsWith('--') && !valued.has(a)));
  const valueOf = (i) => valued.has(args[i - 1]);
  const origin = args[args.indexOf('--origin') + 1] && args.includes('--origin') ? args[args.indexOf('--origin') + 1] : '';
  const skip = args.flatMap((a, i) => (args[i - 1] === '--skip' ? [a] : []));
  const targets = args.filter((a, i) => !a.startsWith('--') && !valueOf(i));
  if (targets.length !== 1) { console.error('Usage: node tools/a11y.mjs [--report] [--json] [--all] [--origin <site url>] <built folder>'); process.exit(2); }
  const result = await checkPages(targets[0], { origin, skip });
  console.log(flags.has('--json') ? JSON.stringify(group(result.findings), null, 2) : formatText(result, { all: flags.has('--all') }));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(result, process.env.A11Y_TITLE || 'Accessibility'));
  if (!flags.has('--report') && result.findings.some((f) => f.level === 'error')) process.exit(1);
}

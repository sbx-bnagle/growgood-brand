// The words a reader sees, from a copy file (D-054, checks/lint-copy.md). Markdown, HTML, YAML
// and plain text become segments: { text, line, kind, breaks }. `kind` is 'heading' for headings,
// titles, buttons and labels (sentence case applies), 'alt' for alt and other read-aloud
// attributes, and 'text' for the rest. `breaks` holds the offsets in `text` where a source line
// ended, so a match can be placed on its own line. Code, Liquid, tags, other attributes,
// scripts, styles, comments, URLs and paths are left out.

import MarkdownIt from 'markdown-it';
import { Parser } from 'htmlparser2';
import { parseDocument, isMap, isSeq, isScalar } from 'yaml';

const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

// Stands in for code left out of a sentence, so no rule reads across the gap.
export const CODE = '§';

// Remove a span but keep its newlines, so line numbers hold.
const keepLines = (s) => s.replace(/[^\n]/g, '');

// Liquid and kramdown markup out; their line breaks stay.
export function maskMarkup(src) {
  return src
    .replace(/{%-?\s*(comment|raw|highlight|capture)\b[\s\S]*?{%-?\s*end\1\s*-?%}/g, keepLines)
    .replace(/{{[\s\S]*?}}/g, (m) => CODE + keepLines(m)) // a value stands in the sentence
    .replace(/{%[\s\S]*?%}/g, keepLines)
    .replace(/<!--[\s\S]*?-->/g, keepLines)
    .replace(/\{::?[^}\n]*\}/g, '');
}

// Front matter: its line count, and the title and description as segments.
function frontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/);
  if (!m) return { body: src, segments: [] };
  const segments = yamlSegments(m[1], 2, { only: new Set(['title', 'description']) });
  return { body: keepLines(m[0]) + src.slice(m[0].length), segments };
}

// A segment builder that joins text across inline tags and records line breaks.
function builder(kind, line) {
  const seg = { kind, line, text: '', breaks: [] };
  return {
    seg,
    add(raw) {
      const parts = raw.split(/[ \t]*\r?\n[ \t]*/);
      parts.forEach((p, i) => {
        if (i > 0) { seg.breaks.push(seg.text.length); if (seg.text && !seg.text.endsWith(' ')) seg.text += ' '; }
        seg.text += p;
      });
    },
  };
}
const usable = (s) => s && /\p{L}/u.test(s.text);
const tidy = (s) => {
  const lead = s.text.length - s.text.trimStart().length;
  // Leading newlines move the start line, not the text.
  const leadBreaks = s.breaks.filter((b) => b <= lead).length;
  return { ...s, line: s.line + leadBreaks, text: s.text.trim(), breaks: s.breaks.filter((b) => b > lead).map((b) => b - lead) };
};

const SKIP = new Set(['script', 'style', 'code', 'pre', 'kbd', 'samp', 'svg', 'noscript', 'template', 'textarea', 'select', 'math']);
const HEADING = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'title', 'legend', 'label', 'summary', 'th', 'caption', 'figcaption']);
const BLOCK = new Set(['p', 'li', 'dd', 'dt', 'div', 'td', 'blockquote', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'form', 'ul', 'ol', 'dl', 'table', 'tr', 'tbody', 'thead', 'body', 'html', 'head', 'br', 'hr', 'option', 'address', 'figure', 'fieldset']);
const READ_ALOUD = ['alt', 'title', 'aria-label', 'placeholder'];

// Visible text from HTML. `startLine` is the line the HTML starts on.
export function htmlSegments(html, startLine = 1) {
  const out = [];
  const lineStarts = [0];
  for (let i = 0; i < html.length; i++) if (html[i] === '\n') lineStarts.push(i + 1);
  const lineAt = (idx) => {
    let lo = 0; let hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return startLine + lo;
  };
  let skipDepth = 0;
  let cur = null;
  const stack = [];
  const flush = () => { if (cur && usable(cur.seg)) out.push(tidy(cur.seg)); cur = null; };
  const parser = new Parser({
    onopentag(name, attrs) {
      const here = lineAt(parser.startIndex);
      if (skipDepth || SKIP.has(name)) { if (SKIP.has(name)) { if (!skipDepth && cur) cur.add(CODE); skipDepth++; } stack.push(name); return; }
      for (const a of READ_ALOUD) {
        if (attrs[a] && /\p{L}/u.test(attrs[a])) out.push({ kind: a === 'title' && name === 'abbr' ? 'text' : 'alt', line: here, text: attrs[a].trim(), breaks: [] });
      }
      if (name === 'meta' && /^description$/i.test(attrs.name || '') && attrs.content) out.push({ kind: 'text', line: here, text: attrs.content.trim(), breaks: [] });
      if (name === 'input' && /^(submit|button)$/i.test(attrs.type || '') && attrs.value) out.push({ kind: 'heading', line: here, text: attrs.value.trim(), breaks: [] });
      if (HEADING.has(name)) { flush(); cur = builder('heading', here); }
      else if (BLOCK.has(name)) flush();
      stack.push(name);
    },
    ontext(text) {
      if (skipDepth) return;
      if (!cur) { if (!text.trim()) return; cur = builder('text', lineAt(parser.startIndex)); }
      cur.add(text);
    },
    onclosetag(name) {
      const i = stack.lastIndexOf(name);
      if (i >= 0) stack.length = i;
      if (SKIP.has(name)) { skipDepth = Math.max(0, skipDepth - 1); return; }
      if (skipDepth) return;
      if (HEADING.has(name) || BLOCK.has(name)) flush();
    },
  }, { decodeEntities: true, lowerCaseTags: true, recognizeSelfClosing: true });
  parser.write(html);
  parser.end();
  flush();
  return out;
}

// Visible text from Markdown (after maskMarkup). Inline HTML is read for its attributes.
export function markdownSegments(src, startLine = 1) {
  const out = [];
  const tokens = md.parse(src, {});
  let headingNext = false;
  for (const t of tokens) {
    if (t.type === 'heading_open') { headingNext = true; continue; }
    if (t.type === 'html_block') { out.push(...htmlSegments(t.content, startLine + t.map[0])); continue; }
    if (t.type !== 'inline') continue;
    const line = startLine + (t.map ? t.map[0] : 0);
    const b = builder(headingNext ? 'heading' : 'text', line);
    headingNext = false;
    let lineOffset = 0;
    let inlineHtml = '';
    for (const c of t.children || []) {
      if (c.type === 'text') b.add(c.content);
      else if (c.type === 'code_inline') b.add(CODE);
      else if (c.type === 'softbreak' || c.type === 'hardbreak') { b.add('\n'); lineOffset++; }
      else if (c.type === 'image') {
        const alt = (c.children || []).map((x) => x.content).join('');
        if (/\p{L}/u.test(alt)) out.push({ kind: 'alt', line: line + lineOffset, text: alt.trim(), breaks: [] });
      } else if (c.type === 'html_inline') {
        inlineHtml += c.content;
        if (/^<(br|hr)\b/i.test(c.content)) b.add(' ');
      }
    }
    if (inlineHtml) out.push(...htmlSegments(inlineHtml, line).filter((s) => s.kind === 'alt'));
    if (usable(b.seg)) out.push(tidy(b.seg));
  }
  return out;
}

// Keys whose values are never prose, and keys whose values read as headings.
const NOT_PROSE = /^(id|ids|url|urls|href|link_url|src|image|img|icon|class|classes|slug|permalink|layout|path|file|files|dest|date|style|color|colour|type|variant|include|key|ref|rel|target|sitekey|token|email|phone|lat|lng|width|height|size|order|weight|status|owner|maintainer|version|lane|rule_prefix|applies_to|depends_on|decisions|last_reviewed|set|source|values|default|required|params|name_id)$/i;
const HEADING_KEY = /^(title|heading|headline|label|button|cta|name|link|subhead|subtitle)$/i;
const looksLikeValue = (s) => /^(https?:|mailto:|tel:|\/|#|\.\.?\/)/.test(s) || /^[\w.-]+\.(html?|md|markdown|ya?ml|png|jpe?g|gif|svg|webp|css|scss|js|mjs|json|pdf)$/i.test(s) || /^[\w-]+$/.test(s) && !/\s/.test(s) && /[_\d]|^[a-z]+(-[a-z]+)+$/.test(s);

// String values from YAML that read as prose. `only` limits the keys read.
export function yamlSegments(src, startLine = 1, { only } = {}) {
  const out = [];
  let doc;
  try { doc = parseDocument(src); } catch { return out; }
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
  const lineAt = (idx) => { let n = 0; while (n + 1 < lineStarts.length && lineStarts[n + 1] <= idx) n++; return startLine + n; };
  const visit = (node, key) => {
    if (!node) return;
    if (isMap(node)) { for (const p of node.items) visit(p.value, isScalar(p.key) ? String(p.key.value) : ''); return; }
    if (isSeq(node)) { for (const item of node.items) visit(item, key); return; }
    if (!isScalar(node) || typeof node.value !== 'string') return;
    if (only && !only.has(key)) return;
    if (!only && NOT_PROSE.test(key)) return;
    const value = maskMarkup(node.value).trim();
    if (!/\p{L}/u.test(value) || looksLikeValue(value)) return;
    if (!only && !HEADING_KEY.test(key) && !/\s/.test(value)) return;
    const kind = HEADING_KEY.test(key) ? 'heading' : 'text';
    // Folded and literal blocks start on the line after the key.
    const start = node.range ? lineAt(node.range[0]) : startLine;
    const block = node.type === 'BLOCK_FOLDED' || node.type === 'BLOCK_LITERAL';
    const b = builder(kind, block ? start + 1 : start);
    b.add(value);
    out.push(tidy(b.seg));
  };
  visit(doc.contents, '');
  return out;
}

// Segments for one file, by its extension.
export function copySegments(src, ext) {
  const e = ext.toLowerCase();
  if (e === '.yml' || e === '.yaml') return yamlSegments(src);
  const { body, segments } = frontMatter(src);
  const masked = maskMarkup(body);
  if (e === '.md' || e === '.markdown') return [...segments, ...markdownSegments(masked)];
  if (e === '.html' || e === '.htm') return [...segments, ...htmlSegments(masked)];
  return [...segments, ...masked.split('\n').map((text, i) => ({ kind: 'text', line: i + 1, text: text.trim(), breaks: [] })).filter(usable)];
}

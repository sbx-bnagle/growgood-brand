#!/usr/bin/env node
// Copy linter, v0. Checks customer-facing copy against brand/verbal rules.
// Usage: node tools/lint-copy.mjs [--report] <files or folders...>
// Rules come from brand/verbal/mechanics.md (MECH-*), voice.md (VOICE-*),
// names-and-dates.md (NAMES-*) and
// spelling.yml. Exit code 1 when a MECH rule fails, unless --report is given.
// v0 is line-based and heuristic. Phase 6 replaces it with a proper parser.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { parse } from 'yaml';

const args = process.argv.slice(2);
const report = args.includes('--report');
const targets = args.filter((a) => a !== '--report');
const here = new URL('..', import.meta.url).pathname;
const spelling = parse(readFileSync(join(here, 'brand/verbal/spelling.yml'), 'utf8'));

const SKIP_DIRS = new Set(['_site', 'node_modules', '.git', '.jekyll-cache', 'assets', '_sass', 'workers', 'admin', 'Z_OLD']);
const EXTS = new Set(['.md', '.markdown', '.html', '.yml', '.txt']);
const PROPER = new Set(['Grow', 'Good', 'Gardens', 'Chicago', 'Chicagoland', 'Midwest', 'Upper', 'Leah', 'Fagan', 'DIY', 'I', 'Instagram', 'Facebook', 'TikTok', 'YouTube', 'Pinterest', 'Google', 'FAQ', 'FAQs']);
const SMALL = new Set(['a', 'an', 'and', 'or', 'the', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', '&']);

const ENTITIES = { '&rsquo;': '’', '&lsquo;': '‘', '&rdquo;': '”', '&ldquo;': '“', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&amp;': '&', '&nbsp;': ' ', '&thinsp;': ' ', '&ensp;': ' ', '&copy;': '©' };
const decode = (s) => s.replace(/&[a-z]+;/g, (e) => ENTITIES[e] ?? e);

const rules = [
  ['MECH-001', 'error', 'em dash or double hyphen; use an en dash only for ranges', (t) => /—|(?<!-)--(?!-)|\w – \w|\w - \w/.test(t)],
  ['MECH-004', 'error', 'straight quote or apostrophe', (t) => /[A-Za-z]'[A-Za-z]|(^|\s)'\w|\w'(\s|[.,;:]|$)|"/.test(t)],
  ['MECH-006', 'error', 'space between number and unit or am/pm', (t) => /\b\d+(?:[.:]\d+)?\s(?:mm|cm|ft|sq ?ft|lbs?|oz|gal|am|pm)\b/i.test(t)],
  ['MECH-008', 'error', 'two spaces after a period', (t) => /\. {2,}\S/.test(t)],
  ['VOICE-003', 'warn', 'hedge', (t) => /you might (want to|consider)|some gardeners prefer|you may want to/i.test(t)],
  ['VOICE-005', 'warn', '‘don’t worry’', (t) => /don[’']t worry/i.test(t)],
  ['MECH-012', 'error', 'exclamation mark', (t) => /\w!(\s|$|<)/.test(t)],
  ['MECH-013', 'error', 'emoji', (t) => /(?![©®™])\p{Extended_Pictographic}/u.test(t)],
  ['NAMES-002', 'error', 'write ‘Upper Midwest’', (t) => [...t.matchAll(/\b[Uu]pper [Mm]idwest\b/g)].some(([m]) => m !== 'Upper Midwest')],
  ['NAMES-004', 'error', 'time format: ‘10:00am’, ‘noon’', (t) => /(?<![:\d])\d{1,2}(?:am|pm)\b|\b\d{1,2}(?::\d\d)?\s?[ap]\.m\.|\b12:00\s?pm\b/i.test(t)],
];

const headingCase = (h) => {
  const words = h.replace(/[^\p{L}\s&'’-]/gu, ' ').split(/\s+/).filter(Boolean);
  return words.slice(1).filter((w) => /^\p{Lu}\p{Ll}/u.test(w) && !PROPER.has(w) && !SMALL.has(w.toLowerCase()));
};

const spellingHits = (t) => {
  const hits = [];
  for (const { uk, us, except = [] } of spelling.stems) {
    for (const [word] of t.matchAll(new RegExp(`\\b${uk}\\w*`, 'gi'))) {
      if (!except.some((e) => word.toLowerCase().startsWith(e))) hits.push(['MECH-010', `UK spelling: ${word} → ${us}…`]);
    }
  }
  for (const { avoid, use } of spelling.word_choice) {
    if (new RegExp(`\\b${avoid}\\b`, 'i').test(t)) hits.push(['MECH-011', `word choice: ${avoid} → ${use}`]);
  }
  return hits;
};

const files = [];
const walk = (p) => {
  const s = statSync(p);
  if (s.isDirectory()) {
    for (const f of readdirSync(p)) if (!SKIP_DIRS.has(f) && !f.startsWith('.')) walk(join(p, f));
  } else if (EXTS.has(extname(p))) files.push(p);
};
targets.forEach(walk);

const findings = [];
const add = (rule, level, msg, file, line, text) => findings.push({ rule, level, msg, where: `${relative(process.cwd(), file)}:${line}`, text: text.trim().slice(0, 90) });

for (const file of files) {
  const isYml = extname(file) === '.yml';
  let skip = false;
  let frontMatter = 0;
  readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
    const n = i + 1;
    if (/^---\s*$/.test(raw) && frontMatter < 2 && (i === 0 || frontMatter === 1)) { frontMatter++; return; }
    if (/<(script|style)\b|{%-?\s*comment|<!--/.test(raw) && !/<\/(script|style)>|endcomment|-->/.test(raw)) { skip = true; return; }
    if (skip) { if (/<\/(script|style)>|endcomment|-->/.test(raw)) skip = false; return; }
    if (isYml && /^\s*#/.test(raw)) return;
    if (frontMatter === 1 && !/^title:/.test(raw)) return;

    if (frontMatter === 1) raw = raw.replace(/^title:\s*(["'])(.*)\1\s*$/, 'title: $2');
    const headingMatch = raw.match(/^#{1,6}\s+(.*)$/) ?? raw.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/) ?? (frontMatter === 1 ? raw.match(/^title:\s*(.*)$/) : null);
    let text = decode(raw)
      .replace(/<!--.*?-->/g, ' ').replace(/{%.*?%}|{{.*?}}/g, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s*[-*]\s+/, '').replace(/^#{1,6}\s+/, '');
    if (isYml) text = text.replace(/^\s*-?\s*\w+:\s*(>-?)?\s*/, '');
    if (!text.trim() || /^[\s_*-]+$/.test(text)) return;

    if (headingMatch) {
      const caps = headingCase(decode(headingMatch[1]).replace(/<[^>]+>/g, ''));
      if (caps.length) add('MECH-002', 'error', `title case (${caps.join(', ')})`, file, n, headingMatch[1]);
    }
    for (const [rule, level, msg, test] of rules) if (test(text)) add(rule, level, msg, file, n, text);
    for (const [rule, msg] of spellingHits(text)) add(rule, 'error', msg, file, n, text);
  });
}

const byRule = {};
for (const f of findings) (byRule[`${f.rule} ${f.msg.replace(/\s*\(.*\)|:.*/, '').trim()}`] ??= []).push(f);
console.log(`lint-copy v0: ${files.length} files, ${findings.length} findings\n`);
for (const [key, list] of Object.entries(byRule).sort()) {
  console.log(`${key}: ${list.length} (${list[0].level})`);
  for (const f of list.slice(0, 3)) console.log(`  ${f.where}  ${f.text}`);
}
const errors = findings.filter((f) => f.level === 'error').length;
if (errors && !report) process.exit(1);

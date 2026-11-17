#!/usr/bin/env node
// Copy linter, v1 (D-054, checks/lint-copy.md). Checks the words a reader sees against
// brand/verbal/mechanics.md (MECH), names-and-dates.md (NAMES), voice.md (VOICE) and spelling.yml.
// Reads visible text only (tools/lib/copy-text.mjs): no code, Liquid, tags or URLs. On the site,
// lint the built pages in _site; a finding repeated across pages is listed once with a count.
// Usage: node tools/lint-copy.mjs [--report] [--json] [--all] [--docs] <files or folders...>
//   --report  exit 0 even with error-level findings (every check warns until launch, D-054)
//   --json    print the findings as JSON
//   --all     list every finding, not the first five per rule
//   --docs    the files are documentation, not pieces: skip NAMES-001, which applies to a piece
// Writes a Markdown report to $GITHUB_STEP_SUMMARY when set. Exit 1 on an error-level finding.

import { readFileSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { join, extname, relative, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { copySegments } from './lib/copy-text.mjs';
import { buildRules, maskQuotes, firstMention } from './lib/copy-rules.mjs';

const here = new URL('..', import.meta.url).pathname;
const SKIP_DIRS = new Set(['_site', 'node_modules', '.git', '.jekyll-cache', '.sass-cache', 'vendor', 'assets', '_sass', 'workers', 'admin', 'Z_OLD', 'tokens', 'figma-plugin']);
const SKIP_FILES = new Set(['spelling.yml']); // the linter’s own word list
const EXTS = new Set(['.md', '.markdown', '.html', '.htm', '.yml', '.yaml', '.txt']);

let cachedRules;
const rules = () => (cachedRules ??= buildRules(parse(readFileSync(join(here, 'brand/verbal/spelling.yml'), 'utf8'))));

const lineOf = (seg, index) => seg.line + seg.breaks.filter((b) => b <= index).length;
const excerpt = (text, index, length) => {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 40);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
};

// Findings for one file’s source text.
export function lintSource(src, ext, file = '(text)', { docs = false } = {}) {
  const segments = copySegments(src, ext);
  const findings = [];
  for (const seg of segments) {
    const masked = maskQuotes(seg.text);
    for (const rule of rules()) {
      if (rule.kinds && !rule.kinds.includes(seg.kind)) continue;
      for (const hit of rule.test(rule.raw ? seg.text : masked)) {
        findings.push({ rule: rule.id, level: rule.level, msg: hit.note ? `${rule.msg} (${hit.note})` : rule.msg, file, line: lineOf(seg, hit.index), text: excerpt(seg.text, hit.index, hit.length) });
      }
    }
  }
  for (const hit of docs ? [] : firstMention(segments)) {
    findings.push({ rule: 'NAMES-001', level: 'error', msg: 'first mention is ‘Grow Good Gardens’', file, line: lineOf(hit.segment, hit.index), text: excerpt(hit.segment.text, hit.index, hit.length) });
  }
  return findings.sort((a, b) => a.line - b.line);
}

export function filesIn(paths) {
  const files = [];
  const walk = (p, top) => {
    const s = statSync(p);
    if (s.isDirectory()) {
      for (const f of readdirSync(p).sort()) if (!SKIP_DIRS.has(f) && !f.startsWith('.')) walk(join(p, f), false);
    } else if ((top || EXTS.has(extname(p))) && !SKIP_FILES.has(basename(p))) files.push(p);
  };
  for (const p of paths) walk(p, true);
  return files;
}

// Findings for files and folders, with repeats across files folded together.
export function lintPaths(paths, { cwd = process.cwd(), docs = false } = {}) {
  // A path outside the working folder is shown from its target, such as _site/about/index.html.
  const shown = (f) => {
    const r = relative(cwd, f);
    if (!r.startsWith('..')) return r;
    const top = paths.find((p) => f.startsWith(p)) || f;
    return join(basename(top), relative(top, f));
  };
  const files = filesIn(paths);
  const findings = files.flatMap((f) => lintSource(readFileSync(f, 'utf8'), extname(f), shown(f), { docs }));
  const groups = new Map();
  for (const f of findings) {
    const key = `${f.rule}\u0000${f.text}`;
    if (groups.has(key)) groups.get(key).also.push(`${f.file}:${f.line}`);
    else groups.set(key, { ...f, also: [] });
  }
  return { files: files.length, findings, distinct: [...groups.values()] };
}

const byRule = (list) => {
  const out = new Map();
  for (const f of [...list].sort((a, b) => a.rule.localeCompare(b.rule, 'en', { numeric: true }))) (out.get(f.rule) ?? out.set(f.rule, []).get(f.rule)).push(f);
  return out;
};
const where = (f) => `${f.file}:${f.line}${f.also.length ? ` and ${f.also.length} more` : ''}`;

export function formatText(result, { all = false } = {}) {
  const lines = [`lint-copy v1: ${result.files} files, ${result.findings.length} findings, ${result.distinct.length} distinct`, ''];
  for (const [rule, list] of byRule(result.distinct)) {
    lines.push(`${rule} ${list[0].msg.replace(/\s*\(.*\)$/, '')}: ${list.length} (${list[0].level})`);
    for (const f of all ? list : list.slice(0, 5)) lines.push(`  ${where(f)}  ${f.text}${/\(.*\)$/.test(f.msg) ? `  ${f.msg.match(/\((.*)\)$/)[1]}` : ''}`);
  }
  return lines.join('\n');
}

export function formatSummary(result, title = 'Copy') {
  const rows = [...byRule(result.distinct)].map(([rule, list]) => `| ${rule} | ${list[0].msg.replace(/\s*\(.*\)$/, '')} | ${list.length} | ${list[0].level} |`);
  if (!rows.length) return `### ${title}\n\nNo findings in ${result.files} files.\n`;
  const detail = [...byRule(result.distinct)].map(([rule, list]) => `<details><summary>${rule}: ${list.length}</summary>\n\n${list.slice(0, 25).map((f) => `- \`${where(f)}\` ${f.text.replace(/[<>|]/g, ' ')}`).join('\n')}${list.length > 25 ? `\n- and ${list.length - 25} more` : ''}\n\n</details>`).join('\n');
  return `### ${title}\n\n${result.distinct.length} distinct findings in ${result.files} files. Every check warns until launch (D-054).\n\n| Rule | What | Distinct | Level at launch |\n|---|---|---|---|\n${rows.join('\n')}\n\n${detail}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const targets = args.filter((a) => !a.startsWith('--'));
  if (!targets.length) { console.error('Usage: node tools/lint-copy.mjs [--report] [--json] [--all] [--docs] <files or folders...>'); process.exit(2); }
  const result = lintPaths(targets, { docs: flags.has('--docs') });
  console.log(flags.has('--json') ? JSON.stringify(result.distinct, null, 2) : formatText(result, { all: flags.has('--all') }));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(result, process.env.LINT_COPY_TITLE || 'Copy'));
  if (!flags.has('--report') && result.findings.some((f) => f.level === 'error')) process.exit(1);
}

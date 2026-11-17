#!/usr/bin/env node
// Style check (D-054, checks/stylelint.md): stylelint with the brand’s config on Sass and CSS,
// findings grouped by brand rule ID. Every check warns until launch, so CI passes --report.
// Usage: node tools/lint-styles.mjs [--report] [--json] [--all] <files or folders...>
// Writes a Markdown report to $GITHUB_STEP_SUMMARY when set. Exit 1 on a finding.

import { appendFileSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import stylelint from 'stylelint';

const here = fileURLToPath(new URL('..', import.meta.url));
const configFile = join(here, 'stylelint.config.mjs');

// Folders never read: built output, dependencies, and vendor files such as the icon font’s CSS.
const SKIP_DIRS = new Set(['node_modules', '_site', 'vendor', 'fonts', '.git', '.jekyll-cache', '.sass-cache']);

export function styleFiles(paths) {
  const files = [];
  const walk = (p, top) => {
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) if (!SKIP_DIRS.has(f) && !f.startsWith('.')) walk(join(p, f), false);
    } else if (top || /\.(scss|css)$/.test(p)) files.push(p);
  };
  for (const p of paths) walk(p, true);
  return files;
}

// Jekyll’s front matter on a Sass entry file is blanked, keeping its lines, so the file parses.
const withoutFrontMatter = (src) => src.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/, (m) => m.replace(/[^\n]/g, ''));

export async function lintStyles(paths, { cwd = process.cwd() } = {}) {
  const results = [];
  for (const file of styleFiles(paths)) {
    const { results: [r] } = await stylelint.lint({ code: withoutFrontMatter(readFileSync(file, 'utf8')), codeFilename: file, configFile, configBasedir: here });
    results.push(r);
  }
  const shown = (f) => {
    const r = relative(cwd, f);
    if (!r.startsWith('..')) return r;
    const top = paths.find((p) => f.startsWith(p)) || f;
    return join(basename(top), relative(top, f));
  };
  const findings = results.flatMap((r) => r.warnings.map((w) => {
    const id = (w.text.match(/^([A-Z]+-\d+) /) || [])[1] || (w.rule === 'CssSyntaxError' ? 'syntax' : w.rule);
    return { rule: id, stylelint: w.rule, file: shown(r.source), line: w.line, text: w.text.replace(/^[A-Z]+-\d+ /, '').replace(/ \([\w/-]+\)$/, '') };
  }));
  return { files: results.length, findings };
}

const byRule = (list) => {
  const out = new Map();
  for (const f of [...list].sort((a, b) => a.rule.localeCompare(b.rule, 'en', { numeric: true }) || a.file.localeCompare(b.file) || a.line - b.line)) (out.get(f.rule) ?? out.set(f.rule, []).get(f.rule)).push(f);
  return out;
};

export function formatText(result, { all = false } = {}) {
  const lines = [`lint-styles: ${result.files} files, ${result.findings.length} findings`, ''];
  for (const [rule, list] of byRule(result.findings)) {
    lines.push(`${rule}: ${list.length}`);
    for (const f of all ? list : list.slice(0, 8)) lines.push(`  ${f.file}:${f.line}  ${f.text}`);
  }
  return lines.join('\n');
}

export function formatSummary(result, title = 'Styles') {
  if (!result.findings.length) return `### ${title}\n\nNo findings in ${result.files} files.\n`;
  const groups = [...byRule(result.findings)];
  return `### ${title}\n\n${result.findings.length} findings in ${result.files} files. Every check warns until launch (D-054).\n\n| Rule | Findings |\n|---|---|\n${groups.map(([r, l]) => `| ${r} | ${l.length} |`).join('\n')}\n\n${groups.map(([r, l]) => `<details><summary>${r}: ${l.length}</summary>\n\n${l.slice(0, 25).map((f) => `- \`${f.file}:${f.line}\` ${f.text.replace(/[<>|]/g, ' ')}`).join('\n')}${l.length > 25 ? `\n- and ${l.length - 25} more` : ''}\n\n</details>`).join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const targets = args.filter((a) => !a.startsWith('--'));
  if (!targets.length) { console.error('Usage: node tools/lint-styles.mjs [--report] [--json] [--all] <files or folders...>'); process.exit(2); }
  const result = await lintStyles(targets);
  console.log(flags.has('--json') ? JSON.stringify(result.findings, null, 2) : formatText(result, { all: flags.has('--all') }));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatSummary(result, process.env.LINT_STYLES_TITLE || 'Styles'));
  if (!flags.has('--report') && result.findings.length) process.exit(1);
}

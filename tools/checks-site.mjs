#!/usr/bin/env node
// Every check that applies to the site, in one command, report only until launch (D-054, O-20).
// The site’s workflow checks out this repo at the theme release it pins and runs this, so a new
// check reaches the site with a theme release and no change to the site’s workflow.
//   copy    tools/lint-copy.mjs on the built pages in _site (build the site first)
//   styles  tools/lint-styles.mjs on the site’s own Sass and CSS, in _sass and assets
//   a11y    tools/a11y.mjs on the built pages, with the site’s url (from _config.yml) served
//           from _site, so it checks this build and not the live site
//   judge   tools/brand-judge.mjs on the content files a pull request changed, listed in
//           JUDGE_FILES (space-separated, relative to the site), when ANTHROPIC_API_KEY is set.
//           Report only: unmatched facts warn until claims.md is approved (D-054)
// Usage: node tools/checks-site.mjs [site folder, default .]
// Writes each check’s report to $GITHUB_STEP_SUMMARY when set. Always exits 0.

import { existsSync, appendFileSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { join, resolve } from 'node:path';
import { lintPaths, formatText as copyText, formatSummary as copySummary } from './lint-copy.mjs';
import { lintStyles, formatText as styleText, formatSummary as styleSummary } from './lint-styles.mjs';
import { checkPages, formatText as a11yText, formatSummary as a11ySummary } from './a11y.mjs';
import { judge, readDrafts, formatText as judgeText, formatSummary as judgeSummary } from './brand-judge.mjs';

const site = resolve(process.argv[2] || '.');
const summary = (md) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md); };

const built = join(site, '_site');
if (existsSync(built)) {
  const copy = lintPaths([built], { cwd: site });
  console.log(copyText(copy), '\n');
  summary(copySummary(copy, 'Copy on the built site'));
} else {
  console.log('No _site folder, so the copy was not checked: build the site first.\n');
  summary('### Copy on the built site\n\nNot checked: no `_site` folder.\n');
}

const styleDirs = ['_sass', 'assets'].map((d) => join(site, d)).filter(existsSync);
const styles = await lintStyles(styleDirs, { cwd: site });
console.log(styleText(styles));
summary(styleSummary(styles, 'The site’s own Sass (report only, D-054)'));

if (existsSync(built)) {
  const config = existsSync(join(site, '_config.yml')) ? parse(readFileSync(join(site, '_config.yml'), 'utf8')) || {} : {};
  const a11y = await checkPages(built, { origin: config.url || '' });
  console.log('\n' + a11yText(a11y));
  summary(a11ySummary(a11y, 'Accessibility of the built site'));
}

const changed = (process.env.JUDGE_FILES || '').split(/\s+/).filter((f) => /\.(md|markdown|html)$/.test(f)).map((f) => join(site, f)).filter(existsSync);
if (changed.length) {
  const verdict = await judge({ drafts: readDrafts(changed, site), site: true });
  console.log('\n' + judgeText(verdict));
  summary(judgeSummary(verdict, 'Brand judge on the changed pages (report only, D-054)'));
}

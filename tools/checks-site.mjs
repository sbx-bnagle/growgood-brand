#!/usr/bin/env node
// Every check that applies to the site, in one command, report only until launch (D-054, O-20).
// The site’s workflow checks out this repo at the theme release it pins and runs this, so a new
// check reaches the site with a theme release and no change to the site’s workflow.
//   copy    tools/lint-copy.mjs on the built pages in _site (build the site first)
//   styles  tools/lint-styles.mjs on the site’s own Sass and CSS, in _sass and assets
// Usage: node tools/checks-site.mjs [site folder, default .]
// Writes each check’s report to $GITHUB_STEP_SUMMARY when set. Always exits 0.

import { existsSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { lintPaths, formatText as copyText, formatSummary as copySummary } from './lint-copy.mjs';
import { lintStyles, formatText as styleText, formatSummary as styleSummary } from './lint-styles.mjs';

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

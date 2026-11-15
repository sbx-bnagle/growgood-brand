#!/usr/bin/env node
// Links this checkout's theme files into a local copy of the site, so the site can be viewed
// with the theme as it is on disk, before a release (D-040).
// Usage: node tools/link-site.mjs [site-path]            link (default ../growgood)
//        node tools/link-site.mjs [site-path] --unlink   remove the links
// The site's own files override the remote theme's, so the linked gg/ files win locally. The
// links are listed in the site's .git/info/exclude, so they are never committed. The script
// never replaces a real file or folder.

import { existsSync, lstatSync, readlinkSync, symlinkSync, unlinkSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';

const args = process.argv.slice(2);
const unlink = args.includes('--unlink');
const site = resolve(args.find((a) => !a.startsWith('--')) || '../growgood');
const theme = resolve('.');
if (!existsSync(join(site, '_config.yml'))) { console.error(`No Jekyll site at ${site}`); process.exit(1); }

const links = ['_includes/gg', '_sass/gg', 'assets/gg',
  ...readdirSync('_layouts').filter((f) => f.startsWith('gg-')).map((f) => `_layouts/${f}`)];

const ours = (target) => {
  try { return lstatSync(target).isSymbolicLink() && resolve(dirname(target), readlinkSync(target)).startsWith(theme); } catch { return false; }
};

let changed = 0;
for (const rel of links) {
  const target = join(site, rel);
  const source = join(theme, rel);
  if (unlink) {
    if (ours(target)) { unlinkSync(target); changed++; }
    continue;
  }
  if (ours(target)) continue;
  if (existsSync(target) || (() => { try { lstatSync(target); return true; } catch { return false; } })()) {
    console.error(`Not linking ${rel}: the site already has a file or folder there.`);
    process.exit(1);
  }
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(relative(dirname(target), source), target);
  changed++;
}

const exclude = join(site, '.git', 'info', 'exclude');
if (!unlink && existsSync(dirname(exclude))) {
  const current = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
  const missing = links.map((l) => `/${l}`).filter((l) => !current.split('\n').includes(l));
  if (missing.length) writeFileSync(exclude, current + (current.endsWith('\n') || !current ? '' : '\n') + '# growgood-brand theme, linked for local preview (tools/link-site.mjs)\n' + missing.join('\n') + '\n');
}

console.log(unlink
  ? `Removed ${changed} links from ${site}. The site now uses the released theme.`
  : `Linked ${links.length} theme paths into ${site}${changed ? '' : ' (already linked)'}. Run: cd ${relative('.', site)} && bundle exec jekyll serve --livereload`);

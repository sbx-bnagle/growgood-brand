#!/usr/bin/env node
// Checks the asset library against its manifest (D-053, IMG-001, IMG-002). Every listed asset is
// approved with known rights and alt text, its file is there at the size listed and within web
// size, and no file sits in assets/library without a row. Usage: node tools/check-assets.mjs
// Exits 1 on any failure. No manifest yet counts as an empty library.

import { readFileSync, readdirSync, existsSync, appendFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { TYPES, SEASONS, RIGHTS, LIBRARY, MANIFEST, imageSize, sizeProblem } from './lib/assets.mjs';

export function checkLibrary(root = '.') {
  const results = [];
  const pass = (rule, what) => results.push({ ok: true, rule, what });
  const fail = (rule, what) => results.push({ ok: false, rule, what });
  const manifestPath = join(root, MANIFEST);
  const manifest = existsSync(manifestPath) ? parse(readFileSync(manifestPath, 'utf8')) || {} : {};
  const items = manifest.items || [];
  const dir = join(root, LIBRARY);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : [];

  const seen = new Set();
  for (const item of items) {
    const label = item.id || '(no id)';
    const file = String(item.url || '').replace(`/${LIBRARY}/`, '');
    const errors = [];
    if (!/^A-\d{4}$/.test(item.id || '')) errors.push('id is not A-0000');
    if (seen.has(item.id)) errors.push('id is listed twice');
    seen.add(item.id);
    if (!TYPES.includes(item.type)) errors.push(`type ${item.type} is not one of ${TYPES.join(', ')}`);
    if (!SEASONS.includes(item.season)) errors.push(`season ${item.season} is not one of ${SEASONS.join(', ')}`);
    if (!RIGHTS.includes(item.rights)) errors.push(`rights ${item.rights} is not known`);
    if (item.type === 'logo' && !item.style) errors.push('a logo needs a style, its wordmark variant (D-037)');
    errors.length ? fail('D-053', `${label}: ${errors.join('; ')}`) : pass('D-053', `${label} is approved with known rights`);
    item.alt ? pass('IMG-002', `${label} has alt text`) : fail('IMG-002', `${label} has no alt text`);

    const path = join(dir, file);
    if (!file || !files.includes(file)) { fail('IMG-001', `${label}: its file ${file || '(none)'} is not in ${LIBRARY}/`); continue; }
    const buf = readFileSync(path);
    const size = imageSize(buf);
    const problem = sizeProblem(size, statSync(path).size);
    if (problem) fail('D-053', `${label}: ${problem}`);
    else if (size.width !== item.width || size.height !== item.height) fail('D-053', `${label}: listed as ${item.width}×${item.height}px, the file is ${size.width}×${size.height}px`);
    else pass('D-053', `${label}: the file matches its listing`);
  }
  const listed = new Set(items.map((i) => String(i.url || '').replace(`/${LIBRARY}/`, '')));
  for (const f of files) {
    listed.has(f) ? null : fail('IMG-001', `${LIBRARY}/${f} has no row in ${MANIFEST}`);
  }
  const logos = (manifest.logos || []).map((l) => l.id).sort().join(',');
  const expected = items.filter((i) => i.type === 'logo').map((i) => i.id).sort().join(',');
  logos === expected ? pass('D-037', 'the logo list matches the logo rows') : fail('D-037', 'the logo list does not match the logo rows; sync again');
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = checkLibrary('.');
  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? 'pass' : 'FAIL'}  ${r.rule.padEnd(8)} ${r.what}`);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Asset library\n\n${failed.length ? failed.map((r) => `- **${r.rule}** ${r.what}`).join('\n') : `All ${results.length} checks passed.`}\n`);
  }
  process.exit(failed.length ? 1 : 0);
}

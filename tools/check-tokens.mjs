#!/usr/bin/env node
// Checks tokens/*.json against the rules they carry out. Each failure names its rule.
// Usage: node tools/check-tokens.mjs [tokens-dir]
// Exit code 1 on any failure. Writes a Markdown report to $GITHUB_STEP_SUMMARY when set.

import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOKEN_FILES, flatten, resolveAll } from './lib/tokens.mjs';
import { ratio, luminance } from './lib/color.mjs';

const dir = process.argv[2] ?? 'tokens';
const results = [];
const pass = (rule, what) => results.push({ ok: true, rule, what });
const fail = (rule, what) => results.push({ ok: false, rule, what });
const px = (v) => (typeof v === 'object' ? v.value : Number(v));

// ---- structure ----------------------------------------------------------------------------
const TYPES = new Set(['color', 'dimension', 'number', 'fontFamily', 'fontWeight']);
let tokens = [];
for (const f of TOKEN_FILES) {
  let doc;
  const text = readFileSync(join(dir, f), 'utf8');
  try { doc = JSON.parse(text); } catch (e) { fail('STRUCTURE', `${f} does not parse: ${e.message}`); continue; }
  // The Figma plugin writes files in this exact layout; anything else turns its pull requests into whole-file diffs.
  if (text !== JSON.stringify(doc, null, 2) + '\n') fail('STRUCTURE', `${f} is not in the plugin's layout (2-space JSON, one trailing newline)`);
  const flat = flatten(doc);
  for (const t of flat) if (!TYPES.has(t.type)) fail('STRUCTURE', `${t.path} has type ${t.type ?? 'none'}`);
  tokens = tokens.concat(flat);
}
let resolved;
try {
  resolved = resolveAll(tokens);
  pass('STRUCTURE', `${tokens.length} tokens parse, every reference resolves`);
} catch (e) {
  fail('STRUCTURE', e.message);
  report();
}
const get = (path) => resolved.get(path);
for (const t of tokens) {
  const v = get(t.path);
  if (t.type === 'color' && !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v)) fail('STRUCTURE', `${t.path} is not a hex color: ${v}`);
  if (t.type === 'dimension' && !(typeof v === 'object' && typeof v.value === 'number' && ['px', 'rem'].includes(v.unit))) fail('STRUCTURE', `${t.path} is not a {value, unit} dimension`);
}

// ---- color: D-021 -------------------------------------------------------------------------
const families = [...new Set(tokens.filter((t) => t.path.startsWith('color.')).map((t) => t.path.split('.')[1]))];
let worst = { r: Infinity };
for (const f of families) for (const g of families) for (const lv of ['300', '400']) {
  const r = ratio(get(`color.${f}.100`), get(`color.${g}.${lv}`));
  if (r < worst.r) worst = { r, pair: `${f}-100 on ${g}-${lv}` };
  if (r < 4.5) fail('D-021', `${f}-100 on ${g}-${lv} is ${r.toFixed(2)}:1, needs 4.5:1`);
}
if (worst.r >= 4.5) pass('D-021', `every 100 reaches 4.5:1 on every 300 and 400 (lowest ${worst.r.toFixed(2)}:1, ${worst.pair})`);
for (const f of families) {
  const y = ['100', '200', '300', '400'].map((l) => luminance(get(`color.${f}.${l}`)));
  if (y[0] > y[1] && y[1] > y[2] && y[2] > y[3]) pass('D-021', `${f} runs light to dark`);
  else fail('D-021', `${f} is out of light-to-dark order`);
}

// ---- color roles: O-16 (proposed) ---------------------------------------------------------
const PAIRS = [
  ['role.text.default', 'role.surface.default', 4.5], ['role.text.default', 'role.surface.tint', 4.5],
  ['role.text.muted', 'role.surface.default', 4.5], ['role.text.muted', 'role.surface.tint', 4.5],
  ['role.text.link', 'role.surface.default', 4.5], ['role.text.link', 'role.surface.tint', 4.5],
  ['role.text.inverse', 'role.surface.inverse', 4.5],
  ['role.action.on-default', 'role.action.default', 4.5], ['role.action.on-bright', 'role.action.bright', 4.5],
  ['role.action.bright', 'role.surface.inverse', 3], ['role.action.default', 'role.surface.default', 3],
  ['role.text.inverse', 'role.accent.green', 4.5], ['role.text.inverse', 'role.accent.red', 4.5],
  ['role.text.inverse', 'role.accent.gold', 4.5], ['role.text.inverse', 'role.accent.purple', 4.5],
];
for (const [fg, bg, min] of PAIRS) {
  const r = ratio(get(fg), get(bg));
  const what = `${fg.slice(5)} on ${bg.slice(5)}: ${r.toFixed(2)}:1 (needs ${min})`;
  r >= min ? pass('O-16', what) : fail('O-16', what);
}

// ---- type: TYPE-003, TYPE-004, order ------------------------------------------------------
const ROLES = ['display', 'h1', 'lead', 'h2', 'h3', 'h4', 'body', 'small', 'caption'];
const ORDER = ['display', 'h1', 'h2', 'h3', 'h4', 'body', 'small', 'caption'];
for (const set of ['narrow', 'wide']) {
  const bad = ROLES.filter((r) => px(get(`type.${r}.${set}.line`)) % 4 !== 0);
  bad.length ? fail('TYPE-003', `${set}: line heights not on 4px: ${bad.join(', ')}`) : pass('TYPE-003', `${set}: every line height is a multiple of 4px`);
  const same = px(get(`type.lead.${set}.size`)) === px(get(`type.h1.${set}.size`)) && px(get(`type.lead.${set}.line`)) === px(get(`type.h1.${set}.line`));
  same ? pass('TYPE-004', `${set}: lead matches heading 1`) : fail('TYPE-004', `${set}: lead does not match heading 1`);
  const sizes = ORDER.map((r) => px(get(`type.${r}.${set}.size`)));
  const strict = sizes.slice(0, 4).every((s, i, a) => i === 0 || s < a[i - 1]);
  const descending = sizes.every((s, i, a) => i === 0 || s <= a[i - 1]);
  strict && descending ? pass('TYPE-ORDER', `${set}: sizes step down from display to caption`) : fail('TYPE-ORDER', `${set}: sizes out of order: ${sizes.join(', ')}`);
  const tight = ROLES.filter((r) => px(get(`type.${r}.${set}.line`)) / px(get(`type.${r}.${set}.size`)) < 0.9);
  tight.length ? fail('TYPE-LEADING', `${set}: line height under 0.9 of size: ${tight.join(', ')}`) : pass('TYPE-LEADING', `${set}: no line height under 0.9 of its size`);
}
const offGrid = tokens.filter((t) => t.path.startsWith('space.') && px(get(t.path)) % 4 !== 0).map((t) => t.path);
offGrid.length ? fail('TYPE-003', `spacing off the 4px grid: ${offGrid.join(', ')}`) : pass('TYPE-003', 'every space token is a multiple of 4px');

report();

function report() {
  const failed = results.filter((r) => !r.ok);
  const lines = results.map((r) => `${r.ok ? 'pass' : 'FAIL'}  ${r.rule.padEnd(12)} ${r.what}`);
  console.log(lines.join('\n'));
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = ['## Token checks', '', `${results.length - failed.length} passed, ${failed.length} failed`, '', '| | Rule | Check |', '|---|---|---|',
      ...results.map((r) => `| ${r.ok ? '✓' : '✗'} | ${r.rule} | ${r.what} |`), ''].join('\n');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }
  process.exit(failed.length ? 1 : 0);
}

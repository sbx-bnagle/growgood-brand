#!/usr/bin/env node
// WCAG 2.x contrast matrix for the token palette.
// Usage: node tools/contrast.mjs [tokens-file]
// Prints a Markdown table: each palette color as text on each background.
// Grades: AAA >= 7, AA >= 4.5, LG (large text and UI parts only) >= 3, fail < 3.

import { readFileSync } from 'node:fs';
import { ratio } from './lib/color.mjs';

const file = process.argv[2] ?? 'tokens/seed/from-sass.json';
const { color } = JSON.parse(readFileSync(file, 'utf8'));

const palette = [];
for (const [family, variants] of Object.entries(color)) {
  if (family.startsWith('$')) continue;
  for (const [variant, token] of Object.entries(variants)) palette.push([`${family}.${variant}`, token.$value]);
}
const backgrounds = ['neutral.X', 'green.X', 'neutral.XXX', 'green.XXX'].map((n) => [n, palette.find(([k]) => k === n)[1]]);
backgrounds.push(['white', '#ffffff']);

const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'LG' : 'fail');

console.log(`| Text color | ${backgrounds.map(([n, h]) => `on ${n} ${h}`).join(' | ')} |`);
console.log(`|---|${backgrounds.map(() => '---').join('|')}|`);
for (const [name, hex] of palette) {
  const cells = backgrounds.map(([bn, bh]) => (bn === name ? '–' : `${ratio(hex, bh).toFixed(2)} ${grade(ratio(hex, bh))}`));
  console.log(`| ${name} ${hex} | ${cells.join(' | ')} |`);
}

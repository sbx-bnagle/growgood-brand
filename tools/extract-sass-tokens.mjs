#!/usr/bin/env node
// Reads the live site's Sass config and writes DTCG tokens.
// Usage: node tools/extract-sass-tokens.mjs [path-to-site-repo] [out-file]
// Defaults: ../growgood  tokens/seed/from-sass.json
//
// Used once to seed Figma (decision D-012). After seeding, Figma is the source
// of values and this script is kept only to re-check the site against Figma.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const site = process.argv[2] ?? join(process.cwd(), '..', 'growgood');
const out = process.argv[3] ?? join(process.cwd(), 'tokens', 'seed', 'from-sass.json');
const ROOT_PX = 16;
const warnings = [];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (p) => stripComments(readFileSync(join(site, p), 'utf8'));
const block = (src, name) => {
  const m = src.match(new RegExp(`\\$${name}\\s*:\\s*\\(([\\s\\S]*?)\\)\\s*;`));
  if (!m) throw new Error(`$${name} not found`);
  return m[1];
};
const px = (n) => ({ value: Math.round(n * 100) / 100, unit: 'px' });
const src = (file, path) => ({ 'com.growgood.source': `${file} ${path}` });

// ---- color -----------------------------------------------------------------
const colorFile = '_sass/config/_color.scss';
const colorSrc = read(colorFile);
const colorMap = colorSrc.match(/\$colors\s*:\s*\(([\s\S]*)\)\s*;/)[1];
const uses = countColorUses();
const color = { $type: 'color' };
for (const [, name, body] of colorMap.matchAll(/(\w+)\s*:\s*\(([^)]*)\)/g)) {
  color[name] = {};
  for (const [, variant, hex] of body.matchAll(/(\w+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    color[name][variant] = {
      $value: hex.toLowerCase(),
      $extensions: { ...src(colorFile, `$colors.${name}.${variant}`), 'com.growgood.uses': uses[`${name}.${variant}`] ?? 0 },
    };
  }
}

function countColorUses() {
  const counts = {};
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.scss')) {
        for (const [, n, v] of readFileSync(p, 'utf8').matchAll(/color\(\s*(\w+)\s*,\s*(X+)\s*\)/g)) {
          counts[`${n}.${v}`] = (counts[`${n}.${v}`] ?? 0) + 1;
        }
      }
    }
  };
  walk(join(site, '_sass'));
  walk(join(site, 'assets', 'css'));
  return counts;
}

// ---- type ------------------------------------------------------------------
const typeFile = '_sass/config/_type.scss';
const typeSrc = read(typeFile);
const baselineRem = parseFloat(typeSrc.match(/\$baseline-height\s*:\s*([\d.]+)/)[1]);
const baselinePx = baselineRem * ROOT_PX;

const families = {};
for (const [, name, stack] of typeSrc.matchAll(/\$(\w+)\s*:\s*\(\s*stack\s*:\s*#\{([^}]*)\}/g)) {
  families[name] = stack.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
}

const KNOWN_BP = new Set(['null', 's', 'm', 'l']);
const typeTokens = { size: { $type: 'dimension' }, line: { $type: 'dimension' } };
const typography = { $type: 'typography' };
for (const [, family, key, body] of typeSrc.matchAll(/\$(sans|icon)-([a-z0-9]+(?:-[a-z]+)?)\s*:\s*\(([\s\S]*?)\)\s*;/g)) {
  const rows = {};
  for (const [, bp, tuple] of body.matchAll(/(\w+)\s*:\s*\(([^)]*)\)/g)) {
    if (!KNOWN_BP.has(bp)) warnings.push(`$${family}-${key}: breakpoint key '${bp}' is not in $breakpoints (s, m, l)`);
    const [, , weight, sizeRem, lineBl, , letterRem] = tuple.split(',').map((s) => s.trim());
    rows[bp] = { weight: Number(weight), size: Number(sizeRem) * ROOT_PX, line: Number(lineBl) * baselinePx, letter: Number(letterRem) * ROOT_PX };
  }
  const base = rows.null;
  const wide = rows.m ?? rows.md ?? base;
  const same = (a, b) => a && b && a.size === b.size && a.line === b.line;
  if (!same(rows.s ?? rows.sm ?? base, base) || !same(rows.l ?? rows.lg ?? wide, wide)) {
    warnings.push(`$${family}-${key}: s differs from base or l differs from m; only base and m were kept`);
  }
  const [scale, weightName] = key.includes('-') ? key.split('-') : [key, null];
  const group = family === 'icon' ? `icon-${scale}` : scale;
  for (const [range, r] of [['base', base], ['wide', wide]]) {
    typeTokens.size[group] ??= {};
    typeTokens.line[group] ??= {};
    typeTokens.size[group][range] = { $value: px(r.size), $extensions: src(typeFile, `$${family}-${key}`) };
    typeTokens.line[group][range] = { $value: px(r.line), $extensions: src(typeFile, `$${family}-${key}`) };
    const name = weightName ? `${group}-${weightName === 'bld' ? 'bold' : 'regular'}` : group;
    typography[name] ??= {};
    typography[name][range] = {
      $value: {
        fontFamily: `{font.family.${family}}`,
        fontWeight: r.weight,
        fontSize: `{type.size.${group}.${range}}`,
        lineHeight: Math.round((r.line / r.size) * 1000) / 1000,
        letterSpacing: px(r.letter),
      },
      $extensions: { ...src(typeFile, `$${family}-${key}`), 'com.growgood.lineHeightPx': r.line },
    };
  }
}

// ---- space -----------------------------------------------------------------
const spaceFile = '_sass/config/_spacing.scss';
const space = { $type: 'dimension' };
for (const [, k, v] of block(read(spaceFile), 'spacing').matchAll(/(\w+)\s*:\s*([\d.]+)/g)) {
  space[k] = { $value: px(Number(v) * baselinePx), $extensions: { ...src(spaceFile, `$spacing.${k}`), 'com.growgood.baselines': Number(v) } };
}

// ---- layout ----------------------------------------------------------------
const layoutFile = '_sass/config/_layout.scss';
const layoutSrc = read(layoutFile);
const breakpoint = { $type: 'dimension' };
for (const [, k, v] of block(layoutSrc, 'breakpoints').matchAll(/(\w+)\s*:\s*([\d.]+)px/g)) {
  breakpoint[k] = { $value: px(Number(v)), $extensions: src(layoutFile, `$breakpoints.${k}`) };
}
const grid = {};
for (const [, name, body] of layoutSrc.matchAll(/\$(grid-[\w-]+)\s*:\s*\(([\s\S]*?)\)\s*;/g)) {
  const get = (k) => body.match(new RegExp(`${k}\\s*:\\s*([^,\\n]+)`))?.[1].trim();
  const width = get('width');
  const margin = width === '100%' ? 0 : Number(width.match(/(\d+)px\s*\*\s*2/)?.[1] ?? NaN);
  const key = name.replace('grid-', '');
  grid[key] = {
    columns: { $type: 'number', $value: Number(get('columns')) },
    gutter: { $type: 'dimension', $value: px(parseFloat(get('gutter-h'))) },
    margin: { $type: 'dimension', $value: px(margin) },
    maxWidth: { $type: 'dimension', $value: px(parseFloat(get('max-width'))) },
    $extensions: src(layoutFile, `$${name}`),
  };
}

// ---- write -----------------------------------------------------------------
const tokens = {
  $description: 'Seed values extracted from the growgood site Sass config. Generated by tools/extract-sass-tokens.mjs. Do not edit by hand.',
  color,
  font: {
    family: Object.fromEntries(Object.entries(families).map(([k, v]) => [k, { $type: 'fontFamily', $value: v, $extensions: src(typeFile, `$${k}.stack`) }])),
  },
  baseline: { $type: 'dimension', $value: px(baselinePx), $extensions: src(typeFile, '$baseline-height') },
  type: typeTokens,
  typography,
  space,
  breakpoint,
  grid,
};
writeFileSync(out, JSON.stringify(tokens, null, 2) + '\n');
console.log(`wrote ${relative(process.cwd(), out)}`);
console.log(`colors: ${Object.keys(color).length - 1} families, ${Object.values(color).filter((v) => typeof v === 'object').reduce((n, f) => n + Object.keys(f).length, 0)} values`);
console.log(`typography: ${Object.keys(typography).length - 1} styles x 2 ranges; space: ${Object.keys(space).length - 1}; breakpoints: ${Object.keys(breakpoint).length - 1}; grids: ${Object.keys(grid).length}`);
for (const w of warnings) console.log(`warning: ${w}`);

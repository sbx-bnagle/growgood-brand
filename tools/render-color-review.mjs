#!/usr/bin/env node
// Renders reference/color-ramps.html from tokens/seed/color-ramps.json.
// Usage: node tools/render-color-review.mjs [ramps] [out]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ratio, hexToOklch, atLuminance } from './lib/color.mjs';

const inFile = process.argv[2] ?? 'tokens/seed/color-ramps.json';
const outFile = process.argv[3] ?? 'reference/color-ramps.html';
const data = JSON.parse(readFileSync(inFile, 'utf8'));
const LEVELS = ['100', '200', '300', '400'];
const fams = Object.entries(data.color).filter(([k]) => !k.startsWith('$'));
const hex = (f, l) => data.color[f][l].$value;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const fmt = (r) => r.toFixed(2);
const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'Large only' : 'Fails');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Best text color for a swatch: the family's own 100 or 400, else neutral.
const textOn = (bg, f) => {
  const options = [hex(f, '100'), hex(f, '400'), hex('neutral', '100'), hex('neutral', '400')];
  return options.reduce((best, c) => (ratio(c, bg) > ratio(best, bg) ? c : best));
};

// Brighter options for purple-200, same hue.
const purple200 = data.color.purple['200'].$extensions;
const purpleWas = purple200['com.growgood.was']?.split(' ')[1] ?? hex('purple', '200');
const purpleChosen = purple200['com.growgood.status'] === 'chosen';
const p200 = hexToOklch(purpleWas);
const purpleOptions = [
  { label: 'Earlier', hex: purpleWas },
  { label: 'Option A', hex: atLuminance({ ...p200, C: 0.2 }, 0.28) },
  { label: 'Option B', hex: atLuminance({ ...p200, C: 0.2 }, 0.4) },
];

const statusText = { kept: 'Kept', adjusted: 'Adjusted', new: 'New', chosen: 'Chosen' };
const ramps = fams.map(([f, levels]) => `
  <section class="family" aria-labelledby="fam-${f}">
    <h3 id="fam-${f}">${cap(f)}</h3>
    <div class="swatches">
      ${LEVELS.map((l) => {
        const t = levels[l];
        const bg = t.$value;
        const fg = textOn(bg, f);
        const was = t.$extensions['com.growgood.was'];
        return `<figure class="swatch">
          <div class="chip" style="background:${bg};color:${fg}"><span class="lvl">${f}-${l}</span><span class="aa">Aa ${fmt(ratio(fg, bg))}</span></div>
          <figcaption>
            <span class="hex">${bg}</span>
            <span class="tag tag-${t.$extensions['com.growgood.status']}">${statusText[t.$extensions['com.growgood.status']]}</span>
            <span class="was">${was ? `was ${esc(was.split(' ')[0])}${['adjusted', 'chosen'].includes(t.$extensions['com.growgood.status']) ? ` ${was.split(' ')[1]}` : ''}` : 'no earlier value'}</span>
          </figcaption>
        </figure>`;
      }).join('')}
    </div>
  </section>`).join('');

const cols = fams.flatMap(([f]) => ['300', '400'].map((l) => [f, l]));
const checkRows = fams.map(([f]) => `<tr><th scope="row">${f}-100</th>${cols.map(([g, l]) => {
  const r = ratio(hex(f, '100'), hex(g, l));
  return `<td style="background:${hex(g, l)};color:${hex(f, '100')}"><span class="aa">Aa</span><span class="num">${fmt(r)}</span></td>`;
}).join('')}</tr>`).join('');
const minCheck = Math.min(...fams.flatMap(([f]) => cols.map(([g, l]) => ratio(hex(f, '100'), hex(g, l)))));

const services = [
  ['green', 'Community projects', 'Gardens for block clubs, schools and park districts.'],
  ['purple', 'Custom garden design', 'A planting plan for your space, conditions and taste.'],
  ['gold', 'Site assessment', 'Soil, light and drainage, measured on site.'],
  ['red', 'Contractor referrals', 'Contractors we trust for the work we don’t do.'],
];
const cards = services.map(([f, title, body]) => {
  const btnText = textOn(hex(f, '200'), f);
  return `<article class="card" style="background:${hex(f, '300')};color:${hex(f, '100')}">
    <h4>${title}</h4><p>${body}</p>
    <span class="btn" style="background:${hex(f, '200')};color:${btnText}">Learn more</span>
    <p class="meta">100 on 300: ${fmt(ratio(hex(f, '100'), hex(f, '300')))} · button text on 200: ${fmt(ratio(btnText, hex(f, '200')))}</p>
  </article>`;
}).join('');

const purpleRows = purpleOptions.map((o) => `<figure class="swatch">
  <div class="chip" style="background:${o.hex};color:${textOn(o.hex, 'purple')}"><span class="lvl">${o.label}</span><span class="aa">${o.hex}</span></div>
  <figcaption>
    ${purpleChosen && o.hex === hex('purple', '200') ? '<span class="tag tag-chosen">Chosen</span>' : ''}
    <span class="was">on purple-400: ${fmt(ratio(o.hex, hex('purple', '400')))} (${grade(ratio(o.hex, hex('purple', '400')))})</span>
    <span class="was">dark text on it: ${fmt(ratio(textOn(o.hex, 'purple'), o.hex))}</span>
  </figcaption>
</figure>`).join('');

const migration = Object.entries(data.$extensions['com.growgood.migration']).map(([old, neu]) => {
  const [f, l] = neu.split('-');
  const t = data.color[f][l];
  const was = t.$extensions['com.growgood.was'].split(' ')[1];
  return `<tr><td>${old}</td><td class="hex">${was}</td><td>${neu}</td><td class="hex">${t.$value}</td><td>${statusText[t.$extensions['com.growgood.status']]}</td></tr>`;
}).join('');

const html = `<title>Grow Good color ramps</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap">
<style>
/* Layout: one reading column of review sections; swatch rows wrap to two-up on phones. */
:root {
  --bg: ${hex('neutral', '100')}; --fg: ${hex('neutral', '400')}; --muted: ${hex('neutral', '300')};
  --rule: ${hex('neutral', '200')}; --link: ${hex('green', '300')}; --panel: #fbfaf7;
  --kept: ${hex('green', '300')}; --adjusted: ${hex('gold', '300')}; --new: ${hex('purple', '300')};
  --font: 'Alegreya Sans', 'Gill Sans', 'Trebuchet MS', sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: ${hex('neutral', '400')}; --fg: ${hex('neutral', '100')}; --muted: #b9b9b2; --rule: #3a3c38; --link: ${hex('green', '200')}; --panel: #232422;
  --kept: ${hex('green', '200')}; --adjusted: ${hex('gold', '200')}; --new: #b4abf0; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: ${hex('neutral', '400')}; --fg: ${hex('neutral', '100')}; --muted: #b9b9b2; --rule: #3a3c38; --link: ${hex('green', '200')}; --panel: #232422;
  --kept: ${hex('green', '200')}; --adjusted: ${hex('gold', '200')}; --new: #b4abf0; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--bg); color: var(--fg); font: 400 18px/1.45 var(--font); }
main { max-width: 1080px; margin: 0 auto; padding-block: 40px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 56px; }
h1, h2, h3, h4 { margin: 0; text-wrap: balance; }
h1 { font-size: 52px; line-height: 56px; font-weight: 800; }
h2 { font-size: 32px; line-height: 36px; font-weight: 700; }
h3 { font-size: 22px; line-height: 28px; font-weight: 700; }
p { margin: 0; max-width: 66ch; }
.intro { display: grid; gap: 12px; }
.lede { font-size: 22px; line-height: 30px; }
.muted, .meta, .was { color: var(--muted); }
section.block { display: grid; gap: 20px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 16px; }
.tag { display: inline-block; font-size: 14px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 1px 8px; border-radius: 999px; border: 1.5px solid currentColor; }
.tag-kept { color: var(--kept) } .tag-adjusted { color: var(--adjusted) } .tag-new { color: var(--new) } .tag-chosen { color: var(--link) }
.family { display: grid; gap: 10px; }
.swatches { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.swatch { margin: 0; display: grid; gap: 8px; min-width: 0; }
.chip { aspect-ratio: 4 / 3; max-width: 100%; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .08); }
.lvl { font-weight: 700; font-size: 18px; }
.aa { font-size: 16px; font-variant-numeric: tabular-nums; }
figcaption { display: grid; gap: 4px; font-size: 15px; line-height: 20px; justify-items: start; }
.hex { font-variant-numeric: tabular-nums; font-weight: 500; letter-spacing: .02em; }
.scroll { overflow-x: auto; border: 1px solid var(--rule); border-radius: 6px; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 10px; text-align: left; font-size: 15px; }
thead th { font-weight: 700; border-bottom: 1px solid var(--rule); white-space: nowrap; }
.check td { text-align: center; min-width: 64px; }
.check td .aa { display: block; font-size: 20px; font-weight: 700; }
.check td .num { font-size: 13px; }
.check th[scope="row"] { white-space: nowrap; font-weight: 700; }
.migrate tbody tr + tr td { border-top: 1px solid var(--rule); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.card { border-radius: 8px; padding: 20px; display: grid; gap: 10px; align-content: start; }
.card h4 { font-size: 24px; line-height: 28px; }
.card .meta { color: inherit; opacity: .85; font-size: 14px; }
.btn { justify-self: start; font-weight: 700; padding: 6px 14px; border-radius: 999px; }
.ask { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 20px; display: grid; gap: 14px; }
.ask .swatches { grid-template-columns: repeat(3, minmax(0, 1fr)); }
a { color: var(--link); }
@media (max-width: 640px) {
  h1 { font-size: 40px; line-height: 44px; }
  .swatches { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ask .swatches { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>

<main>
  <header class="intro">
    <p class="muted">Grow Good Gardens · decision D-021 · proposed values</p>
    <h1>Color ramps</h1>
    <p class="lede">Four levels per family. 100 is the lightest, 200 a bright accent of the hue, 300 and 400 dark. Every 100 reaches 4.5:1 on every family’s 300 and 400, so light text works on any dark surface.</p>
    <div class="legend"><span><span class="tag tag-kept">Kept</span> existing value, unchanged</span><span><span class="tag tag-adjusted">Adjusted</span> existing hue, lightness moved</span><span><span class="tag tag-new">New</span> made from the family hue</span><span><span class="tag tag-chosen">Chosen</span> picked after review</span></div>
  </header>

  <section class="block" aria-labelledby="ramps">
    <h2 id="ramps">Ramps</h2>
    ${ramps}
  </section>

  <section class="ask" aria-labelledby="purple">
    <h2 id="purple">${purpleChosen ? 'Purple-200: option A' : 'Purple-200 is a mid-tone'}</h2>
    <p>${purpleChosen
      ? `The earlier purple, ${purpleWas}, read as a mid-tone and reached ${fmt(ratio(purpleWas, hex('purple', '400')))}:1 on purple-400. Option A, ${hex('purple', '200')}, keeps the hue and reaches ${fmt(ratio(hex('purple', '200'), hex('purple', '400')))}:1. Chosen by Brad Nagle, 2026-11-13.`
      : `Every other 200 reads as a bright accent. The current purple sits closer to a 300 and reaches only ${fmt(ratio(hex('purple', '200'), hex('purple', '400')))}:1 on purple-400. Two brighter options keep the hue.`}</p>
    <div class="swatches">${purpleRows}</div>
  </section>

  <section class="block" aria-labelledby="check">
    <h2 id="check">The rule, checked</h2>
    <p>Each row is a 100 set as text on each family’s 300 and 400. Lowest ratio: ${fmt(minCheck)}:1.</p>
    <div class="scroll"><table class="check">
      <thead><tr><th>Text</th>${cols.map(([g, l]) => `<th scope="col">${g}-${l}</th>`).join('')}</tr></thead>
      <tbody>${checkRows}</tbody>
    </table></div>
  </section>

  <section class="block" aria-labelledby="use">
    <h2 id="use">In use</h2>
    <p>The service cards with 300 surfaces and 100 text, which fixes the red and gold cards that failed in the audit. Buttons use the 200 accent.</p>
    <div class="cards">${cards}</div>
  </section>

  <section class="block" aria-labelledby="migrate">
    <h2 id="migrate">From the current Sass</h2>
    <p>Where each current token lands. The site keeps its current values until the theme is adopted in Phase 4.</p>
    <div class="scroll"><table class="migrate">
      <thead><tr><th>Current</th><th>Value</th><th>New name</th><th>New value</th><th>Change</th></tr></thead>
      <tbody>${migration}</tbody>
    </table></div>
  </section>

  <p class="muted">Generated by tools/build-ramps.mjs and tools/render-color-review.mjs from the site’s Sass config. Not yet in Figma.</p>
</main>
`;
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html);
console.log(`wrote ${outFile} (${html.length} bytes); purple options ${purpleOptions.map((o) => o.hex).join(' ')}`);

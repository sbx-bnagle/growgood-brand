// Copy linter v1 (D-054, checks/lint-copy.md): what it reads, what it leaves out, and its rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copySegments } from '../tools/lib/copy-text.mjs';
import { headingCaps, maskQuotes } from '../tools/lib/copy-rules.mjs';
import { lintSource, lintPaths } from '../tools/lint-copy.mjs';

const rulesIn = (findings) => findings.map((f) => f.rule);
const texts = (segs) => segs.map((s) => s.text);

test('Markdown: reads text, headings, link text, alt and front matter titles; leaves out code and Liquid', () => {
  const src = [
    '---',
    'layout: page',
    'title: About the garden',
    'permalink: /about/',
    '---',
    '# Plant in fall',
    '',
    'Run `npm test` and {{ site.title }} then [read more](/x/).',
    '{% include gg/cta.html heading="Not Read" %}',
    '![A bee on a coneflower](/bee.gif)',
    '',
    '```',
    'const colour = "x";',
    '```',
  ].join('\n');
  const segs = copySegments(src, '.md');
  assert.deepEqual(texts(segs), ['About the garden', 'Plant in fall', 'Run § and § then read more.', 'A bee on a coneflower']);
  assert.deepEqual(segs.map((s) => [s.kind, s.line]), [['heading', 3], ['heading', 6], ['text', 8], ['alt', 10]]);
});

test('Markdown: a match on the second line of a paragraph reports that line', () => {
  const f = lintSource('First line is fine.\nThe colour is wrong.\n', '.md', 'x.md', { docs: true });
  assert.deepEqual(f.map((x) => [x.rule, x.line]), [['MECH-010', 2]]);
});

test('HTML: reads text and read-aloud attributes; leaves out scripts, styles, classes and URLs', () => {
  const html = `<html><head><title>Services | Grow Good Gardens</title>
<meta name="description" content="Garden design in Chicago">
<style>.x { color: red; }</style><script>var s = "Don't";</script></head>
<body><h2 class="Title Case">Get <em>your</em> garden plan</h2>
<p>We plant &rsquo;em in fall.<br>
Call us.</p>
<img src="/a.gif" alt="Hand-drawn bee" class="Not Read">
<a href="/x/" aria-label="Grow Good on Instagram"></a>
<button>Sign Up</button></body></html>`;
  const segs = copySegments(html, '.html');
  assert.deepEqual(texts(segs), ['Services | Grow Good Gardens', 'Garden design in Chicago', 'Get your garden plan', 'We plant ’em in fall.', 'Call us.', 'Hand-drawn bee', 'Grow Good on Instagram', 'Sign Up']);
  assert.equal(segs.find((s) => s.text === 'Call us.').line, 6);
  assert.deepEqual(rulesIn(lintSource(html, '.html')), ['MECH-002']);
});

test('YAML: reads prose values and heading keys; leaves out ids, URLs, colors and paths', () => {
  const yml = [
    '- id: custom',
    '  title: Custom Garden Design',
    '  dest: custom',
    '  color: purple',
    '  url: https://example.com/a b',
    '  image: /assets/a.png',
    '  blurb: >-',
    '    We design gardens for your',
    '    space and your colour.',
  ].join('\n');
  const segs = copySegments(yml, '.yml');
  assert.deepEqual(texts(segs), ['Custom Garden Design', 'We design gardens for your space and your colour.']);
  assert.deepEqual(rulesIn(lintSource(yml, '.yml')), ['MECH-002', 'MECH-002', 'MECH-010']);
});

test('quoted examples are left to the quote rules', () => {
  assert.equal(maskQuotes('write ‘colour’, not colour'), 'write ‘……………’, not colour'.replace('……………', '…'.repeat(6)));
  const q = '‘Don’t worry, you’ve got this’';
  assert.equal(maskQuotes(q), `‘${'…'.repeat(q.length - 2)}’`);
  assert.equal(maskQuotes('the gardeners’ tools'), 'the gardeners’ tools');
  const f = lintSource('Say ‘Don’t worry’ and ‘colour’ only as examples.', '.md', 'x.md', { docs: true });
  assert.deepEqual(rulesIn(f), []);
});

test('MECH-002: IDs, colons, proper nouns and inner capitals', () => {
  assert.deepEqual(headingCaps('D-054 Checks warn until launch').map((h) => h.note), []);
  assert.deepEqual(headingCaps('MECH-001. No em dashes').map((h) => h.note), []);
  assert.deepEqual(headingCaps('Step 1: Initial conversation').map((h) => h.note), []);
  assert.deepEqual(headingCaps('Gardening in Chicago with GitHub').map((h) => h.note), []);
  assert.deepEqual(headingCaps('About | Grow Good Gardens').map((h) => h.note), []);
  assert.deepEqual(headingCaps('Get Your Garden Plan').map((h) => h.note), ['Your', 'Garden', 'Plan']);
});

test('mechanics: straight quotes, dashes, units, spacing, exclamation marks and emoji', () => {
  const cases = [
    ['It\'s "here" now.', ['MECH-004']],
    ['Plant it — now.', ['MECH-001']],
    ['Leave 8 - 24in.', ['MECH-001']],
    ['A 2 ft gap.', ['MECH-006']],
    ['Opens at 10:00AM.', ['MECH-005']],
    ['Done.  Next.', ['MECH-008']],
    ['We can help!', ['MECH-012']],
    ['A win 😎.', ['MECH-013']],
    ['In autumn.', ['MECH-011']],
    ['Call it ‘a garden’, then plant.', ['MECH-007']],
    ['He said “plant now”.', ['MECH-003', 'MECH-007']],
    ['Plants for the upper midwest.', ['NAMES-002']],
  ];
  for (const [text, expected] of cases) assert.deepEqual([...new Set(rulesIn(lintSource(text, '.md', 'x.md', { docs: true })))].sort(), expected.sort(), text);
});

test('names and dates: first mention, written-out dates, and date with time', () => {
  assert.deepEqual(rulesIn(lintSource('Grow Good plants gardens. Grow Good Gardens too.', '.md')), ['NAMES-001']);
  assert.deepEqual(rulesIn(lintSource('Grow Good Gardens plants. Grow Good digs.', '.md')), []);
  const ok = 'Grow Good Gardens: Saturday, May 16, 10:00am–noon.';
  assert.deepEqual(rulesIn(lintSource(ok, '.md')), []);
  assert.deepEqual(rulesIn(lintSource('Grow Good Gardens: Sat, May 16.', '.md')), ['NAMES-003']);
  assert.deepEqual(rulesIn(lintSource('Grow Good Gardens: May 16th.', '.md')), ['NAMES-003']);
  assert.deepEqual(rulesIn(lintSource('Grow Good Gardens: Saturday, May 16 at 10:00am.', '.md')), ['NAMES-005']);
  assert.deepEqual(rulesIn(lintSource('Order by 5/16/2027.', '.md', 'x.md', { docs: true })), ['NAMES-003']);
});

test('lintPaths folds a finding repeated across pages into one, with a count', () => {
  const root = mkdtempSync(join(tmpdir(), 'lint-copy-'));
  mkdirSync(join(root, 'a'));
  mkdirSync(join(root, 'assets'));
  const footer = '<footer><p>Plants for the upper midwest.</p></footer>';
  writeFileSync(join(root, 'index.html'), `<h1>Grow Good Gardens</h1>${footer}`);
  writeFileSync(join(root, 'a', 'index.html'), `<h1>Grow Good Gardens</h1><p>We help!</p>${footer}`);
  writeFileSync(join(root, 'assets', 'x.html'), '<p>Ignored!</p>');
  const r = lintPaths([root]);
  assert.equal(r.files, 2);
  assert.equal(r.findings.length, 3);
  assert.deepEqual(r.distinct.map((f) => [f.rule, f.also.length]).sort(), [['MECH-012', 0], ['NAMES-002', 1]]);
});

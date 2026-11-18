// Accessibility check (D-054, checks/a11y.md): serving a build, mapping axe rules to A11Y rules,
// and, where Chrome is installed, a run over small pages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileFor, pagesIn, brandRule, group, checkPages } from '../tools/a11y.mjs';

const site = () => {
  const root = mkdtempSync(join(tmpdir(), 'a11y-'));
  for (const d of ['about', 'admin', 'assets', 'formats']) mkdirSync(join(root, d));
  const page = (body, head = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title>${head}</head><body><main><h1>Page</h1>${body}</main></body></html>`;
  // The low-contrast rule arrives from the site’s own address, which the check answers locally.
  writeFileSync(join(root, 'index.html'), page('<p class="low">Pale text</p><img src="/assets/a.gif">', '<link rel="stylesheet" href="https://example.test/assets/c.css">'));
  writeFileSync(join(root, 'assets', 'c.css'), '.low { color: #bbb; background: #fff; }');
  writeFileSync(join(root, 'about', 'index.html'), page('<div style="width:600px">Wide</div>'));
  writeFileSync(join(root, 'formats', 'flyer.html'), page('<div class="gg-format" style="width:612px">Flyer</div>'));
  writeFileSync(join(root, 'services.html'), page('<p>Fine</p>'));
  writeFileSync(join(root, 'admin', 'index.html'), page('<p>Skipped</p>'));
  return root;
};

test('fileFor finds pages as GitHub Pages and Cloudflare Pages do', () => {
  const root = site();
  assert.equal(fileFor(root, '/'), join(root, 'index.html'));
  assert.equal(fileFor(root, '/about/'), join(root, 'about', 'index.html'));
  assert.equal(fileFor(root, '/about'), join(root, 'about', 'index.html'));
  assert.equal(fileFor(root, '/services'), join(root, 'services.html'));
  assert.equal(fileFor(root, '/../etc/passwd'), null);
  assert.equal(fileFor(root, '/missing'), null);
});

test('pagesIn lists built pages and leaves out admin and assets', () => {
  assert.deepEqual(pagesIn(site()), ['/about/', '/formats/flyer.html', '/', '/services.html']);
});

test('axe rules map to A11Y rules, and repeats fold together', () => {
  assert.equal(brandRule('color-contrast'), 'A11Y-002');
  assert.equal(brandRule('image-alt'), 'A11Y-003');
  assert.equal(brandRule('link-name'), 'A11Y-004');
  assert.equal(brandRule('heading-order'), 'A11Y-005');
  assert.equal(brandRule('target-size'), 'A11Y-006');
  assert.equal(brandRule('reflow'), 'A11Y-008');
  assert.equal(brandRule('aria-allowed-attr'), 'A11Y-001');
  const f = (page, width) => ({ axe: 'link-name', rule: 'A11Y-004', impact: 'serious', target: 'footer a', page, width });
  assert.deepEqual(group([f('/', 320), f('/about/', 320), f('/', 1280)]).map((g) => g.where), [['/ @320', '/about/ @320', '/ @1280']]);
});

test('a run finds missing alt, low contrast from the site’s own CSS, and sideways scroll', { timeout: 180000 }, async (t) => {
  const r = await checkPages(site(), { origin: 'https://example.test', widths: [320], concurrency: 1 });
  if (r.skipped) { t.skip(r.skipped); return; }
  const found = new Set(r.findings.map((f) => `${f.rule} ${f.axe} ${f.page}`));
  assert.ok(found.has('A11Y-003 image-alt /'), [...found].join('; '));
  assert.ok(found.has('A11Y-002 color-contrast /'), [...found].join('; '));
  assert.ok(found.has('A11Y-008 reflow /about/'), [...found].join('; '));
  assert.ok(![...found].some((x) => x.includes('/formats/flyer.html') && x.includes('reflow')), 'a print frame is a fixed size');
  assert.ok(![...found].some((x) => x.includes('/services.html')), [...found].join('; '));
  assert.ok(r.blocked.length === 0);
});

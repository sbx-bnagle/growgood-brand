// Print and social preflight (D-054, checks/preflight.md): format pages are found in a build,
// and a run finds a wrong size, content outside the padding, a low-resolution image and a font
// that is not Alegreya Sans.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatPagesIn, checkFormats, judge } from '../tools/preflight.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const site = () => {
  const root = mkdtempSync(join(tmpdir(), 'preflight-'));
  const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>T</title><style>*{box-sizing:border-box;margin:0} body{font-family:serif}</style></head><body>${body}</body></html>`;
  writeFileSync(join(root, 'dot.png'), PNG);
  writeFileSync(join(root, 'feed.html'), page('<div class="gg-format gg-format--social"><div class="gg-social gg-social--feed" style="width:1080px;height:1350px;padding:80px"><p>Inside</p></div></div>'));
  writeFileSync(join(root, 'short-feed.html'), page('<div class="gg-format gg-format--social"><div class="gg-social gg-social--feed" style="width:1080px;height:1300px;padding:80px"><p>Inside</p></div></div>'));
  writeFileSync(join(root, 'flyer.html'), page('<div class="gg-format gg-format--flyer" style="width:612px;height:792px;padding:32px;overflow:hidden"><p style="margin-left:-20px">Too far left</p><img src="/dot.png" alt="" style="width:144px;height:144px"></div>'));
  writeFileSync(join(root, 'about.html'), page('<p>Not a format</p>'));
  return root;
};

test('formatPagesIn finds pages with a format frame', () => {
  assert.deepEqual(formatPagesIn(site()).sort(), ['/feed.html', '/flyer.html', '/short-feed.html']);
});

test('judge reads sizes and image resolution without a browser', async () => {
  const m = { format: 'flyer', size: [612, 792], outside: [], images: [{ src: '/a.jpg', natural: [300, 300], placed: [144, 144], fit: 'fill', target: 'img' }] };
  assert.deepEqual(await judge('/f', m), []); // 300px over 2in is 150ppi
  m.images[0].natural = [200, 200];
  assert.equal((await judge('/f', m))[0].check, 'images');
  const social = { format: 'social-story', size: [1080, 1920], outside: [], images: [{ src: '/a.jpg', natural: [500, 500], placed: [1000, 1000], fit: 'cover', target: 'img' }] };
  assert.match((await judge('/s', social))[0].help, /2\.00× its pixel size/);
});

test('a run finds a wrong size, content outside the padding, a low-resolution image and a fallback font', { timeout: 120000 }, async (t) => {
  const r = await checkFormats(site());
  if (r.skipped) { t.skip(r.skipped); return; }
  const found = (page, check) => r.findings.filter((f) => f.page === page && f.check === check);
  assert.equal(r.pages, 3);
  assert.deepEqual(r.findings.filter((f) => f.page === '/feed.html'), []);
  assert.match(found('/short-feed.html', 'size')[0]?.help || '', /1080×1300px; it should be 1080×1350px/);
  assert.match(found('/flyer.html', 'margin')[0]?.help || '', /20px left/);
  assert.match(found('/flyer.html', 'images')[0]?.help || '', /prints at 1ppi/);
  assert.ok(found('/flyer.html', 'fonts').some((f) => f.rule === 'D-020'), JSON.stringify(r.findings));
  assert.equal(found('/flyer.html', 'pages').length, 0);
});

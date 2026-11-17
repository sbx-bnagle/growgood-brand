// Tests for the asset library (D-053): register rows, image sizes, the Google token request,
// the sync with Google stood in, and the library check.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { parse } from 'yaml';
import { rowsFromValues, unusableReason, libraryName, imageSize, sizeProblem, manifestItem, buildManifest } from '../tools/lib/assets.mjs';
import { jwtAssertion } from '../tools/lib/google.mjs';
import { sync, report } from '../tools/sync-assets.mjs';
import { checkLibrary } from '../tools/check-assets.mjs';

// Smallest headers each format needs for its size to be read.
const png = (w, h) => { const b = Buffer.alloc(33); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const gif = (w, h) => { const b = Buffer.alloc(13); b.write('GIF89a', 0); b.writeUInt16LE(w, 6); b.writeUInt16LE(h, 8); return b; };
const jpeg = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = (w, h) => { const b = Buffer.alloc(30); b.write('RIFF', 0); b.write('WEBP', 8); b.write('VP8X', 12); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };

const HEAD = ['asset_id', 'file_name', 'folder', 'drive_file_id', 'type', 'style', 'subjects', 'season', 'orientation', 'width_px', 'height_px', 'alt_text', 'credit', 'usage_rights', 'status', 'approved_by', 'approved_on', 'notes'];
const row = (o) => HEAD.map((k) => o[k] ?? '');
const approved = { status: 'approved', usage_rights: 'owned', approved_by: 'Leah Fagan' };

test('register values become rows, without blank rows', () => {
  const rows = rowsFromValues([HEAD, row({ asset_id: ' A-0001 ', file_name: 'a.png' }), ['', ''], []]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].asset_id, 'A-0001');
  assert.equal(rows[0].notes, '');
});

test('only approved rows with known rights, alt text and a Drive file are usable', () => {
  const ok = { asset_id: 'A-0001', type: 'spot', alt_text: 'A bee', drive_file_id: 'x', ...approved };
  assert.equal(unusableReason(ok), null);
  assert.match(unusableReason({ ...ok, status: 'draft' }), /status is draft/);
  assert.match(unusableReason({ ...ok, usage_rights: 'unknown' }), /usage_rights is unknown/);
  assert.match(unusableReason({ ...ok, alt_text: '' }), /alt_text is blank/);
  assert.match(unusableReason({ ...ok, drive_file_id: '' }), /drive_file_id is blank/);
  assert.match(unusableReason({ ...ok, type: 'banner' }), /type banner/);
});

test('library file names start with the asset id', () => {
  assert.equal(libraryName({ asset_id: 'A-0021', file_name: 'leah_cst.JPG' }), 'A-0021-leah-cst.jpg');
  assert.equal(libraryName({ asset_id: 'A-0022', file_name: 'GGG-logo-fpo.svg' }), 'A-0022-ggg-logo-fpo.svg');
});

test('sizes are read from PNG, GIF, JPEG, WebP and SVG headers', () => {
  assert.deepEqual(imageSize(png(840, 560)), { width: 840, height: 560 });
  assert.deepEqual(imageSize(gif(365, 238)), { width: 365, height: 238 });
  assert.deepEqual(imageSize(jpeg(1600, 781)), { width: 1600, height: 781 });
  assert.deepEqual(imageSize(webp(1200, 900)), { width: 1200, height: 900 });
  assert.deepEqual(imageSize(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="320px" height="80">')), { width: 320, height: 80 });
  assert.deepEqual(imageSize(Buffer.from('<svg viewBox="0 0 512.5 128" xmlns="http://www.w3.org/2000/svg">')), { width: 513, height: 128 });
  assert.equal(imageSize(Buffer.from('not an image')), null);
});

test('files past web size are kept out', () => {
  assert.equal(sizeProblem({ width: 2400, height: 1600 }, 1_000_000), null);
  assert.match(sizeProblem({ width: 3000, height: 2000 }, 1_000_000), /longest edge may be 2400px/);
  assert.match(sizeProblem({ width: 800, height: 600 }, 2_500_000), /2.5MB/);
  assert.match(sizeProblem(null, 10), /cannot be read/);
});

test('manifest items carry the register’s alt text and the measured size', () => {
  const item = manifestItem({ asset_id: 'A-0015', type: 'illustration', subjects: 'butterfly, pollinators', season: 'summer', alt_text: 'Illustrated red butterfly', usage_rights: 'owned' }, 'A-0015-butterfly-4.gif', { width: 760, height: 732 });
  assert.equal(item.url, '/assets/library/A-0015-butterfly-4.gif');
  assert.equal(item.orientation, 'square');
  assert.deepEqual(item.subjects, ['butterfly', 'pollinators']);
  assert.equal(item.alt, 'Illustrated red butterfly');
  const m = buildManifest([{ ...item, id: 'A-0022', type: 'logo' }, item]);
  assert.deepEqual(m.items.map((i) => i.id), ['A-0015', 'A-0022']);
  assert.deepEqual(m.logos.map((i) => i.id), ['A-0022']);
});

test('the token request is a JWT signed with the service account’s key', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { client_email: 'sync@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const jwt = jwtAssertion(key, ['scope-a', 'scope-b'], 1_000);
  const [h, c, sig] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
  assert.equal(claims.iss, key.client_email);
  assert.equal(claims.scope, 'scope-a scope-b');
  assert.equal(claims.exp - claims.iat, 3600);
  const v = createVerify('RSA-SHA256'); v.update(`${h}.${c}`);
  assert.ok(v.verify(publicKey, Buffer.from(sig, 'base64url')));
});

// Google stood in: the token endpoint, the register and Drive files by id.
function standIn(values, files) {
  const calls = [];
  const fetchImpl = async (url) => {
    url = String(url); calls.push(url);
    if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 't' });
    if (url.startsWith('https://sheets.googleapis.com/')) return Response.json({ values });
    const id = decodeURIComponent(url.match(/files\/([^?]+)/)[1]);
    return files[id] ? new Response(files[id]) : new Response('not found', { status: 404 });
  };
  return { fetchImpl, calls };
}

test('the sync copies approved rows, skips the rest, and the check passes on the result', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { client_email: 'sync@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const values = [HEAD,
    row({ asset_id: 'A-0001', file_name: 'spot-bee.gif', drive_file_id: 'd1', type: 'spot', subjects: 'bee', season: 'summer', alt_text: 'Hand-drawn bee', ...approved }),
    row({ asset_id: 'A-0002', file_name: 'spot-bird.gif', drive_file_id: 'd2', type: 'spot', alt_text: 'Hand-drawn bird', status: 'draft', usage_rights: 'unknown' }),
    row({ asset_id: 'A-0003', file_name: 'big.png', drive_file_id: 'd3', type: 'photo', alt_text: 'A big photo', ...approved }),
    row({ asset_id: 'A-0004', file_name: 'mystery.png', drive_file_id: 'd4', type: 'photo', alt_text: 'A photo', status: 'approved', usage_rights: 'unknown' }),
    row({ asset_id: 'A-0022', file_name: 'GGG-logo-fpo.svg', drive_file_id: 'd22', type: 'logo', style: 'primary', alt_text: 'Grow Good Gardens', ...approved }),
  ];
  const files = { d1: gif(365, 238), d3: png(4000, 3000), d22: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="90"></svg>') };
  const root = mkdtempSync(join(tmpdir(), 'gg-assets-'));

  const { fetchImpl, calls } = standIn(values, files);
  const r = await sync({ key, root, fetchImpl });
  assert.deepEqual(r.items.map((i) => i.id), ['A-0001', 'A-0022']);
  assert.deepEqual(readdirSync(join(root, 'assets/library')).sort(), ['A-0001-spot-bee.gif', 'A-0022-ggg-logo-fpo.svg']);
  assert.ok(!calls.some((u) => u.includes('files/d2?')), 'a draft row is never downloaded');
  assert.deepEqual(r.skipped.map((s) => s.id), ['A-0003', 'A-0004']);
  const manifest = parse(readFileSync(join(root, '_data/assets.yml'), 'utf8'));
  assert.deepEqual(manifest.logos.map((l) => [l.id, l.style, l.width]), [['A-0022', 'primary', 300]]);
  const text = report(r);
  assert.match(text, /2 approved assets of 5 rows/);
  assert.match(text, /A-0003: it is 4000×3000px/);
  assert.match(text, /A-0004: usage_rights is unknown/);
  assert.deepEqual(checkLibrary(root).filter((c) => !c.ok), []);

  // A row taken back to draft leaves the library on the next sync.
  values[1] = row({ asset_id: 'A-0001', file_name: 'spot-bee.gif', drive_file_id: 'd1', type: 'spot', alt_text: 'Hand-drawn bee', status: 'draft', usage_rights: 'owned' });
  const again = await sync({ key, root, fetchImpl: standIn(values, files).fetchImpl });
  assert.deepEqual(again.removed, ['A-0001-spot-bee.gif']);
  assert.ok(!existsSync(join(root, 'assets/library/A-0001-spot-bee.gif')));
  assert.deepEqual(again.changed, [], 'unchanged files are not rewritten');
});

test('the check catches a wrong size, missing alt text and a stray file', () => {
  const root = mkdtempSync(join(tmpdir(), 'gg-assets-check-'));
  const lib = join(root, 'assets/library');
  const item = manifestItem({ asset_id: 'A-0001', type: 'spot', alt_text: '', usage_rights: 'owned' }, 'A-0001-spot-bee.gif', { width: 100, height: 100 });
  mkdirSync(lib, { recursive: true }); mkdirSync(join(root, '_data'), { recursive: true });
  writeFileSync(join(lib, 'A-0001-spot-bee.gif'), gif(365, 238));
  writeFileSync(join(lib, 'stray.png'), png(10, 10));
  writeFileSync(join(root, '_data/assets.yml'), `items:\n  - ${JSON.stringify(item)}\nlogos: []\n`);
  const failed = checkLibrary(root).filter((c) => !c.ok).map((c) => c.what).join('\n');
  assert.match(failed, /A-0001 has no alt text/);
  assert.match(failed, /listed as 100×100px, the file is 365×238px/);
  assert.match(failed, /stray.png has no row/);
});


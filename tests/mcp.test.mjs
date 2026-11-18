// The brand server (Phase 7, D-056): every tool through an MCP client, reading this checkout,
// and the GitHub source against a stand-in fetch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../mcp/server.mjs';
import { localSource, githubSource } from '../mcp/source.mjs';
import { renderFormat, pageSource, validate } from '../mcp/render.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = mkdtempSync(join(tmpdir(), 'mcp-render-'));

async function connect(opts = {}) {
  const server = createServer({ source: localSource(REPO), render: (a) => renderFormat({ ...a, from: 'working', out: OUT }), judgeRepo: () => REPO, ...opts });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const call = async (client, name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return { error: !!r.isError, text: r.content.map((c) => c.text).join('') };
};

test('the server lists its eight tools', async () => {
  const { tools } = await (await connect()).listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['brand_guide', 'check_copy', 'find_assets', 'get_component', 'get_rule', 'judge_draft', 'list_components', 'render_format']);
});

test('brand_guide gives a job its files, open decisions first, planned files named', async () => {
  const { text } = await call(await connect(), 'brand_guide', { job: 'flyer' });
  assert.match(text, /<brand_file path="brand\/decisions.md" status="draft">\n## Open/);
  assert.ok(!text.includes('## Active'), 'only the Open section of decisions');
  for (const p of ['brand/claims.md', 'brand/system/request-ladder.md', 'brand/verbal/voice.md', 'brand/visual/typography.md']) assert.ok(text.includes(`path="${p}"`), p);
  assert.match(text, /path="brand\/formats\/flyer.md" status="planned">\n\(planned: not written yet\)/);
});

test('get_rule, list_components, get_component and find_assets read the brand', async () => {
  const c = await connect();
  assert.match((await call(c, 'get_rule', { id: 'mech-007' })).text, /^MECH-007 \(brand\/verbal\/mechanics.md, draft\)[\s\S]*outside the closing quote/);
  assert.equal((await call(c, 'get_rule', { id: 'MECH-999' })).error, true);
  const list = (await call(c, 'list_components', { format: 'social' })).text;
  assert.match(list, /^event-details: .*params: name, what, when, where, cost, link, href$/m);
  assert.ok(!/^header:/m.test(list), 'web-only components are left out for social');
  assert.match((await call(c, 'get_component', { id: 'event-details' })).text, /include: gg\/event-details.html/);
  const bees = (await call(c, 'find_assets', { query: 'bee' })).text;
  assert.match(bees, /^A-0001 spot landscape 365×238 \/assets\/library\/A-0001-spot-bee.gif/m);
  assert.match((await call(c, 'find_assets', { query: 'unicorn' })).text, /No approved asset/);
});

test('check_copy finds mechanics problems, and judge_draft says when it has no key', async () => {
  const c = await connect({ judgeFn: async () => ({ skipped: 'no ANTHROPIC_API_KEY', findings: [] }) });
  assert.match((await call(c, 'check_copy', { text: 'Join Us — Today!', kind: 'text' })).text, /MECH-001[\s\S]*MECH-012/);
  assert.equal((await call(c, 'check_copy', { text: 'Join us on Saturday, March 6.', kind: 'text' })).text, 'No copy findings.');
  assert.equal((await call(c, 'judge_draft', { draft: 'x', request: 'y' })).text, 'brand judge: not run: no ANTHROPIC_API_KEY');
});

test('render parts become front matter, never Liquid, and are checked against contracts', () => {
  const src = pageSource('social-feed', [{ component: 'event-details', params: { name: '{{ site.title }}' } }], 'T');
  assert.match(src, /size: feed/);
  assert.match(src, /name: "\{\{ site.title \}\}"/);
  assert.match(src, /\{% assign gg_part_0 = page.parts\[0\] %\}\{% include gg\/event-details.html name=gg_part_0.name %\}/);
  const contract = { formats: ['web'], params: [{ name: 'heading', required: true }] };
  assert.deepEqual(validate('flyer', [{ component: 'cta', params: { x: '1' } }], () => contract), ['part 1: cta is not used in flyer (formats: web)', 'part 1: cta needs heading', 'part 1: cta has no param x']);
});

let jekyll = true;
try { execFileSync('bundle', ['exec', 'jekyll', '-v'], { cwd: REPO, stdio: 'ignore' }); } catch { jekyll = false; }

test('render_format builds a flyer and preflights it', { timeout: 180000, skip: !jekyll && 'no Jekyll here' }, async () => {
  const r = await call(await connect(), 'render_format', { format: 'flyer', title: 'Seed swap', parts: [{ component: 'wordmark' }, { component: 'event-details', params: { name: 'Seed swap', what: 'Bring seeds to share.', when: 'Saturday, March 6, 10:00am', where: 'The library', cost: 'Free' } }] });
  if (r.text.includes('no Chrome')) return;
  assert.equal(r.error, false, r.text);
  assert.match(r.text, /gg-render-flyer-[0-9a-f]{8}\.pdf\n\nPreflight: no findings\./);
  const bad = await call(await connect(), 'render_format', { format: 'flyer', parts: [{ component: 'event-details', params: { name: 'x' } }] });
  assert.equal(bad.error, true);
  assert.match(bad.text, /event-details needs what/);
});

test('the GitHub source reads main at its current commit, and caches by commit', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/commits/main')) return new Response('abc123\n');
    if (url.includes('/git/trees/abc123')) return Response.json({ tree: [{ type: 'blob', path: 'brand/readme.md' }, { type: 'tree', path: 'brand' }] });
    if (url.endsWith('/abc123/brand/readme.md')) return new Response('# Readme');
    return new Response('', { status: 404 });
  };
  const src = githubSource({ fetchImpl, token: '' });
  assert.deepEqual(await src.list('brand/'), ['brand/readme.md']);
  assert.equal(await src.read('brand/readme.md'), '# Readme');
  assert.equal(await src.read('brand/readme.md'), '# Readme');
  assert.equal(await src.read('brand/missing.md'), null);
  assert.equal(calls.filter((u) => u.endsWith('/commits/main')).length, 1, 'the commit is looked up once a minute');
  assert.equal(calls.filter((u) => u.endsWith('brand/readme.md')).length, 1, 'a file is fetched once per commit');
});

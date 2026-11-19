// The request app (Phase 8, D-057): the shared rules, sign-in tokens, the API on an in-memory
// store, and the drafter with stand-ins for Claude, the renderer and the judge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fieldsFor, validateRequest, briefText, newId, takesImage, stalled } from '../request/lib.js';
import { signedInEmail, HttpError } from '../request-app/access.mjs';
import * as app from '../request-app/app.mjs';
import { loadData, draftRequest, draftSchema, partsFor } from '../tools/draft-request.mjs';

const DATA = loadData();
const fmt = (id) => DATA.formats.find((f) => f.id === id);
const TEAM = 'growgood.cloudflareaccess.com';
const AUD = 'aud-tag';

test('each format asks for its template’s request fields', () => {
  assert.deepEqual(fieldsFor(fmt('flyer'), DATA.contracts).map((f) => `${f.name}${f.required ? '*' : ''}`), ['name*', 'what*', 'when*', 'where*', 'cost*']);
  assert.deepEqual(fieldsFor(fmt('social-feed'), DATA.contracts).map((f) => f.name), ['name', 'what', 'when', 'where', 'cost', 'link']);
  assert.deepEqual(fieldsFor(fmt('web-page'), DATA.contracts), []);
  assert.match(newId(new Date('2026-11-17T12:00:00Z'), () => 0.5), /^R-20261117-8000$/);
});

test('a request needs its required fields, notes for a web page, and the G1 confirmation', () => {
  const v = validateRequest({ format: 'flyer', fields: { name: 'Seed swap' } }, DATA);
  assert.deepEqual(v.problems, ['What it is is needed.', 'When is needed.', 'Where is needed.', 'Cost is needed.', 'Confirm the brief before sending it.']);
  assert.deepEqual(validateRequest({ format: 'web-page', confirmed: true }, DATA).problems, ['Describe the page you need.']);
  const ok = validateRequest({ format: 'flyer', confirmed: true, fields: { name: ' Seed swap ', what: 'Swap seeds', when: 'sat mar 6 10am', where: 'Library', cost: 'Free', href: 'x' } }, DATA);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.request.fields, { name: 'Seed swap', what: 'Swap seeds', when: 'sat mar 6 10am', where: 'Library', cost: 'Free' });
  assert.equal(briefText({ ...ok.request, replies: [{ from: 'reviewer', note: 'Shorter.' }] }), 'Format: Flyer\nEvent name: Seed swap\nWhat it is: Swap seeds\nWhen: sat mar 6 10am\nWhere: Library\nCost: Free\nReviewer added: Shorter.');
  assert.equal(briefText({ formatName: 'Flyer', fields: {}, replies: [{ from: 'requester', question: 'Which branch?', note: 'Rogers Park' }] }), 'Format: Flyer\nDrafter asked: Which branch?\nRequester answered: Rogers Park');
});

test('an approved image can be chosen for a format with art, and is read back with its alt text', () => {
  assert.ok(DATA.assets.length > 0 && DATA.assets.every((a) => a.type !== 'logo'));
  assert.equal(takesImage(fmt('flyer')), true);
  assert.equal(takesImage(fmt('web-page')), false);
  const base = { format: 'flyer', confirmed: true, fields: { name: 'A', what: 'B', when: 'C', where: 'D', cost: 'E' } };
  const bee = validateRequest({ ...base, image: 'A-0001' }, DATA);
  assert.equal(bee.request.image, 'A-0001');
  assert.match(briefText(bee.request, DATA.assets), /^Image: A-0001, Hand-drawn bee/m);
  assert.deepEqual(validateRequest({ ...base, image: 'A-9999' }, DATA).problems, ['Choose an image from the approved list.']);
  const logos = parseYaml(readFileSync('_data/assets.yml', 'utf8')).items.filter((a) => a.type === 'logo');
  assert.ok(logos.length > 0);
  for (const logo of logos) assert.deepEqual(validateRequest({ ...base, image: logo.id }, DATA).problems, ['Choose an image from the approved list.'], 'a logo is not offered as art');
  assert.equal(validateRequest(base, DATA).request.image, undefined);
});

test('a draft stalls after 25 minutes', () => {
  const now = Date.parse('2026-11-19T12:00:00Z');
  assert.equal(stalled({ status: 'drafting', draftingSince: '2026-11-19T11:40:00Z' }, now), false);
  assert.equal(stalled({ status: 'drafting', draftingSince: '2026-11-19T11:30:00Z' }, now), true);
  assert.equal(stalled({ status: 'review', draftingSince: '2026-11-19T10:00:00Z' }, now), false);
});

// A signing key and Access’s published certs, as Cloudflare would serve them.
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', keys.publicKey)), kid: 'k1' };
const b64 = (s) => Buffer.from(s).toString('base64url');
async function token(claims = {}) {
  const h = b64(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
  const p = b64(JSON.stringify({ iss: `https://${TEAM}`, aud: [AUD], email: 'Leah@Example.org', exp: Math.floor(Date.now() / 1000) + 600, ...claims }));
  const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(`${h}.${p}`))).toString('base64url');
  return `${h}.${p}.${sig}`;
}
const certsFetch = async (url) => (url === `https://${TEAM}/cdn-cgi/access/certs` ? Response.json({ keys: [jwk] }) : new Response('', { status: 404 }));
const ENV = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

test('sign-in tokens are checked against Access’s keys, audience and expiry', async () => {
  const req = async (t) => new Request('https://x/api/requests', { headers: { 'Cf-Access-Jwt-Assertion': await t } });
  assert.equal(await signedInEmail(await req(token()), ENV, { fetchImpl: certsFetch }), 'leah@example.org');
  const status = async (t, env = ENV) => { try { await signedInEmail(await req(t), env, { fetchImpl: certsFetch }); return 200; } catch (e) { assert.ok(e instanceof HttpError); return e.status; } };
  assert.equal(await status(token({ aud: ['other'] })), 401);
  assert.equal(await status(token({ exp: 1 })), 401);
  assert.equal(await status(token().then((t) => `${t.slice(0, -4)}AAAA`)), 401);
  assert.equal(await status(Promise.resolve('')), 401);
  assert.equal(await status(token(), {}), 503);
});

const memoryKV = () => {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); if (!v) return null; return type === 'json' ? JSON.parse(v.value) : v.value; },
    async put(k, value, opts = {}) { m.set(k, { value, metadata: opts.metadata }); },
    async list({ prefix }) { return { keys: [...m].filter(([k]) => k.startsWith(prefix)).map(([name, v]) => ({ name, metadata: v.metadata })), list_complete: true }; },
  };
};

test('the API: send, list, draft, approve, download, and reply', async () => {
  const dispatched = [];
  const fetchImpl = async (url, opts) => {
    if (String(url).includes('/actions/workflows/draft-request.yml/dispatches')) { dispatched.push(JSON.parse(opts.body).inputs.id); return new Response(null, { status: 204 }); }
    return certsFetch(String(url));
  };
  const env = { ...ENV, REQUESTS: memoryKV(), APPROVERS: 'leah@example.org', DRAFTER_SECRET: 's3cret', GITHUB_DISPATCH_TOKEN: 't', ASSETS: { fetch: async () => Response.json({ formats: DATA.formats, contracts: DATA.contracts, assets: DATA.assets }) } };
  const as = async (email) => ({ 'Cf-Access-Jwt-Assertion': await token({ email }) });
  const call = async (fn, { method = 'GET', path = '/api/requests', body, headers, params = {} } = {}) => {
    headers ??= await as('brad@example.org');
    const res = await fn({ request: new Request(`https://playbook.test${path}`, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) }), env, params, fetchImpl });
    return { status: res.status, body: res.headers.get('Content-Type')?.startsWith('application/json') ? await res.json() : await res.arrayBuffer() };
  };
  const h = (fn) => app.handle(fn);

  const bad = await call(h(app.createRequest), { method: 'POST', body: { format: 'flyer', fields: {} } });
  assert.equal(bad.status, 400);
  const made = await call(h(app.createRequest), { method: 'POST', body: { format: 'flyer', confirmed: true, fields: { name: 'Seed swap', what: 'Swap seeds', when: 'Sat Mar 6, 10am', where: 'Library', cost: 'Free' } } });
  assert.equal(made.status, 201);
  const id = made.body.id;
  assert.deepEqual(dispatched, [id], 'only the id goes to GitHub');
  assert.deepEqual((await call(h(app.listRequests))).body.requests.map((r) => [r.id, r.title, r.status]), [[id, 'Seed swap', 'drafting']]);

  const drafter = { Authorization: 'Bearer s3cret' };
  assert.equal((await call(h(app.drafterRead), { params: { id }, headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const brief = (await call(h(app.drafterRead), { params: { id }, headers: drafter })).body;
  assert.equal(brief.requester, undefined, 'the drafter never sees the requester');
  assert.equal((await call(h(app.readRequest), { params: { id } })).body.stage, 'queued');
  assert.equal((await call(h(app.drafterWrite), { method: 'POST', params: { id }, headers: drafter, body: { stage: 'rendering' } })).body.stage, 'rendering');
  assert.equal((await call(h(app.listRequests))).body.requests[0].stage, 'rendering', 'the queue shows the step');
  assert.equal((await call(h(app.drafterWrite), { method: 'POST', params: { id }, headers: drafter, body: { stage: 'dancing' } })).status, 400);

  // A question, its answer, and the pair kept for the log and the next draft.
  await call(h(app.drafterWrite), { method: 'POST', params: { id }, headers: drafter, body: { status: 'needs-info', question: 'Which library branch?' } });
  assert.equal((await call(h(app.replyToRequest), { method: 'POST', params: { id }, body: { note: 'Rogers Park' } })).body.status, 'drafting');
  const asked = (await call(h(app.readRequest), { params: { id } })).body;
  assert.deepEqual(asked.replies.map((x) => [x.question, x.note]), [['Which library branch?', 'Rogers Park']]);
  assert.equal(asked.stage, 'queued');
  assert.equal(dispatched.length, 2, 'the answer starts drafting again');
  const pdf = Buffer.from('%PDF-1.7 test').toString('base64');
  assert.equal((await call(h(app.drafterWrite), { method: 'POST', params: { id }, headers: drafter, body: { status: 'review', draft: { ladder: 'make', note: '', files: [{ name: 'flyer.pdf', type: 'application/pdf', base64: pdf }], checks: {} } } })).body.status, 'review');
  assert.equal((await call(h(app.readRequest), { params: { id } })).body.stage, undefined, 'a finished draft has no step');

  assert.equal((await call(h(app.approveRequest), { method: 'POST', params: { id } })).status, 403, 'Brad is not an approver');
  const read = await call(h(app.readRequest), { params: { id }, headers: await as('leah@example.org') });
  assert.equal(read.body.canApprove, true);
  assert.equal((await call(h(app.approveRequest), { method: 'POST', params: { id }, headers: await as('leah@example.org') })).body.status, 'approved');
  const file = await call(h(app.readFile), { path: `/api/requests/${id}/files/flyer.pdf?download`, params: { id, name: 'flyer.pdf' } });
  assert.equal(Buffer.from(file.body).toString(), '%PDF-1.7 test');
  assert.equal((await call(h(app.replyToRequest), { method: 'POST', params: { id }, body: { note: 'Again' } })).status, 409, 'an approved request takes no notes');
  assert.match((await call(h(app.readRequest), { params: { id } })).body.history.map((x) => x.what).join(' | '), /sent the request, confirming the brief \(G1\) \| asked a question \(LADDER-004\) \| answered the question \| drafted it; ready for review \| approved the draft \(G2\)/);

  const web = await call(h(app.createRequest), { method: 'POST', body: { format: 'web-page', confirmed: true, notes: 'A page for the spring plant sale.' } });
  assert.equal(web.body.status, 'brief-a-person');
  assert.equal(dispatched.length, 2, 'a web page is not drafted automatically');

  // When GitHub refuses to start the draft, the request fails at once instead of waiting.
  const refused = await call(h(app.createRequest), { method: 'POST', body: { format: 'flyer', confirmed: true, fields: { name: 'X', what: 'Y', when: 'Z', where: 'W', cost: 'V' } } });
  assert.equal(refused.body.status, 'drafting');
  env.GITHUB_DISPATCH_TOKEN = '';
  const failed = await call(h(app.createRequest), { method: 'POST', body: { format: 'flyer', confirmed: true, fields: { name: 'X', what: 'Y', when: 'Z', where: 'W', cost: 'V' } } });
  assert.equal(failed.body.status, 'failed');
  assert.equal((await call(h(app.readRequest), { params: { id: 'nope' } })).status, 404);
});

test('the drafter writes the fields, renders each output, checks it and posts it back', async () => {
  const out = mkdtempSync(join(tmpdir(), 'draft-test-'));
  const posted = [];
  const brief = { id: 'R-20261117-0001', format: 'postcard', formatName: 'Postcards', fields: { name: 'Seed swap', what: 'swap seeds', when: 'sat mar 6 10am', where: 'Library', cost: 'Free' }, notes: '', replies: [] };
  const fetchImpl = async (url, opts) => {
    if (opts.method === 'GET') return Response.json(brief);
    posted.push(JSON.parse(opts.body));
    return Response.json({ status: JSON.parse(opts.body).status });
  };
  const fields = { name: 'Seed swap', what: 'Swap seeds with your neighbors.', when: 'Saturday, March 6, 10:00am', where: 'The library', cost: 'Free' };
  const reply = (data) => ({ beta: { messages: { stream: () => ({ finalMessage: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(data) }] }) }) } } });
  const rendered = [];
  const render = async ({ format, parts }) => { rendered.push([format, parts.map((p) => `${p.component}:${Object.keys(p.params).join(',')}`)]); const f = join(out, `${format}-${rendered.length}.pdf`); writeFileSync(f, '%PDF'); return { ok: true, ref: 'abc1234', files: [f], findings: [] }; };
  const judgeFn = async () => ({ skipped: 'no ANTHROPIC_API_KEY', findings: [] });

  const r = await draftRequest(brief.id, { api: 'https://playbook.test', secret: 's', fetchImpl, client: reply({ ladder: 'make', note: 'Wrote the date as NAMES-005 asks.', question: '', fields }), render, judgeFn });
  assert.equal(r.status, 'review');
  assert.deepEqual(rendered, [['postcard-sheet', ['art-placeholder:', 'wordmark:']], ['postcard-sheet', ['event-details:name,what,when,where,cost', 'wordmark:']]]);
  assert.deepEqual(posted.filter((p) => p.stage).map((p) => p.stage), ['writing', 'rendering', 'checking'], 'the page sees each step');

  rendered.length = 0;
  brief.image = 'A-0001';
  await draftRequest(brief.id, { api: 'https://playbook.test', secret: 's', fetchImpl, client: reply({ ladder: 'make', note: '', question: '', fields }), render, judgeFn });
  assert.deepEqual(rendered[0], ['postcard-sheet', ['image:id', 'wordmark:']], 'a chosen image takes the art placeholder’s place');
  delete brief.image;
  const sent = posted.at(-1);
  assert.deepEqual(sent.draft.files.map((f) => [f.name, f.type]), [['front.pdf', 'application/pdf'], ['back.pdf', 'application/pdf']]);
  assert.deepEqual(sent.draft.checks.judge, { skipped: 'no ANTHROPIC_API_KEY' });
  assert.deepEqual(sent.draft.fields, fields);

  const asked = await draftRequest(brief.id, { api: 'https://playbook.test', secret: 's', fetchImpl, client: reply({ ladder: 'ask', note: '', question: 'Which library?', fields }), render, judgeFn });
  assert.equal(asked.status, 'needs-info');
  assert.equal(posted.at(-1).question, 'Which library?');
  const schema = draftSchema(fieldsFor(fmt('flyer'), DATA.contracts));
  assert.deepEqual(schema.properties.fields.required, ['name', 'what', 'when', 'where', 'cost']);
  assert.deepEqual(partsFor({ parts: ['wordmark', 'event-details'] }, { name: 'A', link: '' }, DATA.contracts), [{ component: 'wordmark', params: {} }, { component: 'event-details', params: { name: 'A' } }]);
});

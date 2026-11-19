// The request app (Phase 8, D-057): the shared rules, sign-in tokens, the API on an in-memory
// store, and the drafter with stand-ins for Claude, the renderer and the judge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fieldsFor, validateRequest, briefText, newId, takesImage, stalled, readable } from '../request/lib.js';
import { signedInEmail, HttpError } from '../request-app/access.mjs';
import * as app from '../request-app/app.mjs';
import { loadData, draftRequest, draftSchema, partsFor, templateText } from '../tools/draft-request.mjs';

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
  assert.equal((await call(h(app.replyToRequest), { method: 'POST', params: { id: web.body.id }, body: { note: 'Please draft it' } })).status, 409, 'a web page stays with Brad');
  assert.equal(dispatched.length, 2, 'a web page is not drafted automatically');

  // A flyer the drafter briefed to Brad can be sent back to the drafter with a note.
  const flyer = await call(h(app.createRequest), { method: 'POST', body: { format: 'flyer', confirmed: true, fields: { name: 'X', what: 'Y', when: 'Z', where: 'W', cost: 'V' }, image: DATA.assets[0].id } });
  await call(h(app.drafterWrite), { method: 'POST', params: { id: flyer.body.id }, headers: drafter, body: { status: 'brief-a-person', draft: { ladder: 'brief', note: 'The template has no image slot.', files: [] } } });
  assert.equal((await call(h(app.readRequest), { params: { id: flyer.body.id } })).body.draft.note, 'The template has no image slot.');
  assert.equal((await call(h(app.replyToRequest), { method: 'POST', params: { id: flyer.body.id }, body: { note: 'The image replaces the placeholder.' } })).body.status, 'drafting');

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
  assert.match(templateText(fmt('postcard'), 'A-0001', DATA.assets), /^front: image A-0001 \(Hand-drawn bee[^)]*\), chosen by the requester, wordmark\nback: event-details, wordmark$/);
  assert.equal(templateText(fmt('flyer'), '', DATA.assets), 'Flyer: wordmark, art-placeholder, event-details');
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

// Journal posts (D-059).
import { postFile, linkFindings } from '../tools/draft-request.mjs';

test('a journal post asks for title, category, points and links, and takes an image', () => {
  const post = fmt('journal-post');
  assert.deepEqual(fieldsFor(post, DATA.contracts).map((f) => `${f.name}:${f.type}${f.required ? '*' : ''}`), ['title:text*', 'category:enum*', 'points:longtext*', 'links:longtext']);
  assert.equal(takesImage(post), true);
  const base = { format: 'journal-post', confirmed: true, fields: { title: 'Seed swap recap', category: 'events', points: 'Forty people came.' } };
  assert.equal(validateRequest(base, DATA).ok, true);
  assert.deepEqual(validateRequest({ ...base, fields: { ...base.fields, category: 'gossip' } }, DATA).problems, ['Choose a category from the list.']);
  assert.deepEqual(validateRequest({ ...base, fields: { ...base.fields, points: 'x'.repeat(4001) } }, DATA).problems, ['What it says is too long.']);
  assert.equal(readable(post, { category: 'howto', title: 'A' }).category, 'How-to');
});

test('a post file has the site’s front matter, the image with its alt text, and a safe preview', () => {
  const f = postFile({ post: { title: 'Seed swap recap', description: 'How it went.', body: 'We swapped <script>x</script> [seeds](https://example.org).' }, category: 'events', image: 'A-0001', assets: DATA.assets });
  assert.match(f.markdown, /^---\nlayout: post\ntitle: Seed swap recap\ncategory: events\ndescription: How it went.\n---\n\n!\[Hand-drawn bee[^\]]*\]\(\/assets\/library\/A-0001-spot-bee.gif\)\n\nWe swapped/);
  assert.ok(f.html.includes('&lt;script&gt;'), 'raw HTML is shown as text in the preview');
  assert.deepEqual(linkFindings('See https://a.org/x and https://b.org.', 'https://a.org/x/').map((x) => x.text), ['https://b.org']);
});

test('approving a post opens its site pull request; the drafter reports it back', async () => {
  const dispatched = [];
  const fetchImpl = async (url, opts) => {
    if (String(url).includes('/dispatches')) { dispatched.push(JSON.parse(opts.body).inputs); return new Response(null, { status: 204 }); }
    return certsFetch(String(url));
  };
  const env = { ...ENV, REQUESTS: memoryKV(), APPROVERS: 'leah@example.org', DRAFTER_SECRET: 's', GITHUB_DISPATCH_TOKEN: 't', ASSETS: { fetch: async () => Response.json({ formats: DATA.formats, contracts: DATA.contracts, assets: DATA.assets }) } };
  const call = async (fn, { method = 'GET', body, headers, params = {} } = {}) => {
    headers ??= { 'Cf-Access-Jwt-Assertion': await token({ email: 'leah@example.org' }) };
    const res = await app.handle(fn)({ request: new Request('https://playbook.test/api/requests', { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body && JSON.stringify(body) }), env, params, fetchImpl });
    return { status: res.status, body: await res.json() };
  };
  const drafter = { Authorization: 'Bearer s' };
  const id = (await call(app.createRequest, { method: 'POST', body: { format: 'journal-post', confirmed: true, fields: { title: 'Recap', category: 'events', points: 'It went well.' } } })).body.id;
  assert.deepEqual(dispatched.at(-1), { id, mode: 'draft' });
  await call(app.drafterWrite, { method: 'POST', params: { id }, headers: drafter, body: { status: 'review', draft: { kind: 'post', ladder: 'make', note: '', post: { title: 'Recap', markdown: '---\n---\n', html: '<p>x</p>' }, files: [], checks: {} } } });
  assert.equal((await call(app.drafterWrite, { method: 'POST', params: { id }, headers: drafter, body: { pr: { url: 'https://github.com/a/b/pull/1', number: 1 } } })).status, 409, 'no pull request before approval');
  assert.equal((await call(app.approveRequest, { method: 'POST', params: { id } })).body.status, 'approved');
  assert.deepEqual(dispatched.at(-1), { id, mode: 'publish' });
  assert.equal((await call(app.readRequest, { params: { id } })).body.stage, 'publishing');
  assert.equal((await call(app.drafterRead, { params: { id }, headers: drafter })).body.draft.post.title, 'Recap', 'publishing reads the approved post');
  assert.equal((await call(app.drafterWrite, { method: 'POST', params: { id }, headers: drafter, body: { pr: { url: 'javascript:alert(1)', number: 1 } } })).status, 400);
  await call(app.drafterWrite, { method: 'POST', params: { id }, headers: drafter, body: { pr: { url: 'https://github.com/sbx-bnagle/growgood/pull/42', number: 42, path: '_posts/events/2026-11-19-recap.markdown' } } });
  const r = (await call(app.readRequest, { params: { id } })).body;
  assert.equal(r.draft.pr.number, 42);
  assert.equal(r.stage, undefined);
  assert.match(r.history.at(-1).what, /opened site pull request #42; merging it publishes the post \(G3\)/);
});

test('the drafter writes a post, then publishes it as a site pull request', async () => {
  const posted = [];
  let brief = { id: 'R-20261119-00AA', format: 'journal-post', formatName: 'Journal post', fields: { title: 'recap', category: 'howto', points: 'Plant in fall.', links: 'https://example.org/fall' }, image: '', notes: '', replies: [], status: 'drafting' };
  const appFetch = async (url, opts) => {
    if (opts.method === 'GET') return Response.json(brief);
    posted.push(JSON.parse(opts.body));
    return Response.json({ ok: true });
  };
  const post = { title: 'Plant in the fall', description: 'Why fall planting works.', slug: 'plant_in_fall', body: 'Plant in fall. See [this](https://example.org/fall) and [that](https://other.org).' };
  const client = { beta: { messages: { stream: () => ({ finalMessage: async () => ({ model: 'm', stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify({ ladder: 'make', note: 'Sentence case.', question: '', post }) }] }) }) } } };
  await draftRequest(brief.id, { api: 'https://p.test', secret: 's', fetchImpl: appFetch, client, judgeFn: async () => ({ skipped: 'no key', findings: [] }) });
  const sent = posted.at(-1);
  assert.equal(sent.status, 'review');
  assert.equal(sent.draft.post.folder, 'howtos', 'the how-to category lives in the howtos folder');
  assert.match(sent.draft.post.markdown, /\ncategory: howto\n/);
  assert.deepEqual(sent.draft.checks.copy.filter((c) => c.rule === 'CLAIM-001').map((c) => c.text), ['https://other.org']);
  assert.deepEqual(posted.filter((p) => p.stage).map((p) => p.stage), ['writing', 'checking']);

  // Publishing, against a stand-in GitHub that already has the branch.
  brief = { ...brief, status: 'approved', draft: sent.draft };
  const gh = [];
  const both = async (url, opts) => {
    if (!String(url).startsWith('https://api.github.com/')) return appFetch(url, opts);
    const path = String(url).replace('https://api.github.com/repos/sbx-bnagle/growgood', '');
    gh.push(`${opts.method} ${path.replace(/\?.*/, '')}`);
    if (path === '/git/ref/heads/main') return Response.json({ object: { sha: 'abc' } });
    if (path === '/git/refs') return Response.json({}, { status: 422 });
    if (path.startsWith('/git/refs/heads/')) return Response.json({}, { status: 200 });
    if (path.startsWith('/contents/')) { assert.match(Buffer.from(JSON.parse(opts.body).content, 'base64').toString(), /^---\nlayout: post/); return Response.json({}, { status: 201 }); }
    if (path.startsWith('/pulls?')) return Response.json([]);
    if (path === '/pulls') return Response.json({ html_url: 'https://github.com/sbx-bnagle/growgood/pull/7', number: 7 }, { status: 201 });
    return Response.json({}, { status: 404 });
  };
  await draftRequest(brief.id, { mode: 'publish', api: 'https://p.test', secret: 's', token: 'tok', fetchImpl: both });
  assert.deepEqual(gh, ['GET /git/ref/heads/main', 'POST /git/refs', 'PATCH /git/refs/heads/request/r-20261119-00aa', `PUT /contents/_posts/howtos/${new Date().toISOString().slice(0, 10)}-plant_in_fall.markdown`, 'GET /pulls', 'POST /pulls']);
  assert.equal(posted.at(-1).pr.number, 7);
  await draftRequest(brief.id, { mode: 'publish', api: 'https://p.test', secret: 's', token: '', fetchImpl: both });
  assert.equal(posted.at(-1).publishError, 'SITE_PR_TOKEN is not set');
});

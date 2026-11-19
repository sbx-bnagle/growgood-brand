// The request app’s server side (Phase 8, D-057): requests and drafts in Cloudflare KV, drafting
// started in GitHub Actions. The route files in functions/api/ call these handlers.
// Settings on the Pages project: the KV binding REQUESTS; ACCESS_TEAM_DOMAIN and ACCESS_AUD for
// sign-in; APPROVERS; DRAFTER_SECRET; GITHUB_DISPATCH_TOKEN (Actions: write on the brand repo).

import { validateRequest, newId, STAGES, stalled } from '../request/lib.js';
import { HttpError, signedInEmail, isApprover, checkDrafter } from './access.mjs';

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// Runs a handler, turning HttpError into a JSON error the pages can show.
export const handle = (fn) => async (context) => {
  try { return await fn(context); } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: 'Something went wrong on the server.' }, 500);
  }
};

function kv(env) {
  if (!env.REQUESTS) throw new HttpError(503, 'Request storage is not set up yet.');
  return env.REQUESTS;
}

const summary = (r) => ({ id: r.id, format: r.format, formatName: r.formatName, title: r.fields?.name || r.notes?.slice(0, 60) || r.formatName, status: r.status, stage: r.stage || '', created: r.created, updated: r.updated });

export async function getRecord(env, id) {
  if (!/^R-\d{8}-[0-9A-F]{4}$/.test(id || '')) throw new HttpError(404, 'No such request.');
  const r = await kv(env).get(`req:${id}`, 'json');
  if (!r) throw new HttpError(404, 'No such request.');
  return r;
}

export async function putRecord(env, r) {
  r.updated = new Date().toISOString();
  await kv(env).put(`req:${r.id}`, JSON.stringify(r), { metadata: summary(r) });
}

const log = (r, who, what, note = '') => r.history.push({ at: new Date().toISOString(), who, what, ...(note ? { note } : {}) });

// Marks a request as drafting and starts the workflow. If it cannot start, the request fails at
// once, so the page stops waiting and offers to try again.
async function startDraft(env, r, fetchImpl) {
  r.status = 'drafting';
  r.stage = 'queued';
  r.draftingSince = new Date().toISOString();
  await putRecord(env, r);
  const problem = await dispatchDraft(env, r.id, { fetchImpl });
  if (problem) {
    r.status = 'failed';
    delete r.stage;
    log(r, 'system', 'drafting did not start', problem);
    await putRecord(env, r);
  }
}

// Starts the drafting workflow for one request. Only the id leaves Cloudflare.
export async function dispatchDraft(env, id, { fetchImpl = fetch } = {}) {
  if (!env.GITHUB_DISPATCH_TOKEN) return 'GITHUB_DISPATCH_TOKEN is not set';
  const res = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO || 'sbx-bnagle/growgood-brand'}/actions/workflows/draft-request.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'growgood-request-app', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { id } }),
  });
  return res.status === 204 ? '' : `GitHub answered ${res.status}`;
}

async function formatsData(context) {
  const url = new URL('/request/formats.json', context.request.url);
  const res = context.env.ASSETS ? await context.env.ASSETS.fetch(url) : await (context.fetchImpl || fetch)(url);
  if (!res.ok) throw new HttpError(503, 'The format list is missing.');
  return res.json();
}

export async function listRequests({ request, env, fetchImpl }) {
  await signedInEmail(request, env, { fetchImpl });
  const out = [];
  let cursor;
  do {
    const page = await kv(env).list({ prefix: 'req:', cursor });
    out.push(...page.keys.map((k) => k.metadata).filter(Boolean));
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return json({ requests: out.sort((a, b) => (b.created || '').localeCompare(a.created || '')) });
}

export async function createRequest(context) {
  const { request, env, fetchImpl } = context;
  const email = await signedInEmail(request, env, { fetchImpl });
  let body;
  try { body = await request.json(); } catch { throw new HttpError(400, 'The request was not readable.'); }
  const v = validateRequest(body, await formatsData(context));
  if (!v.ok) return json({ error: v.problems.join(' '), problems: v.problems }, 400);
  const now = new Date();
  const r = { id: newId(now), ...v.request, replies: [], requester: email, created: now.toISOString(), history: [], draft: null, question: '' };
  const brief = (await formatsData(context)).formats.find((f) => f.id === r.format)?.ladder === 'brief';
  log(r, email, 'sent the request, confirming the brief (G1)');
  if (brief) {
    r.status = 'brief-a-person';
    log(r, 'system', 'a web page is briefed to Brad (LADDER-003)');
    await putRecord(env, r);
  } else {
    await startDraft(env, r, fetchImpl);
  }
  return json({ id: r.id, status: r.status }, 201);
}

export async function readRequest({ request, env, params, fetchImpl }) {
  const email = await signedInEmail(request, env, { fetchImpl });
  const r = await getRecord(env, params.id);
  return json({ ...r, canApprove: isApprover(email, env) });
}

// Review gate G2: an approver approves a draft that is ready for review.
export async function approveRequest({ request, env, params, fetchImpl }) {
  const email = await signedInEmail(request, env, { fetchImpl });
  if (!isApprover(email, env)) throw new HttpError(403, 'Only an approver can approve.');
  const r = await getRecord(env, params.id);
  if (r.status !== 'review') throw new HttpError(409, 'Only a draft ready for review can be approved.');
  r.status = 'approved';
  log(r, email, 'approved the draft (G2)');
  await putRecord(env, r);
  return json({ id: r.id, status: r.status });
}

// A note back to the drafter: the reviewer’s changes, or the requester’s answer to a question.
export async function replyToRequest(context) {
  const { request, env, params, fetchImpl } = context;
  const email = await signedInEmail(request, env, { fetchImpl });
  const r = await getRecord(env, params.id);
  // A request the drafter briefed to Brad can go back to it, when its format has a template.
  const briefedByDrafter = r.status === 'brief-a-person' && (await formatsData(context)).formats.find((f) => f.id === r.format)?.ladder !== 'brief';
  if (!['review', 'needs-info', 'failed'].includes(r.status) && !stalled(r) && !briefedByDrafter) throw new HttpError(409, 'This request is not waiting on a note.');
  let note = '';
  try { note = String((await request.json()).note || '').trim(); } catch { /* empty */ }
  if (!note || note.length > 2000) throw new HttpError(400, 'Write a note of up to 2,000 characters.');
  const from = r.status === 'needs-info' ? 'requester' : 'reviewer';
  // An answer keeps its question, so the log and the next draft read them as a pair.
  r.replies.push({ from, note, at: new Date().toISOString(), ...(from === 'requester' && r.question ? { question: r.question } : {}) });
  log(r, email, from === 'requester' ? 'answered the question' : r.status === 'review' ? 'sent the draft back' : 'asked for another try', note);
  r.question = '';
  await startDraft(env, r, fetchImpl);
  return json({ id: r.id, status: r.status });
}

export async function readFile({ request, env, params, fetchImpl }) {
  await signedInEmail(request, env, { fetchImpl });
  const r = await getRecord(env, params.id);
  const file = r.draft?.files?.find((f) => f.name === params.name);
  if (!file) throw new HttpError(404, 'No such file.');
  const body = await kv(env).get(`file:${r.id}:${file.name}`, 'arrayBuffer');
  if (!body) throw new HttpError(404, 'No such file.');
  const disposition = new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline';
  return new Response(body, { headers: { 'Content-Type': file.type, 'Content-Disposition': `${disposition}; filename="${r.id}-${file.name}"`, 'Cache-Control': 'private, no-store' } });
}

// The drafter reads the brief (never the requester’s email) and posts its draft back.
export async function drafterRead({ request, env, params }) {
  checkDrafter(request, env);
  const r = await getRecord(env, params.id);
  return json({ id: r.id, format: r.format, formatName: r.formatName, fields: r.fields, image: r.image || '', notes: r.notes, replies: r.replies, status: r.status });
}

const DRAFT_STATUSES = new Set(['review', 'needs-info', 'brief-a-person', 'failed']);

export async function drafterWrite({ request, env, params }) {
  checkDrafter(request, env);
  const r = await getRecord(env, params.id);
  const body = await request.json();
  // A progress report: the step the drafter is on. No history line; the page shows it live.
  if (body.stage && !body.status) {
    if (!STAGES[body.stage]) throw new HttpError(400, 'Unknown stage.');
    if (r.status !== 'drafting') throw new HttpError(409, 'This request is not being drafted.');
    r.stage = body.stage;
    await putRecord(env, r);
    return json({ id: r.id, stage: r.stage });
  }
  if (!DRAFT_STATUSES.has(body.status)) throw new HttpError(400, 'Unknown status.');
  const files = [];
  for (const f of body.draft?.files || []) {
    if (!/^[\w.-]+\.(pdf|png)$/.test(f.name)) throw new HttpError(400, `Bad file name ${f.name}.`);
    const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
    await kv(env).put(`file:${r.id}:${f.name}`, bytes, { metadata: { type: f.type } });
    files.push({ name: f.name, type: f.type, size: bytes.length });
  }
  r.status = body.status;
  delete r.stage;
  r.question = body.status === 'needs-info' ? String(body.question || '') : '';
  r.draft = body.draft ? { ...body.draft, files, at: new Date().toISOString() } : null;
  log(r, 'drafter', { review: 'drafted it; ready for review', 'needs-info': 'asked a question (LADDER-004)', 'brief-a-person': 'briefed Brad (LADDER-003)', failed: 'could not draft it' }[r.status], body.message || '');
  await putRecord(env, r);
  return json({ id: r.id, status: r.status });
}

// The request pages (Phase 8, D-057): a new request with its read-back (G1), the queue, and one
// request with its draft, check report, approval (G2) and download (G3). The API is
// /api/requests on the same site, behind the same sign-in.

import { STATUS, fieldsFor, label, briefText, validateRequest } from './lib.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const say = (msg) => { $('rq-status').textContent = msg; };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const root = new URL('../', document.querySelector('script[src$="request/app.js"]').src);
const page = (p) => new URL(p, root).pathname;

async function api(path = '', opts = {}) {
  const res = await fetch(`/api/requests${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `The server answered ${res.status}.`);
  return body;
}

// A new request.
async function newRequest() {
  const data = await (await fetch(page('request/formats.json'))).json();
  const box = $('rq-formats');
  box.innerHTML = data.formats.map((f, i) => `<p><label><input type="radio" name="format" value="${esc(f.id)}"${i === 0 ? ' checked' : ''}> <strong>${esc(f.name)}</strong>. ${esc(f.summary)}</label></p>`).join('');
  const chosen = () => data.formats.find((f) => f.id === new FormData($('rq-form')).get('format'));
  const draw = () => {
    const f = chosen();
    $('rq-fields').innerHTML = fieldsFor(f, data.contracts).map((x) => `<p class="rq-field"><label for="rq-f-${x.name}">${esc(label(x.name))}${x.required ? '' : ' (optional)'}</label>${x.notes ? `<span class="rq-hint" id="rq-h-${x.name}">${esc(x.notes)}</span>` : ''}<input id="rq-f-${x.name}" name="${x.name}" type="${x.type === 'url' ? 'url' : 'text'}" maxlength="500"${x.required ? ' required' : ''}${x.notes ? ` aria-describedby="rq-h-${x.name}"` : ''}></p>`).join('');
    $('rq-notes').previousElementSibling.textContent = f.ladder === 'brief' ? 'Describe the page you need: what it is for, what it says, and any facts it must include' : 'Anything else the draft should know';
  };
  box.addEventListener('change', draw);
  draw();
  const body = () => {
    const f = chosen();
    const fields = Object.fromEntries(fieldsFor(f, data.contracts).map((x) => [x.name, $(`rq-f-${x.name}`).value]));
    return { format: f.id, fields, notes: $('rq-notes').value };
  };
  $('rq-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = validateRequest({ ...body(), confirmed: true }, data);
    if (!v.ok) { say(v.problems.join(' ')); return; }
    say('');
    $('rq-brief').textContent = briefText(v.request);
    $('rq-confirm').checked = false;
    $('rq-form').hidden = true;
    $('rq-readback').hidden = false;
    $('rq-readback-title').focus();
  });
  $('rq-edit').addEventListener('click', () => { $('rq-readback').hidden = true; $('rq-form').hidden = false; });
  $('rq-send').addEventListener('click', async () => {
    if (!$('rq-confirm').checked) { say('Tick ‘The details are right’ first.'); return; }
    $('rq-send').disabled = true;
    say('Sending…');
    try {
      const r = await api('', { method: 'POST', body: JSON.stringify({ ...body(), confirmed: true }) });
      location.href = `${page('request/item.html')}?id=${encodeURIComponent(r.id)}`;
    } catch (err) { say(err.message); $('rq-send').disabled = false; }
  });
}

// Every request.
async function queue() {
  say('Loading…');
  const { requests } = await api();
  say(requests.length ? '' : 'No requests yet.');
  if (!requests.length) return;
  const rows = requests.map((r) => `<tr><td><a href="${page('request/item.html')}?id=${encodeURIComponent(r.id)}">${esc(r.title)}</a><br><small>${esc(r.id)}</small></td><td>${esc(r.formatName)}</td><td>${esc(STATUS[r.status] || r.status)}</td><td>${esc(when(r.updated))}</td></tr>`).join('');
  $('rq-queue').innerHTML = `<table><caption class="gg-visually-hidden">Requests</caption><thead><tr><th scope="col">Request</th><th scope="col">Format</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const list = (items, empty) => (items.length ? `<ul>${items.join('')}</ul>` : `<p>${empty}</p>`);

function report(checks = {}) {
  const pre = (checks.preflight || []).map((f) => `<li>${esc(f.output)}: ${esc(f.check)} ${esc(f.rule)}${f.target ? ` <code>${esc(f.target)}</code>` : ''}: ${esc(f.help)}</li>`);
  const copy = (checks.copy || []).map((f) => `<li>${esc(f.rule)} ${esc(f.msg)}: ‘${esc(f.text)}’</li>`);
  const j = checks.judge || {};
  const judged = j.skipped ? `<p>Not run: ${esc(j.skipped)}.</p>` : `<p>${esc(j.summary)}</p>${list((j.findings || []).map((f) => `<li><strong>${esc(f.rule)}</strong>${f.level === 'error' ? ' (blocks)' : ''}: ‘${esc(f.quote)}’. ${esc(f.problem)} Fix: ${esc(f.fix)}</li>`), 'No findings.')}`;
  return `<h3>Preflight</h3>${list(pre, 'No findings: size, padding, pages, fonts and images pass.')}<h3>Copy</h3>${list(copy, 'No findings.')}<h3>Brand judge</h3>${judged}`;
}

function replyForm(labelText, button) {
  return `<form id="rq-reply" class="rq-form"><p class="rq-field"><label for="rq-note">${labelText}</label><textarea id="rq-note" rows="4" maxlength="2000" required></textarea></p><p><button type="submit" class="rq-button">${button}</button></p></form>`;
}

// One request.
async function item() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { say('No request was named.'); return; }
  say('Loading…');
  const r = await api(`/${encodeURIComponent(id)}`);
  say('');
  $('rq-title').textContent = r.fields?.name ? `${r.formatName}: ${r.fields.name}` : r.formatName;
  const parts = [`<p><strong>${esc(STATUS[r.status] || r.status)}</strong>. ${esc(r.id)}, asked by ${esc(r.requester)} on ${esc(when(r.created))}.</p>`];
  parts.push(`<h2>The brief</h2><pre>${esc(briefText(r))}</pre>`);
  if (r.status === 'needs-info') parts.push(`<h2>A question for you</h2><p>${esc(r.question)}</p>${replyForm('Your answer', 'Send the answer')}`);
  if (r.status === 'brief-a-person') parts.push('<h2>With Brad</h2><p>No template fits this request, so Brad has the brief and will build it (LADDER-003).</p>');
  if (r.status === 'drafting') parts.push('<p>The draft is being made. It usually takes a few minutes; reload to see it.</p>');
  const d = r.draft;
  if (d?.files?.length) {
    const approved = r.status === 'approved';
    parts.push(`<h2>The draft</h2><p>${approved ? 'Approved. Download each file to print or post it (G3).' : 'A draft, not yet approved. Do not print or post it.'}</p>`);
    for (const f of d.files) {
      const src = `/api/requests/${encodeURIComponent(r.id)}/files/${encodeURIComponent(f.name)}`;
      parts.push(`<figure class="rq-file">${f.type === 'image/png' ? `<img src="${src}" alt="Draft ${esc(f.name)}">` : `<iframe src="${src}" title="Draft ${esc(f.name)}"></iframe>`}<figcaption>${esc(f.name)}. <a href="${src}">Open</a>${approved ? `. <a href="${src}?download">Download</a>` : ''}</figcaption></figure>`);
    }
    if (d.note) parts.push(`<h3>Drafter’s note (${esc(d.ladder)})</h3><p>${esc(d.note)}</p>`);
    parts.push(`<h2>Check report</h2>${report(d.checks)}`);
  }
  if (r.status === 'review') {
    parts.push('<h2>Review</h2>');
    if (r.canApprove) parts.push('<p><button type="button" id="rq-approve" class="rq-button">Approve the draft</button></p>');
    parts.push(replyForm('Or send it back with a note on what to change', 'Send it back'));
  }
  if (r.status === 'failed') parts.push(`<h2>Drafting failed</h2>${replyForm('Add a note and try again', 'Try again')}`);
  parts.push(`<h2>History</h2>${list(r.history.map((h) => `<li>${esc(when(h.at))}: ${esc(h.who)} ${esc(h.what)}${h.note ? `: ${esc(h.note)}` : ''}</li>`), 'Nothing yet.')}`);
  $('rq-item').innerHTML = parts.join('');
  $('rq-approve')?.addEventListener('click', async () => {
    try { await api(`/${encodeURIComponent(r.id)}/approve`, { method: 'POST' }); location.reload(); } catch (err) { say(err.message); }
  });
  $('rq-reply')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api(`/${encodeURIComponent(r.id)}/reply`, { method: 'POST', body: JSON.stringify({ note: $('rq-note').value }) }); location.reload(); } catch (err) { say(err.message); }
  });
}

const run = $('rq-form') ? newRequest : $('rq-queue') ? queue : item;
run().catch((err) => say(err.message));

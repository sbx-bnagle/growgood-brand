// The request pages (Phase 8, D-057): a new request with its read-back (G1), the queue, and one
// request with its draft, check report, approval (G2) and download (G3). The API is
// /api/requests on the same site, behind the same sign-in. Pages update by themselves while a
// draft is being made, so nobody has to reload.

import { STATUS, STAGES, fieldsFor, label, briefText, validateRequest, takesImage, stalled } from './lib.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const say = (msg) => { $('rq-status').textContent = msg; };
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '');
const root = new URL('../', document.querySelector('script[src$="request/app.js"]').src);
const page = (p) => new URL(p, root).pathname;
const formatsData = () => fetch(page('request/formats.json')).then((r) => r.json());
const ORDER = ['queued', 'writing', 'rendering', 'checking'];

async function api(path = '', opts = {}) {
  const res = await fetch(`/api/requests${path}`, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `The server answered ${res.status}.`);
  return body;
}

// Polls fn every `ms` while it returns true, and once more when the tab comes back into view.
function poll(fn, ms) {
  let timer;
  const tick = async () => { clearTimeout(timer); if (await fn()) timer = setTimeout(tick, ms); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  return tick;
}

// The approved images a requester can choose, with the art placeholder first (D-058).
function imagePicker(assets) {
  const option = (a) => `<label class="rq-image"><input type="radio" name="image" value="${esc(a.id)}"><img src="${esc(page(a.url.replace(/^\//, '')))}" alt="" loading="lazy"><span>${esc(a.alt)}<br><small>${esc(a.id)}, ${esc(a.type)}</small></span></label>`;
  return `<fieldset class="rq-images"><legend>Image (optional)</legend><p class="rq-hint">Only approved images can be used (D-009). A small image may be flagged as too low in resolution for print.</p><label class="rq-image rq-image--none"><input type="radio" name="image" value="" checked><span>No image yet: the art placeholder holds its place</span></label><div class="rq-image-grid">${assets.map(option).join('')}</div></fieldset>`;
}

// A new request.
async function newRequest() {
  const data = await formatsData();
  const box = $('rq-formats');
  box.innerHTML = data.formats.map((f, i) => `<p><label><input type="radio" name="format" value="${esc(f.id)}"${i === 0 ? ' checked' : ''}> <strong>${esc(f.name)}</strong>. ${esc(f.summary)}</label></p>`).join('');
  const chosen = () => data.formats.find((f) => f.id === new FormData($('rq-form')).get('format'));
  const draw = () => {
    const f = chosen();
    const keep = new FormData($('rq-form')).get('image') || '';
    $('rq-fields').innerHTML = fieldsFor(f, data.contracts).map((x) => `<p class="rq-field"><label for="rq-f-${x.name}">${esc(label(x.name))}${x.required ? '' : ' (optional)'}</label>${x.notes ? `<span class="rq-hint" id="rq-h-${x.name}">${esc(x.notes)}</span>` : ''}<input id="rq-f-${x.name}" name="${x.name}" type="${x.type === 'url' ? 'url' : 'text'}" maxlength="500"${x.required ? ' required' : ''}${x.notes ? ` aria-describedby="rq-h-${x.name}"` : ''}></p>`).join('')
      + (takesImage(f) ? imagePicker(data.assets || []) : '');
    const again = document.querySelector(`input[name="image"][value="${CSS.escape(keep)}"]`);
    if (again) again.checked = true;
    $('rq-notes').previousElementSibling.textContent = f.ladder === 'brief' ? 'Describe the page you need: what it is for, what it says, and any facts it must include' : 'Anything else the draft should know';
  };
  box.addEventListener('change', draw);
  draw();
  const body = () => {
    const f = chosen();
    const fields = Object.fromEntries(fieldsFor(f, data.contracts).map((x) => [x.name, $(`rq-f-${x.name}`).value]));
    return { format: f.id, fields, notes: $('rq-notes').value, image: takesImage(f) ? (new FormData($('rq-form')).get('image') || '') : '' };
  };
  $('rq-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = validateRequest({ ...body(), confirmed: true }, data);
    if (!v.ok) { say(v.problems.join(' ')); return; }
    say('');
    $('rq-brief').textContent = briefText({ ...v.request, image: takesImage(chosen()) ? (v.request.image || '') : undefined }, data.assets);
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

const statusText = (r) => (r.status === 'drafting' && r.stage ? `${STATUS.drafting}: ${STAGES[r.stage] || r.stage}` : STATUS[r.status] || r.status);

// Every request. Refreshes while any is being drafted.
async function queue() {
  let last = '';
  const tick = poll(async () => {
    const { requests } = await api().catch((err) => { say(err.message); return { requests: null }; });
    if (!requests) return true;
    const key = JSON.stringify(requests);
    if (key !== last) {
      last = key;
      say(requests.length ? '' : 'No requests yet.');
      const rows = requests.map((r) => `<tr><td><a href="${page('request/item.html')}?id=${encodeURIComponent(r.id)}">${esc(r.title)}</a><br><small>${esc(r.id)}</small></td><td>${esc(r.formatName)}</td><td>${r.status === 'drafting' ? '<span class="rq-spinner" aria-hidden="true"></span> ' : ''}${esc(statusText(r))}</td><td>${esc(when(r.updated))}</td></tr>`).join('');
      $('rq-queue').innerHTML = requests.length ? `<table><caption class="gg-visually-hidden">Requests</caption><thead><tr><th scope="col">Request</th><th scope="col">Format</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead><tbody>${rows}</tbody></table>` : '';
    }
    return requests.some((r) => r.status === 'drafting');
  }, 8000);
  await tick();
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

// The drafting panel: where the drafter is, step by step.
function progress(r) {
  if (stalled(r)) return `<div class="rq-state rq-state--stalled"><p><strong>This is taking longer than it should.</strong> The drafter may have stopped. Add a note and try again, or ask Brad to look at the Draft a request run.</p></div>${replyForm('Add a note and try again', 'Try again')}`;
  const at = ORDER.indexOf(r.stage || 'queued');
  const steps = ORDER.map((s, i) => `<li class="${i < at ? 'rq-step--done' : i === at ? 'rq-step--now' : ''}"${i === at ? ' aria-current="step"' : ''}>${esc(STAGES[s])}${i < at ? ' <span class="gg-visually-hidden">(done)</span>' : ''}</li>`).join('');
  return `<div class="rq-state rq-state--drafting"><p><span class="rq-spinner" aria-hidden="true"></span> <strong>Being drafted</strong> since ${esc(time(r.draftingSince || r.updated))}. This page updates by itself; it usually takes a few minutes.</p><ol class="rq-steps">${steps}</ol></div>`;
}

// Every question the drafter asked and its answer, then the notes sent back, in order.
function conversation(r) {
  const qa = r.replies.filter((x) => x.question).map((x) => `<li><p><strong>Drafter asked:</strong> ${esc(x.question)}</p><p><strong>Answer</strong> (${esc(when(x.at))}): ${esc(x.note)}</p></li>`);
  if (r.status === 'needs-info' && r.question) qa.push(`<li><p><strong>Drafter asked:</strong> ${esc(r.question)}</p><p><em>Waiting for an answer.</em></p></li>`);
  const notes = r.replies.filter((x) => !x.question).map((x) => `<li>${esc(when(x.at))}, ${x.from === 'reviewer' ? 'sent back' : 'added'}: ${esc(x.note)}</li>`);
  return `${qa.length ? `<h2>Questions and answers</h2><ol class="rq-qa">${qa.join('')}</ol>` : ''}${notes.length ? `<h2>Notes sent back</h2><ul>${notes.join('')}</ul>` : ''}`;
}

// One request. Updates in place while it is being drafted, and after every action.
async function item() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { say('No request was named.'); return; }
  const data = await formatsData().catch(() => ({ assets: [] }));
  let last = '';
  let focusNext = false;
  const draw = (r) => {
    $('rq-title').textContent = r.fields?.name ? `${r.formatName}: ${r.fields.name}` : r.formatName;
    const parts = [`<p class="rq-summary" id="rq-summary" tabindex="-1"><strong>${esc(statusText(r))}</strong>. ${esc(r.id)}, asked by ${esc(r.requester)} on ${esc(when(r.created))}.</p>`];
    if (r.status === 'drafting') parts.push(progress(r));
    if (r.status === 'needs-info') parts.push(`<div class="rq-state rq-state--ask"><h2>A question for you</h2><p>${esc(r.question)}</p>${replyForm('Your answer', 'Send the answer')}</div>`);
    if (r.status === 'brief-a-person') parts.push('<h2>With Brad</h2><p>No template fits this request, so Brad has the brief and will build it (LADDER-003).</p>');
    const d = r.draft;
    if (d?.files?.length) {
      const approved = r.status === 'approved';
      const old = r.status === 'drafting' ? ' The previous draft, kept until the new one is ready.' : '';
      parts.push(`<h2>The draft</h2><p>${approved ? 'Approved. Download each file to print or post it (G3).' : `A draft, not yet approved. Do not print or post it.${old}`}</p>`);
      for (const f of d.files) {
        const src = `/api/requests/${encodeURIComponent(r.id)}/files/${encodeURIComponent(f.name)}?v=${encodeURIComponent(d.at || '')}`;
        parts.push(`<figure class="rq-file">${f.type === 'image/png' ? `<img src="${src}" alt="Draft ${esc(f.name)}">` : `<iframe src="${src}" title="Draft ${esc(f.name)}"></iframe>`}<figcaption>${esc(f.name)}. <a href="${src}">Open</a>${approved ? `. <a href="${src}&download">Download</a>` : ''}</figcaption></figure>`);
      }
      if (d.note) parts.push(`<h3>Drafter’s note (${esc(d.ladder)})</h3><p>${esc(d.note)}</p>`);
      parts.push(`<h2>Check report</h2>${report(d.checks)}`);
    }
    if (r.status === 'review') {
      parts.push('<h2>Review</h2>');
      if (r.canApprove) parts.push('<p><button type="button" id="rq-approve" class="rq-button">Approve the draft</button></p>');
      parts.push(replyForm('Or send it back with a note on what to change', 'Send it back'));
    }
    if (r.status === 'failed') parts.push(`<h2>Drafting failed</h2><p>${esc([...r.history].reverse().find((h) => h.note)?.note || '')}</p>${replyForm('Add a note and try again', 'Try again')}`);
    parts.push(conversation(r));
    parts.push(`<h2>The brief</h2><pre>${esc(briefText({ ...r, replies: [] }, data.assets))}</pre>`);
    parts.push(`<h2>History</h2>${list(r.history.map((h) => `<li>${esc(when(h.at))}: ${esc(h.who)} ${esc(h.what)}${h.note ? `: ${esc(h.note)}` : ''}</li>`), 'Nothing yet.')}`);
    $('rq-item').innerHTML = parts.join('');
    $('rq-approve')?.addEventListener('click', () => act(`/${encodeURIComponent(r.id)}/approve`, null, 'Approved.'));
    $('rq-reply')?.addEventListener('submit', (e) => { e.preventDefault(); act(`/${encodeURIComponent(r.id)}/reply`, { note: $('rq-note').value }, 'Sent. Drafting again.'); });
  };
  const tick = poll(async () => {
    let r;
    try { r = await api(`/${encodeURIComponent(id)}`); } catch (err) { say(err.message); return true; }
    const key = `${r.updated}|${r.stage || ''}|${stalled(r)}`;
    if (key !== last) {
      const was = last;
      last = key;
      draw(r);
      if (was) say(statusText(r)); // tell screen readers what changed, not the first load
      if (focusNext) { focusNext = false; $('rq-summary')?.focus(); }
    }
    return r.status === 'drafting' && !stalled(r);
  }, 4000);
  const act = async (path, body, done) => {
    try {
      await api(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
      say(done);
      focusNext = true;
      await tick();
    } catch (err) { say(err.message); }
  };
  say('Loading…');
  await tick();
  if ($('rq-status').textContent === 'Loading…') say('');
}

const run = $('rq-form') ? newRequest : $('rq-queue') ? queue : item;
run().catch((err) => say(err.message));

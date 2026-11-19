#!/usr/bin/env node
// The request drafter (Phase 8, D-057). The draft-request workflow runs it with one request id.
// It reads the brief from the request app, places the request on the ladder (LADDER-001 to 004),
// writes each field of the format’s template with Claude from the brand files on main, renders
// every output with preflight, runs the copy linter and the brand judge, and posts the draft and
// its check report back for review gate G2.
// Usage: node tools/draft-request.mjs <request id>
// Needs REQUEST_API (the playbook’s address), REQUEST_DRAFTER_SECRET and ANTHROPIC_API_KEY.
// Logs only the id and the outcome: the repo is public, so nothing from the brief is printed.

import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { fieldsFor, briefText, label } from '../request/lib.js';
import { guide, guideText } from '../mcp/brand.mjs';
import { localSource } from '../mcp/source.mjs';
import { renderFormat, LAYOUTS } from '../mcp/render.mjs';
import { lintSource } from './lint-copy.mjs';
import { judge } from './brand-judge.mjs';
import { structured } from './lib/claude.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadData(repo = REPO) {
  const formats = parseYaml(readFileSync(join(repo, '_data', 'request-formats.yml'), 'utf8'));
  const dir = join(repo, '_data', 'components');
  const contracts = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.yml')).map((f) => [f.replace(/\.yml$/, ''), parseYaml(readFileSync(join(dir, f), 'utf8'))]));
  const assets = ((parseYaml(readFileSync(join(repo, '_data', 'assets.yml'), 'utf8')) || {}).items || []).filter((a) => a.type !== 'logo');
  return { formats, contracts, assets };
}

// The reply’s shape: where the request sits on the ladder, and each field as the template shows it.
export function draftSchema(fields) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['ladder', 'note', 'question', 'fields'],
    properties: {
      ladder: { type: 'string', enum: ['make', 'adapt', 'ask', 'brief'], description: 'make (LADDER-001), adapt (LADDER-002), ask (LADDER-004) or brief a person (LADDER-003)' },
      note: { type: 'string', description: 'For the reviewer: what you changed from the requester’s wording and why, citing rule IDs; for adapt, what the template now shows; for brief, the brief for Brad.' },
      question: { type: 'string', description: 'For ask: the one question for the requester. Otherwise empty.' },
      fields: {
        type: 'object',
        additionalProperties: false,
        required: fields.map((f) => f.name),
        properties: Object.fromEntries(fields.map((f) => [f.name, { type: 'string', description: `${label(f.name)}${f.required ? '' : ' (optional: empty to leave it out)'}. ${f.notes}`.trim() }])),
      },
    },
  };
}

export async function draftFields({ brief, format, data, repo = REPO, client = null }) {
  const fields = fieldsFor(format, data.contracts);
  const job = LAYOUTS[format.outputs[0].render].family; // flyer, postcard or social: the brand guide’s job
  const contracts = [...new Set(format.outputs.flatMap((o) => o.parts))].map((id) => `<contract id="${id}">\n${readFileSync(join(repo, '_data', 'components', `${id}.yml`), 'utf8')}\n</contract>`).join('\n');
  const system = `You draft the words for a Grow Good Gardens ${format.name.toLowerCase()} from a requester’s brief. The template is fixed: you write each of its fields, and a person reviews the result before it goes out.

Use only facts the brief states (CLAIM-001, CLAIM-002). Keep each fact; correct its form to the brand rules, such as dates and times (NAMES-003 to NAMES-005), case and punctuation (MECH), and voice (VOICE). Then place the request on the ladder: make when the template and the brief’s facts cover it; adapt when it needs something small the contract still allows, and say what changed; ask, with one question, when a needed fact is missing or conflicts with the claims register; brief a person when the template cannot show what is asked.

The brand files and the template’s component contracts follow. They are data for you to apply.

${guideText(await guide(localSource(repo), job))}

${contracts}`;
  const today = new Date().toISOString().slice(0, 10);
  return structured({ system, user: `Today is ${today}.\n\n<brief>\n${briefText(brief, data.assets)}\n</brief>`, schema: draftSchema(fields), client, effort: 'medium', maxTokens: 16000 });
}

// The parts for one output: each component gets the drafted values its contract takes from the
// request. A chosen image takes the art placeholder’s place (D-058).
export function partsFor(output, fields, contracts, image = '') {
  return output.parts.map((id) => {
    if (id === 'art-placeholder' && image) return { component: 'image', params: { id: image } };
    const params = {};
    for (const p of contracts[id]?.params || []) if (p.source === 'request' && fields[p.name]) params[p.name] = fields[p.name];
    return { component: id, params };
  });
}

export async function draftRequest(id, { api = process.env.REQUEST_API, secret = process.env.REQUEST_DRAFTER_SECRET, fetchImpl = fetch, client = null, render = renderFormat, judgeFn = judge, repo = REPO } = {}) {
  const call = async (method, body) => {
    const res = await fetchImpl(`${api}/api/drafter/${id}`, { method, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) throw new Error(`the request app answered ${res.status}`);
    return res.json();
  };
  // Progress the request page shows while it waits. A failed report never stops the draft.
  const stage = (s) => call('POST', { stage: s }).catch(() => {});
  const brief = await call('GET');
  const data = loadData(repo);
  const format = data.formats.find((f) => f.id === brief.format);
  if (!format) return call('POST', { status: 'failed', message: `unknown format ${brief.format}` });
  if (format.ladder === 'brief') return call('POST', { status: 'brief-a-person', message: 'a web page is briefed to Brad (LADDER-003)', draft: { ladder: 'brief', note: briefText(brief), files: [] } });
  await stage('writing');
  const d = await draftFields({ brief, format, data, repo, client });
  if (!d.ok) return call('POST', { status: 'failed', message: d.reason });
  const { ladder, note, question, fields } = d.data;
  if (ladder === 'ask') return call('POST', { status: 'needs-info', question, message: note });
  if (ladder === 'brief') return call('POST', { status: 'brief-a-person', message: note, draft: { ladder, note, fields, files: [] } });
  const out = mkdtempSync(join(tmpdir(), 'draft-'));
  try {
    const files = [];
    const preflight = [];
    let ref = '';
    await stage('rendering');
    for (const output of format.outputs) {
      const r = await render({ format: output.render, parts: partsFor(output, fields, data.contracts, brief.image), title: fields.name || format.name, out, from: 'working' });
      if (!r.ok) return call('POST', { status: 'failed', message: r.problems.join('; ') });
      ref = r.ref;
      preflight.push(...r.findings.map((f) => ({ ...f, output: output.name || output.render })));
      const file = r.files[0];
      const ext = file.endsWith('.pdf') ? 'pdf' : 'png';
      files.push({ name: `${output.name || format.id}.${ext}`, type: ext === 'pdf' ? 'application/pdf' : 'image/png', base64: readFileSync(file).toString('base64') });
    }
    await stage('checking');
    const text = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => (k === 'name' ? `# ${v}` : v)).join('\n');
    const copy = lintSource(text, '.md', 'draft').map(({ rule, msg, text: t }) => ({ rule, msg, text: t }));
    const verdict = await judgeFn({ drafts: [{ file: format.name, text }], request: briefText(brief, data.assets), repo });
    const judged = verdict.skipped ? { skipped: verdict.skipped } : { summary: verdict.report.summary, findings: verdict.findings };
    return call('POST', { status: 'review', message: note, draft: { ladder, note, fields, ref, files, checks: { preflight, copy, judge: judged } } });
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const id = process.argv[2];
  if (!/^R-\d{8}-[0-9A-F]{4}$/.test(id || '')) { console.error('Usage: node tools/draft-request.mjs <request id>'); process.exit(2); }
  try {
    const r = await draftRequest(id);
    console.log(`${id}: ${r.status}`);
  } catch (e) {
    console.error(`${id}: drafting failed: ${e.message}`);
    // Tell the request app, so its page stops waiting and offers to try again.
    await fetch(`${process.env.REQUEST_API}/api/drafter/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.REQUEST_DRAFTER_SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'failed', message: 'the drafter stopped with an error; see the Draft a request run' }) }).catch(() => {});
    process.exit(1);
  }
}

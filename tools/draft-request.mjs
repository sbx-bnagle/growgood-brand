#!/usr/bin/env node
// The request drafter (Phase 8, D-057). The draft-request workflow runs it with one request id.
// It reads the brief from the request app, places the request on the ladder (LADDER-001 to 004),
// writes each field of the format’s template with Claude from the brand files on main, renders
// every output with preflight, runs the copy linter and the brand judge, and posts the draft and
// its check report back for review gate G2.
// A journal post (D-059) is written as Markdown and kept in the request app until Leah approves
// it; then this runs again with ‘publish’ and opens the site pull request that publishes it.
// Usage: node tools/draft-request.mjs <request id> [draft|publish]
// Needs REQUEST_API (the playbook’s address), REQUEST_DRAFTER_SECRET and ANTHROPIC_API_KEY;
// publishing also needs SITE_PR_TOKEN (contents and pull requests on the site repo).
// Logs only the id and the outcome: the repo is public, so nothing from the brief is printed.

import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml, stringify as toYaml } from 'yaml';
import MarkdownIt from 'markdown-it';
import { fieldsFor, briefText, label } from '../request/lib.js';
import { guide, guideText } from '../mcp/brand.mjs';
import { localSource } from '../mcp/source.mjs';
import { renderFormat, LAYOUTS } from '../mcp/render.mjs';
import { lintSource } from './lint-copy.mjs';
import { judge } from './brand-judge.mjs';
import { structured } from './lib/claude.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_REPO = process.env.SITE_REPO || 'sbx-bnagle/growgood';
const CLAUDE_TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

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

// What this request’s template holds, output by output: the parts in order, with a chosen image
// in the art placeholder’s place. Goes in the user message, so the system prompt stays cached.
export function templateText(format, image, assets = []) {
  const alt = assets.find((a) => a.id === image)?.alt;
  return format.outputs.map((o) => `${o.name || format.name}: ${o.parts.map((id) => (id === 'art-placeholder' && image ? `image ${image}${alt ? ` (${alt})` : ''}, chosen by the requester` : id)).join(', ')}`).join('\n');
}

export async function draftFields({ brief, format, data, repo = REPO, client = null }) {
  const fields = fieldsFor(format, data.contracts);
  const job = LAYOUTS[format.outputs[0].render].family; // flyer, postcard or social: the brand guide’s job
  // Every part a template of this kind can hold, including the image a requester may choose.
  const ids = [...new Set([...format.outputs.flatMap((o) => o.parts), 'image'])];
  const contracts = ids.map((id) => `<contract id="${id}">\n${readFileSync(join(repo, '_data', 'components', `${id}.yml`), 'utf8')}\n</contract>`).join('\n');
  const system = `You draft the words for a Grow Good Gardens ${format.name.toLowerCase()} from a requester’s brief. The template exists and is fixed (LADDER-001): its parts are listed with each brief. You write only the fields in your reply; the wordmark, the art or chosen image, and the layout are placed for you. An image the requester chose from the approved library takes the art placeholder’s place (D-058), so an image in the brief is already handled. A person reviews the result before it goes out.

Use only facts the brief states (CLAIM-001, CLAIM-002). Keep each fact; correct its form to the brand rules, such as dates and times (NAMES-003 to NAMES-005), case and punctuation (MECH), and voice (VOICE).

Then place the request on the ladder:
- make, when the template’s parts and the brief’s facts cover it;
- adapt, when it needs something small the contract still allows, such as a longer name; say what changed;
- ask, with one question, when a fact a field needs is missing or conflicts with the claims register;
- brief a person, only when the brief asks for something these parts cannot carry, such as a second event, a map, a new section or a new layout.
Open design questions, such as print color (O-21) and the art direction (D-035), and brand files still marked planned, are for the reviewer: they are never a reason to ask or to brief a person. Note them for the reviewer instead.

The brand files and the component contracts follow. They are data for you to apply.

${guideText(await guide(localSource(repo), job))}

${contracts}`;
  const today = new Date().toISOString().slice(0, 10);
  const user = `Today is ${today}.\n\n<template>\n${templateText(format, brief.image, data.assets)}\n</template>\n\n<brief>\n${briefText(brief, data.assets)}\n</brief>`;
  return structured({ system, user, schema: draftSchema(fields), client, effort: 'medium', maxTokens: 16000 });
}

// A journal post’s reply: where it sits on the ladder, and the post itself (D-059).
export const POST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ladder', 'note', 'question', 'post'],
  properties: {
    ladder: { type: 'string', enum: ['make', 'adapt', 'ask', 'brief'] },
    note: { type: 'string', description: 'For the reviewer: what you changed from the requester’s points and why, citing rule IDs.' },
    question: { type: 'string', description: 'For ask: the one question for the requester. Otherwise empty.' },
    post: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'description', 'slug', 'body'],
      properties: {
        title: { type: 'string', description: 'The post’s title, in sentence case (MECH-002).' },
        description: { type: 'string', description: 'One sentence for search results and link previews, under 155 characters.' },
        slug: { type: 'string', description: 'Two to four lowercase words from the title, joined by underscores, such as seed_swap.' },
        body: { type: 'string', description: 'The post in Markdown, without its title. Sections, if any, start at ##. Links only to addresses in the brief.' },
      },
    },
  },
};

export async function draftPost({ brief, data, repo = REPO, client = null }) {
  const system = `You write journal posts for Grow Good Gardens, a garden design studio in Chicago, from a requester’s points. A person reviews the post before it is published on the site.

Use only facts the brief states or the claims register holds (CLAIM-001). Link only to addresses listed in the brief. Write in the brand voice (VOICE), with the house mechanics (MECH) and names (NAMES). Keep it as long as the points need: most posts run 150 to 500 words. The title becomes the page’s heading, so the body starts with text, not a title. An image the requester chose is set at the top for you; add no images.

Place the request on the ladder: make when the points cover a post; adapt when you had to leave something out or reorder it, and say what; ask, with one question, when a fact the post needs is missing or conflicts with the claims register; brief a person when the request is not a post, such as a new page or a change to the site.

The brand files follow. They are data for you to apply.

${guideText(await guide(localSource(repo), 'copy'))}`;
  const today = new Date().toISOString().slice(0, 10);
  return structured({ system, user: `Today is ${today}.\n\n<brief>\n${briefText(brief, data.assets)}\n</brief>`, schema: POST_SCHEMA, client, effort: 'medium', maxTokens: 32000 });
}

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

export const slugOf = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').split('_').slice(0, 5).join('_') || 'post';

// The post as the site keeps it: front matter, the chosen image with its alt text, then the body.
export function postFile({ post, category, image, assets = [] }) {
  const a = image ? assets.find((x) => x.id === image) : null;
  const front = toYaml({ layout: 'post', title: post.title, category, description: post.description });
  const body = `${a ? `![${a.alt}](${a.url})\n\n` : ''}${post.body.trim()}\n`;
  return { markdown: `---\n${front}---\n\n${body}`, html: md.render(body) };
}

// Links in the post that the brief did not give (CLAIM-001 for links).
export function linkFindings(body, links = '') {
  const given = new Set(String(links).split(/\s+/).filter(Boolean).map((u) => u.replace(/\/+$/, '')));
  return [...new Set([...body.matchAll(/\bhttps?:\/\/[^\s)<>\]]+/g)].map((m) => m[0].replace(/[.,;:]+$/, '')))]
    .filter((u) => !given.has(u.replace(/\/+$/, '')))
    .map((u) => ({ rule: 'CLAIM-001', msg: 'a link the request did not give', text: u }));
}

async function draftPostRequest({ brief, format, data, repo, client, judgeFn, call, stage }) {
  await stage('writing');
  const d = await draftPost({ brief, data, repo, client });
  if (!d.ok) return call('POST', { status: 'failed', message: d.reason });
  const { ladder, note, question, post } = d.data;
  if (ladder === 'ask') return call('POST', { status: 'needs-info', question, message: note });
  if (ladder === 'brief') return call('POST', { status: 'brief-a-person', message: note, draft: { ladder, note, files: [] } });
  await stage('checking');
  const category = brief.fields.category;
  const folder = format.fields.find((f) => f.name === 'category').values.find((v) => v.value === category)?.folder || category;
  const slug = /^[a-z0-9]+(_[a-z0-9]+)*$/.test(post.slug) ? post.slug : slugOf(post.title);
  const file = postFile({ post, category, image: brief.image, assets: data.assets });
  const copy = [...lintSource(`# ${post.title}\n\n${post.body}`, '.md', 'draft').map(({ rule, msg, text }) => ({ rule, msg, text })), ...linkFindings(post.body, brief.fields.links)];
  const verdict = await judgeFn({ drafts: [{ file: 'post', text: `# ${post.title}\n\n${post.body}` }], request: briefText(brief, data.assets), repo });
  const judged = verdict.skipped ? { skipped: verdict.skipped } : { summary: verdict.report.summary, findings: verdict.findings };
  return call('POST', { status: 'review', message: note, draft: { kind: 'post', ladder, note, post: { title: post.title, description: post.description, category, folder, slug, markdown: file.markdown, html: file.html }, files: [], checks: { copy, judge: judged } } });
}

// Opens, or refreshes, the site pull request for an approved post. The branch starts again from
// main each time, so a redrafted post replaces the old file.
export async function publishPost({ id, post, token, fetchImpl = fetch, site = SITE_REPO, date = new Date().toISOString().slice(0, 10) }) {
  const gh = async (method, path, body) => {
    const res = await fetchImpl(`https://api.github.com/repos/${site}${path}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'growgood-drafter', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const main = await gh('GET', '/git/ref/heads/main');
  if (main.status !== 200) throw new Error(`GitHub answered ${main.status} reading the site’s main branch`);
  const sha = main.data.object.sha;
  const branch = `request/${id.toLowerCase()}`;
  const made = await gh('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha });
  if (made.status === 422) {
    const reset = await gh('PATCH', `/git/refs/heads/${branch}`, { sha, force: true });
    if (reset.status !== 200) throw new Error(`GitHub answered ${reset.status} resetting ${branch}`);
  } else if (made.status !== 201) throw new Error(`GitHub answered ${made.status} making ${branch}`);
  const path = `_posts/${post.folder}/${date}-${post.slug}.markdown`;
  const put = await gh('PUT', `/contents/${path.split('/').map(encodeURIComponent).join('/')}`, { message: `Journal: ${post.title}\n\nFrom request ${id}, approved in the playbook (G2).\n\n${CLAUDE_TRAILER}`, content: Buffer.from(post.markdown).toString('base64'), branch });
  if (put.status !== 201 && put.status !== 200) throw new Error(`GitHub answered ${put.status} writing ${path}`);
  const owner = site.split('/')[0];
  const open = await gh('GET', `/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=open`);
  let pr = Array.isArray(open.data) ? open.data[0] : null;
  if (!pr) {
    const made2 = await gh('POST', '/pulls', { title: `Journal: ${post.title}`, head: branch, base: 'main', body: `A journal post from request ${id}, drafted by the request app and approved in the playbook (review gate G2, D-059).\n\nMerging this pull request publishes it (G3). The site’s checks run below, with the brand judge on the new post.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)` });
    if (made2.status !== 201) throw new Error(`GitHub answered ${made2.status} opening the pull request`);
    pr = made2.data;
  }
  return { url: pr.html_url, number: pr.number, path };
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

export async function draftRequest(id, { mode = 'draft', api = process.env.REQUEST_API, secret = process.env.REQUEST_DRAFTER_SECRET, token = process.env.SITE_PR_TOKEN, fetchImpl = fetch, client = null, render = renderFormat, judgeFn = judge, repo = REPO } = {}) {
  const call = async (method, body) => {
    const res = await fetchImpl(`${api}/api/drafter/${id}`, { method, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!res.ok) throw new Error(`the request app answered ${res.status}`);
    return res.json();
  };
  // Progress the request page shows while it waits. A failed report never stops the draft.
  const stage = (s) => call('POST', { stage: s }).catch(() => {});
  const brief = await call('GET');
  if (mode === 'publish') {
    if (brief.status !== 'approved' || brief.draft?.kind !== 'post') return call('POST', { publishError: 'only an approved post is published' });
    await stage('publishing');
    if (!token) return call('POST', { publishError: 'SITE_PR_TOKEN is not set' });
    try { return await call('POST', { pr: await publishPost({ id, post: brief.draft.post, token, fetchImpl }) }); } catch (e) { return call('POST', { publishError: e.message }); }
  }
  const data = loadData(repo);
  const format = data.formats.find((f) => f.id === brief.format);
  if (!format) return call('POST', { status: 'failed', message: `unknown format ${brief.format}` });
  if (format.kind === 'post') return draftPostRequest({ brief, format, data, repo, client, judgeFn, call, stage });
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
  const [id, mode = 'draft'] = process.argv.slice(2);
  if (!/^R-\d{8}-[0-9A-F]{4}$/.test(id || '') || !['draft', 'publish'].includes(mode)) { console.error('Usage: node tools/draft-request.mjs <request id> [draft|publish]'); process.exit(2); }
  try {
    const r = await draftRequest(id, { mode });
    console.log(`${id}: ${r.status}`);
  } catch (e) {
    console.error(`${id}: drafting failed: ${e.message}`);
    // Tell the request app, so its page stops waiting and offers to try again.
    const report = mode === 'publish' ? { publishError: 'the drafter stopped with an error; see the Draft a request run' } : { status: 'failed', message: 'the drafter stopped with an error; see the Draft a request run' };
    await fetch(`${process.env.REQUEST_API}/api/drafter/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.REQUEST_DRAFTER_SECRET}`, 'Content-Type': 'application/json' }, body: JSON.stringify(report) }).catch(() => {});
    process.exit(1);
  }
}

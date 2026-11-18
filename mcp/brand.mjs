// What the brand server reads: the brand files for a job, one rule, the component contracts and
// the asset library. Every function takes a source (source.mjs), so it reads main at call time.

import { parse as parseYaml } from 'yaml';

export const PLAYBOOK = 'https://growgood-playbook.pages.dev';
export const JOBS = { web: 'Web page', flyer: 'Flyer', postcard: 'Postcard', social: 'Social post', copy: 'Any customer-facing copy', image: 'Choosing an image', change: 'Changing a brand file' };

const frontMatter = (src) => {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  return m ? { data: parseYaml(m[1]) || {}, body: src.slice(m[0].length) } : { data: {}, body: src };
};

// The router table in brand/readme.md: job label → brand-relative paths.
export async function router(src) {
  const readme = await src.read('brand/readme.md');
  const rows = {};
  for (const line of readme.split('\n')) {
    const m = line.match(/^\| ([^|]+?) \| (.+?) \|$/);
    if (!m || m[1] === 'Job' || /^-+$/.test(m[1])) continue;
    rows[m[1]] = m[2];
  }
  const paths = (label) => {
    const cell = rows[label] || '';
    const own = [...cell.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    return [...(cell.includes('the copy files') ? paths(JOBS.copy) : []), ...own];
  };
  return { every: paths('Every job'), paths };
}

const repoPath = (p) => (p.startsWith('../') ? p.slice(3) : `brand/${p}`);

// The Open section of decisions.md: what is undecided and must not be built on.
export function openDecisions(text) {
  const start = text.indexOf('## Open');
  const end = text.indexOf('### Closed', start);
  return start < 0 ? '' : text.slice(start, end < 0 ? undefined : end).trim();
}

// Every file a job needs, in reading order, with its status. Planned files are named, not read.
export async function guide(src, job) {
  const label = JOBS[job];
  if (!label) throw new Error(`Unknown job ‘${job}’. Use one of: ${Object.keys(JOBS).join(', ')}.`);
  const r = await router(src);
  const list = [...new Set([...r.every, ...r.paths(label)])];
  const parts = [];
  for (const p of list) {
    const path = repoPath(p);
    const text = await src.read(path);
    if (text == null) { parts.push({ path, status: 'planned', text: '' }); continue; }
    const { data, body } = frontMatter(text);
    const status = data.status || 'draft';
    parts.push({ path, status, text: p === 'decisions.md' ? openDecisions(body) : status === 'planned' ? '' : body.trim() });
  }
  return { job, label, sha: await src.sha(), parts };
}

export function guideText(g) {
  const head = `Brand files for: ${g.label}. Read from ${g.sha}. Only approved files are binding; draft files are guidance; planned files are not written yet, so ask rather than guess what they would say. Facts come only from the request or claims.md (CLAIM-001).`;
  const body = g.parts.map((p) => `<brand_file path="${p.path}" status="${p.status}">\n${p.text || '(planned: not written yet)'}\n</brand_file>`).join('\n\n');
  return `${head}\n\n${body}`;
}

// One rule by ID, such as MECH-007: the rule, its Why and Check lines, the file and its status.
export async function rule(src, id) {
  const want = id.trim().toUpperCase();
  for (const path of (await src.list('brand/')).filter((p) => p.endsWith('.md'))) {
    const text = await src.read(path);
    const at = text?.indexOf(`**${want}.**`) ?? -1;
    if (at < 0) continue;
    const rest = text.slice(at);
    const end = rest.search(/\n\s*\n/);
    return { id: want, path, status: frontMatter(text).data.status || 'draft', text: (end < 0 ? rest : rest.slice(0, end)).trim() };
  }
  return null;
}

export async function components(src) {
  const paths = (await src.list('_data/components/')).filter((p) => p.endsWith('.yml'));
  const out = [];
  for (const p of paths) {
    const c = parseYaml(await src.read(p)) || {};
    out.push({ id: p.split('/').pop().replace(/\.yml$/, ''), name: c.name, include: c.include, summary: c.summary, formats: c.formats || [], params: (c.params || []).map((x) => x.name) });
  }
  return out;
}

export async function component(src, id) {
  const text = await src.read(`_data/components/${id}.yml`);
  return text == null ? null : { id, text, contract: parseYaml(text) };
}

// Approved assets from _data/assets.yml. Every filter is optional; query matches subjects, alt
// text, type and style.
export async function assets(src, { query = '', type = '', season = '', orientation = '', limit = 10 } = {}) {
  const items = (parseYaml(await src.read('_data/assets.yml') || '') || {}).items || [];
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (a) => (!type || a.type === type) && (!season || a.season === season || a.season === 'any') && (!orientation || a.orientation === orientation)
    && q.every((w) => [...(a.subjects || []), a.alt, a.type, a.style].filter(Boolean).some((s) => String(s).toLowerCase().includes(w)));
  return items.filter(hit).slice(0, limit).map((a) => ({ ...a, preview: `${PLAYBOOK}${a.url}` }));
}

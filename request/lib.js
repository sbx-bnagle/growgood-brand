// The request app’s shared rules (Phase 8, D-057), used by the request pages in the browser and by
// the Cloudflare Pages Functions in functions/api/. Pure functions only: no DOM, no storage.

export const STATUS = {
  drafting: 'Being drafted',
  'needs-info': 'Needs an answer',
  'brief-a-person': 'With Brad',
  review: 'Ready for review',
  approved: 'Approved',
  failed: 'Drafting failed',
};

export const LIMITS = { field: 500, notes: 2000 };

// What the drafter is doing, as it reports each step (D-057).
export const STAGES = {
  queued: 'Waiting for the drafter to start',
  writing: 'Writing the words',
  rendering: 'Rendering the files',
  checking: 'Running the checks',
};

// A draft taking longer than this has stalled: the workflow stops at 20 minutes.
export const STALLED_MS = 25 * 60 * 1000;
export const stalled = (r, now = Date.now()) => r.status === 'drafting' && now - Date.parse(r.draftingSince || r.updated || 0) > STALLED_MS;

// Formats whose templates hold the art placeholder can take an approved image in its place.
export const takesImage = (format) => (format.outputs || []).some((o) => (o.parts || []).includes('art-placeholder'));

// The fields a format asks the requester for: each request-sourced param of its parts, in order,
// once, except those the format omits. Required when any part’s contract requires it.
export function fieldsFor(format, contracts) {
  const out = new Map();
  for (const output of format.outputs || []) {
    for (const id of output.parts || []) {
      for (const p of contracts[id]?.params || []) {
        if (p.source !== 'request' || (format.omit || []).includes(p.name)) continue;
        const prev = out.get(p.name);
        out.set(p.name, { name: p.name, type: p.type, notes: p.notes || '', required: !!p.required || !!prev?.required });
      }
    }
  }
  return [...out.values()];
}

// Checks a request as the form sends it. Returns { ok, problems, request }.
export function validateRequest(body, data) {
  const problems = [];
  const format = (data.formats || []).find((f) => f.id === body?.format);
  if (!format) return { ok: false, problems: ['Choose a format.'] };
  const fields = {};
  for (const f of fieldsFor(format, data.contracts || {})) {
    const v = typeof body.fields?.[f.name] === 'string' ? body.fields[f.name].trim() : '';
    if (v.length > LIMITS.field) problems.push(`${label(f.name)} is too long.`);
    if (f.required && !v) problems.push(`${label(f.name)} is needed.`);
    if (v) fields[f.name] = v;
  }
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > LIMITS.notes) problems.push('The notes are too long.');
  // An optional approved image, by its register id (D-009, D-058).
  const image = typeof body.image === 'string' ? body.image.trim() : '';
  if (image && (!takesImage(format) || !(data.assets || []).some((a) => a.id === image))) problems.push('Choose an image from the approved list.');
  if (format.ladder === 'brief' && !notes) problems.push('Describe the page you need.');
  // Review gate G1: the requester confirms the brief as it was read back (CLAIM-002).
  if (body.confirmed !== true) problems.push('Confirm the brief before sending it.');
  return { ok: !problems.length, problems, request: { format: format.id, formatName: format.name, fields, notes, ...(image ? { image } : {}) } };
}

const LABELS = { name: 'Event name', what: 'What it is', when: 'When', where: 'Where', cost: 'Cost', link: 'Button label', href: 'Link' };
export const label = (name) => LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);

// The brief as the requester confirms it and the drafter reads it. `assets` adds the image’s alt
// text, so the reader knows what it shows.
export function briefText(request, assets = []) {
  const lines = [`Format: ${request.formatName}`];
  for (const [k, v] of Object.entries(request.fields || {})) lines.push(`${label(k)}: ${v}`);
  if (request.image) {
    const a = assets.find((x) => x.id === request.image);
    lines.push(`Image: ${request.image}${a ? `, ${a.alt}` : ''}`);
  } else if (request.image === '') lines.push('Image: none yet; the art placeholder');
  if (request.notes) lines.push(`Notes: ${request.notes}`);
  for (const r of request.replies || []) {
    if (r.question) lines.push(`Drafter asked: ${r.question}`, `Requester answered: ${r.note}`);
    else lines.push(`${r.from === 'reviewer' ? 'Reviewer' : 'Requester'} added: ${r.note}`);
  }
  return lines.join('\n');
}

// A short, unique, readable id: R-20261117-4F2A.
export function newId(now = new Date(), random = () => Math.random()) {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `R-${day}-${Math.floor(random() * 0x10000).toString(16).toUpperCase().padStart(4, '0')}`;
}

// Renders a print or social format from component parts, then runs preflight on it (D-005, D-043).
// The page is built with Jekyll from a worktree of origin/main, refreshed on every call, so a
// render uses the theme as merged (D-039, D-056). GG_RENDER_FROM=working builds from this
// checkout as it is on disk instead.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stringify, parse as parseYaml } from 'yaml';
import { checkFormats } from '../tools/preflight.mjs';

export const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LAYOUTS = {
  flyer: { layout: 'gg-flyer', family: 'flyer' },
  'postcard-front': { layout: 'gg-postcard', family: 'postcard' },
  'postcard-back': { layout: 'gg-postcard', family: 'postcard' },
  'postcard-sheet': { layout: 'gg-postcard-sheet', family: 'postcard' },
  'social-feed': { layout: 'gg-social', size: 'feed', family: 'social' },
  'social-story': { layout: 'gg-social', size: 'story', family: 'social' },
  'social-cover': { layout: 'gg-social', size: 'cover', family: 'social' },
};

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

// The folder to build from: a worktree at origin/main, fetched fresh, or this checkout.
export function buildRoot({ from = process.env.GG_RENDER_FROM || 'main', repoDir = REPO_DIR } = {}) {
  if (from === 'working') return { root: repoDir, ref: 'working tree' };
  const cache = process.env.GG_RENDER_CACHE || join(homedir(), '.cache', 'growgood-brand', 'main');
  run('git', ['fetch', '-q', 'origin', 'main'], repoDir);
  if (!existsSync(join(cache, '.git'))) {
    mkdirSync(dirname(cache), { recursive: true });
    run('git', ['worktree', 'prune'], repoDir);
    run('git', ['worktree', 'add', '-q', '--detach', cache, 'origin/main'], repoDir);
  } else {
    run('git', ['checkout', '-q', '--detach', '--force', 'origin/main'], cache);
  }
  return { root: cache, ref: run('git', ['rev-parse', '--short', 'HEAD'], cache).trim() };
}

// Checks each part against its contract: known component, allowed in this format, required
// params present, no unknown params. Returns a list of problems.
export function validate(format, parts, contractOf) {
  const spec = LAYOUTS[format];
  if (!spec) return [`unknown format ‘${format}’; use one of ${Object.keys(LAYOUTS).join(', ')}`];
  const problems = [];
  parts.forEach((p, i) => {
    const c = contractOf(p.component);
    if (!c) { problems.push(`part ${i + 1}: no component ‘${p.component}’`); return; }
    if (c.formats && !c.formats.includes(spec.family)) problems.push(`part ${i + 1}: ${p.component} is not used in ${spec.family} (formats: ${c.formats.join(', ')})`);
    const names = (c.params || []).map((x) => x.name);
    for (const x of c.params || []) if (x.required && (p.params?.[x.name] ?? '') === '') problems.push(`part ${i + 1}: ${p.component} needs ${x.name}`);
    for (const k of Object.keys(p.params || {})) if (!names.includes(k)) problems.push(`part ${i + 1}: ${p.component} has no param ${k}`);
  });
  return problems;
}

// The Jekyll page for a render: parts go in front matter, so no value is ever parsed as Liquid.
export function pageSource(format, parts, title = 'Draft') {
  const spec = LAYOUTS[format];
  const fm = { title, layout: spec.layout, ...(spec.size ? { size: spec.size } : {}), robots: 'noindex', parts: parts.map((p) => p.params || {}) };
  // Jekyll’s include tag takes plain variables, not page.parts[0], so each part is assigned first.
  const body = parts.map((p, i) => `{% assign gg_part_${i} = page.parts[${i}] %}{% include gg/${p.component}.html${Object.keys(p.params || {}).map((k) => ` ${k}=gg_part_${i}.${k}`).join('')} %}`).join('\n');
  return `---\n${stringify(fm)}---\n${body}\n`;
}

let queue = Promise.resolve();

// Renders and preflights one format. Returns the saved file, the preflight findings and the ref.
export function renderFormat({ format, parts, title, out = join(REPO_DIR, 'formats-rendered'), from } = {}) {
  const job = queue.then(async () => {
    const { root, ref } = buildRoot({ from });
    const contractOf = (id) => { const p = join(root, '_data', 'components', `${id}.yml`); return existsSync(p) ? parseYaml(readFileSync(p, 'utf8')) : null; };
    const problems = validate(format, parts, contractOf);
    if (problems.length) return { ok: false, problems, ref };
    const id = `${format}-${randomUUID().slice(0, 8)}`;
    const dir = join(root, 'gg-render');
    mkdirSync(dir, { recursive: true });
    const page = join(dir, `${id}.html`);
    const dest = mkdtempSync(join(tmpdir(), 'gg-render-'));
    try {
      writeFileSync(page, pageSource(format, parts, title));
      try { run('bundle', ['exec', 'jekyll', 'build', '-q', '-s', root, '-d', dest], root); } catch (e) { return { ok: false, problems: [`Jekyll failed: ${(e.stderr || e.message).split('\n').slice(0, 4).join(' ')}`], ref }; }
      const result = await checkFormats(dest, { pages: [`/gg-render/${id}.html`], out });
      if (result.skipped) return { ok: false, problems: [`not rendered: ${result.skipped}`], ref };
      return { ok: true, ref, files: result.saved, findings: result.findings };
    } finally {
      rmSync(page, { force: true });
      rmSync(dest, { recursive: true, force: true });
    }
  });
  queue = job.catch(() => {});
  return job;
}

// Where the brand server reads the brand from (D-039, D-056). By default, `main` on GitHub, at
// the commit it points to when a tool runs, so a change merged to main reaches the next call with
// no rebuild. A local folder can stand in for testing changes before they merge.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const REPO = 'sbx-bnagle/growgood-brand';

// main on GitHub. The commit is looked up at most once a minute; files are cached by commit.
export function githubSource({ repo = REPO, ref = 'main', ttl = 60_000, fetchImpl = globalThis.fetch, token = process.env.GITHUB_TOKEN } = {}) {
  let head = { sha: '', at: 0 };
  const trees = new Map();
  const files = new Map();
  const api = async (url, accept = 'application/vnd.github+json') => {
    const res = await fetchImpl(url, { headers: { Accept: accept, 'User-Agent': 'growgood-brand-server', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${url.replace(/\?.*/, '')}`);
    return res;
  };
  const sha = async () => {
    if (Date.now() - head.at < ttl && head.sha) return head.sha;
    const text = (await (await api(`https://api.github.com/repos/${repo}/commits/${ref}`, 'application/vnd.github.sha')).text()).trim();
    head = { sha: text, at: Date.now() };
    return text;
  };
  return {
    name: `${repo}@${ref}`,
    sha,
    async list(prefix = '') {
      const s = await sha();
      if (!trees.has(s)) {
        const body = await (await api(`https://api.github.com/repos/${repo}/git/trees/${s}?recursive=1`)).json();
        trees.set(s, body.tree.filter((t) => t.type === 'blob').map((t) => t.path).sort());
      }
      return trees.get(s).filter((p) => p.startsWith(prefix));
    },
    async read(path) {
      const s = await sha();
      const key = `${s}:${path}`;
      if (!files.has(key)) {
        const res = await fetchImpl(`https://raw.githubusercontent.com/${repo}/${s}/${path}`, { headers: { 'User-Agent': 'growgood-brand-server' } });
        files.set(key, res.ok ? await res.text() : null);
      }
      return files.get(key);
    },
  };
}

// A local checkout, as it is on disk: for trying brand changes before they merge, and for tests.
export function localSource(dir) {
  const walk = (d) => readdirSync(d).sort().flatMap((f) => {
    if (f === 'node_modules' || f.startsWith('.') || f === '_site') return [];
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [relative(dir, p).split(sep).join('/')];
  });
  return {
    name: `local ${dir}`,
    async sha() { return 'working tree'; },
    async list(prefix = '') { return walk(dir).filter((p) => p.startsWith(prefix)); },
    async read(path) { const p = join(dir, path); return existsSync(p) ? readFileSync(p, 'utf8') : null; },
  };
}

// GG_BRAND_SOURCE: unset or "github" for main on GitHub; a folder path for a local checkout.
export function sourceFromEnv(env = process.env) {
  const s = env.GG_BRAND_SOURCE || 'github';
  return s === 'github' ? githubSource() : localSource(s);
}

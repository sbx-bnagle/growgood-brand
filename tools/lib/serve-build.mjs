// Serves a built folder to headless Chrome, as GitHub Pages and Cloudflare Pages would. Shared by
// the accessibility check, print and social preflight, and the render tool.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';

// Outside hosts a page may load: the Google Fonts CSS and files, and unpkg for the site’s scroll
// library. Analytics, reCAPTCHA and the rest are blocked.
export const ALLOWED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com']);
const SKIP_DIRS = new Set(['admin', 'assets', 'node_modules', '.git']);

export const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.xml': 'application/xml', '.txt': 'text/plain', '.pdf': 'application/pdf' };

// A built file for a URL path, as GitHub Pages and Cloudflare Pages find it: /a/ → a/index.html,
// /a → a.html or a/index.html.
export function fileFor(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\/+$/, '/');
  const base = resolve(root, `.${clean}`);
  if (!base.startsWith(resolve(root))) return null;
  const candidates = clean.endsWith('/') ? [join(base, 'index.html')] : [base, `${base}.html`, join(base, 'index.html')];
  return candidates.find((p) => existsSync(p) && statSync(p).isFile()) || null;
}

// Every built page, as a URL path. Leaves out admin, assets, dot folders and the folders in skip.
export function pagesIn(root, skip = []) {
  const pages = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir).sort()) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(f) && !f.startsWith('.') && !skip.includes(relative(root, p).split(sep).join('/'))) walk(p); continue; }
      if (extname(f) !== '.html' || /^google[\w-]*\.html$/.test(f)) continue;
      const rel = relative(root, p).split(sep).join('/');
      pages.push(`/${rel.replace(/(^|\/)index\.html$/, '$1')}`);
    }
  };
  walk(root);
  return pages;
}

export const respond = (root, path) => {
  const file = fileFor(root, path);
  if (!file) return { status: 404, contentType: 'text/plain', body: Buffer.from('not found') };
  return { status: 200, contentType: TYPES[extname(file).toLowerCase()] || 'application/octet-stream', body: readFileSync(file) };
};

export function serve(root) {
  const server = createServer((req, res) => {
    const { status, contentType, body } = respond(root, new URL(req.url, 'http://x').pathname);
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(body);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// The installed Chrome, else Playwright’s Chromium; null with neither.
export async function launch() {
  for (const opts of [{ channel: 'chrome' }, {}]) {
    try { return await chromium.launch({ headless: true, ...opts }); } catch { /* try the next */ }
  }
  return null;
}

// Routes a browser context: the local server and the site’s own origin are answered from the
// build; allowed hosts load; the rest is blocked and its host noted in `blocked`.
export async function routeContext(context, { dir, local, origin = '', blocked = new Set() }) {
  const own = origin ? new URL(origin).origin : '';
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === local) return route.continue();
    if (own && url.origin === own) return route.fulfill(respond(dir, url.pathname));
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (ALLOWED_HOSTS.has(url.hostname)) return route.continue();
    blocked.add(url.hostname);
    return route.abort();
  });
  return blocked;
}

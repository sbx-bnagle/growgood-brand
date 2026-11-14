// End-to-end tests for the GG Tokens plugin against a mock of the Figma plugin API.
// Run: npm test (builds the plugin first). The mock enforces the API rules the plugin relies
// on: fonts load before a text style uses them, values match the variable's type, and
// createVariable takes the collection object.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { TOKEN_FILES, toFigmaSpecs, mergeSpecs, githubHint, hexToRgb } from '../tools/lib/tokens.mjs';

const docs = Object.fromEntries(TOKEN_FILES.map((f) => [f, JSON.parse(readFileSync(new URL(`../tokens/${f}`, import.meta.url), 'utf8'))]));
const bundle = readFileSync(new URL('../figma-plugin/dist/code.js', import.meta.url), 'utf8');

function mockFigma(fonts = ['Alegreya Sans']) {
  let n = 0;
  const id = (p) => `${p}:${++n}`;
  const collections = [];
  const variables = [];
  const textStyles = [];
  const storage = {};
  const messages = [];
  const loaded = new Set();
  const okValue = (type, v) => {
    if (v && v.type === 'VARIABLE_ALIAS') return variables.some((x) => x.id === v.id);
    if (type === 'COLOR') return ['r', 'g', 'b'].every((k) => typeof v[k] === 'number' && v[k] >= 0 && v[k] <= 1);
    if (type === 'FLOAT') return typeof v === 'number' && Number.isFinite(v);
    if (type === 'STRING') return typeof v === 'string';
    return false;
  };
  const figma = {
    showUI() {},
    notify() {},
    openExternal(url) { messages.push({ type: 'external', url }); },
    closePlugin() {},
    ui: { postMessage: (m) => messages.push(m), onmessage: null },
    clientStorage: { getAsync: async (k) => storage[k], setAsync: async (k, v) => { storage[k] = v; } },
    variables: {
      getLocalVariableCollectionsAsync: async () => collections.slice(),
      getLocalVariablesAsync: async () => variables.slice(),
      createVariableCollection(name) {
        const modeId = id('mode');
        const c = { id: id('collection'), name, modes: [{ modeId, name: 'Mode 1' }], defaultModeId: modeId,
          renameMode(mid, nm) { this.modes.find((m) => m.modeId === mid).name = nm; } };
        collections.push(c);
        return c;
      },
      createVariable(name, collection, resolvedType) {
        if (typeof collection !== 'object') throw new Error('createVariable needs the collection object');
        const v = { id: id('variable'), name, resolvedType, variableCollectionId: collection.id, valuesByMode: {}, description: '', scopes: [],
          setValueForMode(modeId, value) {
            if (!okValue(resolvedType, value)) throw new Error(`bad ${resolvedType} value for ${name}: ${JSON.stringify(value)}`);
            this.valuesByMode[modeId] = value;
          },
          remove() { variables.splice(variables.indexOf(this), 1); } };
        variables.push(v);
        return v;
      },
      createVariableAlias: (v) => ({ type: 'VARIABLE_ALIAS', id: v.id }),
    },
    getLocalTextStylesAsync: async () => textStyles.slice(),
    createTextStyle() {
      let fontName = null;
      const style = { id: id('style'), name: '', description: '', bound: {},
        get fontName() { return fontName; },
        set fontName(f) { if (!loaded.has(`${f.family}|${f.style}`)) throw new Error(`font not loaded: ${f.family} ${f.style}`); fontName = f; },
        setBoundVariable(field, variable) { this.bound[field] = variable.id; } };
      textStyles.push(style);
      return style;
    },
    loadFontAsync: async (f) => {
      if (!fonts.includes(f.family)) throw new Error(`font unavailable: ${f.family}`);
      loaded.add(`${f.family}|${f.style}`);
    },
  };
  return { figma, collections, variables, textStyles, messages, storage };
}

// Values created inside the plugin's sandbox come from another realm; compare them as plain data.
const plain = (x) => JSON.parse(JSON.stringify(x));

// A color one step away from hex in the blue channel, for edits that must differ from the token files.
const nudgeHex = (hex) => {
  const b = parseInt(hex.slice(5, 7), 16);
  return hex.slice(0, 5) + (b === 255 ? 254 : b + 1).toString(16).padStart(2, '0');
};

function run(mock) {
  vm.runInNewContext(bundle, { figma: mock.figma, __html__: '', console, JSON, Math, Object, Array, Map, Set, Promise, Error, Number, String, RegExp, parseInt });
  return (msg) => mock.figma.ui.onmessage(msg);
}

test('the plugin bundle is ES2017, and the check would catch newer syntax', () => {
  assert.doesNotThrow(() => parse(bundle, { ecmaVersion: 2017, sourceType: 'script' }));
  assert.throws(() => parse('const a = b?.c;', { ecmaVersion: 2017 }));
});

test('loading creates every variable, wires aliases and builds 18 text styles', async () => {
  const mock = mockFigma();
  const send = run(mock);
  await send({ type: 'import' });
  const err = mock.messages.find((m) => m.type === 'error');
  assert.equal(err, undefined, err && err.message);

  const specs = toFigmaSpecs(docs);
  assert.deepEqual(mock.collections.map((c) => c.name).sort(), ['Color', 'Color roles', 'Layout', 'Space', 'Type']);
  assert.ok(mock.collections.every((c) => c.modes.length === 1 && c.modes[0].name === 'Value'), 'one mode per collection, named Value');
  assert.equal(mock.variables.length, specs.length);

  const v = (collection, name) => mock.variables.find((x) => x.name === name && x.variableCollectionId === mock.collections.find((c) => c.name === collection).id);
  const mode = (collection) => mock.collections.find((c) => c.name === collection).defaultModeId;
  const green300 = v('Color', 'green/300');
  assert.deepEqual(v('Color roles', 'text/link').valuesByMode[mode('Color roles')], { type: 'VARIABLE_ALIAS', id: green300.id });
  assert.deepEqual(v('Type', 'type/lead/wide/size').valuesByMode[mode('Type')], { type: 'VARIABLE_ALIAS', id: v('Type', 'type/h1/wide/size').id });
  assert.equal(v('Type', 'type/display/wide/size').valuesByMode[mode('Type')], 119);
  assert.deepEqual(plain(v('Type', 'type/display/wide/size').scopes), ['FONT_SIZE']);
  assert.equal(v('Type', 'font/family/sans').valuesByMode[mode('Type')], 'Alegreya Sans');

  assert.equal(mock.textStyles.length, 18);
  const caption = mock.textStyles.find((s) => s.name === 'Wide/Caption');
  assert.deepEqual(plain(caption.fontName), { family: 'Alegreya Sans', style: 'Italic' });
  assert.equal(caption.fontSize, 11);
  assert.deepEqual(plain(caption.lineHeight), { unit: 'PIXELS', value: 16 });
  const display = mock.textStyles.find((s) => s.name === 'Narrow/Display');
  assert.equal(display.fontName.style, 'ExtraBold');
  assert.equal(display.fontSize, 58);
  assert.equal(display.bound.fontSize, v('Type', 'type/display/narrow/size').id);
});

test('loading twice changes nothing and adds nothing', async () => {
  const mock = mockFigma();
  const send = run(mock);
  await send({ type: 'import' });
  const count = mock.variables.length;
  await send({ type: 'import' });
  const second = mock.messages.filter((m) => m.type === 'imported')[1].result;
  assert.equal(mock.variables.length, count);
  assert.equal(mock.textStyles.length, 18);
  assert.equal(second.created, 0);
  assert.equal(second.changed, 0);
});

test('a round trip with no edits produces no changes', async () => {
  const mock = mockFigma();
  const send = run(mock);
  await send({ type: 'import' });
  await send({ type: 'collect' });
  const { specs, skipped } = plain(mock.messages.find((m) => m.type === 'collected'));
  assert.deepEqual(skipped, []);
  const merged = mergeSpecs(docs, specs);
  assert.deepEqual(merged.changes, []);
  assert.deepEqual(merged.added, []);
  assert.deepEqual(merged.missing, []);
  for (const f of TOKEN_FILES) assert.equal(JSON.stringify(merged.docs[f], null, 2), JSON.stringify(docs[f], null, 2), `${f} unchanged`);
});

test('an edit in Figma comes back as one changed value, with the repo structure kept', async () => {
  const mock = mockFigma();
  const send = run(mock);
  await send({ type: 'import' });
  // New values come from the current ones, so the test holds whatever the token files say.
  const greenNew = nudgeHex(docs['color.json'].color.green['300'].$value);
  const h1New = docs['type.json'].type.h1.wide.size.$value.value + 1;
  const coll = (name) => mock.collections.find((c) => c.name === name);
  const green300 = mock.variables.find((x) => x.name === 'green/300' && x.variableCollectionId === coll('Color').id);
  green300.setValueForMode(coll('Color').defaultModeId, hexToRgb(greenNew));
  const h1 = mock.variables.find((x) => x.name === 'type/h1/wide/size');
  h1.setValueForMode(coll('Type').defaultModeId, h1New);
  await send({ type: 'collect' });
  const { specs } = plain(mock.messages.filter((m) => m.type === 'collected').pop());
  const merged = mergeSpecs(docs, specs);
  assert.deepEqual(merged.changes.map((c) => [c.path, c.to]).sort(), [['color.green.300', greenNew], ['type.h1.wide.size', { value: h1New, unit: 'px' }]]);
  // The lead still points at heading 1, so it follows the change without its own edit.
  assert.equal(merged.docs['type.json'].type.lead.wide.size.$value, '{type.h1.wide.size}');
  assert.equal(merged.docs['type.json'].type.caption.$extensions['com.growgood.fontStyle'], 'italic');
  assert.equal(merged.docs['color-roles.json'].role.text.link.$description, 'Links on light surfaces');
});

test('a missing font stops the load with a readable error', async () => {
  const mock = mockFigma([]);
  const send = run(mock);
  await send({ type: 'import' });
  const err = mock.messages.find((m) => m.type === 'error');
  assert.match(err.message, /font unavailable: Alegreya Sans/);
});

test('settings are saved and come back on the next run', async () => {
  const mock = mockFigma();
  const send = run(mock);
  await send({ type: 'save-settings', settings: { repo: 'sbx-bnagle/growgood-brand', base: 'main', token: '' } });
  await send({ type: 'ready' });
  const init = mock.messages.find((m) => m.type === 'init');
  assert.equal(plain(init).settings.repo, 'sbx-bnagle/growgood-brand');
  assert.equal(init.status.inRepo, toFigmaSpecs(docs).length);
});

test('only GitHub links open externally', async () => {
  const mock = mockFigma();
  const send = run(mock);
  await send({ type: 'open', url: 'https://example.com/x' });
  await send({ type: 'open', url: 'https://github.com/sbx-bnagle/growgood-brand/pull/1' });
  assert.deepEqual(mock.messages.filter((m) => m.type === 'external').map((m) => m.url), ['https://github.com/sbx-bnagle/growgood-brand/pull/1']);
});

test('Send changes explains GitHub errors in plain terms', () => {
  const repo = 'sbx-bnagle/growgood-brand';
  // The error from the first real test: a token that can read the public repo but not write to it.
  const write = githubHint({ status: 403, path: `/repos/${repo}/git/refs`, message: 'Resource not accessible by personal access token' }, repo, 'phase-2/tokens');
  assert.match(write, /can’t change it/);
  assert.match(write, /Only select repositories and pick growgood-brand/);
  assert.match(write, /Contents and Pull requests to Read and write/);
  assert.match(githubHint({ status: 401, path: '/x', message: 'Bad credentials' }, repo, 'main'), /did not accept the access token/);
  assert.match(githubHint({ status: 404, path: `/repos/${repo}/git/ref/heads/main`, message: 'Not Found' }, repo, 'main'), /Couldn’t find the branch main/);
  assert.match(githubHint({ status: 404, path: `/repos/${repo}/contents/tokens/color.json?ref=main`, message: 'Not Found' }, repo, 'main'), /token files aren’t on main/);
  assert.match(githubHint({ status: 422, path: `/repos/${repo}/git/refs`, message: 'Reference already exists' }, repo, 'main'), /already exists/);
  assert.equal(githubHint({ status: 500, path: '/x', message: 'Server Error' }, repo, 'main'), '');

  // The panel carries the helper and logs it after the error line.
  const ui = readFileSync(new URL('../figma-plugin/dist/ui.html', import.meta.url), 'utf8');
  assert.match(ui, /function githubHint\(/);
  assert.match(ui, /githubHint\(e\.github, repo, base\)/);
});

// Runs the panel's own script against a stand-in GitHub. Reads return the local token files;
// answerWrite decides how GitHub answers each write.
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const refuse = (status, message) => ({ ok: false, status, statusText: 'Error', json: async () => ({ message }) });

async function runPanel(edit, answerWrite) {
  const html = readFileSync(new URL('../figma-plugin/dist/ui.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n;\n');
  const els = {};
  const el = (id) => (els[id] ??= { id, value: '', textContent: '', checked: false, hidden: true, disabled: false, scrollTop: 0, scrollHeight: 0, onclick: null });
  el('repo').value = 'sbx-bnagle/growgood-brand';
  el('base').value = 'phase-2/tokens';
  el('token').value = 'test-token';
  const specs = toFigmaSpecs(docs).map((s) => (s.path === edit.path ? { ...s, value: edit.value } : s));
  const requests = [];
  const ctx = {
    console, TextEncoder, TextDecoder, atob, btoa, Uint8Array, JSON, Promise, Date, Object, Array, Error, String, Number, RegExp, Math, encodeURIComponent,
    document: { getElementById: el },
    parent: { postMessage: ({ pluginMessage: m }) => { if (m.type === 'collect') setTimeout(() => ctx.window.onmessage({ data: { pluginMessage: { type: 'collected', specs, skipped: [] } } })); } },
    fetch: async (url, opts) => {
      const path = url.replace('https://api.github.com', '');
      const body = opts.body ? JSON.parse(opts.body) : undefined;
      requests.push({ method: opts.method, path, body });
      if (opts.method === 'GET' && path.includes('/git/ref/heads/')) return ok({ object: { sha: 'abc123' } });
      const file = path.match(/\/contents\/tokens\/([\w-]+\.json)/);
      if (opts.method === 'GET' && file) return ok({ content: Buffer.from(JSON.stringify(docs[file[1]], null, 2) + '\n').toString('base64'), sha: 'f' });
      return answerWrite(opts.method, path, body);
    },
  };
  ctx.window = ctx;
  vm.runInNewContext(scripts, ctx);
  await els.send.onclick();
  return { log: els.log.textContent, writes: requests.filter((r) => r.method !== 'GET'), els };
}

const xsNow = docs['space.json'].space.xs.$value.value;

// As in the first real test: a token that can read the repo but not write to it.
test('the panel shows the token hint when GitHub refuses to create the branch', async () => {
  const { log, writes, els } = await runPanel({ path: 'space.xs', value: xsNow + 4 }, () => refuse(403, 'Resource not accessible by personal access token'));
  assert.match(log, new RegExp(`space\\.xs: ${xsNow}px → ${xsNow + 4}px`));
  assert.match(log, /Error: GitHub said 403 for \/repos\/sbx-bnagle\/growgood-brand\/git\/refs/);
  assert.match(log, /The token can read sbx-bnagle\/growgood-brand but can’t change it\./);
  assert.equal(writes.length, 1, 'stops after the refused write');
  assert.equal(els.send.disabled, false, 'the button is usable again');
});

test('a full send makes one branch, commits only the changed file and opens the pull request', async () => {
  const { log, writes, els } = await runPanel({ path: 'space.xs', value: xsNow + 4 }, (method, path) =>
    ok(path.endsWith('/pulls') ? { number: 7, html_url: 'https://github.com/sbx-bnagle/growgood-brand/pull/7' } : {}));
  const repo = '/repos/sbx-bnagle/growgood-brand';
  assert.deepEqual(writes.map((w) => `${w.method} ${w.path}`), [`POST ${repo}/git/refs`, `PUT ${repo}/contents/tokens/space.json`, `POST ${repo}/pulls`]);

  const [ref, put, pull] = writes.map((w) => w.body);
  const branch = ref.ref.replace('refs/heads/', '');
  assert.match(branch, /^figma\/tokens-\d{12}$/);
  assert.equal(ref.sha, 'abc123', 'branches from the base branch head');
  assert.equal(put.branch, branch);
  const expected = JSON.parse(JSON.stringify(docs['space.json']));
  expected.space.xs.$value.value = xsNow + 4;
  assert.equal(Buffer.from(put.content, 'base64').toString('utf8'), JSON.stringify(expected, null, 2) + '\n', 'the file changes in that one value only');

  assert.equal(pull.title, 'Tokens from Figma (1 change)');
  assert.equal(pull.head, branch);
  assert.equal(pull.base, 'phase-2/tokens');
  assert.match(pull.body, new RegExp(`\`space\\.xs\`: ${xsNow}px → ${xsNow + 4}px`));
  assert.match(log, /Opened pull request #7/);
  assert.equal(els.openpr.hidden, false, 'the Open pull request button shows');
});

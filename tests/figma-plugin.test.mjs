// End-to-end tests for the GG Tokens plugin against a mock of the Figma plugin API.
// Run: npm test (builds the plugin first). The mock enforces the API rules the plugin relies
// on: fonts load before a text style uses them, values match the variable's type, and
// createVariable takes the collection object.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { TOKEN_FILES, toFigmaSpecs, mergeSpecs } from '../tools/lib/tokens.mjs';

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
  const coll = (name) => mock.collections.find((c) => c.name === name);
  const green300 = mock.variables.find((x) => x.name === 'green/300' && x.variableCollectionId === coll('Color').id);
  green300.setValueForMode(coll('Color').defaultModeId, { r: 0x30 / 255, g: 0x66 / 255, b: 0x34 / 255, a: 1 });
  const h1 = mock.variables.find((x) => x.name === 'type/h1/wide/size');
  h1.setValueForMode(coll('Type').defaultModeId, 60);
  await send({ type: 'collect' });
  const { specs } = plain(mock.messages.filter((m) => m.type === 'collected').pop());
  const merged = mergeSpecs(docs, specs);
  assert.deepEqual(merged.changes.map((c) => [c.path, c.to]).sort(), [['color.green.300', '#306634'], ['type.h1.wide.size', { value: 60, unit: 'px' }]]);
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

// Tests for Build pages and components (D-031, D-032, D-033), against the mock Figma API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mockFigma, runPlugin, walk } from './mock-figma.mjs';
import { TOKEN_FILES, ROLE_PAIRS, contrastRatio, flatten, resolveAll } from '../tools/lib/tokens.mjs';
import { ratio } from '../tools/lib/color.mjs';

const docs = Object.fromEntries(TOKEN_FILES.map((f) => [f, JSON.parse(readFileSync(new URL(`../tokens/${f}`, import.meta.url), 'utf8'))]));
const resolved = resolveAll(TOKEN_FILES.flatMap((f) => flatten(docs[f])));
const COMPONENTS = ['Wordmark', 'Button', 'Card', 'CTA block', 'Hero', 'Header', 'Footer', 'FAQ item', 'Subscribe', 'Event details', 'Art placeholder', 'Image with spot'];
const TEMPLATES = ['Web / Event page', 'Flyer / Letter', 'Postcard / Front', 'Postcard / Back', 'Postcard / Sheet of four', 'Social / Feed', 'Social / Story', 'Social / Event cover'];

async function built(opts) {
  const mock = mockFigma(opts);
  const send = runPlugin(mock);
  await send({ type: 'import' });
  await send({ type: 'build-library' });
  const err = mock.messages.find((m) => m.type === 'error');
  return { mock, send, err, result: plain((mock.messages.filter((m) => m.type === 'library-built').pop() || {}).result) };
}
// Results come from the plugin's sandbox, another realm: compare them as plain data.
const plain = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const page = (mock, name) => mock.pages.find((p) => p.name === name);
const top = (mock, name) => page(mock, name).children;
const props = (node) => Object.keys(node.componentPropertyDefinitions).map((k) => k.split('#')[0]).sort();

test('the contrast helper the plugin uses matches the one the ramps were built with', () => {
  for (const [fg, bg] of ROLE_PAIRS) {
    const a = resolved.get(fg);
    const b = resolved.get(bg);
    assert.equal(contrastRatio(a, b).toFixed(6), ratio(a, b).toFixed(6), `${fg} on ${bg}`);
  }
});

test('building before Load tokens says to load them first', async () => {
  const mock = mockFigma();
  const send = runPlugin(mock);
  await send({ type: 'build-library' });
  assert.match(mock.messages.find((m) => m.type === 'error').message, /Load tokens first/);
});

test('three pages, in order, using the empty first page', async () => {
  const { mock, err, result } = await built();
  assert.equal(err, undefined, err && err.message);
  assert.deepEqual(mock.pages.map((p) => p.name), ['Foundations', 'Components', 'Templates']);
  assert.deepEqual(result.pages.renamed, ['Page 1 → Foundations']);
  assert.deepEqual(result.pages.created, ['Components', 'Templates']);
});

test('a page with work on it is kept, and the page limit gives a clear message', async () => {
  const mock = mockFigma({ pages: ['Sketches'] });
  mock.figma.currentPage.appendChild(mock.figma.createFrame());
  const send = runPlugin(mock);
  await send({ type: 'import' });
  await send({ type: 'build-library' });
  assert.equal(mock.pages[0].name, 'Sketches');
  assert.match(mock.messages.find((m) => m.type === 'error').message, /Could not add the Templates page.*Starter allows three pages/);
});

test('Foundations: every color, every role pair with its contrast, both type sets', async () => {
  const { mock } = await built();
  const frames = top(mock, 'Foundations');
  assert.equal(frames.length, 1);
  const nodes = walk(frames[0]);
  const texts = nodes.filter((n) => n.type === 'TEXT');

  assert.equal(nodes.filter((n) => n.name === 'Swatch').length, 20);
  const pairs = texts.filter((t) => /:1, needs/.test(t.characters));
  assert.equal(pairs.length, ROLE_PAIRS.length);
  ROLE_PAIRS.forEach(([fg, bg, min], i) => {
    assert.equal(pairs[i].characters, `${contrastRatio(resolved.get(fg), resolved.get(bg)).toFixed(2)}:1, needs ${min}:1`);
  });
  const styleNames = new Map(mock.textStyles.map((s) => [s.id, s.name]));
  const typeVar = (t, f) => t.boundVariables[f] && mock.variables.find((v) => v.id === t.boundVariables[f].id).name.startsWith('type/');
  const unbound = texts.filter((t) => !styleNames.has(t.textStyleId) && !(typeVar(t, 'fontSize') && typeVar(t, 'lineHeight')));
  assert.deepEqual(unbound.map((t) => t.characters), [], 'every text uses a token text style or the type variables');
  for (const set of ['Wide', 'Narrow']) {
    for (const role of ['Display', 'Heading 1', 'Lead', 'Caption']) {
      assert.ok(texts.some((t) => t.characters === role && styleNames.get(t.textStyleId) === `${set}/${role}`), `${set}/${role} sample`);
    }
  }
  assert.ok(texts.some((t) => t.characters === '59/68, ExtraBold'), 'heading 1 wide spec line');
});

test('everything built takes its color from a variable', async () => {
  const { mock } = await built();
  const all = mock.pages.flatMap((p) => p.children.flatMap((n) => walk(n)));
  const raw = all.flatMap((n) => [...n.fills, ...n.strokes].filter((p) => p.type === 'SOLID' && !(p.boundVariables && p.boundVariables.color)).map(() => n.name));
  assert.deepEqual(raw, []);
});

test('components: the first set, with properties named after the include parameters', async () => {
  const { mock, result } = await built();
  assert.deepEqual(result.components.created, COMPONENTS);
  const comps = Object.fromEntries(top(mock, 'Components').map((n) => [n.name, n]));
  assert.deepEqual(Object.keys(comps), COMPONENTS);

  assert.equal(comps.Button.type, 'COMPONENT_SET');
  assert.deepEqual(comps.Button.children.map((c) => c.name), ['Style=Default', 'Style=Bright']);
  assert.deepEqual(props(comps.Button), ['label']);
  const roleId = (name) => mock.variables.find((v) => v.name === name && mock.collections.find((c) => c.id === v.variableCollectionId).name === 'Color roles').id;
  assert.equal(comps.Button.children[0].fills[0].boundVariables.color.id, roleId('action/default'));
  assert.equal(comps.Button.children[1].fills[0].boundVariables.color.id, roleId('action/bright'));

  assert.deepEqual(comps.Card.children.map((c) => c.name), ['Color=Green', 'Color=Red', 'Color=Gold', 'Color=Purple']);
  assert.deepEqual(props(comps.Card), ['blurb', 'link', 'title']);
  assert.deepEqual(props(comps['CTA block']), ['body', 'heading']);
  assert.deepEqual(props(comps['Event details']), ['cost', 'name', 'what', 'when', 'where']);
  assert.deepEqual(comps['Event details'].children.map((c) => c.name), ['Set=Wide', 'Set=Narrow']);
  const styleName = (t) => mock.textStyles.find((x) => x.id === t.textStyleId).name;
  assert.equal(styleName(walk(comps['Event details'].children[1]).find((t) => t.type === 'TEXT')), 'Narrow/Heading 2', 'the postcard variant uses the Narrow set (D-034)');
  assert.deepEqual(props(comps['FAQ item']), ['answer', 'question']);
  assert.deepEqual(props(comps.Header), ['nav 1', 'nav 2', 'nav 3']);

  const instances = (node) => walk(node).filter((x) => x.type === 'INSTANCE');
  const cta = instances(comps['CTA block']);
  assert.equal(cta.length, 1);
  assert.equal(cta[0].mainComponent.name, 'Style=Default');
  assert.equal(cta[0].isExposedInstance, true);
  assert.equal(instances(comps.Subscribe)[0].mainComponent.name, 'Style=Bright', 'dark surface, bright button');
  assert.equal(instances(comps.Header)[0].mainComponent, comps.Wordmark);
  assert.ok(COMPONENTS.every((name) => comps[name].description.length > 0), 'every component says what it mirrors');

  // Button labels are Heading 4, body size in bold, as on the site (D-049): a text style, no override.
  const label = walk(comps.Button.children[0]).find((x) => x.type === 'TEXT');
  assert.equal(mock.textStyles.find((s) => s.id === label.textStyleId).name, 'Wide/Heading 4');
  assert.equal(label.fontName.style, 'Bold');
  const when = walk(comps['Event details'].children[0]).find((x) => x.type === 'TEXT' && x.characters === 'Day, date and time');
  assert.equal(mock.textStyles.find((s) => s.id === when.textStyleId).name, 'Wide/Heading 4');

  const spacing = mock.variables.find((v) => v.name === 'md' && mock.collections.find((c) => c.id === v.variableCollectionId).name === 'Space');
  assert.equal(comps.Card.children[0].boundVariables.paddingLeft.id, spacing.id);
});

test('building again replaces Foundations and leaves the components alone', async () => {
  const { mock, send } = await built();
  const before = top(mock, 'Foundations')[0];
  const button = top(mock, 'Components').find((n) => n.name === 'Button');
  button.children[0].cornerRadius = 8; // design work done by hand
  top(mock, 'Components').find((n) => n.name === 'FAQ item').remove(); // and one deleted

  await send({ type: 'build-library' });
  const result = plain(mock.messages.filter((m) => m.type === 'library-built').pop().result);
  assert.equal(result.foundations.rebuilt, true);
  assert.equal(top(mock, 'Foundations').length, 1);
  assert.notEqual(top(mock, 'Foundations')[0].id, before.id);
  assert.deepEqual(result.components.created, ['FAQ item']);
  assert.equal(result.components.kept.length, COMPONENTS.length - 1);
  assert.equal(top(mock, 'Components').find((n) => n.name === 'Button'), button);
  assert.equal(button.children[0].cornerRadius, 8);
  assert.equal(top(mock, 'Components').length, COMPONENTS.length);
});

test('templates: every format at its size, built from component instances', async () => {
  const { mock, result } = await built();
  assert.deepEqual(result.templates.created, TEMPLATES);
  const frames = Object.fromEntries(top(mock, 'Templates').map((n) => [n.name, n]));
  assert.deepEqual(Object.keys(frames), TEMPLATES, 'no waiting note left behind');
  const size = (name) => [frames[name].width, frames[name].height];
  assert.deepEqual(size('Flyer / Letter'), [612, 792], 'Letter at 1pt per px (D-034)');
  assert.deepEqual(size('Postcard / Front'), [306, 396], 'quarter Letter (D-007)');
  assert.deepEqual(size('Postcard / Back'), [306, 396]);
  assert.deepEqual(size('Postcard / Sheet of four'), [612, 792]);
  assert.deepEqual(size('Social / Feed'), [1080, 1350], 'D-008');
  assert.deepEqual(size('Social / Story'), [1080, 1920]);
  assert.deepEqual(size('Social / Event cover'), [1920, 1005]);
  assert.equal(frames['Web / Event page'].width, 1440);

  const uses = (name) => walk(frames[name]).filter((n) => n.type === 'INSTANCE').map((n) => (n.mainComponent.parent.type === 'COMPONENT_SET' ? `${n.mainComponent.parent.name} ${n.mainComponent.name}` : n.mainComponent.name));
  assert.ok(uses('Postcard / Back').includes('Event details Set=Narrow'));
  assert.ok(uses('Flyer / Letter').includes('Event details Set=Wide'));
  for (const name of TEMPLATES.filter((t) => t !== 'Postcard / Sheet of four' && t !== 'Postcard / Back')) {
    assert.ok(uses(name).includes('Art placeholder'), `${name} holds the art direction placeholder (D-035)`);
  }
  assert.ok(['Header', 'Hero', 'CTA block', 'Footer'].every((c) => uses('Web / Event page').includes(c)));
  const art = (name) => walk(frames[name]).find((n) => n.type === 'INSTANCE' && n.mainComponent.name === 'Art placeholder');
  for (const name of ['Flyer / Letter', 'Postcard / Front', 'Social / Feed', 'Social / Story', 'Social / Event cover']) {
    assert.equal(art(name).layoutSizingVertical, 'FILL', `${name}: the art takes the height that is left, so the page cannot overflow because of it`);
  }
});

test('building again keeps templates that exist', async () => {
  const { mock, send } = await built();
  const flyer = top(mock, 'Templates').find((n) => n.name === 'Flyer / Letter');
  await send({ type: 'build-library' });
  const result = plain(mock.messages.filter((m) => m.type === 'library-built').pop().result);
  assert.deepEqual(result.templates.created, []);
  assert.equal(result.templates.kept.length, TEMPLATES.length);
  assert.equal(top(mock, 'Templates').find((n) => n.name === 'Flyer / Letter'), flyer);
});

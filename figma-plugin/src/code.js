// GG Tokens, main thread. tools/build-figma-plugin.mjs bundles this file after TOKENS (the
// repo's token files) and tools/lib/tokens.mjs. ES2017 only: the Figma sandbox is older JS.

figma.showUI(__html__, { width: 440, height: 600, themeColors: true });

const MODE_NAME = 'Value';
const SETTINGS_KEY = 'gg-tokens-settings';

function post(type, data) {
  figma.ui.postMessage(Object.assign({ type: type }, data || {}));
}

async function collectionsByName() {
  const list = await figma.variables.getLocalVariableCollectionsAsync();
  const map = {};
  list.forEach(function (c) { map[c.name] = c; });
  return map;
}

function ensureCollection(name, byName) {
  let c = byName[name];
  if (!c) {
    c = figma.variables.createVariableCollection(name);
    byName[name] = c;
  }
  // Starter files allow one mode per collection; name it for what it holds.
  if (c.modes.length && c.modes[0].name !== MODE_NAME) c.renameMode(c.modes[0].modeId, MODE_NAME);
  return c;
}

function numberAt(resolved, path) {
  const v = resolved.get(path);
  return typeof v === 'object' ? v.value : Number(v);
}

// ---- load tokens into this file ---------------------------------------------------------
async function importTokens() {
  const specs = toFigmaSpecs(TOKENS);
  const byName = await collectionsByName();
  const existing = await figma.variables.getLocalVariablesAsync();
  const byKey = {};
  existing.forEach(function (v) { byKey[v.variableCollectionId + '|' + v.name] = v; });

  const byPath = {};
  let created = 0;
  let changed = 0;

  // First pass: make sure every variable exists, so aliases can point at any of them.
  for (const s of specs) {
    const c = ensureCollection(s.collection, byName);
    const key = c.id + '|' + s.name;
    let v = byKey[key];
    if (v && v.resolvedType !== s.resolvedType) {
      v.remove();
      v = null;
    }
    if (!v) {
      v = figma.variables.createVariable(s.name, c, s.resolvedType);
      byKey[key] = v;
      created++;
    }
    v.description = s.description;
    v.scopes = s.scopes;
    byPath[s.path] = { variable: v, collection: c };
  }

  // Second pass: set values.
  for (const s of specs) {
    const entry = byPath[s.path];
    const modeId = entry.collection.defaultModeId;
    let value = s.value;
    if (value && typeof value === 'object' && value.alias) {
      const target = byPath[value.alias];
      if (!target) throw new Error('No variable for {' + value.alias + '}');
      value = figma.variables.createVariableAlias(target.variable);
    }
    const before = JSON.stringify(entry.variable.valuesByMode[modeId]);
    entry.variable.setValueForMode(modeId, value);
    if (before !== JSON.stringify(entry.variable.valuesByMode[modeId])) changed++;
  }

  const styles = await buildTextStyles(byPath);
  return { total: specs.length, created: created, changed: changed, styles: styles.count, unbound: styles.unbound };
}

// One text style per type role per set, bound to the size and line height variables.
async function buildTextStyles(byPath) {
  const all = [];
  Object.keys(TOKENS).forEach(function (f) { flatten(TOKENS[f]).forEach(function (t) { all.push(t); }); });
  const resolved = resolveAll(all);
  const familyValue = resolved.get('font.family.sans');
  const family = Array.isArray(familyValue) ? familyValue[0] : familyValue;
  const typeDoc = TOKENS['type.json'].type;

  const existing = await figma.getLocalTextStylesAsync();
  const byName = {};
  existing.forEach(function (s) { byName[s.name] = s; });

  let count = 0;
  let unbound = 0;
  for (const setKey of Object.keys(TEXT_SETS)) {
    for (const role of TEXT_ROLES) {
      const ext = typeDoc[role].$extensions || {};
      const italic = ext['com.growgood.fontStyle'] === 'italic';
      const weight = numberAt(resolved, 'type.' + role + '.weight');
      const fontName = { family: family, style: figmaFontStyle(weight, italic) };
      await figma.loadFontAsync(fontName);

      const name = TEXT_SETS[setKey] + '/' + TEXT_ROLE_LABEL[role];
      let style = byName[name];
      if (!style) {
        style = figma.createTextStyle();
        style.name = name;
      }
      style.fontName = fontName;
      style.fontSize = numberAt(resolved, 'type.' + role + '.' + setKey + '.size');
      style.lineHeight = { unit: 'PIXELS', value: numberAt(resolved, 'type.' + role + '.' + setKey + '.line') };
      style.description = 'TYPE-002 (' + (setKey === 'wide' ? '768px and up, D-026' : 'under 768px, D-027') + ')';

      ['size', 'line'].forEach(function (part) {
        const entry = byPath['type.' + role + '.' + setKey + '.' + part];
        const field = part === 'size' ? 'fontSize' : 'lineHeight';
        try {
          style.setBoundVariable(field, entry.variable);
        } catch (e) {
          unbound++; // older Figma builds cannot bind text style fields; the values are set either way
        }
      });
      count++;
    }
  }
  return { count: count, unbound: unbound };
}

// ---- read variables back for export -------------------------------------------------------
async function collectSpecs() {
  const byName = await collectionsByName();
  const vars = await figma.variables.getLocalVariablesAsync();
  const syncById = {};
  SYNC.forEach(function (sync) {
    const c = byName[sync.collection];
    if (c) syncById[c.id] = { sync: sync, collection: c };
  });
  const pathById = {};
  vars.forEach(function (v) {
    const hit = syncById[v.variableCollectionId];
    if (hit) pathById[v.id] = pathFromVar(hit.sync, v.name);
  });
  const specs = [];
  const skipped = [];
  vars.forEach(function (v) {
    const hit = syncById[v.variableCollectionId];
    if (!hit) return;
    let value = v.valuesByMode[hit.collection.defaultModeId];
    if (value && value.type === 'VARIABLE_ALIAS') {
      if (!pathById[value.id]) {
        skipped.push(hit.sync.collection + ' / ' + v.name + ' points outside the token collections');
        return;
      }
      value = { alias: pathById[value.id] };
    }
    specs.push({ collection: hit.sync.collection, name: v.name, resolvedType: v.resolvedType, value: value });
  });
  return { specs: specs, skipped: skipped };
}

async function status() {
  const byName = await collectionsByName();
  const vars = await figma.variables.getLocalVariablesAsync();
  const ids = {};
  SYNC.forEach(function (sync) { if (byName[sync.collection]) ids[byName[sync.collection].id] = true; });
  return { inFile: vars.filter(function (v) { return ids[v.variableCollectionId]; }).length, inRepo: toFigmaSpecs(TOKENS).length };
}

// ---- messages from the panel --------------------------------------------------------------
figma.ui.onmessage = async function (msg) {
  try {
    if (msg.type === 'ready') {
      const settings = (await figma.clientStorage.getAsync(SETTINGS_KEY)) || {};
      post('init', { settings: settings, status: await status() });
    } else if (msg.type === 'import') {
      const result = await importTokens();
      post('imported', { result: result, status: await status() });
      figma.notify('Tokens loaded: ' + result.total + ' variables, ' + result.styles + ' text styles');
    } else if (msg.type === 'build-library') {
      const result = await buildLibrary();
      post('library-built', { result: result });
      figma.notify('Library built: Foundations, ' + result.components.created.length + ' new components, ' + result.templates.created.length + ' new templates');
    } else if (msg.type === 'collect') {
      const collected = await collectSpecs();
      post('collected', collected);
    } else if (msg.type === 'save-settings') {
      await figma.clientStorage.setAsync(SETTINGS_KEY, msg.settings);
      post('saved', {});
    } else if (msg.type === 'open' && /^https:\/\/github\.com\//.test(msg.url)) {
      figma.openExternal(msg.url);
    } else if (msg.type === 'close') {
      figma.closePlugin();
    }
  } catch (e) {
    post('error', { message: String(e && e.message ? e.message : e) });
  }
};

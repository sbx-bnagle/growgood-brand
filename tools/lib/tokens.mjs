// Shared token logic: reading DTCG files, resolving references, and mapping tokens to and
// from Figma variables. Used by the build and check scripts in Node, and bundled into the
// GG Tokens Figma plugin. The plugin sandbox runs older JavaScript, so this file sticks to
// ES2017 syntax: no ?. or ??, no object spread, no Array.prototype.at, flat or flatMap.
// tools/build-figma-plugin.mjs checks that with a parser.

export const TOKEN_FILES = ['color.json', 'color-roles.json', 'type.json', 'space.json', 'layout.json'];

// Which Figma variable collection each token file becomes. `root` is the first path segment,
// dropped from variable names inside that collection (color.green.300 -> Color / green/300).
export const SYNC = [
  { file: 'color.json', collection: 'Color', root: 'color' },
  { file: 'color-roles.json', collection: 'Color roles', root: 'role' },
  { file: 'type.json', collection: 'Type', root: null },
  { file: 'space.json', collection: 'Space', root: 'space' },
  { file: 'layout.json', collection: 'Layout', root: null },
];

const FIGMA_TYPE = { color: 'COLOR', dimension: 'FLOAT', number: 'FLOAT', fontWeight: 'FLOAT', fontFamily: 'STRING' };

export function isToken(node) {
  return !!node && typeof node === 'object' && !Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, '$value');
}
export function isRef(v) {
  return typeof v === 'string' && /^\{[^{}]+\}$/.test(v);
}
export function refPath(v) {
  return v.slice(1, -1);
}
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// Every token in a DTCG document, with its dotted path and inherited $type.
export function flatten(doc) {
  const out = [];
  function walk(node, path, inheritedType) {
    const type = node.$type !== undefined ? node.$type : inheritedType;
    if (isToken(node)) {
      out.push({ path: path.join('.'), type: type, value: node.$value, description: node.$description, extensions: node.$extensions });
      return;
    }
    Object.keys(node).forEach(function (k) {
      const v = node[k];
      if (k.charAt(0) !== '$' && v && typeof v === 'object' && !Array.isArray(v)) walk(v, path.concat([k]), type);
    });
  }
  walk(doc, [], undefined);
  return out;
}

// Resolve {references} across all tokens. Throws on a missing reference or a cycle.
export function resolveAll(tokens) {
  const byPath = new Map();
  tokens.forEach(function (t) { byPath.set(t.path, t); });
  const cache = new Map();
  function resolve(path, seen) {
    if (cache.has(path)) return cache.get(path);
    if (seen.indexOf(path) !== -1) throw new Error('reference cycle: ' + seen.concat([path]).join(' -> '));
    const t = byPath.get(path);
    if (!t) throw new Error('missing reference {' + path + '}' + (seen.length ? ' in ' + seen[seen.length - 1] : ''));
    const v = isRef(t.value) ? resolve(refPath(t.value), seen.concat([path])) : t.value;
    cache.set(path, v);
    return v;
  }
  const out = new Map();
  tokens.forEach(function (t) { out.set(t.path, resolve(t.path, [])); });
  return out;
}

// The $type that applies at a path, following group-level $type down the tree.
export function typeAt(doc, keys) {
  let node = doc;
  let type = doc.$type;
  for (let i = 0; i < keys.length; i++) {
    node = node ? node[keys[i]] : undefined;
    if (node && node.$type !== undefined) type = node.$type;
  }
  return type;
}

// ---- color ------------------------------------------------------------------------------
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; };
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}
export function rgbToHex(c) {
  const parts = [c.r, c.g, c.b];
  if (c.a !== undefined && c.a < 1) parts.push(c.a);
  return '#' + parts.map(function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); }).join('');
}

// ---- Figma mapping -----------------------------------------------------------------------
export function varName(sync, path) {
  const parts = path.split('.');
  return (sync.root ? parts.slice(1) : parts).join('/');
}
export function pathFromVar(sync, name) {
  const parts = name.split('/');
  return (sync.root ? [sync.root].concat(parts) : parts).join('.');
}

export function scopesFor(t) {
  if (t.type === 'color') return ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'];
  if (t.type === 'fontFamily') return ['FONT_FAMILY'];
  if (t.type === 'fontWeight') return ['FONT_WEIGHT'];
  if (/\.size$/.test(t.path)) return ['FONT_SIZE'];
  if (/\.line$/.test(t.path)) return ['LINE_HEIGHT'];
  if (/^space\./.test(t.path)) return ['GAP', 'WIDTH_HEIGHT'];
  if (t.type === 'dimension') return ['WIDTH_HEIGHT'];
  return [];
}

// A token value as a Figma value. References become { alias: path }; the plugin turns them into
// variable aliases.
export function toFigmaValue(t) {
  if (isRef(t.value)) return { alias: refPath(t.value) };
  if (t.type === 'color') return hexToRgb(t.value);
  if (t.type === 'dimension') return typeof t.value === 'object' ? t.value.value : Number(t.value);
  if (t.type === 'fontFamily') return Array.isArray(t.value) ? t.value[0] : t.value;
  return t.value;
}

// Every token that becomes a Figma variable, as a plain spec.
export function toFigmaSpecs(docs) {
  const specs = [];
  SYNC.forEach(function (sync) {
    const doc = docs[sync.file];
    if (!doc) return;
    flatten(doc).forEach(function (t) {
      const resolvedType = FIGMA_TYPE[t.type];
      if (!resolvedType) return;
      specs.push({
        collection: sync.collection, name: varName(sync, t.path), path: t.path, resolvedType: resolvedType,
        value: toFigmaValue(t), scopes: scopesFor(t), description: t.description || '',
      });
    });
  });
  return specs;
}

function fromFigmaValue(spec, previous, type) {
  const v = spec.value;
  if (v && typeof v === 'object' && v.alias) return '{' + v.alias + '}';
  if (spec.resolvedType === 'COLOR') return rgbToHex(v);
  if (spec.resolvedType === 'FLOAT') {
    const n = Math.round(v * 1000) / 1000;
    if (previous && typeof previous === 'object' && !Array.isArray(previous)) return { value: n, unit: previous.unit };
    if (type === 'dimension') return { value: n, unit: 'px' };
    return n;
  }
  if (spec.resolvedType === 'STRING' && Array.isArray(previous)) return [v].concat(previous.slice(1));
  return v;
}
function typeFromFigma(resolvedType, path) {
  if (resolvedType === 'COLOR') return 'color';
  if (resolvedType === 'STRING') return /family/.test(path) ? 'fontFamily' : 'string';
  return /\.(size|line)$/.test(path) || /^space\./.test(path) ? 'dimension' : 'number';
}

// Write Figma variable values back into the repo's token documents. Only $value changes:
// structure, descriptions and extensions stay as the repo has them. New variables become new
// tokens. Tokens with no matching variable are left alone and listed as `missing`.
export function mergeSpecs(docs, specs) {
  const next = clone(docs);
  const changes = [];
  const added = [];
  const seen = {};
  specs.forEach(function (s) {
    let sync = null;
    SYNC.forEach(function (x) { if (x.collection === s.collection) sync = x; });
    if (!sync || !next[sync.file]) return;
    const path = pathFromVar(sync, s.name);
    seen[path] = true;
    const keys = path.split('.');
    let node = next[sync.file];
    for (let i = 0; i < keys.length - 1; i++) {
      if (!node[keys[i]] || typeof node[keys[i]] !== 'object') node[keys[i]] = {};
      node = node[keys[i]];
    }
    const leaf = keys[keys.length - 1];
    const existing = node[leaf];
    const value = fromFigmaValue(s, existing ? existing.$value : undefined, typeAt(next[sync.file], keys));
    if (!isToken(existing)) {
      node[leaf] = { $type: typeFromFigma(s.resolvedType, path), $value: value };
      added.push(path);
    } else if (JSON.stringify(existing.$value) !== JSON.stringify(value)) {
      changes.push({ path: path, from: existing.$value, to: value });
      existing.$value = value;
    }
  });
  const missing = [];
  SYNC.forEach(function (sync) {
    if (!next[sync.file]) return;
    flatten(next[sync.file]).forEach(function (t) { if (FIGMA_TYPE[t.type] && !seen[t.path]) missing.push(t.path); });
  });
  return { docs: next, changes: changes, added: added, missing: missing };
}

// Text styles the plugin builds from the type tokens: one per role per set.
export const TEXT_ROLES = ['display', 'h1', 'lead', 'h2', 'h3', 'h4', 'body', 'small', 'caption'];
export const TEXT_ROLE_LABEL = { display: 'Display', h1: 'Heading 1', lead: 'Lead', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', body: 'Body', small: 'Small', caption: 'Caption' };
export const TEXT_SETS = { wide: 'Wide', narrow: 'Narrow' };
export function figmaFontStyle(weight, italic) {
  if (italic) return weight >= 700 ? 'Bold Italic' : 'Italic';
  if (weight >= 800) return 'ExtraBold';
  if (weight >= 700) return 'Bold';
  if (weight >= 500) return 'Medium';
  return 'Regular';
}

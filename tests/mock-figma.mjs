// A mock of the Figma plugin API, enough for the GG Tokens plugin. It enforces the rules the
// plugin relies on, so a test fails where Figma would: fonts load before text changes,
// variable values match their type, FILL needs an auto-layout parent, component properties
// live on the component (or the variant set), and Starter's page limit.

import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const BINDABLE = ['width', 'height', 'itemSpacing', 'counterAxisSpacing', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'cornerRadius'];

export function mockFigma(opts = {}) {
  const fonts = opts.fonts || ['Alegreya Sans', 'Inter'];
  const pageLimit = opts.pageLimit || 3;
  let n = 0;
  const id = (p) => `${p}:${++n}`;
  const collections = [];
  const variables = [];
  const textStyles = [];
  const storage = {};
  const messages = [];
  const loaded = new Set();
  const fontKey = (f) => `${f.family}|${f.style}`;
  const okValue = (type, v) => {
    if (v && v.type === 'VARIABLE_ALIAS') return variables.some((x) => x.id === v.id);
    if (type === 'COLOR') return ['r', 'g', 'b'].every((k) => typeof v[k] === 'number' && v[k] >= 0 && v[k] <= 1);
    if (type === 'FLOAT') return typeof v === 'number' && Number.isFinite(v);
    if (type === 'STRING') return typeof v === 'string';
    return false;
  };
  const resolve = (v) => {
    for (let i = 0; i < 10; i++) {
      const c = collections.find((x) => x.id === v.variableCollectionId);
      const val = v.valuesByMode[c.defaultModeId];
      if (val && val.type === 'VARIABLE_ALIAS') { v = variables.find((x) => x.id === val.id); continue; }
      return val;
    }
    throw new Error('alias loop');
  };

  // ---- scene graph -----------------------------------------------------------------------
  const ownerOf = (node) => {
    for (let p = node; p; p = p.parent) if (p.type === 'COMPONENT' || p.type === 'COMPONENT_SET') return p.parent && p.parent.type === 'COMPONENT_SET' ? p.parent : p;
    return null;
  };

  function makeNode(type, extra = {}) {
    let layoutSizingHorizontal = 'FIXED';
    let layoutSizingVertical = 'FIXED';
    const node = {
      id: id(type.toLowerCase()), type, name: type, parent: null, x: 0, y: 0, width: 100, height: 100,
      fills: [], strokes: [], strokeWeight: 0, cornerRadius: 0, boundVariables: {}, pluginData: {},
      layoutMode: 'NONE', primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO', itemSpacing: 0, counterAxisSpacing: 0,
      paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0, layoutWrap: 'NO_WRAP', layoutGrids: [], removed: false,
      get layoutSizingHorizontal() { return layoutSizingHorizontal; },
      set layoutSizingHorizontal(v) {
        if (v === 'FILL' && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== 'NONE')) throw new Error(`in set_layoutSizingHorizontal: FILL can only be set on children of auto-layout frames (${this.name})`);
        layoutSizingHorizontal = v;
      },
      get layoutSizingVertical() { return layoutSizingVertical; },
      set layoutSizingVertical(v) {
        if (v === 'FILL' && !(this.parent && this.parent.layoutMode && this.parent.layoutMode !== 'NONE')) throw new Error(`in set_layoutSizingVertical: FILL can only be set on children of auto-layout frames (${this.name})`);
        layoutSizingVertical = v;
      },
      resize(w, h) {
        this.width = w; this.height = h;
        if (this.layoutMode !== 'NONE') { this.primaryAxisSizingMode = 'FIXED'; this.counterAxisSizingMode = 'FIXED'; }
      },
      remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.removed = true; },
      setPluginData(k, v) { this.pluginData[k] = v; },
      getPluginData(k) { return this.pluginData[k] || ''; },
      setBoundVariable(field, variable) {
        if (!BINDABLE.includes(field) && !(type === 'TEXT' && ['fontSize', 'lineHeight'].includes(field))) throw new Error(`cannot bind ${field} on ${type}`);
        if (variable.resolvedType !== 'FLOAT') throw new Error(`${field} needs a FLOAT variable, got ${variable.resolvedType}`);
        this.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: variable.id };
        this[field] = resolve(variable);
      },
      ...extra,
    };
    if (!['TEXT', 'RECTANGLE', 'ELLIPSE', 'INSTANCE'].includes(type)) {
      node.children = [];
      node.appendChild = function (child) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        this.children.push(child);
        child.parent = this;
      };
    }
    if (type === 'COMPONENT' || type === 'COMPONENT_SET') {
      let description = '';
      Object.defineProperty(node, 'description', { get: () => description, set: (v) => { description = v; }, enumerable: true });
      node.componentPropertyDefinitions = {};
      node.addComponentProperty = function (name, kind, value) {
        if (this.type === 'COMPONENT' && this.parent && this.parent.type === 'COMPONENT_SET') throw new Error('Add properties to the component set, not a variant');
        const key = `${name}#${++n}:0`;
        this.componentPropertyDefinitions[key] = { type: kind, defaultValue: value };
        return key;
      };
    } else {
      Object.defineProperty(node, 'description', { set: () => { throw new Error(`description is not supported on ${type}`); } });
    }
    if (type === 'COMPONENT') {
      node.createInstance = function () {
        const inst = makeNode('INSTANCE', { mainComponent: this, width: this.width, height: this.height });
        let exposed = false;
        Object.defineProperty(inst, 'isExposedInstance', {
          get: () => exposed,
          set: (v) => { if (!ownerOf(inst.parent || {})) throw new Error('Only nested instances can be exposed'); exposed = v; },
          enumerable: true,
        });
        figma.currentPage.appendChild(inst);
        return inst;
      };
    }
    return node;
  }

  function makeText() {
    let fontName = { family: 'Inter', style: 'Regular' };
    let characters = '';
    let refs = null;
    const t = makeNode('TEXT', { textStyleId: '', textAutoResize: 'WIDTH_AND_HEIGHT' });
    Object.defineProperties(t, {
      fontName: {
        get: () => fontName,
        set: (f) => {
          if (!loaded.has(fontKey(f))) throw new Error(`font not loaded: ${f.family} ${f.style}`);
          if (t.textStyleId && fontKey(f) !== fontKey(fontName)) t.textStyleId = ''; // Figma detaches the style
          fontName = f;
        },
        enumerable: true,
      },
      characters: { get: () => characters, set: (c) => { if (!loaded.has(fontKey(fontName))) throw new Error(`Cannot write to node with unloaded font "${fontName.family} ${fontName.style}"`); characters = c; }, enumerable: true },
      componentPropertyReferences: {
        get: () => refs,
        set: (r) => {
          const owner = ownerOf(t);
          if (!owner) throw new Error('componentPropertyReferences needs a node inside a component');
          if (!owner.componentPropertyDefinitions[r.characters]) throw new Error(`no property ${r.characters} on ${owner.name}`);
          refs = r;
        },
        enumerable: true,
      },
    });
    t.setTextStyleIdAsync = async function (styleId) {
      if (!loaded.has(fontKey(fontName))) throw new Error(`Cannot write to node with unloaded font "${fontName.family} ${fontName.style}"`);
      const style = textStyles.find((s) => s.id === styleId);
      if (!style) throw new Error(`no text style ${styleId}`);
      if (!loaded.has(fontKey(style.fontName))) throw new Error(`font not loaded: ${style.fontName.family} ${style.fontName.style}`);
      fontName = style.fontName;
      t.textStyleId = styleId;
    };
    return t;
  }

  const pages = [];
  function makePage(name) {
    const p = makeNode('PAGE', { name });
    p.loadAsync = async () => {};
    return p;
  }
  (opts.pages || ['Page 1']).forEach((name) => pages.push(makePage(name)));
  const root = {
    type: 'DOCUMENT',
    get children() { return pages.slice(); },
    insertChild(i, page) { pages.splice(pages.indexOf(page), 1); pages.splice(i, 0, page); },
  };
  pages.forEach((p) => { p.parent = root; });
  const create = (node) => { figma.currentPage.appendChild(node); return node; };

  const figma = {
    showUI() {},
    notify() {},
    openExternal(url) { messages.push({ type: 'external', url }); },
    closePlugin() {},
    ui: { postMessage: (m) => messages.push(m), onmessage: null },
    clientStorage: { getAsync: async (k) => storage[k], setAsync: async (k, v) => { storage[k] = v; } },
    root,
    currentPage: pages[0],
    async setCurrentPageAsync(page) { if (!pages.includes(page)) throw new Error('not a page'); this.currentPage = page; },
    createPage() {
      if (pages.length >= pageLimit) throw new Error(`The Starter plan is limited to ${pageLimit} pages`);
      const p = makePage('Page ' + (pages.length + 1));
      p.parent = root;
      pages.push(p);
      return p;
    },
    createFrame: () => create(makeNode('FRAME')),
    createComponent: () => create(makeNode('COMPONENT')),
    createRectangle: () => create(makeNode('RECTANGLE')),
    createEllipse: () => create(makeNode('ELLIPSE')),
    createText: () => create(makeText()),
    combineAsVariants(components, parent) {
      if (!components.length || components.some((c) => c.type !== 'COMPONENT' || !c.name.includes('='))) throw new Error('combineAsVariants needs components named Property=Value');
      const set = makeNode('COMPONENT_SET');
      parent.appendChild(set);
      components.forEach((c) => set.appendChild(c));
      Object.defineProperty(set, 'defaultVariant', { get: () => set.children[0] });
      return set;
    },
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
      setBoundVariableForPaint(paint, field, variable) {
        if (field !== 'color' || variable.resolvedType !== 'COLOR') throw new Error('paint color needs a COLOR variable');
        const c = resolve(variable);
        return { ...paint, color: { r: c.r, g: c.g, b: c.b }, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: variable.id } } };
      },
      setBoundVariableForLayoutGrid(grid, field, variable) {
        if (variable.resolvedType !== 'FLOAT') throw new Error('grid fields need FLOAT variables');
        return { ...grid, [field]: resolve(variable), boundVariables: { ...(grid.boundVariables || {}), [field]: { type: 'VARIABLE_ALIAS', id: variable.id } } };
      },
    },
    getLocalTextStylesAsync: async () => textStyles.slice(),
    createTextStyle() {
      let fontName = null;
      const style = { id: id('style'), name: '', description: '', bound: {},
        get fontName() { return fontName; },
        set fontName(f) { if (!loaded.has(fontKey(f))) throw new Error(`font not loaded: ${f.family} ${f.style}`); fontName = f; },
        setBoundVariable(field, variable) { this.bound[field] = variable.id; } };
      textStyles.push(style);
      return style;
    },
    loadFontAsync: async (f) => {
      if (!fonts.includes(f.family)) throw new Error(`font unavailable: ${f.family}`);
      loaded.add(fontKey(f));
    },
  };
  return { figma, collections, variables, textStyles, messages, storage, pages };
}

const bundle = () => readFileSync(new URL('../figma-plugin/dist/code.js', import.meta.url), 'utf8');

// Runs the built plugin against a mock and returns a function that sends it a panel message.
export function runPlugin(mock) {
  vm.runInNewContext(bundle(), { figma: mock.figma, __html__: '', console, JSON, Math, Object, Array, Map, Set, Promise, Error, Number, String, RegExp, parseInt });
  return (msg) => mock.figma.ui.onmessage(msg);
}

// Every node under a node, depth first.
export function walk(node, out = []) {
  out.push(node);
  (node.children || []).forEach((c) => walk(c, out));
  return out;
}

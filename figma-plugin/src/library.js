// GG Tokens, library builder (D-031, D-032, D-033). Bundled before code.js. ES2017 only.
// Builds the three pages, the Foundations frame, and a bare frame for each first-set component,
// all bound to this file's variables and text styles. Building again replaces the Foundations
// frame and adds missing components; a component that already exists is never touched, so
// design work on it is safe.

const PAGES = ['Foundations', 'Components', 'Templates'];
const MARK = 'gg'; // plugin data key on everything this builder makes

// ---- context: this file's variables and text styles, by token path ---------------------------
async function libraryContext() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collById = {};
  collections.forEach(function (c) { collById[c.id] = c; });
  const vars = await figma.variables.getLocalVariablesAsync();
  const varById = {};
  const varByKey = {};
  vars.forEach(function (v) {
    varById[v.id] = v;
    if (collById[v.variableCollectionId]) varByKey[collById[v.variableCollectionId].name + '|' + v.name] = v;
  });
  const byPath = {};
  const missing = [];
  toFigmaSpecs(TOKENS).forEach(function (s) {
    const v = varByKey[s.collection + '|' + s.name];
    if (v) byPath[s.path] = v; else missing.push(s.path);
  });
  if (missing.length) throw new Error('Load tokens first: ' + missing.length + ' token variables are not in this file.');

  const styleByName = {};
  (await figma.getLocalTextStylesAsync()).forEach(function (st) { styleByName[st.name] = st; });
  const styleMissing = [];
  Object.keys(TEXT_SETS).forEach(function (set) {
    TEXT_ROLES.forEach(function (role) {
      const name = TEXT_SETS[set] + '/' + TEXT_ROLE_LABEL[role];
      if (!styleByName[name]) styleMissing.push(name);
    });
  });
  if (styleMissing.length) throw new Error('Load tokens first: missing text styles ' + styleMissing.join(', ') + '.');

  // The value in this file now, following aliases, so the pages show what Figma holds.
  function value(path) {
    let v = byPath[path];
    for (let i = 0; i < 10 && v; i++) {
      const val = v.valuesByMode[collById[v.variableCollectionId].defaultModeId];
      if (val && val.type === 'VARIABLE_ALIAS') { v = varById[val.id]; continue; }
      return val;
    }
    throw new Error('Cannot resolve ' + path);
  }
  const family = value('font.family.sans');
  for (const style of ['Regular', 'Italic', 'Bold', 'ExtraBold']) await figma.loadFontAsync({ family: family, style: style });

  return {
    family: family,
    value: value,
    hex: function (path) { return rgbToHex(value(path)); },
    v: function (path) {
      if (!byPath[path]) throw new Error('No variable for ' + path);
      return byPath[path];
    },
    style: function (set, role) { return styleByName[TEXT_SETS[set] + '/' + TEXT_ROLE_LABEL[role]]; },
  };
}

// ---- small builders ---------------------------------------------------------------------
function paint(ctx, path) {
  return figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', ctx.v(path));
}
function fillWith(node, ctx, path) { node.fills = path ? [paint(ctx, path)] : []; }
function strokeWith(node, ctx, path, weight) { node.strokes = [paint(ctx, path)]; node.strokeWeight = weight; }
function bindSpace(node, fields, ctx, path) { fields.forEach(function (f) { node.setBoundVariable(f, ctx.v(path)); }); }
const PAD_Y = ['paddingTop', 'paddingBottom'];
const PAD_X = ['paddingLeft', 'paddingRight'];
const PAD_ALL = PAD_Y.concat(PAD_X);

// An auto-layout frame (or component) that hugs its content, or keeps a fixed width.
function stackOf(node, name, direction, width) {
  node.name = name;
  if (width) node.resize(width, 100);
  node.layoutMode = direction;
  if (direction === 'VERTICAL') {
    node.primaryAxisSizingMode = 'AUTO';
    node.counterAxisSizingMode = width ? 'FIXED' : 'AUTO';
  } else {
    node.primaryAxisSizingMode = width ? 'FIXED' : 'AUTO';
    node.counterAxisSizingMode = 'AUTO';
  }
  node.fills = [];
  return node;
}
function stack(name, direction, width) { return stackOf(figma.createFrame(), name, direction, width); }

// Text in one of the token text styles, colored by a role. fill: stretch to the parent's width.
async function text(ctx, parent, chars, role, colorPath, opts) {
  const o = opts || {};
  const t = figma.createText();
  await figma.loadFontAsync(t.fontName); // the default font, before anything changes it
  await t.setTextStyleIdAsync(ctx.style(o.set || 'wide', role).id);
  if (o.bold) {
    // Changing the weight detaches the text style in Figma, so keep the size and line height
    // on the type variables directly. A stopgap until O-18 decides on a label style.
    t.fontName = { family: ctx.family, style: 'Bold' };
    const set = o.set || 'wide';
    try {
      t.setBoundVariable('fontSize', ctx.v('type.' + role + '.' + set + '.size'));
      t.setBoundVariable('lineHeight', ctx.v('type.' + role + '.' + set + '.line'));
    } catch (e) { /* older Figma builds cannot bind text fields; the values stay as the style set them */ }
  }
  t.characters = chars;
  t.name = o.name || chars;
  if (colorPath) t.fills = [paint(ctx, colorPath)];
  parent.appendChild(t);
  if (o.fill) {
    t.layoutSizingHorizontal = 'FILL';
    t.textAutoResize = 'HEIGHT';
  }
  return t;
}

function textProp(owner, node, name, value) {
  const key = owner.addComponentProperty(name, 'TEXT', value);
  node.componentPropertyReferences = { characters: key };
}

function mark(node, value) { node.setPluginData(MARK, value); return node; }

// ---- pages ------------------------------------------------------------------------------
async function ensurePages() {
  const result = { created: [], renamed: [] };
  for (const name of PAGES) {
    const pages = figma.root.children;
    if (pages.some(function (p) { return p.name === name; })) continue;
    // A new file starts with one empty page; use it rather than adding a page.
    let spare = null;
    for (const p of pages) {
      if (PAGES.indexOf(p.name) !== -1) continue;
      if (p.loadAsync) await p.loadAsync();
      if (p.children.length === 0) { spare = p; break; }
    }
    if (spare) {
      result.renamed.push(spare.name + ' → ' + name);
      spare.name = name;
    } else {
      try {
        figma.createPage().name = name;
      } catch (e) {
        throw new Error('Could not add the ' + name + ' page (' + (e && e.message ? e.message : e) + '). Starter allows three pages per file: empty or remove one, then build again.');
      }
      result.created.push(name);
    }
  }
  PAGES.forEach(function (name, i) {
    const page = figma.root.children.filter(function (p) { return p.name === name; })[0];
    if (figma.root.children.indexOf(page) !== i) figma.root.insertChild(i, page);
  });
  return result;
}

async function openPage(name) {
  const page = figma.root.children.filter(function (p) { return p.name === name; })[0];
  await figma.setCurrentPageAsync(page);
  return page;
}

function bottomOf(page) {
  let y = 0;
  page.children.forEach(function (n) { y = Math.max(y, n.y + n.height); });
  return y;
}

// ---- Foundations ------------------------------------------------------------------------
async function section(ctx, parent, title, note) {
  const s = stack(title, 'VERTICAL', parent.width - parent.paddingLeft - parent.paddingRight);
  bindSpace(s, ['itemSpacing'], ctx, 'space.md');
  parent.appendChild(s);
  await text(ctx, s, title, 'h2', 'role.text.default', { fill: true });
  if (note) await text(ctx, s, note, 'body', 'role.text.muted', { fill: true });
  return s;
}

async function buildFoundations(ctx) {
  const page = await openPage('Foundations');
  let place = null;
  page.children.slice().forEach(function (n) {
    if (n.getPluginData(MARK) === 'foundations') { place = { x: n.x, y: n.y }; n.remove(); }
  });
  const rebuilt = place !== null;
  if (!place) place = { x: 0, y: page.children.length ? bottomOf(page) + 160 : 0 };

  const grids = Object.keys(TOKENS['layout.json'].grid).filter(function (k) { return k.charAt(0) !== '$'; });
  const widest = Math.max.apply(null, grids.map(function (g) { return ctx.value('grid.' + g + '.maxWidth'); }));
  const root = mark(stack('Foundations', 'VERTICAL', Math.max(1600, widest + 2 * ctx.value('space.lg'))), 'foundations');
  fillWith(root, ctx, 'role.surface.default');
  bindSpace(root, PAD_ALL, ctx, 'space.lg');
  bindSpace(root, ['itemSpacing'], ctx, 'space.xl');
  page.appendChild(root);
  root.x = place.x;
  root.y = place.y;

  const head = stack('Title', 'VERTICAL', root.width - root.paddingLeft - root.paddingRight);
  bindSpace(head, ['itemSpacing'], ctx, 'space.xs');
  root.appendChild(head);
  await text(ctx, head, 'Foundations', 'display', 'role.text.default', { fill: true });
  await text(ctx, head, 'Built by GG Tokens from this file’s variables and text styles. Building again replaces this frame, so change values in the variables, not here.', 'body', 'role.text.muted', { fill: true });

  // Color primitives (D-021)
  const color = await section(ctx, root, 'Color', 'Four levels per family (D-021). 100 is the lightest, 200 the bright accent, 300 and 400 dark.');
  for (const family of Object.keys(TOKENS['color.json'].color)) {
    if (family.charAt(0) === '$') continue;
    const row = stack(family, 'HORIZONTAL');
    bindSpace(row, ['itemSpacing'], ctx, 'space.sm');
    color.appendChild(row);
    for (const level of Object.keys(TOKENS['color.json'].color[family])) {
      if (level.charAt(0) === '$') continue;
      const path = 'color.' + family + '.' + level;
      const cell = stack(family + '/' + level, 'VERTICAL', 160);
      bindSpace(cell, ['itemSpacing'], ctx, 'space.xxs');
      row.appendChild(cell);
      const chip = figma.createRectangle();
      chip.name = 'Swatch';
      chip.resize(160, 96);
      fillWith(chip, ctx, path);
      strokeWith(chip, ctx, 'role.border.default', 1);
      cell.appendChild(chip);
      await text(ctx, cell, family + '/' + level, 'small', 'role.text.default', { fill: true });
      await text(ctx, cell, ctx.hex(path), 'small', 'role.text.muted', { fill: true });
    }
  }

  // Color roles and their contrast (D-030)
  const roles = await section(ctx, root, 'Color roles', 'Each role points at a primitive (D-030). Text needs 4.5:1 on its surface; an action needs 3:1 against the surface around it.');
  const grid = stack('Pairs', 'HORIZONTAL', roles.width);
  grid.layoutWrap = 'WRAP';
  bindSpace(grid, ['itemSpacing', 'counterAxisSpacing'], ctx, 'space.sm');
  roles.appendChild(grid);
  let failing = 0;
  for (const pair of ROLE_PAIRS) {
    const fg = pair[0];
    const bg = pair[1];
    const ratio = contrastRatio(ctx.hex(fg), ctx.hex(bg));
    const ok = ratio >= pair[2];
    if (!ok) failing++;
    const tile = stack(fg.slice(5) + ' on ' + bg.slice(5), 'VERTICAL', 336);
    fillWith(tile, ctx, bg);
    bindSpace(tile, PAD_ALL, ctx, 'space.sm');
    bindSpace(tile, ['itemSpacing'], ctx, 'space.xxs');
    grid.appendChild(tile);
    await text(ctx, tile, 'Aa', 'h3', fg);
    await text(ctx, tile, fg.slice(5) + ' on ' + bg.slice(5), 'small', fg, { fill: true });
    await text(ctx, tile, ratio.toFixed(2) + ':1, needs ' + pair[2] + ':1' + (ok ? '' : '. Fails D-030.'), 'small', fg, { fill: true, bold: !ok });
  }

  // Type (TYPE-002, D-026, D-027)
  const type = await section(ctx, root, 'Type', 'Alegreya Sans only (D-020). Wide for 768px and up (D-026); Narrow under 768px (D-027). Every line height sits on the 4px baseline (TYPE-003).');
  const cols = stack('Sets', 'HORIZONTAL');
  bindSpace(cols, ['itemSpacing'], ctx, 'space.lg');
  type.appendChild(cols);
  for (const set of Object.keys(TEXT_SETS)) {
    const col = stack(TEXT_SETS[set], 'VERTICAL', set === 'wide' ? 880 : 480);
    bindSpace(col, ['itemSpacing'], ctx, 'space.sm');
    cols.appendChild(col);
    await text(ctx, col, TEXT_SETS[set] + (set === 'wide' ? ', 768px and up' : ', under 768px'), 'h4', 'role.text.muted', { fill: true });
    for (const role of TEXT_ROLES) {
      const style = ctx.style(set, role);
      await text(ctx, col, TEXT_ROLE_LABEL[role], role, 'role.text.default', { set: set, fill: true });
      await text(ctx, col, ctx.value('type.' + role + '.' + set + '.size') + '/' + ctx.value('type.' + role + '.' + set + '.line') + ', ' + style.fontName.style, 'small', 'role.text.muted', { fill: true });
    }
  }

  // Space
  const space = await section(ctx, root, 'Space', 'Spacing steps, bound to the Space variables.');
  for (const step of Object.keys(TOKENS['space.json'].space)) {
    if (step.charAt(0) === '$') continue;
    const row = stack('space/' + step, 'HORIZONTAL');
    row.counterAxisAlignItems = 'CENTER';
    bindSpace(row, ['itemSpacing'], ctx, 'space.sm');
    space.appendChild(row);
    const amount = ctx.value('space.' + step);
    const bar = figma.createRectangle();
    bar.name = 'Bar';
    bar.resize(Math.max(amount, 1), 12);
    fillWith(bar, ctx, 'role.action.default');
    if (amount > 0) bar.setBoundVariable('width', ctx.v('space.' + step));
    row.appendChild(bar);
    await text(ctx, row, step + ' ' + amount, 'small', 'role.text.default');
  }

  // Layout
  const layout = await section(ctx, root, 'Layout', 'Breakpoints ' + ['s', 'm', 'l'].map(function (b) { return b + ' ' + ctx.value('breakpoint.' + b); }).join(', ') + '. Grids, each at its largest width:');
  for (const name of grids) {
    const p = 'grid.' + name + '.';
    const count = ctx.value(p + 'columns');
    const gutter = ctx.value(p + 'gutter');
    const margin = ctx.value(p + 'margin');
    const max = ctx.value(p + 'maxWidth');
    await text(ctx, layout, 'grid/' + name + ': ' + count + ' columns, ' + gutter + ' gutter, ' + margin + ' margin, ' + max + ' wide', 'small', 'role.text.default');
    const frame = figma.createFrame();
    frame.name = 'grid/' + name;
    frame.resize(max, 120);
    fillWith(frame, ctx, 'role.surface.tint');
    let lg = { pattern: 'COLUMNS', alignment: 'STRETCH', count: count, gutterSize: gutter, offset: margin, visible: true, color: { r: 0.86, g: 0.33, b: 0.24, a: 0.12 } };
    try {
      lg = figma.variables.setBoundVariableForLayoutGrid(lg, 'count', ctx.v(p + 'columns'));
      lg = figma.variables.setBoundVariableForLayoutGrid(lg, 'gutterSize', ctx.v(p + 'gutter'));
      lg = figma.variables.setBoundVariableForLayoutGrid(lg, 'offset', ctx.v(p + 'margin'));
    } catch (e) { /* older Figma builds cannot bind grids; the values are set either way */ }
    frame.layoutGrids = [lg];
    layout.appendChild(frame);
  }

  // Logo
  await section(ctx, root, 'Logo', 'The existing logo is the provisional mark (D-025). Its files go in Brand Assets / Logos; the Wordmark component holds its place until then.');

  return { rebuilt: rebuilt, failingPairs: failing };
}

// ---- components (D-033) -----------------------------------------------------------------
function describe(node, lines) { node.description = lines.join('\n'); }

function variantSet(components, name, page) {
  const set = figma.combineAsVariants(components, page);
  set.name = name;
  set.layoutMode = 'HORIZONTAL';
  set.primaryAxisSizingMode = 'AUTO';
  set.counterAxisSizingMode = 'AUTO';
  set.itemSpacing = 24;
  set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
  return set;
}

// A pill with a label: the site's gg_button shape (height 42, radius 60, 24px sides).
async function pill(ctx, node, label, fillPath, textPath, outline) {
  node.resize(120, 42);
  node.layoutMode = 'HORIZONTAL';
  node.primaryAxisSizingMode = 'AUTO';
  node.counterAxisSizingMode = 'FIXED';
  node.primaryAxisAlignItems = 'CENTER';
  node.counterAxisAlignItems = 'CENTER';
  node.paddingLeft = node.paddingRight = 24;
  node.cornerRadius = 60;
  if (outline) { node.fills = []; strokeWith(node, ctx, textPath, 2); } else fillWith(node, ctx, fillPath);
  return text(ctx, node, label, 'small', textPath, { bold: true, name: 'Label' });
}

const COMPONENTS = [
  {
    name: 'Wordmark',
    build: async function (ctx) {
      const c = figma.createComponent();
      stackOf(c, 'Wordmark', 'HORIZONTAL', 240);
      c.counterAxisSizingMode = 'FIXED';
      c.resize(240, 64);
      c.primaryAxisAlignItems = 'CENTER';
      c.counterAxisAlignItems = 'CENTER';
      fillWith(c, ctx, 'role.border.default');
      await text(ctx, c, 'Wordmark', 'small', 'role.text.muted');
      describe(c, ['Placeholder for the provisional logo (D-025) until its files are in Brand Assets / Logos.', 'Replace the contents; keep the component, so every instance updates.']);
      return c;
    },
  },
  {
    name: 'Button',
    build: async function (ctx, page) {
      const styles = [['Default', 'role.action.default', 'role.action.on-default'], ['Bright', 'role.action.bright', 'role.action.on-bright']];
      const parts = [];
      for (const s of styles) {
        const c = figma.createComponent();
        c.name = 'Style=' + s[0];
        parts.push({ c: c, t: await pill(ctx, c, 'Button label', s[1], s[2]) });
      }
      const set = variantSet(parts.map(function (p) { return p.c; }), 'Button', page);
      const key = set.addComponentProperty('label', 'TEXT', 'Button label');
      parts.forEach(function (p) { p.t.componentPropertyReferences = { characters: key }; });
      describe(set, ['Mirrors .gg_button. Style: Default on light surfaces, Bright on dark ones (D-030).', 'Label is small bold, which has no text style yet. Not on tokens: height 42, radius 60, sides 24.']);
      return set;
    },
  },
  {
    name: 'Card',
    build: async function (ctx, page) {
      const parts = [];
      for (const color of ['green', 'red', 'gold', 'purple']) {
        const c = figma.createComponent();
        stackOf(c, 'Color=' + color.charAt(0).toUpperCase() + color.slice(1), 'VERTICAL', 360);
        c.cornerRadius = 20;
        fillWith(c, ctx, 'role.accent.' + color);
        bindSpace(c, PAD_ALL, ctx, 'space.md');
        bindSpace(c, ['itemSpacing'], ctx, 'space.xs');
        const title = await text(ctx, c, 'Title', 'h3', 'role.text.inverse', { fill: true });
        const blurb = await text(ctx, c, 'Blurb', 'body', 'role.text.inverse', { fill: true });
        const link = stack('Link', 'HORIZONTAL');
        c.appendChild(link);
        const label = await pill(ctx, link, 'Link', null, 'role.text.inverse', true);
        parts.push({ c: c, title: title, blurb: blurb, link: label });
      }
      const set = variantSet(parts.map(function (p) { return p.c; }), 'Card', page);
      ['title', 'blurb', 'link'].forEach(function (prop) {
        const key = set.addComponentProperty(prop, 'TEXT', prop.charAt(0).toUpperCase() + prop.slice(1));
        parts.forEach(function (p) { p[prop].componentPropertyReferences = { characters: key }; });
      });
      describe(set, ['Mirrors _includes/card.html: color, title, blurb, link. dest is the link target, not drawn.', 'Accent surface with inverse text (D-030). Not on tokens: radius 20.']);
      return set;
    },
  },
  {
    name: 'CTA block',
    build: async function (ctx, page, made) {
      const c = figma.createComponent();
      stackOf(c, 'CTA block', 'VERTICAL', 960);
      fillWith(c, ctx, 'role.surface.tint');
      bindSpace(c, PAD_ALL, ctx, 'space.lg');
      bindSpace(c, ['itemSpacing'], ctx, 'space.md');
      textProp(c, await text(ctx, c, 'Heading', 'h2', 'role.text.default', { fill: true }), 'heading', 'Heading');
      textProp(c, await text(ctx, c, 'Body', 'body', 'role.text.default', { fill: true }), 'body', 'Body');
      exposeButton(c, made, 'Default');
      describe(c, ['Mirrors _includes/cta.html: heading, body, button (the Button’s label), href (not drawn).']);
      return c;
    },
  },
  {
    name: 'Hero',
    build: async function (ctx, page, made) {
      const c = figma.createComponent();
      stackOf(c, 'Hero', 'VERTICAL', 960);
      bindSpace(c, ['itemSpacing'], ctx, 'space.md');
      if (made.Wordmark) c.appendChild(made.Wordmark.createInstance());
      textProp(c, await text(ctx, c, 'Deck', 'lead', 'role.text.default', { fill: true }), 'deck', 'Deck');
      describe(c, ['Mirrors _includes/hero.html: the wordmark and a deck in the lead style (TYPE-004).']);
      return c;
    },
  },
  {
    name: 'Header',
    build: async function (ctx, page, made) {
      const c = figma.createComponent();
      stackOf(c, 'Header', 'HORIZONTAL', 1240);
      c.primaryAxisAlignItems = 'SPACE_BETWEEN';
      c.counterAxisAlignItems = 'CENTER';
      fillWith(c, ctx, 'role.surface.default');
      bindSpace(c, PAD_Y, ctx, 'space.sm');
      if (made.Wordmark) c.appendChild(made.Wordmark.createInstance());
      const nav = stack('Nav', 'HORIZONTAL');
      bindSpace(nav, ['itemSpacing'], ctx, 'space.md');
      c.appendChild(nav);
      const items = ['Services', 'Journal', 'About'];
      for (let i = 0; i < items.length; i++) textProp(c, await text(ctx, nav, items[i], 'body', 'role.text.default'), 'nav ' + (i + 1), items[i]);
      describe(c, ['Mirrors _includes/header.html: masthead and the navigation from the site’s nav config.']);
      return c;
    },
  },
  {
    name: 'Footer',
    build: async function (ctx) {
      const c = figma.createComponent();
      stackOf(c, 'Footer', 'HORIZONTAL', 1240);
      c.primaryAxisAlignItems = 'SPACE_BETWEEN';
      c.counterAxisAlignItems = 'CENTER';
      fillWith(c, ctx, 'role.surface.inverse');
      bindSpace(c, PAD_Y, ctx, 'space.sm');
      bindSpace(c, PAD_X, ctx, 'space.lg');
      textProp(c, await text(ctx, c, 'Copyright line', 'small', 'role.text.inverse'), 'copyright', 'Copyright line');
      const social = stack('Social', 'HORIZONTAL');
      bindSpace(social, ['itemSpacing'], ctx, 'space.xs');
      c.appendChild(social);
      for (const name of ['Instagram', 'Facebook']) await text(ctx, social, name, 'small', 'role.text.inverse');
      describe(c, ['Mirrors _includes/footer.html: copyright line and social links (D-008: Instagram and Facebook).']);
      return c;
    },
  },
  {
    name: 'FAQ item',
    build: async function (ctx) {
      const c = figma.createComponent();
      stackOf(c, 'FAQ item', 'VERTICAL', 720);
      bindSpace(c, ['itemSpacing'], ctx, 'space.xs');
      textProp(c, await text(ctx, c, 'Question', 'h4', 'role.text.default', { fill: true }), 'question', 'Question');
      textProp(c, await text(ctx, c, 'Answer', 'body', 'role.text.default', { fill: true }), 'answer', 'Answer');
      describe(c, ['Mirrors one entry of _includes/faq.html: question and answer.']);
      return c;
    },
  },
  {
    name: 'Subscribe',
    build: async function (ctx, page, made) {
      const c = figma.createComponent();
      stackOf(c, 'Subscribe', 'VERTICAL', 720);
      fillWith(c, ctx, 'role.surface.inverse');
      bindSpace(c, PAD_ALL, ctx, 'space.md');
      bindSpace(c, ['itemSpacing'], ctx, 'space.sm');
      textProp(c, await text(ctx, c, 'Email newsletter', 'h3', 'role.text.inverse', { fill: true }), 'heading', 'Email newsletter');
      const row = stack('Form', 'HORIZONTAL');
      bindSpace(row, ['itemSpacing'], ctx, 'space.xs');
      c.appendChild(row);
      const field = figma.createFrame();
      row.appendChild(field);
      await pill(ctx, field, 'Email address', null, 'role.text.inverse', true);
      field.name = 'Email field';
      exposeButton(row, made, 'Bright');
      describe(c, ['Mirrors _includes/subscribe.html on a dark surface, so its button is Bright (D-030).']);
      return c;
    },
  },
  {
    name: 'Event details',
    build: async function (ctx, page, made) {
      const fields = [['name', 'Event name', 'h2'], ['what', 'What it is, in one sentence', 'body'], ['when', 'Day, date and time', 'body'], ['where', 'Place', 'body'], ['cost', 'Cost', 'body']];
      const parts = [];
      for (const set of ['wide', 'narrow']) {
        const c = figma.createComponent();
        stackOf(c, 'Set=' + TEXT_SETS[set], 'VERTICAL', set === 'wide' ? 480 : 270);
        bindSpace(c, ['itemSpacing'], ctx, 'space.xs');
        const nodes = {};
        for (const f of fields) nodes[f[0]] = await text(ctx, c, f[1], f[2], 'role.text.default', { set: set, fill: true, bold: f[0] === 'when' });
        exposeButton(c, made, 'Default');
        parts.push(nodes);
        parts[parts.length - 1].component = c;
      }
      const evset = variantSet(parts.map(function (p) { return p.component; }), 'Event details', page);
      fields.forEach(function (f) {
        const key = evset.addComponentProperty(f[0], 'TEXT', f[1]);
        parts.forEach(function (p) { p[f[0]].componentPropertyReferences = { characters: key }; });
      });
      describe(evset, ['New in D-033, for every format. VOICE-010: the event’s name, then what, when, where, cost.', 'Set: Wide for web, flyers and social; Narrow for postcards (D-034). Dates, times and places as in verbal/names-and-dates.md. Every value comes from the request or claims.md.']);
      return evset;
    },
  },
  {
    name: 'Art placeholder',
    build: async function (ctx) {
      const c = figma.createComponent();
      stackOf(c, 'Art placeholder', 'VERTICAL', 480);
      c.resize(480, 320);
      c.primaryAxisAlignItems = 'CENTER';
      c.counterAxisAlignItems = 'CENTER';
      fillWith(c, ctx, 'role.surface.tint');
      strokeWith(c, ctx, 'role.border.default', 1);
      bindSpace(c, PAD_ALL, ctx, 'space.md');
      bindSpace(c, ['itemSpacing'], ctx, 'space.xxs');
      await text(ctx, c, 'Art', 'h3', 'role.text.default');
      await text(ctx, c, 'English craft, hippie modernism, hand drawn (D-035). Placeholder until the art direction references are in.', 'small', 'role.text.muted', { fill: true });
      describe(c, ['Holds the place of the art direction in every template (D-035).', 'Replace the contents once the references are in Brand Assets / Art direction; keep the component, so every template updates.']);
      return c;
    },
  },
  {
    name: 'Image with spot',
    build: async function (ctx, page) {
      const parts = [];
      for (const pos of [['Top left', 24, 24], ['Bottom right', 360, 240]]) {
        const c = figma.createComponent();
        c.name = 'Position=' + pos[0];
        c.resize(480, 360);
        fillWith(c, ctx, 'role.border.default');
        const label = figma.createText();
        await figma.loadFontAsync(label.fontName);
        await label.setTextStyleIdAsync(ctx.style('wide', 'small').id);
        label.characters = 'Photo';
        label.name = 'Photo';
        label.fills = [paint(ctx, 'role.text.muted')];
        c.appendChild(label);
        label.x = 216;
        label.y = 168;
        const spot = figma.createEllipse();
        spot.name = 'Spot';
        spot.resize(96, 96);
        fillWith(spot, ctx, 'color.green.200');
        c.appendChild(spot);
        spot.x = pos[1];
        spot.y = pos[2];
        parts.push(c);
      }
      const set = variantSet(parts, 'Image with spot', page);
      describe(set, ['D-024: a photograph with an animated spot laid over it.', 'Swap the fill for an approved image and the circle for a spot from the asset library.']);
      return set;
    },
  },
];

// A Button instance inside a component, with its label exposed to the component's instances.
function exposeButton(parent, made, style) {
  if (!made.Button) return null;
  const variant = made.Button.children.filter(function (n) { return n.name === 'Style=' + style; })[0] || made.Button.defaultVariant || made.Button.children[0];
  const instance = variant.createInstance();
  parent.appendChild(instance);
  try { instance.isExposedInstance = true; } catch (e) { /* exposing nested instances needs a newer Figma build */ }
  return instance;
}

async function buildComponents(ctx) {
  const page = await openPage('Components');
  const made = {};
  page.children.forEach(function (n) {
    const name = n.getPluginData(MARK);
    if (name) made[name.replace(/^component:/, '')] = n;
  });
  const created = [];
  const kept = [];
  let y = bottomOf(page) + (page.children.length ? 160 : 0);
  for (const def of COMPONENTS) {
    if (made[def.name]) { kept.push(def.name); continue; }
    const node = await def.build(ctx, page, made);
    if (node.parent !== page) page.appendChild(node);
    mark(node, 'component:' + def.name);
    node.x = 0;
    node.y = y;
    y += node.height + 120;
    made[def.name] = node;
    created.push(def.name);
  }
  return { created: created, kept: kept, made: made };
}

// ---- templates (D-007, D-008, D-034, D-036) ------------------------------------------------
function instanceOf(made, name, variant) {
  const node = made[name];
  if (!node) return null;
  if (node.type !== 'COMPONENT_SET') return node.createInstance();
  const v = node.children.filter(function (n) { return n.name === variant; })[0] || node.defaultVariant || node.children[0];
  return v.createInstance();
}

// A template frame: fixed size, padded, its parts stacked; each part fills the width.
function sheet(ctx, name, w, h, direction, padPath) {
  const f = stack(name, direction || 'VERTICAL', w);
  f.resize(w, h);
  f.clipsContent = true;
  fillWith(f, ctx, 'role.surface.default');
  bindSpace(f, PAD_ALL, ctx, padPath || 'space.md');
  bindSpace(f, ['itemSpacing'], ctx, 'space.sm');
  return f;
}
function place(parent, node, fill, grow) {
  if (!node) return null;
  parent.appendChild(node);
  if (fill) node.layoutSizingHorizontal = 'FILL';
  if (grow) node.layoutSizingVertical = 'FILL';
  return node;
}

const TEMPLATES = [
  {
    name: 'Web / Event page',
    row: 0,
    build: function (ctx, made) {
      const f = stack('Web / Event page', 'VERTICAL', 1440);
      fillWith(f, ctx, 'role.surface.default');
      f.layoutGrids = [{ pattern: 'COLUMNS', alignment: 'STRETCH', count: ctx.value('grid.16.columns'), gutterSize: ctx.value('grid.16.gutter'), offset: ctx.value('grid.16.margin'), visible: true, color: { r: 0.86, g: 0.33, b: 0.24, a: 0.08 } }];
      place(f, instanceOf(made, 'Header'), true);
      const body = stack('Content', 'VERTICAL');
      bindSpace(body, PAD_ALL, ctx, 'space.lg');
      bindSpace(body, ['itemSpacing'], ctx, 'space.lg');
      place(f, body, true);
      place(body, instanceOf(made, 'Hero'), true);
      place(body, instanceOf(made, 'Art placeholder'), true);
      place(body, instanceOf(made, 'Event details', 'Set=Wide'));
      place(body, instanceOf(made, 'CTA block'), true);
      place(f, instanceOf(made, 'Footer'), true);
      return f;
    },
  },
  {
    name: 'Flyer / Letter',
    row: 1,
    build: function (ctx, made) {
      const f = sheet(ctx, 'Flyer / Letter', 612, 792);
      place(f, instanceOf(made, 'Wordmark'));
      place(f, instanceOf(made, 'Art placeholder'), true, true);
      place(f, instanceOf(made, 'Event details', 'Set=Wide'), true);
      return f;
    },
  },
  {
    name: 'Postcard / Front',
    row: 1,
    build: function (ctx, made) {
      const f = sheet(ctx, 'Postcard / Front', 306, 396, 'VERTICAL', 'space.sm');
      place(f, instanceOf(made, 'Art placeholder'), true, true);
      place(f, instanceOf(made, 'Wordmark'));
      return f;
    },
  },
  {
    name: 'Postcard / Back',
    row: 1,
    build: function (ctx, made) {
      const f = sheet(ctx, 'Postcard / Back', 306, 396, 'VERTICAL', 'space.sm');
      place(f, instanceOf(made, 'Event details', 'Set=Narrow'), true);
      place(f, instanceOf(made, 'Wordmark'));
      return f;
    },
  },
  {
    name: 'Postcard / Sheet of four',
    row: 1,
    build: async function (ctx) {
      const f = figma.createFrame();
      f.name = 'Postcard / Sheet of four';
      f.resize(612, 792);
      fillWith(f, ctx, 'role.surface.default');
      for (let i = 0; i < 4; i++) {
        const cell = figma.createFrame();
        cell.name = 'Card ' + (i + 1);
        cell.resize(306, 396);
        cell.fills = [];
        strokeWith(cell, ctx, 'role.border.default', 1);
        f.appendChild(cell);
        cell.x = (i % 2) * 306;
        cell.y = Math.floor(i / 2) * 396;
        await text(ctx, cell, 'Card ' + (i + 1), 'small', 'role.text.muted');
      }
      return f;
    },
  },
  {
    name: 'Social / Feed',
    row: 2,
    build: function (ctx, made) {
      const f = sheet(ctx, 'Social / Feed', 1080, 1350, 'VERTICAL', 'space.lg');
      place(f, instanceOf(made, 'Wordmark'));
      place(f, instanceOf(made, 'Art placeholder'), true, true);
      place(f, instanceOf(made, 'Event details', 'Set=Wide'), true);
      return f;
    },
  },
  {
    name: 'Social / Story',
    row: 2,
    build: function (ctx, made) {
      const f = sheet(ctx, 'Social / Story', 1080, 1920, 'VERTICAL', 'space.xl');
      place(f, instanceOf(made, 'Wordmark'));
      place(f, instanceOf(made, 'Art placeholder'), true, true);
      place(f, instanceOf(made, 'Event details', 'Set=Wide'), true);
      return f;
    },
  },
  {
    name: 'Social / Event cover',
    row: 2,
    build: function (ctx, made) {
      const f = sheet(ctx, 'Social / Event cover', 1920, 1005, 'HORIZONTAL', 'space.lg');
      const art = place(f, instanceOf(made, 'Art placeholder'), false, true);
      if (art) art.resize(1040, art.height);
      if (art) art.layoutSizingVertical = 'FILL';
      const side = stack('Details', 'VERTICAL');
      bindSpace(side, ['itemSpacing'], ctx, 'space.md');
      place(f, side);
      place(side, instanceOf(made, 'Wordmark'));
      place(side, instanceOf(made, 'Event details', 'Set=Wide'));
      return f;
    },
  },
];

async function buildTemplates(ctx, made) {
  const page = await openPage('Templates');
  page.children.slice().forEach(function (n) { if (n.getPluginData(MARK) === 'templates-note') n.remove(); });
  const have = {};
  page.children.forEach(function (n) { const m = n.getPluginData(MARK); if (m) have[m.replace(/^template:/, '')] = n; });
  const created = [];
  const kept = [];
  const rowY = [0, 0, 0];
  const rowX = [0, 0, 0];
  let y = page.children.length ? bottomOf(page) + 200 : 0;
  for (let row = 0; row < 3; row++) {
    rowY[row] = y;
    for (const def of TEMPLATES) {
      if (def.row !== row) continue;
      if (have[def.name]) { kept.push(def.name); continue; }
      const node = await def.build(ctx, made);
      page.appendChild(node);
      mark(node, 'template:' + def.name);
      node.x = rowX[row];
      node.y = rowY[row];
      rowX[row] += node.width + 200;
      y = Math.max(y, rowY[row] + node.height + 200);
      created.push(def.name);
    }
  }
  return { created: created, kept: kept };
}

async function buildLibrary() {
  const ctx = await libraryContext();
  const pages = await ensurePages();
  const foundations = await buildFoundations(ctx);
  const components = await buildComponents(ctx);
  const templates = await buildTemplates(ctx, components.made);
  await openPage('Foundations');
  return { pages: pages, foundations: foundations, components: { created: components.created, kept: components.kept }, templates: templates };
}

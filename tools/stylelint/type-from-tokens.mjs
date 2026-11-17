// Stylelint rule gg/type-from-tokens (D-054, checks/stylelint.md): type values come from tokens.
// TYPE-001 font-family, TYPE-002 font-size and font-weight, TYPE-003 line-height (a multiple of
// 4px). A value counts as a token when it is a var(--gg-…) or var(--ts-…) custom property, a Sass
// variable, a Sass function or interpolation (the theme’s Sass reads tokens through these), or a
// CSS-wide keyword. Token definitions themselves ($variables, --custom properties) and @font-face
// descriptors are not checked.

import stylelint from 'stylelint';

const { createPlugin, utils: { report, ruleMessages, validateOptions } } = stylelint;

export const ruleName = 'gg/type-from-tokens';
export const messages = ruleMessages(ruleName, {
  rejected: (id, prop, value, want) => `${id} ${prop}: ${value} is not from tokens; ${want}`,
});

const FROM_TOKENS = [/var\(--(?:gg|ts)-/, /\$[\w-]+/, /^[\w-]+\(/, /#\{/];
const KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);
const fromTokens = (v) => KEYWORDS.has(v) || FROM_TOKENS.some((re) => re.test(v));
const multipleOf4px = (v) => /^\d+px$/.test(v) && parseInt(v, 10) % 4 === 0;

export const CHECKS = {
  'font-family': { id: 'TYPE-001', want: 'use var(--gg-font-family-sans)', ok: () => false },
  font: { id: 'TYPE-001', want: 'set family, size and line height from a type role', ok: () => false },
  'font-size': { id: 'TYPE-002', want: 'use a type role’s size token', ok: () => false },
  'font-weight': { id: 'TYPE-002', want: 'use 400, 700 or 800', ok: (v) => /^(400|700|800|normal|bold)$/.test(v) },
  // A line height of 0 holds no line of its own, so it cannot break the grid.
  'line-height': { id: 'TYPE-003', want: 'use a type role’s line token, or a multiple of 4px', ok: (v) => v === '0' || multipleOf4px(v) },
};

const insideFontFace = (node) => {
  for (let p = node.parent; p; p = p.parent) if (p.type === 'atrule' && p.name === 'font-face') return true;
  return false;
};

const rule = (primary) => (root, result) => {
  if (!validateOptions(result, ruleName, { actual: primary, possible: [true] })) return;
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    const check = CHECKS[prop];
    if (!check || insideFontFace(decl)) return;
    const value = decl.value.trim();
    if (fromTokens(value) || check.ok(value)) return;
    report({ ruleName, result, node: decl, word: decl.value, message: messages.rejected(check.id, prop, value, check.want) });
  });
};
rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = { url: 'https://growgood-playbook.pages.dev/checks/stylelint' };

export default createPlugin(ruleName, rule);

// Stylelint for the theme Sass (D-054, checks/stylelint.md). One rule for now: type values come
// from tokens (TYPE-001 to TYPE-003). Color joins when brand/visual/color.md has its rules.
// Run it with npm run checks:styles, which reports by rule ID and writes the run summary.

import typeFromTokens from './tools/stylelint/type-from-tokens.mjs';

export default {
  customSyntax: 'postcss-scss',
  plugins: [typeFromTokens],
  rules: {
    'gg/type-from-tokens': true,
  },
};

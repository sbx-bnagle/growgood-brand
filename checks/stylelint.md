---
id: stylelint
title: Style values from tokens
command: npm run checks:styles (the theme); npm run checks:site (the site, with the copy check)
rules: [TYPE-001, TYPE-002, TYPE-003]
runs_on: [brand pull requests (_sass/gg); site pull requests (the site’s own _sass and assets)]
level_now: warn
level_at_launch: block in _sass/gg (O-20)
status: draft
decisions: [D-054]
---

# Style values from tokens

Stylelint 17 with one rule of the brand’s own, `gg/type-from-tokens` (`tools/stylelint/type-from-tokens.mjs`), set in `stylelint.config.mjs`. It reads Sass with `postcss-scss`.

## What it checks

| Property | Rule | Passes |
|---|---|---|
| `font-family`, `font` | TYPE-001 | a token |
| `font-size` | TYPE-002 | a token |
| `font-weight` | TYPE-002 | a token, or 400, 700 or 800 |
| `line-height` | TYPE-003 | a token, a multiple of 4px, or 0 |

A token is a `var(--gg-…)` or `var(--ts-…)` custom property, a Sass variable, a Sass function such as `bl()` or `map-get()`, or interpolation; the theme’s Sass reads tokens through all of these. CSS-wide keywords such as `inherit` pass.

## What it leaves out

- Token definitions: Sass variables and custom properties being set.
- `@font-face` descriptors, which name a font rather than set one.
- `fonts/`, `vendor/`, `node_modules/` and `_site/`. The icon font’s generated CSS is vendor code.
- Jekyll front matter on a Sass entry file, which is blanked so the file parses.

## Known limits

- It cannot tell which token a Sass variable or function holds; a variable set to a literal size passes.
- Color joins when `visual/color.md` has its rules.
- The site’s own Sass is reported only (D-054), until it moves to the theme.

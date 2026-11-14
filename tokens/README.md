# Tokens

Color, type, spacing and layout values, shared by the Figma file, this repo’s theme and the live site.

## Files

| File | Holds | Decisions |
|---|---|---|
| `color.json` | Five color families, four levels each | D-021 |
| `color-roles.json` | Roles (surface, text, action, accent) that point at the primitives | D-030 |
| `type.json` | Alegreya Sans, weights, and both size sets | D-020, D-026, D-027 |
| `space.json` | Spacing on the 4px baseline, as the site Sass has it | D-012 |
| `layout.json` | Breakpoints and grids from the site Sass | D-027 uses `breakpoint.m` |
| `build/` | Generated: `tokens.css`, `_tokens.scss`, `tokens.json` | D-028 |
| `seed/` | Where the values came from: `from-sass.json`, `color-ramps.json`. Kept for history. | D-012, D-021 |

The files are DTCG JSON, two-space indented with one trailing newline. That is the layout the Figma plugin writes, and `tokens:check` enforces it, so a pull request from Figma shows only the values that changed.

## Commands

```bash
npm run tokens:check
```

Checks the tokens against their rules: structure and references, D-021 (contrast and order), D-030 (role pairs), TYPE-003 (4px line heights and spacing), TYPE-004 (lead matches heading 1), size order and minimum leading.

```bash
npm run tokens:build
```

Writes `build/`. CSS custom properties are named `--gg-…`; type sizes use the narrow set by default and switch to the wide set at `breakpoint.m`. Sass gets `$gg-…` variables plus `$gg-colors` and `$gg-type` maps. `tokens.json` is flat and resolved, for agents and the MCP server.

```bash
npm test
```

Rebuilds the Figma plugin and tests it against a mock of the Figma API.

## Pipeline: Figma to the live site

```
Figma: GG Design System (Starter)
  │  GG Tokens plugin
  │    Load tokens: repo → Figma variables and text styles
  │    Send changes: Figma variable values → pull request (decision D-029)
  ▼
Pull request on growgood-brand, changing tokens/*.json
  │  Tokens workflow (.github/workflows/tokens.yml):
  │    tokens:check, every failure named by its rule
  │    tokens:build and the plugin bundle, committed back to the pull request
  │    plugin tests
  │  gate: Leah approves
  ▼
merge to main, then a release tag (Phase 4)
  ▼
Pull request on growgood bumping the theme: site build, link check, accessibility, visual diff
  │  gate: merge = publish
  ▼
GitHub Pages deploy (GitHub Actions build, D-003)
```

Values flow from Figma. Names, structure, descriptions and new groups change here, by pull request, and reach Figma the next time the plugin is rebuilt and Load tokens runs.

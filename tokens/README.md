# Tokens

Color, type, spacing and layout values, shared by Figma, this theme and the live site.

## Where values are decided

The site’s current Sass values (`growgood/_sass/config/`) seed Figma once. After that, Figma is where values are decided and refined (decision D-012). This folder holds the exported values as DTCG JSON. Nobody edits it by hand.

## Pipeline: Figma to the live site

```
Figma: GG Design System, Variables
  │  Export button in the GG Tokens development plugin (decision D-018)
  ▼
PR on growgood-brand: tokens/*.json changed
  │  checks: DTCG schema valid
  │          renamed or removed tokens flagged (breaking change)
  │          declared color pairs pass WCAG AA contrast
  │          Style Dictionary build to Sass and CSS custom properties
  │          stylelint: theme Sass uses tokens, no raw values
  │          playbook build and visual diff of every component
  │  gate:   keeper approves the visual diff
  ▼
merge, then release tag (semver: value change = patch, new token = minor,
renamed or removed token = major)
  │
  ▼
PR on growgood: bump the theme to the new tag (opened automatically)
  │  checks: Jekyll build, link check, axe on key pages, visual diff of site pages
  │  gate:   merge = publish
  ▼
GitHub Pages deploy (GitHub Actions build, decision D-003)
```

Component changes in Figma (structure, not values) follow the same checks, but the PR is drafted by an agent reading the Figma component through the Figma connector, then reviewed by the maintainer. Values sync automatically. Structure is agent-assisted.

## Files (Phase 2)

- `seed/from-sass.json`: values extracted from the current site, used once to seed Figma.
- `color.json`, `type.json`, `space.json`, `layout.json`: exported from Figma.
- `build/`: generated Sass and CSS. Not committed by hand.

---
id: stylelint
title: Style values from tokens
command: npm run lint:styles
rules: [TYPE-001, TYPE-002, TYPE-003]
runs_on: [brand pull requests; the site’s own Sass, report only]
level_now: warn
level_at_launch: block in _sass/gg (O-20)
status: planned
decisions: [D-054]
---

# Style values from tokens

Planned. Stylelint on the theme’s `_sass/gg`: font sizes, font families and line heights come from token variables, never literal values (TYPE-001 to TYPE-003). Colors join when `visual/color.md` has its rules. The site’s own Sass is reported only, until it moves to the theme.

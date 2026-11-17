---
id: preflight
title: Print and social preflight
command: npm run preflight
rules: [FLY, CARD, SOC, D-006, D-007, D-008]
runs_on: [rendered formats]
level_now: warn
level_at_launch: block size and margin; warn image resolution (O-20)
status: planned
decisions: [D-006, D-007, D-054]
---

# Print and social preflight

Planned. Renders each format and checks its exact size (Letter for the flyer; 4.25×5.5in postcards, four to a Letter sheet with cut marks; the social pixel sizes), that content stays inside the template’s padding, that fonts are embedded, and that raster images are at least 150ppi at their placed size. Print color waits on O-21.

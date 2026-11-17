---
id: contrast
title: Color contrast
command: npm run contrast
rules: [D-021, WCAG 2.2 AA contrast]
runs_on: [by hand; part of a11y once that is built]
level_now: warn
level_at_launch: block below 4.5:1 for text, 3:1 for large text and non-text (O-20)
status: draft
decisions: [D-021, D-054]
---

# Color contrast

Prints the contrast ratio of each palette color against the surfaces, and marks each pair AAA, AA, large text only (LG) or fail. The `a11y` check takes this over for pages, where it measures the colors actually used.

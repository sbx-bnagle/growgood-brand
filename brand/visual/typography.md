---
id: visual.typography
title: Typography
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.2.0
last_reviewed: 2026-11-13
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: TYPE
depends_on: [tokens, verbal.mechanics]
decisions: [D-020, D-026, D-027]
---

# Typography

One face and one scale in two sizes. Alegreya Sans in every format, on an augmented fourth (ratio 1.414) from a 21px body, and below 768px on a major third (ratio 1.25) from a 19px body. Every line height sits on a 4px grid. The type scale reference shows both sets.

## Rules

**TYPE-001.** Alegreya Sans only: 400, 700 and 800, with 400 italic.
*Why:* one face keeps every format recognizably Grow Good (D-020).
*Check:* stylelint, `font-family` from tokens only.

**TYPE-002.** Use only these sizes and weights. Size/line height in px. The second column applies below 768px.

| Role | 768px and up | Under 768px | Weight |
|---|---|---|---|
| Display | 119/112 | 58/56 | 800 |
| Heading 1 | 59/68 | 37/48 | 800 |
| Lead | 59/68 | 37/48 | 400 |
| Heading 2 | 42/48 | 30/40 | 700 |
| Heading 3 | 30/40 | 24/36 | 700 |
| Heading 4 | 21/32 | 19/28 | 700 |
| Body | 21/32 | 19/28 | 400 |
| Small | 15/24 | 15/24 | 400 |
| Caption | 11/16 | 12/20 | 400 italic |

*Why:* a fixed set gives every piece the same hierarchy, and a tool cannot drift between near sizes (D-026, D-027).
*Check:* stylelint, sizes from tokens only; brand judge for which role is used where.

**TYPE-003.** Every line height is a multiple of 4px, and text sits on the 4px baseline grid.
*Why:* a shared grid lines up text across columns and formats.
*Check:* stylelint for line heights; playbook visual check for alignment.

**TYPE-004.** The lead is the heading 1 size in regular weight, in both sets.
*Why:* it gives the opening paragraph the size of a statement while the weight keeps it apart from the headings.
*Check:* brand judge.

**TYPE-005.** Case follows MECH-002: sentence case for every role.
*Check:* `lint-copy`.

## Open lane

- Flyers, postcards and social posts take fixed sizes per format. Their sizes come from this scale and are set in each format file.
- Captions at 11px are small on screen. The Phase 6 accessibility checks will test them at real reading distance.
- Latin plant names are set in italic, as in botanical writing.

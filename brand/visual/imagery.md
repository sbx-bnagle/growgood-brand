---
id: visual.imagery
title: Imagery
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-16
lane: mixed
applies_to: [web, flyer, postcard, social]
rule_prefix: IMG
depends_on: [asset-library, system.request-ladder]
decisions: [D-009, D-024, D-035, D-053]
---

# Imagery

How to choose an image and describe it. Every image comes from the asset register, through `_data/assets.yml`, so a person has approved it and its rights are known before it reaches a page.

## Rules

**IMG-001.** Use only images listed in `_data/assets.yml`, placed with the image include by their `id`. Never link a Drive file or an outside image.
*Why:* the list holds only rows Leah approved with known rights (D-053).
*Check:* `assets:check`; reviewer.

**IMG-002.** Use the register’s alt text as it is. When the text beside an image already says what it shows, such as a spot next to its heading, mark the image decorative instead, with empty alt.
*Why:* alt text is written once and approved with the image; a screen reader should not hear the same thing twice.
*Check:* `assets:check` for missing alt text; reviewer for decorative use.

**IMG-003.** Match the image’s `orientation` to its slot, and its `season` to the event, or use one marked ‘any’.
*Why:* a snowman on a June flyer, or a stretched photo, undoes the piece.
*Check:* reviewer.

**IMG-004.** Never stretch, recolor or crop out a person’s face. Scale an image down, never past its file’s size.
*Why:* stretched or enlarged images look careless, and people in photos are shown whole.
*Check:* reviewer.

**IMG-005.** If no approved image fits, brief a person (LADDER-003). Never make, find or generate an image.
*Why:* images are made and approved outside the request flow (D-024; O-06 is open).
*Check:* reviewer.

**IMG-006.** Never place a file from the Art direction folder.
*Why:* those are references for designers, not assets (D-035).
*Check:* `assets:check`; reviewer.

## Open lane

Images will come through several channels, such as rendered gardens, photography, illustration and hand-cut illustration, each with its own style. Until those are settled (O-19), no rule chooses an image by channel or style.

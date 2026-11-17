---
id: visual.spots-and-icons
title: Spots and icons
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-16
lane: mixed
applies_to: [web, flyer, postcard, social]
rule_prefix: SPOT
depends_on: [visual.imagery, asset-library]
decisions: [D-024, D-053]
---

# Spots and icons

Spots are the small hand-drawn illustrations, black line with a yellow wash, that mark items in a list or a grid. Icons are the interface symbols the theme draws with its icon font. Spots are assets; icons are part of the theme.

## Rules

**SPOT-001.** Use a spot to mark one item in a list, grid or short section: one spot per item, beside the item’s heading or text.
*Why:* that is how the site uses them, and it keeps them small companions to the words rather than the picture.
*Check:* reviewer.

**SPOT-002.** A spot is never the main image of a page, flyer, postcard or post.
*Why:* spots are 365×238px; enlarged, the line loses its hand-drawn texture (IMG-004).
*Check:* reviewer.

**SPOT-003.** Choose the spot whose subject matches the item, from its `subjects` in the register. If none fits, leave the item without a spot rather than stretch the meaning.
*Why:* a spot that does not match its item reads as decoration added for its own sake.
*Check:* reviewer.

**SPOT-004.** A spot beside a heading that names the same thing is decorative: empty alt (IMG-002).
*Why:* the heading already says it.
*Check:* reviewer.

**SPOT-005.** Icons come only from the theme’s components (the arrow in a button, the social links, the mail mark), never placed on their own.
*Why:* the icon font belongs to the theme’s code, so a component can change it everywhere at once.
*Check:* reviewer.

## Open lane

Some illustrations move: the site floats the butterfly and buzzes the bee with CSS, and a few files are animated. Motion is for the web only; print and social stills use the first frame.

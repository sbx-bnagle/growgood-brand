---
id: system.accessibility
title: Accessibility
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-17
lane: mixed
applies_to: [web, flyer, postcard, social]
rule_prefix: A11Y
depends_on: [tokens, assets]
decisions: [D-030, D-054]
---

# Accessibility

Every Grow Good piece works for people who read it with a screen reader, a keyboard, a phone held at arm’s length, or low vision. The target is WCAG 2.2 level AA (D-054).

## Rules

**A11Y-001.** Every page and template meets WCAG 2.2 level AA.
*Why:* AA is the common baseline for public sites, and the brand speaks to every neighbor.
*Check:* `a11y`; reviewer for what a tool cannot test.

**A11Y-002.** Text contrast is at least 4.5:1. Large text, 24px or 18.7px bold, and parts of the interface such as icons and field borders, at least 3:1. Use the color role pairs in the tokens, which are checked (D-030).
*Why:* low contrast is the most common barrier, and it fails outdoors on a phone first.
*Check:* `a11y`, `contrast`, `tokens:check`.

**A11Y-003.** Every image has the register’s alt text, or empty alt when the words beside it already say what it shows (IMG-002).
*Why:* a screen reader reads the alt text in place of the image.
*Check:* `a11y`, `assets:check`.

**A11Y-004.** Every link, button and form field has a name a screen reader reads out: its visible text, a label, or `aria-label`. A link says where it goes, never ‘click here’.
*Why:* a control without a name is announced as ‘button’ or ‘link’ and nothing more.
*Check:* `a11y`; reviewer for link wording.

**A11Y-005.** Each page has a language, a title and one first-level heading, and its headings go down one level at a time.
*Why:* screen reader users move through a page by its headings.
*Check:* `a11y`.

**A11Y-006.** Anything tapped or clicked is at least 24×24px, or has space around it to make up the difference.
*Why:* small targets defeat unsteady hands and thumbs.
*Check:* `a11y`.

**A11Y-007.** Everything works from the keyboard, in reading order, with a visible focus outline.
*Why:* many people never use a mouse.
*Check:* reviewer.

**A11Y-008.** Pages fit a 320px-wide screen with no sideways scroll.
*Why:* zoomed text and small phones both arrive at a narrow screen.
*Check:* `a11y` at 320px.

**A11Y-009.** Motion that lasts more than five seconds can be paused, and pages honor the reduced-motion setting.
*Why:* looping motion distracts some readers and makes others unwell.
*Check:* reviewer.

## Open lane

- The animated spots loop. Whether they stop after a few loops, or still under reduced motion, is a design call to make with A11Y-009.
- Captions at 11px (TYPE-002) are tested by a reviewer at real reading distance.
- Contrast applies to print and social too. Text set inside a social image also goes in the post’s alt text.

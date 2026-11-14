---
id: verbal.mechanics
title: Mechanics
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.2.0
last_reviewed: 2026-11-13
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: MECH
depends_on: [verbal.spelling]
decisions: [D-013, D-022]
---

# Mechanics

Punctuation, case, units and spelling for everything a customer reads. Every rule here is checked by the copy linter, so a reviewer’s time goes to what a tool cannot judge.

## Rules

**MECH-001.** No em dashes. Use an en dash with no spaces, and only for ranges: 8–24in, May–June, 9:00–11:00am.
*Why:* the em dash is the most common sign of copy written without care, by people or by tools.
*Check:* `lint-copy`.

**MECH-002.** Sentence case for titles, headings, subheads and buttons: ‘Get your garden plan’, not ‘Get Your Garden Plan’.
*Why:* sentence case reads as plain speech. Title case reads as an advertisement.
*Check:* `lint-copy`, with proper nouns allowed.

**MECH-003.** Single quotes in preference to double. Double quotes only for a quote inside a quote.
*Why:* house style. Fewer marks on the page.
*Check:* `lint-copy`.

**MECH-004.** Curly quotes and apostrophes, always: ‘ ’ “ ”. Never straight ones.
*Why:* straight quotes are typewriter marks.
*Check:* `lint-copy`.

**MECH-005.** Lowercase for units, am and pm, and filenames.
*Check:* `lint-copy`.

**MECH-006.** No space between a number and its unit, or a time and am or pm: 7mm, 2ft, 9:00pm.
*Why:* the number and unit are one value. A line break between them splits the value.
*Check:* `lint-copy`.

**MECH-007.** Commas and periods sit inside closing quotes.
*Check:* `lint-copy`.

**MECH-008.** One space after a period.
*Check:* `lint-copy`.

**MECH-009.** Oxford comma: ‘birds, butterflies, and bees’.
*Check:* reviewer.

**MECH-010.** US spelling, checked by stem against `spelling.yml`. A stem check catches ‘neighbours’ where a whole-word check catches only ‘neighbour’.
*Check:* `lint-copy`.

**MECH-011.** US garden word choice from `spelling.yml`: fall, not autumn; while, not whilst; toward, not towards.
*Check:* `lint-copy`.

**MECH-012.** No exclamation marks.
*Why:* the facts carry the interest. An exclamation mark asks the reader to be excited instead (D-022).
*Check:* `lint-copy`.

**MECH-013.** No emoji.
*Check:* `lint-copy`.

## Open lane

Formats with very little room, such as a social story, still follow every rule here. Shorten the sentence, not the mechanics.

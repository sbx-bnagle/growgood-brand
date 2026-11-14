---
id: verbal.voice
title: Voice
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.2.0
last_reviewed: 2026-11-13
lane: mixed
applies_to: [web, flyer, postcard, social]
rule_prefix: VOICE
depends_on: [verbal.mechanics, verbal.names-and-dates, claims]
decisions: [D-013, D-022]
---

# Voice

Grow Good writes flat and plainly, as a neighbor who knows plants. The models are Robin Kinross and Robert Wearing: few adjectives, full confidence, and a reader assumed to be capable. The same voice covers every format, from a care guide to an event flyer.

## Rules

**VOICE-001.** Few adjectives, ideally none. Detail carries the color, not description.
*Why:* ‘native plants that feed caterpillars’ says more than ‘beautiful, vibrant plantings’.
*Check:* brand judge.

**VOICE-002.** Understate comparisons. Say what a thing does differently and let the reader draw the conclusion.
*Check:* brand judge.

**VOICE-003.** State the position with full confidence. Do not hedge with ‘you might consider’ or ‘some gardeners prefer’.
*Check:* `lint-copy` flags known hedges. Brand judge for the rest.

**VOICE-004.** Second person, active: ‘Leave 8–24in of stubble’, not ‘stubble should be left’.
*Check:* brand judge.

**VOICE-005.** Encouragement is a fact about the plant, not about the reader. ‘Nothing you remove is alive’ works. ‘Don’t worry, you’ve got this’ reads as condescension.
*Check:* `lint-copy` flags ‘don’t worry’. Brand judge for the rest.

**VOICE-006.** In instructions, give the consequence both ways: done badly, and skipped.
*Check:* brand judge, instructional copy only.

**VOICE-007.** No punchiness. A punchy line addressed to a beginner reads as talking down.
*Check:* brand judge.

**VOICE-008.** For timing, name the portion of the season, then the natural sign that it has arrived: ‘Early spring, once there is green at the crown.’
*Check:* brand judge, instructional copy only.

**VOICE-009.** Warmth is neighborly, not cheerful. Use ‘we’, name the place (the parkway, the block, the Chicago spring), and invite plainly: ‘Bring a trowel. We bring the plants.’
*Why:* Grow Good works street by street. Local detail is friendlier than an exclamation mark.
*Check:* brand judge.

**VOICE-010.** An event headline is the event’s name. The facts follow in this order: what, when, where, cost. One sentence says why it is worth coming, stated as a fact.
*Check:* brand judge; contract limits on the flyer, postcard and social templates.

## Open lane

Facts about plants and places are where the color lives: what a plant feeds, when it goes dormant, what it does in a wet spring.

## Examples

- Off brand: ‘Not sure what will grow in your space? We can help!’ Breaks VOICE-007 and MECH-012.
- On brand: ‘A site visit tells you what your soil, light and drainage will support.’

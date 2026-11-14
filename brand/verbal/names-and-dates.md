---
id: verbal.names-and-dates
title: Names, places and dates
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-13
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: NAMES
depends_on: [verbal.mechanics, claims]
decisions: [D-023]
---

# Names, places and dates

One form for each name, place, date and time, so every format and every tool writes them the same way.

## Rules

**NAMES-001.** ‘Grow Good Gardens’ on first mention in a piece. ‘Grow Good’ after that.
*Why:* the full name once makes the business findable; the short form reads as how neighbors say it.
*Check:* reviewer now; `lint-copy` from Phase 6.

**NAMES-002.** ‘Upper Midwest’, capitalized. ‘Chicagoland’ for the metro area.
*Check:* `lint-copy`.

**NAMES-003.** Event dates: weekday, month, day, written out. ‘Saturday, May 16’. Add the year only when the event is more than six months away.
*Why:* the weekday is what people check against their week.
*Check:* reviewer now; `lint-copy` from Phase 6.

**NAMES-004.** Times: hour and minutes, lowercase am or pm, no space: ‘10:00am’. Use ‘noon’ and ‘midnight’. A range takes an en dash with no spaces: ‘10:00am–noon’, ‘6:00–8:00pm’.
*Check:* `lint-copy`.

**NAMES-005.** A date and time together: ‘Saturday, May 16, 10:00am–noon’.
*Check:* reviewer now; `lint-copy` from Phase 6.

**NAMES-006.** Places as people say them (the park, the library branch), followed once by the street address. Neighborhood names as the City of Chicago spells them. Addresses come from the request, never from memory.
*Check:* reviewer; the brand judge checks addresses against the request (CLAIM-002).

## Open lane

When an event has a rain date, give it its own line with the same format.

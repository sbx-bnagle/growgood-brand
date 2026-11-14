---
id: system.request-ladder
title: Request ladder
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-13
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: LADDER
depends_on: [claims, system.components]
decisions: [D-016]
---

# Request ladder

Every request lands on one of four steps. The step decides who does the work. The system is allowed to say no, and to say ‘the better route is…’ at any step.

## Rules

**LADDER-001. Make it.** A template exists for the format, and every fact is in the request or in `claims.md`. Build it from the template.
*Why:* this is the repeat work the system exists to take on.
*Check:* the build record names the template and the source of every fact.

**LADDER-002. Adapt it.** A template exists, but the request needs something the template does not show, such as a second date or a longer title. Adapt within the template’s contract limits and state what changed.
*Why:* small changes are safe while the contract still holds.
*Check:* contract validation passes, and the change note goes to the reviewer.

**LADDER-003. Brief a person.** No template fits, or the request needs a new image, layout or format. Write a brief for the maintainer and stop.
*Why:* new work is design work. Once it is made and approved, it becomes a template, and the next request is a make.
*Check:* reviewer.

**LADDER-004. Stop and ask.** A fact is missing, a fact conflicts with `claims.md`, or the request depends on an open decision. Ask the requester, one question at a time.
*Why:* a guessed fact costs more than a late one. A flyer cannot be recalled.
*Check:* the brand judge blocks any draft containing a fact found in neither the request nor `claims.md`.

## Open lane

When a request falls between steps, take the higher one. Briefing a person when a make would have done costs an hour. Making when a brief was needed costs a reprint.

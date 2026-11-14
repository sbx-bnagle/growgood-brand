---
id: system.components
title: Components
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-14
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: COMP
depends_on: [claims, tokens, assets]
decisions: [D-033, D-041, D-042, D-043]
---

# Components

How pages, flyers, postcards and social posts are put together from the theme’s includes, and what each include accepts. Each include has a contract in `_data/components/`; the playbook shows every one with worked examples.

## Rules

**COMP-001.** Build every format from the includes in `_includes/gg/` and the layouts in `_layouts/`. Do not write new markup for something an include already does.
*Why:* one fix to a component reaches every format (D-043).
*Check:* reviewer.

**COMP-002.** Pass only the parameters a contract lists, with values of the type and from the source it names.
*Why:* the contract is the one description people, checks and agents share (D-042).
*Check:* `components:check` for the includes; reviewer for a page.

**COMP-003.** A parameter whose source is `claims` takes wording from `claims.md` only. One whose source is `assets` takes an approved row of the asset register. One whose source is `request` takes what the requester gave, checked against the copy rules.
*Why:* facts come only from the claims register or the request (CLAIM-001).
*Check:* reviewer; the brand judge in Phase 6.

**COMP-004.** Contract examples use labeled placeholders, such as ‘Event name’, never sample facts.
*Why:* agents copy what they read.
*Check:* `components:check`.

## The contract format

| Field | Holds |
|---|---|
| `name`, `include`, `figma` | The component, its include, and its Figma component |
| `summary` | One sentence |
| `formats` | web, flyer, postcard, social |
| `decisions`, `rules` | What shapes it |
| `params` | Each with `name`, `type` (text, url, enum, bool, asset), `required`, `default`, `values` for enums, `source`, `notes` |
| `data` | Site data the include reads |
| `examples` | Each with a `title`, its `params`, and the `surface` it sits on (default, tint, inverse) |

Sources: `request` (the requester), `claims` (`claims.md` wording), `assets` (an approved register row), `site` (the site’s data or config), `fixed` (a design choice requesters do not set).

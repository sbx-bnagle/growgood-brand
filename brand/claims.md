---
id: claims
title: Claims
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-13
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: CLAIM
depends_on: []
decisions: [D-015]
---

# Claims

Every fact Grow Good says in public. If a fact is not in this file, it does not go out.

## Rules

**CLAIM-001.** Prices, service areas, credentials, numbers, awards and quotes come only from the table below, in its exact wording.
*Why:* a wrong fact in print cannot be recalled, and a near-miss fact reads as carelessness.
*Check:* the brand judge matches every fact in a draft against this table and the request. An unmatched fact blocks the draft.

**CLAIM-002.** Event details (name, date, time, place, cost) belong to the request, not to this file. The requester confirms them at the brief step before anything is built.
*Why:* event facts change per job. Confirming them once, early, stops a typo reaching every format.
*Check:* review gate G1 (brief confirmation).

**CLAIM-003.** A claim past its expiry date is treated as missing.
*Why:* last season’s price is the most common wrong fact.
*Check:* the brand judge reads the Expires column.

## Register

| ID | Claim, exact wording | Source | Confirmed by | Confirmed on | Expires |
|---|---|---|---|---|---|
| C-001 | Sustainable Landscaping Design Chicago | growgood `_config.yml` description | | | |

Phase 1 fills this table from the site and from Leah.

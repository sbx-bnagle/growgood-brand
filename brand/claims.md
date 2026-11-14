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

Wording is taken from the live site, with the house mechanics applied (curly apostrophes, sentence case). Nothing below is confirmed yet. Leah confirms each row, or strikes it.

| ID | Claim, exact wording | Source | Confirmed by | Confirmed on | Expires |
|---|---|---|---|---|---|
| C-001 | Sustainable landscaping design Chicago | `_config.yml` description, page title | | | |
| C-002 | Chicagoland and the Upper Midwest | `services.markdown`, capitalized per NAMES-002. The site also says ‘Chicago and the upper midwest’ (`custom.markdown`). | | | |
| C-003 | $100 for a standalone consultation. If you decide to move forward with a custom garden design, the fee is applied toward your project. | `consult.markdown`, `_data/faqs.yml` | | | |
| C-004 | A site assessment is a one-hour visit to your space where we assess soil conditions, light exposure, and drainage. | `_data/faqs.yml` | | | |
| C-005 | We don’t install gardens ourselves, but we’ll connect you with trusted local contractors if you’d prefer not to do it yourself. | `custom.markdown` step 5 | | | |
| C-006 | We work with trusted local and regional nurseries to supply healthy, climate-adapted native perennials. | `custom.markdown` step 4 | | | |
| C-007 | We source healthy, climate-adapted plants from trusted nurseries and stand behind their quality at the time of delivery. We don’t offer a guarantee against plant loss after installation since establishment depends on factors outside our control, including watering, weather, and site conditions. | `_data/faqs.yml` | | | |
| C-008 | We prioritize native plants because they’re the best fit for our climate, require less maintenance once established, and provide the most benefit to local wildlife. That said, we occasionally include non-native but non-invasive plants when they serve the design well. We never use invasive species. | `_data/faqs.yml` | | | |
| C-009 | Most native perennials take two to three years to fully establish. | `_data/faqs.yml` | | | |
| C-010 | Every garden plan comes with detailed step-by-step instructions for bed preparation, planting, and long-term care. | `_data/faqs.yml` | | | |
| C-011 | We’re happy to provide a garden plan as a standalone service. | `_data/faqs.yml` | | | |
| C-012 | We specialize in small spaces and tight budgets. | `about.markdown` | | | |
| C-013 | Custom garden design; Site assessment & consultation; Contractor referrals; Community projects | `_data/services.yml` | | | |
| C-014 | Phone: 312 771-1876 | `_includes/contact.html` | | | |
| C-015 | Email: leah@growgoodgardens.com | `_includes/contact.html` | | | |
| C-016 | Instagram, TikTok, Pinterest and YouTube: growgood_gardens | `_includes/footer.html` | | | |
| C-017 | Facebook: facebook.com/profile.php?id=61582029068083 | `_includes/footer.html` | | | |
| C-018 | Leah Fagan (role title to confirm) | `about.markdown` signature | | | |

## Withheld

- Garden kits. The kits page is out of the navigation and its FAQ answers are placeholders. No kit claim goes out until the kits launch.

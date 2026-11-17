---
id: visual.logo
title: Logo
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-16
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: LOGO
depends_on: [asset-library, system.components]
decisions: [D-025, D-037, D-053]
---

# Logo

The Grow Good wordmark, and which version goes where. The current mark is provisional: a refined logo is a later branding project (D-025). The file in use is a placeholder.

## Rules

**LOGO-001.** Place the mark only with the wordmark include, `gg/wordmark.html`. Never place a logo file directly.
*Why:* the include finds the approved logo row by variant, so a new mark reaches every format by changing the register, not the templates (D-037).
*Check:* `components:check`; reviewer.

**LOGO-002.** Use the `primary` variant everywhere until another variant is approved and listed here.
*Why:* one variant exists. More are expected for different contexts, each added as a register row, a component variant and a rule here.
*Check:* `components:check` rejects a variant the contract does not list.

**LOGO-003.** Never redraw, recolor, stretch, outline or add effects to the mark, and never set the name in type as a substitute, except as the include’s own text fallback.
*Why:* the mark is one drawing; versions made on the spot multiply.
*Check:* reviewer.

**LOGO-004.** Partner and sponsor logos come from the register’s `partner-logo` rows, at the size the partner asks for, and never larger than the Grow Good mark.
*Why:* partners are credited, and the piece stays Grow Good’s.
*Check:* reviewer.

## Open lane

Clear space and minimum sizes are set with the final mark. Until then, keep the wordmark at the size its include and the templates give it.

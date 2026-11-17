---
id: tokens:check
title: Design tokens
command: npm run tokens:check
rules: [TYPE-003, TYPE-004, D-021, D-030]
runs_on: [brand pull requests]
level_now: warn
level_at_launch: block (O-20)
status: approved
decisions: [D-021, D-030, D-054]
---

# Design tokens

Checks the DTCG token files in `tokens/`: structure and references, the type scale (TYPE-003, TYPE-004), the color ramps (D-021) and the color role pairs (D-030). The Tokens workflow also rebuilds the token outputs, the Figma plugin and the playbook pages, and fails when the committed copies differ.

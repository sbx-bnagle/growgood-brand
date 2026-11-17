---
id: components:check
title: Component contracts
command: npm run components:check
rules: [COMP-002, COMP-004, LOGO-001, LOGO-002]
runs_on: [brand pull requests]
level_now: warn
level_at_launch: block (O-20)
status: approved
decisions: [D-042, D-054]
---

# Component contracts

Checks every include in `_includes/gg/` against its contract in `_data/components/`: parameters, variants, required values and the examples the playbook renders. A variant the contract does not list is a finding.

The Playbook workflow runs it on every brand pull request. Until launch a finding warns (D-054).

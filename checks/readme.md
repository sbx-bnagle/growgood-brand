---
id: checks
title: Checks
maintainer: brad-nagle
status: draft
last_reviewed: 2026-11-17
decisions: [D-054]
---

# Checks

Every automatic check on Grow Good work, one file each. A brand rule’s *Check:* line names one of these, or ‘reviewer’.

Until launch every check warns: it reports on the pull request and never fails it (D-054). Each file gives the level proposed for launch, which O-20 settles.

| Check | Rules | Runs on | Proposed at launch | Status |
|---|---|---|---|---|
| [`lint-copy`](lint-copy.md) | MECH, NAMES, VOICE patterns | brand and site pull requests | block MECH and NAMES; warn VOICE | draft |
| [`components:check`](components-check.md) | COMP-002, COMP-004, LOGO-001, LOGO-002 | brand pull requests | block | approved |
| [`assets:check`](assets-check.md) | IMG-001, IMG-002, IMG-006 | brand pull requests, the Assets sync | block | approved |
| [`tokens:check`](tokens-check.md) | TYPE-003, TYPE-004, D-021, D-030 | brand pull requests | block | approved |
| [`contrast`](contrast.md) | palette pairs against WCAG 2.2 AA | by hand; `a11y` from Phase 6 | block | draft |
| [`stylelint`](stylelint.md) | TYPE-001 to TYPE-003 | brand pull requests; site pull requests | block in `_sass/gg` | draft |
| [`a11y`](a11y.md) | A11Y-001 to A11Y-006, A11Y-008 | brand and site pull requests | block serious and critical | draft |
| [`preflight`](preflight.md) | D-006 to D-008, D-020 | the playbook’s formats; request drafts | block size, margin, pages and fonts; warn image resolution | draft |
| [`brand judge`](brand-judge.md) | CLAIM, VOICE beyond patterns, NAMES-006 | request drafts; site report only | block unmatched facts; warn the rest | planned |

## How a check file is laid out

Front matter: `id`, the command, the rule IDs it covers, where it runs, the level now and the level proposed for launch. Then what it checks, what it leaves out, and its known limits.

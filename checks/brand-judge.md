---
id: brand judge
title: Brand judge
command: npm run judge
rules: [CLAIM-001, CLAIM-002, CLAIM-003, COMP-003, MECH-007, NAMES-006, TYPE-002, TYPE-004, VOICE-001, VOICE-002, VOICE-004, VOICE-006, VOICE-007, VOICE-008, VOICE-009, VOICE-010]
runs_on: [request drafts; site pull requests, report only until claims.md is approved]
level_now: warn
level_at_launch: block a fact found in neither the request nor claims.md; warn the rest (O-20)
status: planned
decisions: [D-054, D-055]
---

# Brand judge

Planned. A Claude model reads a draft beside the request, `claims.md` and the rules a pattern cannot check, and writes a report for review gate G2. Every fact in the draft is matched against the request and `claims.md`; an unmatched fact leads the report. It runs on the Claude API with a key saved as a GitHub secret, and the brand server (Phase 7) reuses it.

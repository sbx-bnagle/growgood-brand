---
id: assets:check
title: Asset library
command: npm run assets:check
rules: [IMG-001, IMG-002, IMG-006]
runs_on: [brand pull requests, the Assets sync]
level_now: warn
level_at_launch: block (O-20)
status: approved
decisions: [D-053, D-054]
---

# Asset library

Checks `assets/library/` against `_data/assets.yml`: every listed asset is approved with known rights and alt text, its file is present at the size listed and within web size (2400px on the longest edge, 2MB), no file sits in the library without a row, and the logo list matches the logo rows.

It runs in the Playbook workflow and in the Assets sync, before the sync opens its pull request.

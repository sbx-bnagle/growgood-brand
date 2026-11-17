---
id: lint-copy
title: Copy linter
command: node tools/lint-copy.mjs [--report] [--json] [--all] [--docs] <files or folders>; npm run checks:copy for the brand files
rules: [MECH-001, MECH-002, MECH-003, MECH-004, MECH-005, MECH-006, MECH-007, MECH-008, MECH-010, MECH-011, MECH-012, MECH-013, NAMES-001, NAMES-002, NAMES-003, NAMES-004, NAMES-005, VOICE-003, VOICE-005]
runs_on: [brand pull requests, site pull requests (the built site)]
level_now: warn
level_at_launch: block for MECH and NAMES, warn for VOICE (O-20)
status: draft
decisions: [D-013, D-054]
---

# Copy linter

Checks the words a reader sees against `brand/verbal/mechanics.md`, `names-and-dates.md`, `voice.md` and `spelling.yml`.

## What it reads

Visible text only: Markdown text and headings, HTML text, the `alt`, `title`, `aria-label` and `placeholder` attributes, a page’s description, the `title` and `description` in front matter, and YAML values that read as prose. It leaves out code, Liquid, HTML tags and other attributes, scripts and styles, comments, URLs and file paths.

On the site it reads the built pages in `_site`, so it sees what Jekyll and kramdown produce. A finding that repeats on many pages, such as one in the footer, is listed once with a count.

## What it skips on purpose

- Words inside curly quotes, ‘like this’, are quoted examples or someone else’s words. Only the straight-quote rule reads them.
- A heading that starts with an ID, such as ‘D-054’ or ‘MECH-001.’, is checked from the word after the ID.
- `brand/verbal/spelling.yml` is the linter’s own word list.

## Known limits

- Title case (MECH-002) knows proper nouns from a list in `tools/lib/copy-rules.mjs`. A new name is a false finding until it is added there; `vocabulary.md` takes the list over when it is written.
- NAMES-001 checks the first mention in a file or page, not in a piece made of several files.
- VOICE rules beyond the listed hedges are the brand judge’s.

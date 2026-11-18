---
id: brand judge
title: Brand judge
command: node tools/brand-judge.mjs [--report] [--json] [--site] [--request <file>] <draft files>; npm run judge -- <draft files>
rules: [CLAIM-001, CLAIM-002, CLAIM-003, COMP-003, MECH-007, NAMES-006, TYPE-002, TYPE-004, VOICE-001, VOICE-002, VOICE-004, VOICE-006, VOICE-007, VOICE-008, VOICE-009, VOICE-010]
runs_on: [request drafts; site pull requests (changed pages), report only until claims.md is approved]
level_now: warn
level_at_launch: block a fact found in neither the request nor claims.md; warn the rest (O-20)
status: draft
decisions: [D-039, D-054, D-055]
---

# Brand judge

A Claude model reads a draft beside its request, `claims.md` and the rules a pattern cannot check, and writes the report a reviewer reads at gate G2.

## What it does

- Lists every fact in the draft and where it is confirmed: the request, a claims register row in the same wording and not expired, or neither. A fact in neither leads the report (CLAIM-001). It blocks a request draft at launch, and warns on a site pull request until Leah approves `claims.md` (D-054).
- Checks the draft against the rules listed above. Each finding gives the rule, a short quote, the problem and a fix in the brand voice.
- Reads the rule list from this file and the rule text from the brand files that hold it, when it runs (D-039). A rule added here reaches the next run with no code change.

## How it runs

- Model `claude-opus-5-5` at high effort; `BRAND_JUDGE_MODEL` and `BRAND_JUDGE_EFFORT` change them. If the model declines, the API retries on another model (server-side fallbacks).
- The report has a fixed shape (structured outputs), so a reply that fails to parse says so and never reads as a pass.
- The instructions and brand files are cached between runs. The date, the request and the draft come after them.
- Needs `ANTHROPIC_API_KEY`. Brad saves it as a GitHub secret in each repo that runs the judge; without it the judge says ‘not run’ and passes nothing.
- On a site pull request, `checks-site.mjs` judges the changed `.md`, `.markdown` and `.html` files named in `JUDGE_FILES`.

## Known limits

- The judge reads text. Type sizes (TYPE-002, TYPE-004) and component use (COMP-003) are judged from the words and markup alone. A rendered check belongs to preflight and the reviewer.
- A model can miss a fact or flag a sound one. The report goes to a person; it never publishes or rejects on its own.

# Instructions for agents

1. Read `brand/readme.md` first. It says which files each job needs. Open only those.
2. In `brand/decisions.md`, anything under ‘Open’ is undecided. Do not build on it. Ask.
3. Facts (prices, dates, places, service area, credentials, numbers, quotes) come only from `brand/claims.md` or from the request itself. If a fact is in neither, stop and ask.
4. Rules have IDs, such as LADDER-003. Cite the ID when a rule shapes a choice or when a check fails.
5. Every request lands on the ladder in `brand/system/request-ladder.md`: make it, adapt it, brief a person, or stop and ask.
6. Do not change files in `brand/` without a matching entry in `brand/decisions.md`. The keeper, Leah Fagan, approves brand changes. The maintainer, Brad Nagle, drafts them.

## Conventions

- Brand files are Markdown with front matter (see `brand/_template.md`), about 400 tokens each. YAML only where the content is a list.
- Brand files follow the house mechanics: no em dashes, curly quotes, sentence-case headings, no space between a number and its unit. Agents copy what they read, so the files model the output.
- Status values: planned, draft, review, approved, deprecated. Only approved files are binding. Draft files are guidance.

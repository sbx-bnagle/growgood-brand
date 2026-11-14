# Roadmap

| # | Phase | Output | Needs from Brad and Leah | Gate | Status |
|---|---|---|---|---|---|
| 0 | Scope | Decisions log, repo, asset folder | Step 1 and 2 answers | Brad signs off | done |
| 1 | Brand canon | Inventory of site and Drive materials; brand files v0.1 with rule IDs | Creative calls, claims, examples marked on or off brand | Leah approves each file | done, except Leah’s claims check and audiences (O-12) |
| 2 | Tokens | Sass values extracted to DTCG JSON; GG Tokens plugin seeds Figma Variables and exports changes as PRs | Figma file on Starter (D-017); color roles (D-030) | Token PR review | done 2026-11-13: merged; loaded into Figma and checked; Send changes tested end to end |
| 3 | Figma library | Foundations, components, templates for web, flyer, postcard, social | Design direction and critique (D-035); art direction references; logo files | Design review | in progress: the plugin builds the pages, 12 components and 8 template frames, built in Figma and checked 2026-11-14; FPO logo in the Wordmark; design by hand next; O-18 open |
| 4 | Theme and playbook | Jekyll includes with contracts; Sass from tokens; playbook site; site moved to Actions build and the theme | Review of the playbook | Visual QA | |
| 5 | Asset library | Drive folders and register populated; sync of approved assets for agents | Images, alt text, usage rights | Leah approves each asset | |
| 6 | Checks | Copy linter, stylelint rules, accessibility, print preflight, brand judge | Pass and fail thresholds | Threshold sign-off | |
| 7 | Brand MCP server | Tools for rules, templates, assets, render, checks | | Test runs | |
| 8 | Request app | Forms per format, Google sign-in, review queue, history | Who can sign in | G1 to G3 live | |
| 9 | Pilot | Fresh-agent test, real requests, fixes written back, handover | Real requests | Go-live | |

## Review gates

- G1: the requester confirms the brief the agent read back to them.
- G2: Leah approves or edits the draft, with the check report beside it.
- G3: publish. Merging the site PR for web pages; download for print and social.

## Backlog

- Logo refinement, as a branding project. The existing logo is the provisional mark (D-025).
- Text-to-image model for on-brand images (LoRA or another approach). See decisions O-06.
- Revisit the rzwc edit LoRA for restyling supplied garden photos.
- Agent-drafted code PRs from Figma component changes, beyond token values.

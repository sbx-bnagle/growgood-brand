# Handover

How to run the Grow Good brand system day to day. Keeper: Leah Fagan. Maintainer: Brad Nagle.

## Where things are

| Thing | Where |
|---|---|
| Brand files, decisions, claims | `brand/` in this repo; start at `brand/readme.md` |
| Theme: includes, layouts, Sass, tokens | this repo, released by tag; the site pins one (D-040) |
| Playbook | growgood-playbook.pages.dev, built from `main` (D-052) |
| Checks | `checks/` describes each one; code in `tools/` |
| Brand server | `mcp/`, found by Claude Code through `.mcp.json` (D-056) |
| Request app | `/request/` in the playbook; setup in `request-app/README.md` (D-057) |
| Asset library | Leah’s Brand Assets folder in Drive; synced every Monday by pull request (D-053) |
| Live site | the `sbx-bnagle/growgood` repo, deployed by GitHub Actions |

## Common jobs

- **Change a brand rule.** Edit the file, add a `decisions.md` entry, open a pull request. Leah approves (D-011). Agents and the request app pick it up from `main` with no release (D-039).
- **Release the theme.** Merge to `main`, then tag: `git tag -a vX.Y.Z -m "…"` and `git push origin vX.Y.Z`. On the site, a pull request moves `remote_theme` in `_config.yml` to the new tag; its checks run against that tag.
- **Add an approved image.** Add the row to the register in Drive with alt text and rights; Leah approves it; the Monday sync opens the pull request.
- **Redraft a request by hand.** In this repo, under Actions, run ‘Draft a request’ with the request’s id.
- **Run every check locally.** `npm test`; `npm run checks:copy`; `npm run checks:styles`; `bundle exec jekyll build && npm run checks:a11y && npm run preflight`; for the site, `node tools/checks-site.mjs ../growgood` after building it.

## Secrets and settings

Names only. Each value is typed into the service by Brad, never into this repo or a chat.

| Name | Where | Used by |
|---|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | this repo’s Actions | the playbook deploy |
| `ANTHROPIC_API_KEY` | Actions in both repos | the brand judge and the drafter |
| `REQUEST_DRAFTER_SECRET`, `REQUEST_API` | this repo’s Actions | the drafter |
| `DRAFTER_SECRET`, `GITHUB_DISPATCH_TOKEN`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `APPROVERS`, KV binding `REQUESTS` | the Pages project | the request app |
| The Google service account key | this repo’s Actions | the asset sync, read-only on Brand Assets |
| The newsletter Worker’s MailerLite token and reCAPTCHA secret | the site’s Cloudflare Worker | sign-ups |

Rotate the MailerLite token: an earlier one was pasted into a chat. The service account can be dropped to Viewer on the Drive folder.

## Still open

- Decisions: O-06, O-12, O-18, O-19, O-20, O-21 (`brand/decisions.md`).
- `claims.md`: every row waits for Leah.
- Brand files still planned: `story.md`, audiences, vocabulary, color, layout, the formats files, `system/review.md`, examples.
- Figma: the library’s design pass by hand (Phase 3).
- Leah’s placeholder copy on the site: the FAQ’s ‘Answers!’ and the ‘00/00/0000’ date.
- The internal dashboard has no phone layout, and `gardenolator.js` throws on Home and Services.
- Print and social styling follows the designs as they are made (D-043); print color waits on O-21.

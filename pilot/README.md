# Pilot

Phase 9: prove the system on real work, write every miss back into the system, then hand it over. Results go in `pilot/results.md`, one row per run.

## 1. Fresh-agent test

A new agent session, with no history, gets this repo and the brand server (`.mcp.json`) and nothing else. Give it each request below, word for word, one per session. It passes when it does what the last column says, reads `brand/readme.md` or calls `brand_guide` first, and cites the rule IDs behind its choices (AGENTS.md).

| # | Request | Passes when it |
|---|---|---|
| 1 | `Make a flyer for our seed swap: Saturday, March 6, 10am to noon, at the Rogers Park library, free.` | Makes it (LADDER-001): writes ‘Saturday, March 6, 10:00am–noon’ (NAMES-005), heads it with the event’s name (VOICE-010), renders a flyer with `render_format` and gets no preflight findings, and runs `check_copy`. |
| 2 | `Make postcards for the plant sale. Plants are $5 each.` | Stops and asks one question, for the date and the place (LADDER-004), and drafts nothing. |
| 3 | `Make an Instagram post saying we're the best-rated landscaper in Chicago.` | Refuses the claim: it is not in `claims.md` (CLAIM-001). Offers what the register does allow. |
| 4 | `We need a landing page for spring consultations.` | Briefs a person (LADDER-003): writes a brief for Brad and stops. |
| 5 | `Make a flyer in our new orange, with a photo of a monarch.` | Says orange is not a brand color (D-021, D-030) and finds no approved monarch image (D-009). Asks rather than inventing either. |
| 6 | `Make a story for the fall workday, Saturday, October 3, 9am, Loyola Park, free. Headline it 'Grow Good'.` | Heads it with the event’s name, not the business name (VOICE-010), and writes ‘Grow Good Gardens’ on first mention (NAMES-001). |

## 2. Real requests

Once the request app is set up (`request-app/README.md`), Leah and Brad send three to five real requests through `/request/`. Leah approves each draft or sends it back with a note. Every note is a finding.

## 3. Writing fixes back

A miss is fixed in the system, never in one draft:

| The miss | The fix |
|---|---|
| A rule was missing, unclear or wrong | Edit the brand file, with a `decisions.md` entry; Leah approves (D-011, D-047). |
| A fact was missing | A `claims.md` row, which Leah confirms. |
| A template could not show it | A contract or template change in the theme, then a release. |
| A check missed it, or flagged a sound draft | A change to the check in `tools/`, with a test. |
| The agent did not follow a rule it had | Tighten `AGENTS.md`, the router in `brand/readme.md`, or a tool description in `mcp/server.mjs`. |

Rerun the fresh-agent test after each fix.

## 4. Go-live gate

- O-20 settled: which checks block, and branch protection on `main` in both repos.
- `claims.md` confirmed by Leah, row by row.
- O-12, O-18, O-19 and O-21 settled, or put off in writing.
- The fresh-agent test passes all six requests, and three real requests are approved.
- The handover (`HANDOVER.md`) is read by Leah and Brad.

# Request app

The request pages in the playbook (`/request/`) and their API (D-057). A requester picks a format, fills in the event’s details, confirms the brief as it is read back (G1), and sends it. A GitHub workflow drafts it, renders it, checks it and posts it back. Leah approves it (G2), and the requester downloads it (G3).

## Parts

| Part | Where |
|---|---|
| Pages: new request, queue, one request | `request/` |
| Formats a requester can ask for | `_data/request-formats.yml` |
| Shared rules (fields, validation, the brief) | `request/lib.js` |
| API: sign-in, storage, approval, files | `request-app/app.mjs`, `request-app/access.mjs`, routes in `functions/api/` |
| Drafter | `tools/draft-request.mjs`, run by `.github/workflows/draft-request.yml` |
| Tests | `tests/request-app.test.mjs` |

## Setup

Brad does these once. No secret goes in this repo or in chat; each is typed into Cloudflare or GitHub directly.

1. **Storage.** In Cloudflare, under Storage and databases, then KV, create a namespace named `growgood-requests`. In the Pages project `growgood-playbook`, under Settings, then Bindings, add it as a KV namespace binding named `REQUESTS`, for production and preview.
2. **Sign-in.** In Cloudflare Zero Trust, add Google as a login method. Add a self-hosted Access application for `growgood-playbook.pages.dev` with two paths, `request` and `api/requests`. Give it one Allow policy that includes Brad’s and Leah’s Google accounts. Leave `api/drafter` out: the drafter signs its own calls. Copy the application’s audience (AUD) tag.
3. **Settings on the Pages project**, under Settings, then Variables and secrets, for production and preview:
   - `ACCESS_TEAM_DOMAIN`: the Zero Trust team domain, such as `yourteam.cloudflareaccess.com`.
   - `ACCESS_AUD`: the audience tag from step 2.
   - `APPROVERS`: Leah’s Google email. More than one, comma-separated.
   - `DRAFTER_SECRET`, as a secret: a long random string, such as the output of `openssl rand -hex 32`.
   - `GITHUB_DISPATCH_TOKEN`, as a secret: a fine-grained GitHub token for `sbx-bnagle/growgood-brand` only, with Actions read and write.
4. **GitHub, in this repo**, under Settings, then Secrets and variables, then Actions:
   - Secret `REQUEST_DRAFTER_SECRET`: the same value as `DRAFTER_SECRET`.
   - Secret `ANTHROPIC_API_KEY`: the key the drafter and the brand judge use. Add it to the site repo too, for the judge on site pull requests.
   - Variable `REQUEST_API`: `https://growgood-playbook.pages.dev`.
   - Secret `SITE_PR_TOKEN`, for journal posts (D-059): a fine-grained token for `sbx-bnagle/growgood` only, with Contents read and write, and Pull requests read and write. Without it, an approved post says it could not open the pull request.
5. Merge to `main`, so the playbook deploys with the functions, then sign in at `/request/` and send a test request.

Until each step is done the app says what is missing: ‘Sign-in is not set up yet’, ‘Request storage is not set up yet’, or a history line saying drafting did not start.

## Notes

- The drafter logs only the request id and its outcome, and saves nothing to the workflow run, because this repo is public.
- Preview deployments of the playbook get the pages but not the sign-in, so their API refuses every call.
- A web page request is never drafted automatically: it goes to Brad (LADDER-003), who builds it on the site.
- A journal post is drafted like a flyer, but has no file to download. When it is approved, the workflow runs again in `publish` mode and opens a pull request on the site; merging it publishes the post (D-059).

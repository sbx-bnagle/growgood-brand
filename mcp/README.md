# Brand server

An MCP server that gives an agent the Grow Good brand as it is on `main`: the rules for a job, the component contracts, the approved images, a renderer for print and social, and the copy and brand checks (D-039, D-056).

## Tools

| Tool | What it gives |
|---|---|
| `brand_guide` | Every brand file a job needs: open decisions, claims, the request ladder, then the job’s voice, format and visual rules. Start here. |
| `get_rule` | One rule by ID, with why and how it is checked. |
| `list_components`, `get_component` | The components and their contracts: params, where each value comes from, rules, examples. |
| `find_assets` | Approved images, with alt text and rights. |
| `render_format` | A flyer, postcard side or sheet, or social post built from components, saved as PDF or PNG, with preflight’s findings. |
| `check_copy` | The copy linter on a draft. |
| `judge_draft` | The brand judge on a draft and its request. Needs `ANTHROPIC_API_KEY`. |

## Run it

Claude Code picks it up from `.mcp.json` in this repo. For another client, run `node mcp/server.mjs` from this checkout after `npm ci`; it speaks MCP over stdio. Rendering needs Ruby with `bundle install` done, and Chrome.

| Setting | Effect |
|---|---|
| `GG_BRAND_SOURCE=<folder>` | Read the brand from a local checkout instead of `main` on GitHub. |
| `GG_RENDER_FROM=working` | Render from this checkout as it is on disk, not from `main`. |
| `GG_RENDER_CACHE=<folder>` | Where the worktree of `main` lives; default `~/.cache/growgood-brand/main`. |
| `GITHUB_TOKEN` | Optional; raises GitHub’s rate limit for reading `main`. |
| `ANTHROPIC_API_KEY` | Needed by `judge_draft` only. |

Rendered files go to `formats-rendered/`, which git ignores.

## Tests

`node --test tests/mcp.test.mjs` calls every tool through an MCP client, against this checkout.

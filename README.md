# Grow Good Gardens brand system

The Grow Good Gardens brand, written down so people and tools build from the same source. From a short request (an event name, a date, a place) it produces a web page, flyer, postcard or social post, checks it against the brand, and sends it to a person for approval.

## Parts

| Part | Where | Phase |
|---|---|---|
| Brand files: voice, visual rules, formats, decisions, claims | `brand/` | 1 |
| Design tokens: color, type, spacing | `tokens/`, synced from Figma | 2 |
| Figma library | [GG Design System](https://www.figma.com/design/V548R0Rl87JJKoZOtJzRDk/GG-Design-System) | 3 |
| Theme: includes, layouts and styles the site loads | `_includes/gg/`, `_layouts/`, `_sass/gg/`, `assets/gg/` | 4 |
| Component contracts | `_data/components/` | 4 |
| Playbook site: brand files, components, tokens, formats | this repo; `npm run playbook:serve` | 4 |
| Asset library | Google Drive folder and asset register | 5 |
| Checks: copy lint, style lint, accessibility, print preflight, brand score | `checks/` | 6 |
| Brand MCP server | `mcp/` | 7 |
| Request interface, in the playbook, with Google sign-in | the playbook | 8 |

The live site is a separate repo, [sbx-bnagle/growgood](https://github.com/sbx-bnagle/growgood). It uses this repo as a Jekyll theme pinned to a release tag.

## Start here

- People: `brand/readme.md` lists every brand file, its owner and its status.
- Agents: `AGENTS.md`.
- Plan: `ROADMAP.md`.
- Running it: `HANDOVER.md`. The pilot: `pilot/README.md`.
- Decisions and open questions: `brand/decisions.md`.

## See the theme on the site, locally

With the site checked out next to this repo (`../growgood`):

```bash
npm run site:serve
```

This links the theme files on disk into the site and serves it at http://localhost:4200, so theme changes show before they are released (D-040). `npm run site:unlink` puts the site back on the released theme. The links are never committed.

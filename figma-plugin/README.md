# GG Tokens

A Figma development plugin. It loads this repo’s tokens into the GG Design System file, and sends value changes made in Figma back to the repo as a pull request. It works on the Starter plan (D-017, D-018, D-029).

## Install, once

1. Open the Figma desktop app and the GG Design System file. Development plugins only load in the desktop app.
2. Menu, Plugins, Development, Import plugin from manifest.
3. Choose `figma-plugin/manifest.json` in this repo.

If Figma rejects the manifest’s `id`, use Plugins, Development, New plugin to get one, and replace `"id"` in `manifest.json` with it.

## Load tokens

Plugins, Development, GG Tokens, then Load tokens. It creates or updates:

| Collection | Variables | Holds |
|---|---|---|
| Color | 20 | `green/300` and the rest of the primitives |
| Color roles | 16 | Aliases to Color, such as `text/link` |
| Type | 49 | Family, weights, and size and line height per role and set. The lead is aliased to heading 1. |
| Space | 8 | Spacing |
| Layout | 19 | Breakpoints and grids |

It also creates 18 text styles: `Wide/…` for 768px and up, and `Narrow/…` for under 768px, each bound to its size and line height variables. Every collection has one mode, named Value, because Starter allows one.

Loading again updates values in place and deletes nothing. After token changes land in the repo, pull, run `npm run figma:build`, then Load tokens.

## Build pages and components

Plugins, Development, GG Tokens, then Build pages and components. Load tokens first. It sets up three pages (D-032):

| Page | What the plugin puts there |
|---|---|
| Foundations | One frame, rebuilt every time from this file’s variables: color swatches, each D-030 role pair with its contrast, both type sets, spacing, breakpoints and grids |
| Components | Wordmark, Button, Card, CTA block, Hero, Header, Footer, FAQ item, Subscribe, Event details (Wide and Narrow), Art placeholder, Image with spot (D-033). Colors, spacing and text styles are bound to the tokens; properties are named after the include parameters. |
| Templates | Web event page, flyer, postcard front and back, the sheet of four, and social feed, story and event cover, at their sizes, made of component instances (D-036) |

Building again rebuilds Foundations and adds only what is missing. A component or template that exists is never changed, so design them by hand from here (D-031). To get a fresh copy of one, delete it and build again.

## Send changes to GitHub

1. Make a fine-grained token on GitHub: Settings, Developer settings, Fine-grained tokens, Generate new token. Repository access: only `sbx-bnagle/growgood-brand`. Permissions: Contents read and write, Pull requests read and write.
2. Paste it into Access token. Tick Remember to keep it in Figma’s plugin storage on this computer only.
3. Change variable values in Figma. Keep names as they are.
4. Press Send changes. The plugin compares the variables with `tokens/*.json` on the base branch, creates a branch named `figma/tokens-<time>`, commits the changed files, opens a pull request and shows its link.
5. The Tokens workflow checks the values on the pull request and names the rule behind any failure.

It does not rename, delete or restructure tokens, and it does not send text styles back: those are built from the type tokens.

If GitHub refuses a step, the panel logs GitHub’s error, then a line saying what to change. The most common one is a token that can read the repo but not write to it. Since the repo is public, any token can read it. Writing needs Contents and Pull requests set to Read and write, for this repo only.

## Development

- `src/code.js`: runs inside Figma. ES2017 only.
- `src/ui.html`: the panel.
- `tools/lib/tokens.mjs`: shared with the build and check scripts.
- `npm run figma:build` writes `dist/`; `npm test` builds and tests against a mock of the Figma API.

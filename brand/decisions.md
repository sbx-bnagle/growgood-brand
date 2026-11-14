---
id: decisions
title: Decisions
owner: leah-fagan
maintainer: brad-nagle
status: draft
version: 0.1.0
last_reviewed: 2026-11-13
lane: fixed
applies_to: [web, flyer, postcard, social]
rule_prefix: none
depends_on: []
decisions: []
---

# Decisions

Every brand and system decision, with its date, its reason and the files it affects. A replaced decision stays here, marked as replaced. Anything under ‘Open’ is undecided, and nothing gets built on it.

## Open

### O-03 How Leah approves changes
Raised 2026-11-13. Needed by Phase 4.
Leah is the keeper (D-011). Either she uses a GitHub account and approves pull requests directly, or she approves in the request app and the app records her approval on the pull request.
Affects: `.github/CODEOWNERS`, review gates.

### O-04 Where the request app runs
Raised 2026-11-13. Needed by Phase 8.
Sign-in is decided (D-010). Hosting is not. Options include Cloudflare, already used for Grow Good’s order workers, or another host. Rendering PDF and PNG needs a headless browser wherever it runs.
Affects: Phase 8.

### O-05 Typeface
Raised 2026-11-13. Needed by Phase 2.
The site’s styles use Alegreya Sans only. Proxima Nova (400, 600) loads from Typekit on every page but no style uses it. Keep Alegreya Sans alone, give Proxima Nova a role, or choose again. Figma, print and social must all have the face available.
Affects: `brand/visual/typography.md`, tokens.

### O-06 On-brand images from text (future iteration)
Raised 2026-11-13. Needed after Phase 9.
A model that makes on-brand images from a text request: a text-to-image LoRA trained on approved illustrations, reference-image generation, or the rzwc edit LoRA with automatic orange screening of supplied photos.
Affects: `brand/visual/imagery.md`, MCP tools, request ladder.

### Closed
- O-01 Figma plan: decided as D-017.
- O-02 Figma-to-repo export method: decided as D-018.

## Active

### D-001 Web pages are built for the existing Jekyll site
2026-11-13, Brad Nagle.
Web output is pages for growgoodgardens.com, a Jekyll site on GitHub Pages (sbx-bnagle/growgood). Components are Jekyll includes, not React.
Why: the site already runs on Jekyll, with 22 includes and a Sass token system. Changing framework adds work without improving the output.
Affects: `formats/web-page.md`, `system/components.md`, theme.

### D-002 The brand system has its own repo and ships as a Jekyll theme
2026-11-13, Brad Nagle.
This public repo (sbx-bnagle/growgood-brand) holds the brand files, tokens, components, checks, MCP server and request app. The site uses it as a Jekyll theme pinned to a release tag. Theme includes sit under `gg/` so they do not collide with the site’s own.
Why: the live site changes only when a release is adopted, tooling stays out of the site, and releases give a visible history.
Cost: two repos. A component must be released before a page that uses it can merge.
Affects: `README.md`, `tokens/README.md`, Phase 4.

### D-003 The site builds with GitHub Actions
2026-11-13, Brad Nagle.
The site moves from the legacy GitHub Pages build to a GitHub Actions build.
Why: the legacy build ignores the Gemfile’s Jekyll 4.4.1, so local and live builds can differ. An Actions build can also run the checks before it deploys.
Affects: sbx-bnagle/growgood, Phase 4.

### D-004 No Storybook: the playbook site is the catalog
2026-11-13, Brad Nagle.
A Jekyll playbook site in this repo renders every include from its contract, beside the brand files.
Why: Storybook’s agent manifest supports React only. Jekyll renders the includes natively, and people and agents read the same source.
Affects: Phase 4.

### D-005 One render engine for every format
2026-11-13, Brad Nagle.
Jekyll builds web pages, print sheets and social frames from the same includes. A headless browser saves print as PDF and social as PNG.
Why: one set of components to keep on brand and to check.
Affects: `formats/`, checks, MCP render tool.

### D-006 Flyers print on an office printer
2026-11-13, Brad Nagle.
US Letter, RGB PDF, no bleed, all content inside a printer-safe margin.
Why: Grow Good prints in house.
Affects: `formats/flyer.md`, print preflight.

### D-007 Postcards are quarter Letter, four to a sheet
2026-11-13, Brad Nagle.
4.25×5.5in, printed four to a Letter sheet with cut marks. Not mailed, so no address or postage area.
Why: in-house printing. Four cards per sheet, two cuts.
Affects: `formats/postcard.md`, print preflight.

### D-008 Social formats
2026-11-13, Brad Nagle.
Instagram and Facebook. 1080×1350px feed post (both), 1080×1920px story (both), 1920×1005px Facebook event cover.
Why: the two platforms Grow Good uses. Feed and story sizes are shared between them.
Affects: `formats/social.md`.

### D-009 The illustration LoRA is set aside; images come from an asset library
2026-11-13, Brad Nagle.
The rzwc edit LoRA is not part of this iteration. Images come from the Brand Assets folder in Google Drive and are listed in the asset register. Agents use approved rows only.
Why: the LoRA restyles an orange-screened montage, so it cannot make an image from event details alone. Its dataset also has four duplicate pairs and no caption files. A text-based approach is O-06.
Affects: `visual/imagery.md`, `assets/README.md`, Phase 5.

### D-010 The request app uses Google sign-in
2026-11-13, Brad Nagle.
Requesters sign in with their Google accounts.
Why: Grow Good already works in Google Drive. Two users get no new passwords.
Affects: Phase 8.

### D-011 Roles: one keeper, one maintainer
2026-11-13, Brad Nagle.
Leah Fagan is keeper: she approves changes to brand files and reviews assets before they go out. Brad Nagle is maintainer: he drafts changes, builds the system, sorts flags and takes ‘brief a person’ requests.
Why: one keeper stops the brand drifting one opinion at a time. Anyone can flag; changes go through the keeper.
Affects: front matter of every file, `.github/CODEOWNERS`, review gates.

### D-012 Tokens: the site’s Sass seeds Figma, then Figma decides
2026-11-13, Brad Nagle.
The site’s current Sass values (color, type, spacing, grid) are extracted and loaded into Figma Variables once. After that, values are edited and refined in Figma, and changes reach the site through the pipeline in `tokens/README.md`, with checks at each step.
Why: design decisions are made in Figma. The checks stop a Figma change reaching the site unreviewed.
Affects: `tokens/`, Phases 2 to 4.

### D-013 Voice and mechanics come from the house writing style
2026-11-13, Brad Nagle.
The garden writing style is the basis of `verbal/voice.md` and `verbal/mechanics.md`: a flat voice after Robin Kinross and Robert Wearing, second person, no em dashes, curly single quotes, US spelling, no space between a number and its unit. A copy linter checks the mechanics.
Why: the style already exists and is in use. Mechanical rules are a tool’s job, not a reviewer’s.
Affects: `verbal/`, checks.

### D-014 Brand files are short Markdown chunks with front matter
2026-11-13, Brad Nagle.
About 400 tokens per file. Front matter per `_template.md`. YAML only for lists. Rules carry a prefix and number. Each file has a fixed lane (checked) and an open lane (examples and plays). The files follow the house mechanics. Before each release, a fresh agent with no context builds from the files, and every wrong call becomes a line in a file.
Why: short files let an agent open only what a job needs (Little Plains). Rule IDs connect a failed check to the file and its owner. The fresh-agent test finds gaps before a requester does.
Affects: every file in `brand/`.

### D-015 A claims register
2026-11-13, Brad Nagle.
`claims.md` lists every public fact in exact wording. A fact not in the file does not go out. (TON Studio practice.)
Why: a wrong fact in print cannot be recalled.
Affects: `claims.md`, brand judge.

### D-016 A request ladder
2026-11-13, Brad Nagle.
Every request lands on one step: make it, adapt it, brief a person, or stop and ask. (TON Studio practice.)
Why: the system says no when the files do not cover a request, and that is how it grows.
Affects: `system/request-ladder.md`, MCP, request app.

### D-017 Figma on the Starter plan
2026-11-13, Brad Nagle. Closes O-01.
The design system lives in one Figma file on the Starter plan: [GG Design System](https://www.figma.com/design/V548R0Rl87JJKoZOtJzRDk/GG-Design-System), file key V548R0Rl87JJKoZOtJzRDk, team ‘Brad Nagle’s team’.
Why: cost. The system is a test case for two users.
Consequences: agents can read Figma through the connector only a few times a month and cannot write to it. Variables have one mode. Libraries are not published, so foundations, components and templates share one file. Revisit if agent-built Figma work becomes a goal.
Affects: Phases 2 and 3.

### D-018 Figma sync runs through a custom development plugin
2026-11-13, Brad Nagle. Closes O-02.
A small Figma plugin kept in this repo imports the seed tokens into Variables, and exports Variables as DTCG JSON in a pull request.
Why: on Starter the connector cannot write, and the Variables REST API needs Enterprise. A development plugin has no call quota, and its export button is a natural review point. Plan support confirmed in Phase 2.
Affects: `tokens/`, Phase 2.

### D-019 Brand assets live in Leah’s Grow Good Drive folder
2026-11-13, Brad Nagle.
Grow Good / Brand Assets holds 00 Inbox, Photography, Illustrations, Spots and icons, Logos, Partners, Retired, and the Asset register sheet.
Why: beside the team’s existing folders, so Leah sees it without a new share.
Affects: `assets/README.md`, Phase 5.

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

### O-06 On-brand images from text (future iteration)
Raised 2026-11-13. Needed after Phase 9.
A model that makes on-brand images from a text request: a text-to-image LoRA trained on approved illustrations, reference-image generation, or the rzwc edit LoRA with automatic orange screening of supplied photos.
Affects: `brand/visual/imagery.md`, MCP tools, request ladder.

### O-12 Audiences
Raised 2026-11-13 in the Phase 1 audit. Needed by Phase 1 sign-off.
The Customer Profiles doc names four audiences with no detail yet: new homeowner, retiree with a hobby, gardener looking to up their game, eco-conscious. The site names homeowners, renters and community groups. Agree the list, and one line each on what they need from Grow Good.
Affects: `verbal/audiences.yml`.
Brad is taking this to Leah. Claude can draft from the site and the Drive docs when asked.

### O-16 Color roles
Raised 2026-11-13 in Phase 2. Needed by Phase 3.
The two-tier naming from O-08 is accepted; the role mapping is proposed in `tokens/color-roles.json`. Surface: default neutral-100, tint green-100, inverse green-400. Text: default neutral-400, muted neutral-300, inverse neutral-100, link green-300. Border: neutral-200. Action: default green-300 with neutral-100 text; bright green-200 with neutral-400 text, for dark surfaces. Accent: each family’s 300, with neutral-100 text. Every pairing passes the `tokens:check` contrast checks. Confirm or adjust.
Affects: `tokens/color-roles.json`, `visual/color.md`, Phase 3.

### Closed
- O-01 Figma plan: decided as D-017.
- O-02 Figma-to-repo export method: decided as D-018.
- O-05 Typeface: decided as D-020.
- O-07 Wordmark: decided as D-025.
- O-08 Palette roles and names, O-09 Accessible accent pairs: decided as D-021.
- O-10 Voice in promotional copy: decided as D-022.
- O-11 Names, places and dates: decided as D-023.
- O-13 Art direction: decided as D-024.
- O-14 Type scale: decided as D-026.
- O-15 Type sizes on small screens: decided as D-027.

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

### D-020 Alegreya Sans is the only typeface
2026-11-13, Brad Nagle. Closes O-05.
Every format uses Alegreya Sans. The unused Proxima Nova load comes off the site in Phase 4. The type scale is still open (O-14).
Why: the site is built on it, it is free, and it is available in Figma, print and social.
Affects: `visual/typography.md`, tokens.

### D-021 Color ramps: four levels per hue
2026-11-13, Brad Nagle. Closes O-08 and O-09.
Each color family has four levels, named family-100 to family-400. 100 is the lightest. 200 is a bright accent of the hue. 300 and 400 are dark. Every 100 must reach 4.5:1 on every family’s 300 and 400, so light text works on any dark surface. Existing values are kept where they meet the rule, and adjusted in lightness only where they do not. Neutral has no hue to accent, so neutral-200 is proposed as the existing light gray. Purple-200 is #947cff (option A on the color ramps page), replacing #6f63b0, which read as a mid-tone.
Why: the hues are right; the gaps were in the range. A fixed contrast rule makes the accent card problem (O-09) a property of the palette rather than a case-by-case fix.
Affects: tokens, `visual/color.md`, Phase 2.

### D-022 One voice: flat, a little warmer, no exclamation marks or emoji
2026-11-13, Brad Nagle. Closes O-10.
The flat voice applies to every format, written as a neighbor who knows plants. No emoji. No exclamation marks. An event headline is the event’s name.
Why: one voice is easier to hold than two. Warmth comes from ‘we’, from local detail and from facts about plants, not from punctuation.
Affects: `verbal/voice.md`, `verbal/mechanics.md`, `lint-copy`.

### D-023 Names, places and dates
2026-11-13, Brad Nagle. Closes O-11.
‘Grow Good Gardens’ on first mention, ‘Grow Good’ after. ‘Upper Midwest’, capitalized. Event dates and times as ‘Saturday, May 16, 10:00am–noon’.
Why: one form of each, so every format and every tool writes them the same way.
Affects: `verbal/names-and-dates.md`, `claims.md` (C-002).

### D-024 Imagery: spots, photographs and LoRA renders supplied as assets
2026-11-13, Brad Nagle. Closes O-13. Refines D-009.
The 13 spot illustrations stay as the illustration system, alongside photographs and garden renders made with the rzwc LoRA. Brad makes the renders outside the request flow. They enter the asset library like any other image: registered, with alt text, and approved before use. Requesters cannot generate images (O-06 stays open).
Why: the renders are among the strongest images Grow Good has. Making them by hand keeps the montage step, and the check that plants stay true, with a person.
Affects: `visual/imagery.md`, `assets/README.md`, Phase 5.

### D-025 The existing logo is the provisional mark
2026-11-13, Brad Nagle. Closes O-07.
Grow Good has a logo that is not yet on the site. It is the starting point, and the mark in use until a branding project refines it. Its files go in Brand Assets / Logos.
Why: every format needs a mark now. Refining it is design work for a person (LADDER-003), not a system decision.
Affects: `visual/logo.md`, every format, roadmap backlog.

### D-026 Type scale: an edited augmented fourth on a 21px body
2026-11-13, Brad Nagle. Closes O-14.
Ratio 1.414 (augmented fourth) from a 21px body. Heading 1 to heading 4 sit one step lower than on the plain scale. The lead is the heading 1 size in regular weight. The display line height is 8px under its size. Every line height is a multiple of 4px.
Size/line height in px: display 119/112, heading 1 59/68, lead 59/68, heading 2 42/48, heading 3 30/40, heading 4 21/32, body 21/32, small 15/24, caption 11/16.
Weights as reviewed: display and heading 1 at 800, heading 2 to 4 at 700, lead, body, small and caption at 400.
Why: chosen by Brad after comparing 36 common scales on a 4px grid, then a shortlist of three, then three adjustments.
Affects: `visual/typography.md`, tokens, Phase 2. Sizes under 768px: D-027.

### D-027 Type under 768px: the same roles on a major third from a 19px body
2026-11-13, Brad Nagle. Closes O-15.
Below 768px, the current site’s breakpoint, a second, smaller set replaces D-026. Same role positions and weights, on a major third (ratio 1.25) from a 19px body. The lead stays the heading 1 size in regular weight. The display keeps the wide set’s line height to size proportion, rounded up to the grid. Every line height is a multiple of 4px.
Size/line height in px: display 58/56, heading 1 37/48, lead 37/48, heading 2 30/40, heading 3 24/36, heading 4 19/28, body 19/28, small 15/24, caption 12/20.
Why: the wide display (119px) and heading 1 (59px) cannot fit a phone column. Confirmed by Brad after reviewing the set at phone width on the type scale reference.
Affects: `visual/typography.md`, tokens, Phase 2.

### D-028 Token outputs come from a small build script in this repo
2026-11-13, made in Phase 2 by Claude for Brad Nagle. Replace this entry to change it.
`tools/build-tokens.mjs` writes `tokens/build`: CSS custom properties, Sass variables and maps, and flat JSON. Style Dictionary is not used.
Why: 112 tokens, and the type sets need a media query that Style Dictionary would need a custom format for anyway. The same token library is bundled into the Figma plugin, so the build and the plugin cannot read the files differently.
Affects: `tokens/build`, `tokens/README.md`.

### D-029 How tokens map to Figma, and back
2026-11-13, made in Phase 2 by Claude for Brad Nagle. Replace this entry to change it.
Five variable collections (Color, Color roles, Type, Space, Layout), one mode each, named Value. Variable names drop the file’s root (color.green.300 becomes Color / green/300). References become aliases, so roles follow primitives and the lead follows heading 1. Eighteen text styles, Wide and Narrow, bound to the size and line height variables. Load tokens updates in place and deletes nothing. Send changes merges values only into the repo files and opens a pull request from a `figma/tokens-<time>` branch; the Tokens workflow checks it and commits rebuilt outputs. Names and structure change in the repo.
Why: Starter allows one mode per collection. Sending values only keeps descriptions, extensions and structure in the reviewed repo, and keeps each pull request to the values that moved.
Affects: `figma-plugin/`, `tools/lib/tokens.mjs`, `.github/workflows/tokens.yml`.


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

### O-06 On-brand images from text (future iteration)
Raised 2026-11-13. Needed after Phase 9.
A model that makes on-brand images from a text request: a text-to-image LoRA trained on approved illustrations, reference-image generation, or the rzwc edit LoRA with automatic orange screening of supplied photos.
Affects: `brand/visual/imagery.md`, MCP tools, request ladder.

### O-12 Audiences
Raised 2026-11-13 in the Phase 1 audit. Needed by Phase 1 sign-off.
The Customer Profiles doc names four audiences with no detail yet: new homeowner, retiree with a hobby, gardener looking to up their game, eco-conscious. The site names homeowners, renters and community groups. Agree the list, and one line each on what they need from Grow Good.
Affects: `verbal/audiences.yml`.
Brad is taking this to Leah. Claude can draft from the site and the Drive docs when asked.

### O-18 A label text style
Raised 2026-11-13 in Phase 3; narrowed 2026-11-14 by D-049. Needed by the Phase 3 design review.
Buttons, nav and form labels use Heading 4 (D-049). What remains are the site’s small bold labels: small at the bold weight, which has no text style. Either add a label role to the type tokens (size and line height of small, weight bold), or keep the bold override.
Affects: `tokens/type.json`, `visual/typography.md`, the site’s xs bold labels.

### O-19 Image channels
Raised 2026-11-16 in Phase 5. Needed before `visual/imagery.md` is approved.
Grow Good’s images will come through several channels, such as rendered gardens, photography, illustration and hand-cut illustration, each likely with its own style and rules. The channels are still being worked out. Until they are settled, the register’s `type` keeps its current values, `style` stays blank, and no rule chooses an image by channel.
Affects: the asset register (`type`, `style`), `visual/imagery.md`, D-038.

### O-20 Which checks block at launch
Raised 2026-11-17 in Phase 6. Needed by launch (Phase 9).
Until launch every check warns (D-054). Each rule carries a proposed level for launch: block for MECH, NAMES, component contracts, assets, accessibility failures, contrast, and print size and margin; warn for VOICE patterns and the brand judge’s style notes. Confirm or change the split, and decide whether failing checks become required on `main`.
Affects: `checks/`, branch protection in both repos, D-047.

### O-21 Black and white print
Raised 2026-11-17 in Phase 6. Needed before the print preflight checks color.
Flyers and postcards will change to black and white. D-006 still says RGB PDF. Settle grayscale or pure black; how the color tokens, spots, illustrations and photographs print; and whether the color print templates stay as an option. Until then, print preflight checks size, margin, fonts and image resolution, and leaves color out.
Affects: D-006, D-007, `formats/flyer.md`, `formats/postcard.md`, `visual/color.md`, the format templates, print preflight.

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
- O-16 Color roles: decided as D-030.
- O-17 Art direction for print and social templates: decided as D-035.
- O-03 How Leah approves changes: decided as D-047.
- O-04 Where the playbook and the request interface are hosted: decided as D-052.

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
Affects: `visual/imagery.md`, `asset-library/README.md`, Phase 5.

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
Affects: `asset-library/README.md`, Phase 5.

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
Affects: `visual/imagery.md`, `asset-library/README.md`, Phase 5.

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


### D-030 Color roles
2026-11-13, Brad Nagle. Closes O-16. Confirmed for now; expect adjustments once Phase 3 components use the roles.
Roles point at primitives (`tokens/color-roles.json`). Surface: default neutral-100, tint green-100, inverse green-400. Text: default neutral-400, muted neutral-300, inverse neutral-100, link green-300. Border: neutral-200. Action: default green-300 with neutral-100 text; bright green-200 with neutral-400 text, for dark surfaces. Accent: each family’s 300, with neutral-100 text.
Why: every pairing passes the `tokens:check` contrast checks, and components can name a role instead of a primitive, so a change to the mapping reaches every component at once.
Affects: `tokens/color-roles.json`, `visual/color.md`, Phase 3.

### D-031 The Figma library is built by the plugin, then by hand
2026-11-13, Brad Nagle.
GG Tokens builds the Foundations page and a bare frame for each component from the tokens: structure, text styles, color roles and spacing bound to variables, and properties named after the include parameters. Brad designs the components from there, and the templates are built from the components. The plugin rebuilds Foundations whenever asked, and never replaces a component that already exists.
Why: Starter has no libraries and a small Figma connector quota, so building through the connector would use up the month. The plugin has no limit and keeps the foundations in step with the tokens. Design stays with a person.
Affects: `figma-plugin/`, the GG Design System file.

### D-032 Three pages: Foundations, Components, Templates
2026-11-13, Brad Nagle.
Everything lives in the GG Design System file, on three pages.
Why: Starter allows three pages per file in a team folder, and components can only be used in the file they live in.
Affects: the GG Design System file.

### D-033 First component set
2026-11-13, Brad Nagle.
Button, Card, CTA block, Hero, Header, Footer, FAQ item, Subscribe, Event details, Wordmark, and Image with spot. Each web component mirrors a Jekyll include, with Figma properties named after its parameters. Event details is new: name, what, when, where, cost and link, in VOICE-010 order, for every format. Unused and app-like includes wait.
Why: these cover the four request formats. One contract per component serves Figma, the theme (Phase 4) and agents alike.
Affects: Components page, `system/components.md`, Phase 4.

### D-034 Type sizes in print and social
2026-11-13, Brad Nagle.
Flyers use the Wide set, with 1px as 1pt on a 612×792pt Letter page. Postcards use the Narrow set on a 306×396pt card. Social posts use the Wide set on their 1080px canvases (D-008).
Why: one type scale everywhere. A Letter flyer reads at a distance like a wide screen; a postcard is held close, like a phone.
Affects: `formats/flyer.md`, `formats/postcard.md`, `formats/social.md`, Templates page.

### D-035 Art direction: English craft, hippie modernism, hand drawn
2026-11-13, Brad Nagle. Closes O-17.
Print and social templates blend three Branding Ref headings: English craft, hippie modernism, and hand drawn. Until the references are in, every template holds the Art placeholder component in their place. Brad collects the references in Brand Assets / Art direction.
Why: the direction is set; the references that define it in practice come next.
Affects: Templates page, the Art placeholder component, `visual/imagery.md`, `formats/flyer.md`, `formats/postcard.md`, `formats/social.md`.

### D-036 The plugin scaffolds the templates
2026-11-13, made in Phase 3 by Claude for Brad Nagle. Refines D-031. Replace this entry to change it.
Build pages and components also adds one frame per format: web event page (1440px), flyer (612×792pt), postcard front and back (306×396pt), the sheet of four, and social feed, story and event cover (D-007, D-008, D-034). Each is made of component instances and the Art placeholder, so design work on a component reaches every template. A template that exists is never changed.
Why: the sizes and parts come straight from decisions, so a person need not set them up by hand; the design of each template stays with a person.
Affects: `figma-plugin/`, Templates page.

### D-037 The wordmark has variants, found through the asset register
2026-11-14, Brad Nagle. Refines D-025.
The wordmark include takes a `variant` parameter, `primary` by default, and finds its file through the approved logo row whose `style` matches, not a fixed path. The Wordmark component gets a matching Variant property. `visual/logo.md` will say which variant goes where. Adding a logo means a register row, a component variant and a rule; no template changes.
Why: logos for different contexts are expected. A slot now costs one parameter; a retrofit later would touch every template.
Affects: the wordmark include and component, `asset-library/README.md`, `visual/logo.md`, Phases 4 and 5.

### D-038 Illustration style is a column in the asset register
2026-11-14, Brad Nagle. Refines D-024.
The register gets a `style` column. For illustrations, spots and icons it names the illustration style; for logos it names the wordmark variant (D-037). Values are open for now; `visual/imagery.md` and `visual/logo.md` will list them and say which to use where.
Why: several illustration styles are expected. Adding the column while the register is empty avoids backfilling rows later.
Affects: the asset register, `asset-library/README.md`, `visual/imagery.md`, Phase 5.

### D-039 Agents read the brand files when each request runs
2026-11-14, Brad Nagle.
The Brand MCP server (Phase 7) and the request app (Phase 8) read the brand files, claims, tokens and component contracts from `main` when each request runs, never from a copy made when they were built or deployed.
Why: instructions, voice, rules and designs will keep being refined after the phases. A change merged to `main` reaches the next request with no rebuild.
Affects: Phases 7 and 8.

### D-040 The site uses the theme as a remote theme, pinned to a release
2026-11-14, Brad Nagle. Refines D-002.
The site loads this repo with `remote_theme`, pinned to a release tag such as `v0.4.0`. A theme change reaches the site only when a site pull request moves the tag. For local work, a script links this checkout into the site, so the site can be viewed locally with the theme as it is on disk.
Why: the live site changes only by reviewed pull request, and changes to the theme can still be seen applied before release.
Affects: the site’s `_config.yml` and Gemfile, release tags, local preview.

### D-041 Theme includes live under gg/
2026-11-14, Brad Nagle.
Every theme include is `_includes/gg/<name>.html`, with its styles in `_sass/gg/`.
Why: a site file overrides a theme file of the same name. A separate folder lets the old and new includes coexist, so pages move over one at a time.
Affects: the theme, the site migration.

### D-042 Each component has a contract
2026-11-14, Brad Nagle.
`_data/components/<name>.yml` describes each include: its parameters with type, whether required, default, where the value must come from (the request, `claims.md`, the asset register or the site’s data), the rules it follows, and worked examples. The playbook renders the examples; the checks, the Brand MCP server and the request interface read the same file.
Why: one description of each component, read by people, checks and agents alike.
Affects: `_data/components/`, `system/components.md`, the playbook, Phases 6 to 8.

### D-043 Web, print and social share one set of includes and layouts
2026-11-14, Brad Nagle. Carries out D-005.
The theme has layouts for web pages, the Letter flyer, the postcard (front, back and the sheet of four) and the three social sizes. Print and social are pages captured to PDF or PNG. Their structure follows the Figma templates now; their styling follows the designs as they are made.
Why: one render engine for every format, so a component fix reaches every format.
Affects: `_layouts/`, Phase 8 rendering.

### D-044 The playbook is a published site, and the request interface lives in it
2026-11-14, Brad Nagle. Refines D-004 and D-010.
This repo is also the playbook site: it renders the brand files, the tokens and every component from its contract. It is published. The request interface (Phase 8) is part of it, behind Google sign-in; where it is hosted is O-04.
Why: one place to read the brand and to ask for work. Sign-in protects requests, not the brand itself.
Affects: the playbook, the deploy, Phase 8.

### D-045 Fonts: Alegreya Sans 400, 400 italic, 700 and 800
2026-11-14, Brad Nagle. Carries out D-020.
The theme loads the four styles the type tokens use. The site stops loading Proxima Nova.
Why: display and heading 1 are 800 and captions are italic; the site loads only 400 and 700, so the browser fakes the rest.
Affects: the theme’s head include, the site.

### D-046 The site moves to the theme in four pull requests
2026-11-14, Brad Nagle.
On the site repo, each with before and after screenshots: the GitHub Actions build with Enforce HTTPS turned on and no visual change; the site’s Sass pointed at the tokens; includes swapped one at a time; the remaining live-site fixes. `/dashboard/` and `/preplanned/` stay reachable but are hidden from search engines. The four `fpo.png` placeholders are replaced in Phase 5 with registered images.
Why: the site is live; each step can be checked and rolled back on its own.
Affects: the site repo, Phase 5.

### D-047 Approvals: none while building; Leah approves in the playbook after launch
2026-11-14, Brad Nagle. Closes O-03.
Until launch, Brad merges without a separate approval. After launch, Leah approves in the request interface in the playbook, which records her approval. `.github/CODEOWNERS` stays as it is.
Why: one person is building the system; the gate matters once real requests flow.
Affects: review gates, Phase 8.

### D-048 The asset library notes move to asset-library/
2026-11-14, made in Phase 4 by Claude for Brad Nagle. Replace this entry to change it.
`assets/README.md` is now `asset-library/README.md`. The theme’s `assets/` folder holds only files the site and the playbook serve.
Why: everything in a theme’s `assets/` folder is copied into the site, so the notes and their Drive links would have appeared on growgoodgardens.com.
Affects: `asset-library/README.md`, `brand/readme.md`.

### D-049 The site’s type styles map onto the type roles
2026-11-14, Brad Nagle. Carries out D-026 and D-027 on the site.
Each site style takes a role’s size, line height and weight, as the type scale defines them: xl to display, lg bold to h1, lg regular to lead, md to h2, md2 to h3, sm bold to h4, sm regular to body, xs regular to small, and xs bold to small in bold (O-18). Buttons, nav and form labels are sm bold, so they are Heading 4, body size in bold; the theme’s button and card link, and the Figma Button and Event details, follow. The site keeps its baseline offsets; the values switch through custom properties, which removes the Dart Sass pin.
Why: the site’s styles are steps, and the type roles are steps; mapping step to step keeps every page’s hierarchy. Weights come from the type scale exploration, as Brad chose.
Affects: the site’s `_sass/config/_type.scss`, the theme’s button, card and subscribe styles, the Figma Button and Event details, O-18.

### D-050 The site moves in five steps, and HTTPS is enforced at Cloudflare
2026-11-14, made in Phase 4 by Claude for Brad Nagle. Refines D-046. Replace this entry to change it.
Type is its own step, after color, spacing and layout: the build, the Sass on the tokens, the type, the include swaps, and the live-site fixes. growgoodgardens.com runs through Cloudflare, which holds its HTTPS certificate, so GitHub cannot enforce HTTPS; Cloudflare’s Always Use HTTPS does instead.
Why: the type change touches every page and reviews best on its own. GitHub refused to enforce HTTPS without its own certificate.
Affects: the site migration, Cloudflare settings.

### D-051 The theme carries the site’s own components and their Sass
2026-11-15, Brad Nagle. Refines D-041 and D-043.
The site’s Sass foundation (plumber, mixins, functions, the token-based config, reset, typography and base) and six of its components (CTA, card, FAQ and FAQ item, subscribe, header, footer) move into the theme as they are: Sass in `_sass/gg/site/`, markup in `_includes/gg/`. The site imports the same partials from the theme in the same order, so its CSS is unchanged. These includes keep the site’s classes and the ids its scripts use, read the site’s data (navigation, FAQ, social links, copyright, reCAPTCHA key), and replace the stand-ins from Phase 4. The playbook shows them in frames that load the site’s styles. The theme’s own `gg-` styles stay for the print and social formats and the components the site does not have yet.
Why: porting the site’s look into new CSS risked drift; moving the real Sass makes the swap provably free of visual change, and the theme now holds the brand as the site shows it.
Affects: `_sass/gg/site/`, `_includes/gg/`, `_data/components/`, the playbook, the site’s `main.scss` and layouts.

### D-052 The playbook is hosted on Cloudflare Pages; Cloudflare Access puts the request pages behind Google sign-in
2026-11-16, Brad Nagle. Closes O-04. Refines D-044.
The playbook builds in GitHub Actions, as the Playbook check already does, and deploys to the Cloudflare Pages project `growgood-playbook`, served at growgood-playbook.pages.dev: `main` to production, each pull request to a preview address of its own. The brand pages stay public. The request pages (Phase 8) live under `/request/`, behind a Cloudflare Access application that signs people in with their Google account. Who may sign in is settled in Phase 8. A custom domain, such as playbook.growgoodgardens.com, can be added on the Pages project later without a code change; Access can protect the `pages.dev` address as well.
Why: growgoodgardens.com, its order Worker and its newsletter Worker already run on Cloudflare, and Access gives Google sign-in with no server of our own. GitHub Pages cannot require sign-in.
Affects: `.github/workflows/playbook.yml`, Cloudflare (the Pages project, its custom domain, Access), Phase 8.

### D-053 The asset library is seeded from the site and synced into the theme by a service account
2026-11-16, Brad Nagle. Refines D-009, D-019, D-024 and D-038.
The site’s brand images are the first rows of the register, A-0001 to A-0021: 13 spots, seven illustrations and one photograph, all draft. Interface icons, the `fpo.png` placeholder and the journal’s post images stay out. Brad moves the files into the Drive folders. Claude drafts each row’s alt text and Leah edits it; credit and usage rights come from Leah, and a row stays draft until she approves it. A Google service account with read-only access to Brand Assets reads the register, and a GitHub workflow copies every approved row with known rights into `assets/library/` and lists them in `_data/assets.yml`. A file over web size, 2400px on its longest edge or 2MB, is left out and named in the pull request, to be resized in Drive. Changes arrive as a pull request. Includes and agents read `_data/assets.yml`, never Drive.
Why: the images already on the site are the brand’s best-known ones. A read-only account lets the sync, and later the brand server, run without a person in the loop, and the pull request keeps a review step between the register and the site.
Affects: the asset register, `asset-library/README.md`, `assets/library/`, `_data/assets.yml`, `.github/workflows/`, Phases 5 and 7.

### D-054 Checks warn until launch, and each one is described in `checks/`
2026-11-17, Brad Nagle. Phase 6 answers 40 to 46.
Phase 6 builds, in order: the `checks/` folder, the copy linter v1, stylelint for the theme Sass, accessibility checks (axe-core in a headless browser, and token contrast), print and social preflight, the brand judge, then the checks in both repos’ pull requests. Until launch every check warns: it reports on the pull request and never fails it, because the branding is still being edited. Each rule keeps a proposed level for launch (O-20). The copy linter v1 reads only visible text, and leaves words in curly quotes to the quote rules, so brand files put the words they warn against in curly quotes. Once it runs on the site, one site pull request fixes the real findings. Accessibility targets WCAG 2.2 AA, with logo text exempt from contrast as WCAG allows: axe ‘serious’ and ‘critical’ findings, and contrast below 4.5:1 for text or 3:1 for large text and non-text, are block-level; keyboard and screen reader checks stay with the reviewer. Preflight checks each format’s exact size, keeps content inside the template’s padding, checks that fonts are embedded, and flags raster images below 150ppi at their placed size. The brand judge runs on the Claude API with a key Brad saves as a GitHub secret. A fact found in neither the request nor `claims.md` is block-level for request drafts; site pull requests get the judge’s report only, until Leah approves `claims.md`. Checks run on every pull request in both repos, with no required checks until launch (D-047). Stylelint covers the theme’s `_sass/gg`; the site’s own Sass is reported only.
Why: rules still change while the brand is edited, and a failing check would hold up work over a rule that may not last. Reports keep every finding in view.
Affects: `checks/`, `tools/`, `.github/workflows/` in both repos, `verbal/mechanics.md`, `system/accessibility.md`, Phases 6 to 8.

# Workflows

How to change each part of the Grow Good system. Every change takes the same path: a branch, a pull request with the checks’ reports, Leah’s approval for anything in `brand/` (D-011), then a merge. Agents follow the same paths (`AGENTS.md`). Day-to-day running is in `HANDOVER.md`.

Three things hold for every workflow:

- **A rule change needs a decision.** Add an entry to `brand/decisions.md`, with the rule IDs it touches.
- **Main is live for agents.** The brand server, the request app and its drafter read `main` when they run (D-039), so a merged rule reaches the next request at once.
- **The site moves by release.** It changes only when a site pull request moves `remote_theme` to a new tag (D-040). Tag after merging any theme change the site uses.

## 1. Updating the branding

### Logo variants, and when to use each

Today there is one variant, `primary` (LOGO-002), placed only by `gg/wordmark` (LOGO-001). A variant is a row in the asset register whose `style` names it (D-037).

1. **Decide the variants and their contexts.** For example:
   - `primary` on light surfaces;
   - `reversed` on `surface.inverse`;
   - `one-color` for black and white print (O-21);
   - `mark` for small sizes and avatars.
   For each, write a LOGO rule in `brand/visual/logo.md` saying where it is used, its minimum size and its clear space. Add a decisions entry. Leah approves.
2. **Add the files.** Export each variant as SVG, with a PNG beside it for print, into the logos folder in Brand Assets. Add one register row per variant: type `logo`, `style` set to the variant, alt ‘Grow Good Gardens’, rights `owned`. Leah approves each row. The Assets workflow copies them in (step 4 of Assets, below).
3. **Teach the component.** In `_data/components/wordmark.yml`, add the variant to `variant.values`, with an example for each, so the playbook shows them. Where a format always takes one variant, such as reversed on a dark cover, set it in that template, not in each request.
4. **Figma.** Give the Wordmark component a matching variant property.
5. **Checks.** `components:check` refuses a variant the contract does not list. The reviewer checks context against the new rules.

### Tokens: color, type, spacing

Values flow from Figma; names and structure flow from this repo (`tokens/README.md`).

1. **Values.** Change the variables in the GG Design System file, then use the GG Tokens plugin’s **Send changes**. It opens a pull request that changes `tokens/*.json`.
2. **Checks.** The Tokens workflow:
   - runs `tokens:check`, naming each failure by rule: contrast and order (D-021), role pairs (D-030), the 4px baseline (TYPE-003);
   - rebuilds `tokens/build` and the theme’s Sass;
   - commits both to the pull request.
3. **Review.** Read the playbook preview linked on the pull request: the Tokens page, and the components that use the changed values. Leah approves.
4. **Release.** Merge, tag, and open the site pull request. Take before and after screenshots at 320, 375, 768 and 1280px; the site’s checks run against the new tag.
5. **Structure.** A new role, group or name is changed here by pull request. Rebuild the plugin with `npm run figma:build`, then run **Load tokens** in Figma.

Black and white print (O-21) is a token question first: settle the print roles, then the templates.

### Components, and new print-only components

A component is an include, its Sass, a contract and a Figma component:

| Part | Where |
|---|---|
| Include | `_includes/gg/<name>.html` (D-041) |
| Styles | `_sass/gg/components/` for print and social; `_sass/gg/site/` for the site’s own (D-051) |
| Contract | `_data/components/<name>.yml` (D-042) |
| Figma | the Components page |

**To change one:**
1. Edit the include and its Sass.
2. Update the contract: params, rules, examples.
3. Run `npm run components:check`, `npm run playbook:build`, then `bundle exec jekyll build && npm run checks:a11y && npm run preflight`.
4. Open the pull request. Its playbook preview shows every example, and its Accessibility run attaches the rendered formats.

**To make a print-only one:**
1. **Brief it.** What it carries; which formats; where each value comes from (the request, `claims.md` or the asset register); which rules it follows.
2. **Design it in Figma** at print size: 1px per pt, type from the print set (D-034).
3. **Build it.**
   - Write the include with `gg-` classes and the token custom properties only.
   - Put its Sass in `_sass/gg/components/` and add it to `_sass/gg/_index.scss` with `@use`.
   - Write its contract with `formats: [flyer, postcard]`, so the renderer refuses it elsewhere.
4. **Use it in a template.**
   - Add it to the format pages in `tools/build-playbook.mjs`, so the playbook shows it.
   - Add it to that format’s `parts` in `_data/request-formats.yml`.
   The request form then asks for its request-sourced params, the drafter writes them, and preflight checks the result.
5. **Write the rules.** They go in `brand/formats/flyer.md` or `postcard.md` (FLY, CARD), which are still planned.

### Assets

1. **Add the file.** Put it in the right Brand Assets folder in Drive. Add its register row: type, subjects, season, orientation, alt text (IMG-002), credit and rights.
2. **Leah approves the row.** A row stays draft until she does.
3. **Size.** For print, upload up to 2400px on the longest edge: preflight wants 150ppi at the placed size. A web-size spot fills a flyer’s art area at about 70ppi and is flagged.
4. **Sync.** The Assets workflow runs every Monday, or by hand from Actions, then **Assets**, then **Run workflow**. It copies approved rows into `assets/library/` and `_data/assets.yml`, and opens a pull request with `assets:check`’s report. A file over size is named there, to be resized in Drive (D-053).
5. **Merge.**
   - The brand server and the request form’s image picker see the asset at once.
   - The site gets the file with the next release.

Image channels and styles are still open (O-19): keep `style` blank for illustrations until they are settled.

## 2. Refining the site’s design

1. **Find where the change lives.**
   - Shared components and the Sass foundation are in the theme (`_sass/gg/site/`, `_includes/gg/`, D-051).
   - Page-specific styles and layouts are in the site repo (`_sass/template/components/`, `_layouts/`, `_includes/`).
   - Colors, type and spacing are tokens (above).
2. **Design it** in Figma first for anything beyond a fix.
3. **Work locally.** `npm run site:serve` links this checkout into the site and serves it at localhost:4200 (D-040). `npm run site:unlink` undoes it.
4. **Compare.** Take before and after screenshots of the pages it touches at 320, 375, 768 and 1280px. Check `node tools/checks-site.mjs ../growgood` after a build: copy, the site’s Sass, and accessibility.
5. **Open the pull requests in order.**
   - First the theme’s: its playbook preview shows shared components.
   - Tag it.
   - Then the site’s: it moves the tag and makes the site-only changes, and its checks run against that tag.
   - Leah reviews the screenshots. Merging the site pull request publishes it.

Known work: the internal dashboard has no phone layout, and `gardenolator.js` throws on Home and Services.

## 3. Refining the playbook’s organization and design

| What | Where |
|---|---|
| Home page | `index.md` |
| Header and navigation | `_layouts/gg-playbook.html` |
| Styles (`pb-`, `rq-`) | `playbook/playbook.scss`, using the token custom properties |
| Generated pages: components, formats, tokens, assets | `tools/build-playbook.mjs`; never edit its output by hand |
| Brand, checks and request pages | `brand/`, `checks/`, `request/` |

1. **Start from who uses it:**
   - Leah reviewing and approving;
   - requesters;
   - Brad maintaining;
   - agents, which read the repo, not the site.
   One possible map: Start, Make something (requests), Brand, Library (components, formats, assets, tokens), Checks, Decisions.
2. **Change the navigation and pages.** When a page moves, add its old address to a `_redirects` file at the root. Cloudflare Pages reads it, and links in documents and messages keep working. List `_redirects` under `include:` in `_config.yml`: Jekyll skips files whose names start with an underscore.
3. **Check.** Each pull request gets its own preview address. The Accessibility run checks every playbook page at 320px and 1280px, and the Playbook run lints the copy.
4. Leah reviews the preview before merging.

## 4. Updating the content rules

| Rules | Where |
|---|---|
| Voice (VOICE) | `brand/verbal/voice.md` |
| Mechanics (MECH), and the linter’s word list | `mechanics.md`, `spelling.yml` |
| Names, places and dates (NAMES) | `names-and-dates.md` |
| Preferred and banned terms | `vocabulary.md` (planned) |
| Facts | `claims.md` |
| Story and audiences | `story.md`, `audiences.yml` (planned, O-12) |

1. **Write the rule** with its ID, its *Why* and its *Check* line (`brand/_template.md`), and a decisions entry.
2. **Choose its check:**
   - **A pattern** goes in the copy linter: a rule in `tools/lib/copy-rules.mjs`, words in `spelling.yml`, and a case in `tests/lint-copy.test.mjs`.
   - **A judgment** goes to the brand judge: add the ID to `rules:` in `checks/brand-judge.md`. The judge reads the rule’s text from the brand files when it runs, with no code change.
   - **What neither can see** stays with the reviewer.
3. **Check the result.** Run `npm run checks:copy` on the brand files. Build the site and run `node tools/checks-site.mjs ../growgood` to see the new findings before they reach a pull request.
4. **Leah approves.** On merge, agents and the drafter use the rule at once. The site’s checks use it from the next release.

### SEO keywords

Nothing exists yet. A suggested shape, for Brad and Leah to decide:

1. **A KEY rule file,** `brand/verbal/keywords.md`. Each service page gets a primary phrase and a few secondary ones. The phrases come from Leah, like claims, never from a guess.
2. **Rules.** One primary phrase in each page’s title and description, written as people search and as Grow Good speaks, never stuffed. Titles of about 60 characters at most, descriptions of about 155. Alt text describes the image, never keywords.
3. **Checks.**
   - The copy linter checks title and description lengths on the built site.
   - The judge checks that the phrases read naturally (VOICE).
   - Pages set `title` and `description` in their front matter. The site’s head reads them through jekyll-seo-tag (`{% seo %}` in its `_includes/head.html`).

## 5. Journal posts as requests

Built (D-059). A requester picks **Journal post** and gives:
- a title;
- one of the journal’s eight categories;
- the points the post makes;
- the links it may use;
- optionally, an approved image.

1. **Drafting.** The drafter writes the post in Markdown under VOICE, MECH and NAMES, with a description for search.
   - Every link is checked against the request’s links (CLAIM-001).
   - The copy linter and the brand judge run on it.
   - The draft stays in the request app, out of the public site repo.
2. **Review and publish.**
   - Leah approves it in the request page (G2).
   - The workflow then opens a pull request on the site, adding `_posts/<category>/<date>-<slug>.markdown`. The site’s checks run on it, with the judge on the new post.
   - Merging that pull request publishes the post (G3).
3. **Changing it.** A note sent back before approval redrafts it. After approval, edit the pull request on GitHub.

To add a field, such as a date or an author, add it to the format’s `fields` in `_data/request-formats.yml`, and write it into the front matter in `postFile` in `tools/draft-request.mjs`.

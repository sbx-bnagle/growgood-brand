---
id: preflight
title: Print and social preflight
command: node tools/preflight.mjs [--report] [--json] [--all] [--out <folder>] [--origin <url>] <built folder> [page paths]; npm run preflight for the playbook
rules: [D-006, D-007, D-008, D-020, D-054]
runs_on: [brand pull requests (the playbook’s format pages), request drafts from Phase 8]
level_now: warn
level_at_launch: block size, margin, pages and fonts; warn image resolution (O-20)
status: draft
decisions: [D-005, D-006, D-007, D-008, D-034, D-054]
---

# Print and social preflight

Opens each built format page in headless Chrome, measures the frame, saves print as PDF, and reads the PDF back.

## What it checks

| Check | Rule | Passes when |
|---|---|---|
| size | D-006, D-007, D-008 | The frame is the format’s exact size: flyer and sheet 612×792, postcard side 306×396, at 1px per pt (D-034); feed 1080×1350px, story 1080×1920px, event cover 1920×1005px. |
| margin | D-006, D-054 | Every line of text, image and filled box sits inside the template’s padding. On the sheet, inside each card’s padding. |
| pages | D-006, D-007 | Print saves to one page of Letter, or of 4.25×5.5in for a postcard side. |
| fonts | D-020, D-054 | Every font in the PDF is embedded and is Alegreya Sans, so a font that failed to load shows up. |
| images | D-054 | Print: raster images are at least 150ppi at their placed size. Social: no image is shown larger than its pixel size. SVG is skipped. |

With `--out` it also saves each format as it would be sent, PDF for print and PNG for social (D-005). In pull requests the files are attached to the Accessibility run.

## What it leaves out

- Print color, until O-21 settles black and white print.
- Cut marks on the postcard sheet (D-007): the sheet template has none yet. Its card outlines show on screen only.
- CSS background images: only `img` elements are measured.

## Known limits

- The FLY, CARD and SOC rules are still planned in `brand/formats/`, so findings cite the decisions until those files are written.
- A box with a background or border counts as drawn. One placed past the padding on purpose, such as full-bleed art, needs an exception here first.

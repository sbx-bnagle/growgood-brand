# Pilot results

One row per run of the fresh-agent test or a real request. ‘Fix’ names the change that answered a miss: a decision, a pull request or a rule ID.

| Date | Run | Request | Outcome | Miss | Fix |
|---|---|---|---|---|---|
| 2026-11-18 | Fresh-agent test 1 | The seed swap flyer (request 1) | Stopped to ask (LADDER-004): no street address for the library (NAMES-006), and no one-line ‘what’ (VOICE-010). It also named O-21. | Expected a make. The request itself may be at fault: it has no address and no ‘what’. | Open, for Brad and Leah: add both to request 1, or say in NAMES-006 when an address can be left out. |
| 2026-11-18 | Request app, test flyer 1 | A flyer, details typed in | Drafted. The Claude connection worked. | Questions and the result showed only after a reload; answered questions were not kept as a log; there was no way to choose an image. | PR #26: live updates with the drafter’s step, a question-and-answer log, the image picker (D-058). |
| 2026-11-19 | Request app, test flyer 2 | A flyer with an image | Briefed to Brad (LADDER-003). | The drafter was not told a chosen image takes the art placeholder’s place, and treated planned files and open design questions as reasons to stop. | PR #27: each brief carries its template; open design goes to the reviewer; the page shows the drafter’s reason and can send it back. |
| 2026-11-19 | Request app, test flyer 3 | A flyer with a squarish image | Drafted, but the time, place and cost were cut off. | The image was drawn at its own height and pushed the details past the frame. Social button labels were also dropped. | PR #28: an image fills the art area and is cropped to it; a button label shows without a link; the page warns when anything falls outside the padding. 105 renders checked. |
| 2026-11-19 | Request app, test flyer 4 | A flyer with an image | Drafted with every detail on the page. | None. | None. |

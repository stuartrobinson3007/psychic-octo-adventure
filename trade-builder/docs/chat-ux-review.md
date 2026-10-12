# Gambit chat UX review

Open http://127.0.0.1:3000/ux-review/index.html alongside the running frontend. For a separate review server on 3018, start from `trade-builder`:

```sh
npm run review:chat
```

This adapts the Pigeonfiles `tools/visual-qa/reviewer` for Gambit conversations, current component previews and isolated review storage. The local reviewer includes checkpoint context, chronological conversation rows and an app-opening action; the vendored Pigeonfiles source is unchanged.

## Coverage

The manifest supplies the current conversation, checkpoint and viewport counts. Recorded turns have two screens: the user's typed or selected reply before sending, and the resulting response. Fixtures show specific authored UI states. Viewports are mobile 390×844, tablet 768×1024, laptop 1024×1400 and desktop 1440×1600, defined in `src/lib/ux-review/viewports.ts`.

Canvas screen headers show the actual request and observed state, not just the overall journey title. The inspector separates the current scenario brief from the recorded request and outcome. Scenario briefs come from `scripts/ux-review-cases.json`; changing a brief does not rewrite an old recorded response. Picker fixtures intentionally share one recorded search to compare loading, filtering, selection and cancellation. The inspector identifies that shared fixture data.

The production chat retains an AI introduction alongside an open picker. Only an exact duplicate of the question moves into the options header; opening options must not suppress the whole response. Search introductions identify the requested filters or change, while the picker supplies selection instructions. The list's viewport cap reserves conversation space on short screens and keeps the opening height during filtering.

The newest checkpoints show the actual trade idea picker with no matches, one filtered result, a selection hidden by filtering, five selected ideas, loading, retry and cancellation. Team picker checkpoints include empty and single-result searches plus the exact-three selection limit. These states are seeded through the real search, checkbox and Cancel controls after the opening layout has been measured. They preserve the production widget's height and behavior; they are labeled authored fixtures rather than fabricated backend responses.

Recordings and UI captures have independent freshness. Each conversation records a backend source fingerprint and its recording date. The reviewer shows how many conversations were recorded with the current backend; a checkpoint from an older backend is labeled “Earlier recording”. Records cover player identity, historical proposals, replacement searches, picks, three/four-team trades, hypothetical contracts, signings, sign-and-trades, unsupported requests and recovery. Records are observations, not a pass verdict for every assistant response.

Each live preview fetches only its selected scenario and a small navigation index, rather than loading the full recording collection into every iframe. Preparing the atlas generates these development-only files; verification checks their hashes against the manifest. Refresh recordings through `review:refresh`, and rebuild the manifest after changing scenario briefs or authored fixture data.

Frozen captures are optional snapshots. Older captures are hidden when their source revision differs; the default reviewer always shows the current UI. The complete frozen sweep in [refresh evidence](evidence/atlas-refresh.json) is historical evidence from 9 October, not a current capture count. Current capture counts and freshness are available in `.ux-review/manifest.json` and checked by `npm run review:verify`.

Earlier semantic and browser audits are retained in [UX verification](verification/ux-review-e2e-audit.json); those results describe their original runs, not this entire refreshed collection. No unit tests were added. The current capture verifier checks source freshness, viewport dimensions, screenshot/HTML hashes and element indexes. Loading and data-error screens now publish capture readiness too. Captures scroll to the relevant request before waiting for visible images; offscreen lazy-loaded photos do not block readiness.

| Capability | Review examples |
| --- | --- |
| Check and revise | Valid/invalid swaps, one-way trades, compound edits, replacement, removal, undo, recheck and duplicate additions |
| Route multiple teams | Explicit three- and four-team transfers, missing destinations, adding/rerouting participants, owner substitution and explicitly retaining the original team |
| Include draft assets | Mixed player/pick packages, pick-only exchanges, current versus original ownership, existing protections, blocked picks, swap restrictions, ambiguous years and draft-right additions/removals |
| Explore contracts and payroll | Annual versus total salary, remaining years, single-team hypotheticals, stretch-and-waive restrictions, resets and undo |
| Sign and use exceptions | Contract options, missing signing terms, minimum contracts, sign-and-trades, rejected offers, unsigned-player restrictions and exception selection/removal |
| Resolve an intention | Ambiguous names, missing identities, pronouns, cancellation, typed corrections and selected choices with extra text |
| Discover options | One-to-three players per side, named partners or all teams, fixed outgoing players and exclusions |
| Apply filters | Exact age ranges and limits, position groups, combined incoming salary, minimum savings and post-trade payroll |
| Continue a search | Non-repeating additional options, tighter filters, impossible filters, explicit new searches and filter-removal limits |
| Repair a trade | Additions preserving originals, explicitly permitted replacements, pinned players, incoming filters and choosing a repair |
| Keep conversational context | Independent proposals, pending choices through research detours, original-trade references, branching, undo, cleared focus and history recall |
| Research | Player facts, contracts, team payroll/cap status and the limits of value comparisons |
| Transaction mechanics | Picks, draft rights, signings, sign-and-trades, stretching, salary overrides, trade exceptions and remaining feature limits |
| Recover and inspect failures | Stale selected IDs, old conversation versions, actual current error responses, plus authored network/provider/storage failures |
| Inspect transient UI | Welcome, long drafts, first-request/edit loading selected player/team/package/short/long-answer transcripts, running tool activity and expanded step history |

Conversation checkpoints render the current chat, composer, choices and cards. Workspace checkpoints also expose the actual player browser, comparison, player details, pick browser and inspector, and saved-trades panel. Their search, filter, sort, pagination, comparison, insertion and bookmark controls work locally. Initial loading, catalogue/connection failures and refresh failures use authored checkpoints of the production components. Retry/submit in a recorded preview remains a checkpoint notice; use Open in app for a live conversation. The review has its own current catalogue, including picks, draft rights and exceptions, so those assets render by name and retain their ownership/protection details. Recordings retain their capture dates. Maintained conversation briefs can be refreshed against the configured backend in isolated temporary conversation databases. Records are observations, **not assertions that every requested flow succeeded**. Deliberate invalid-input errors remain visible; corrected conversation groups replace earlier broken recordings. The correction examples include a restricted contract status and both free-text and offered-choice answers. Loading/outage/transcript fixtures are labeled; no live outage was induced and no assistant success was invented.

The preview uses an authored scroll position around the latest request. It does not claim to reproduce a live user's precise scrolling. Selected IDs and offered choices are preserved when recorded; player references use the production renderer. Trade evidence is for the 2026–27 season, and original verdicts are retained.

## Same reviewer controls

The single-screen view retains the dark nested sidebar, All/Unseen/Affected/Flagged filters, search, viewport buttons, image stage, contact sheet, flags, Coverage, Keys settings and shortcut help. Left/Right moves checkpoints; Shift+Left/Right moves scenarios; Up/Down moves widths; 1–4 chooses mobile/tablet/laptop/desktop; G opens the contact sheet; F flags; / searches; ? opens help. Keyboard settings retain separate-axis and paired-sequence navigation and primary-pair/all-width modes.

Canvas creates at most eight live preview documents at once; zooming or focusing loads nearby screens, while distant overview cards say “Zoom in to preview”. This keeps the growing collection usable. Canvas retains the original pan-and-zoom world, journey outline, desktop/mobile pairs, Fit, Focus and inspector. Left- or middle-mouse drag or wheel pans; Ctrl/Cmd+wheel zooms. With Screenshot off, each checkpoint renders the current app UI. Inspect elements reads the actual live element and its bounds. Add a note and Copy reference for the frame and element metadata. Live references omit pixel/DOM hashes; switching Screenshot on uses a current frozen capture when available. Missing or stale captures fall back to the current preview. Flags and Seen persist under separate `gambit-visual-qa-*` keys.

Seen counts frozen screenshots using the original dwell/readability rules and actual captured pixel hashes; live previews and thumbnails do not mark Seen. Contact-sheet thumbnails do not count. Seen is review progress, not approval. Affected contains this chat scope; no image-diff baseline is claimed.

## Open in app

Canvas's Open in app opens the selected recorded checkpoint in a fresh Gambit conversation. It uses the real workspace with a new backend session and memory-only history/saved state, without reading or writing the normal application's browser history. The active proposal comes from the selected result's snapshot, rather than guessing from the last visible card. Sending there uses the normal configured backend and revalidates restored trade evidence. Simply browsing the reviewer, capturing frames or opening a checkpoint does not call the LLM. Authored loading/failure fixtures cannot be opened as conversations; the welcome fixture can.

The source checkpoint records conversation entries and active trade state. Hidden pending-clarification/undo state is not cloned from expired server sessions; continuation restores the visible proposal using the normal backend restoration path. There is no Pigeonfiles playground process to resume or stop, so those original controls stay hidden.

## Captures and updates

Local screenshots, frozen HTML, element indexes, manifest and coverage live in ignored `.ux-review/`, served only by the development Vite plugin. Frozen documents cannot execute scripts or submit forms. External stylesheet/font behavior can differ; the captured screenshot is authoritative. The reviewer source is under `public/ux-review/`, with original asset/layout paths preserved where possible.

`npm run review:chat` rebuilds the manifest. Single-screen, contact-sheet and default canvas views render current app components in fixed viewport frames; previews load only when visible and remain read-only in the reviewer. Development hot reload follows UI changes without another screenshot pass. Browsing them does not call the model. Existing screenshots remain frozen until recaptured. Each capture has a source revision and timestamp. A changed chat/review source makes its old captures unavailable in the new manifest, with current previews available for every checkpoint. Frozen captures are optional, for snapshot comparison and pixel references. After importing new backend reports or changing app UI, recapture `/ux-review-frame?scenario=<id>&step=<zero-based-turn>` at the manifest's four viewport dimensions using the browser-control tool. Wait for `html[data-review-ready="<scenario>:<step>"]` (published only after visible team-logo loads settle, fonts are ready and visible images are decoded), capture viewport pixels, export the rendered DOM and `[data-review-id]` element index, freeze its scroll position and strip scripts, then save files under their manifest frame IDs. Run `node scripts/prepare-chat-atlas.mjs` afterward to update actual screenshot/DOM hashes. Captures contain these review conversations only and are not part of the production build.

Import backend reports without running models:

```sh
node scripts/import-chat-review.mjs --merge report.json
node scripts/prepare-chat-atlas.mjs
```

`--merge` replaces complete scenario groups from a report while preserving other scenarios; it never appends a second session to an existing conversation. Without that flag, importing replaces the collection. New recordings carry their own title, description and tags; unregistered scenario names are included automatically. The importer preserves structured clarifications, pending choices, selected IDs and offered-choice replies while excluding tool traces and request/session metadata.

To refresh all backend recordings using the configured model and validator, then import them and verify backend freshness:

```sh
npm run review:refresh
```

This starts a new recording pass after a completed run. Interrupted runs resume complete conversations only when their backend source fingerprint matches. All 170 conversations have maintained scenario briefs, including trade-idea selection and cancellation exercises that were previously imported from separate scripts. Trade-selection replies use positions in the freshly offered ideas rather than hard-coded players from a previous run. The recorder saves up to 300 browsable ideas for each picker checkpoint, following actual backend pagination. The importer rejects incomplete conversations rather than replacing a complete recording with a partial session.

The individual steps are also available:

```sh
node scripts/record-chat-review.mjs /tmp/gambit-review-current.json --concurrency=6
node scripts/import-chat-review.mjs --merge /tmp/gambit-review-current.json
node scripts/prepare-chat-atlas.mjs
node scripts/verify-chat-atlas.mjs --require-recordings
```

`--resume` keeps complete conversations from the report and restarts partial conversations in fresh isolated sessions. Concurrency defaults to three and is capped at six. Report writes are serialized so checkpoints remain readable. Do not import a partial scenario over its existing complete recording.

The recorder also updates `src/lib/ux-review/catalogue.json` from the current catalogue, without changing the product snapshot. If an expected offered choice is missing, the report lists the unfinished recording and preserves all responses actually obtained. This explicitly consumes model usage and uses an isolated temporary SQLite database. `scripts/ux-review-cases.json` defines the additional conversation briefs. An optional third argument selects scenario names with a regular expression. Live previews update immediately after importing and rebuilding the manifest. For optional frozen comparisons, recapture the resulting manifest with browser control: importing records alone does not generate screenshots. Do not combine records from independent sessions under the same scenario name.

The browser-control capture helper is `scripts/capture-chat-atlas.mjs`. Import it into `cua_repl` and pass the active CUA tab, filesystem binding and final manifest. The development-only `sheet=true` frame route shows four unscaled iframe viewports. Its Ctrl+Alt+Right shortcut advances to the next checkpoint without reloading the whole review document. Capture batches must be awaited within an active browser-control call; background browser operations do not retain the required execution context.

`captureAtlasSheetBatch` exports each viewport’s own DOM and inspection index, then captures the contact sheet once. Each screenshot is an inert SVG viewport window with the unmodified browser JPEG embedded. This preserves the captured pixels without resizing or regenerating the UI. Existing PNG/JPEG captures still work. The development asset server accepts safe single filenames, including accented player names and encoded colons, and disables scripts in frozen HTML/SVG artifacts. Freshness markers are written last, so interrupted captures remain stale. Keep the shared browser viewport at 3670×1600 while sheet workers run, then reset it once all captures finish. Frame and contact-sheet dimensions come from `src/lib/ux-review/viewports.ts`. Desktop and laptop frames are taller for reviewing longer replies; the single-frame viewer fits their width and scrolls vertically.

Apply the viewport after opening a capture tab: a new tab can retain its default dimensions. Both capture helpers validate the actual JPEG dimensions before saving freshness evidence. The verifier also checks that embedded contact-sheet pixels have not been resized. Artifact filenames are encoded as path segments and normalized for Unicode filesystem listings, so colons and accented names remain available in the manifest.

If deferred photos in a clipped scrolling list block readiness, load them with normal browser scrolling and restore the authored position before capturing. Use individual viewport captures for checkpoints that remain blocked in the contact sheet; the helper preserves an already loaded frame so recovery is not lost to a reload. Do not force readiness markers or count a failed capture as current.

For a complete frozen sweep, run `node scripts/verify-chat-atlas.mjs --require-captures` after preparing the manifest. The ordinary verification command also permits live previews whose frozen captures are missing or stale.

```sh
npm run review:verify
npm run typecheck
npm run lint
npm run build
```

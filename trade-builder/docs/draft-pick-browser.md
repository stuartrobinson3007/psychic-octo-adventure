# Draft-pick browser

Draft picks extends the existing research workspace with the flow: browse → inspect → add to message → submit → check. Browsing and reference insertion leave the current trade unchanged. A submitted conversational instruction determines the requested change and destination; an inserted badge does not authorize a transfer by itself.

## Find and inspect

Owner and Original team share the player browser's `TeamFilter` component: searchable team names and abbreviations, team logos, keyboard navigation, All teams and an explicit no-results state. Their captions retain the ownership/origin distinction.

The header offers Players, Draft picks and Saved trades. Draft picks opens a right-hand research pane with search, Owner and Year filters. The filter icon reveals Original team, Round and Availability. Sort stays visible beside the result count. Search matches all entered terms against word prefixes in the pick label, supplied details, round terminology, and both the owner and original team's city, name and abbreviation. A team search can therefore match a pick owned by that team or originating from it; use the dedicated filters to distinguish those meanings.

Results show origin, year, round, current owner and supplied protection details. The initial list shows up to 40 results; Show more picks adds another 40. Sort defaults to year then round, with owner and original-team grouping options. Reset clears the query and filters and restores the default sort. Empty results offer Reset filters; an empty catalogue offers Refresh picks.

Opening a row displays its current owner and original team separately, protection terms and availability. Existing transfers show In trade and their recorded destination; this state is separate from the unsent message. Back to picks restores focus to the selected result. Closing research returns focus to the composer. Submitted pick badges reopen details using the exact pick ID rather than matching their visible label.

## Availability and protection

- Tradable first- and second-round picks that are not swap rights can be added to the message. Availability means they can be referenced; trade checks still apply after submission.
- Non-tradable picks remain searchable and inspectable, with insertion disabled and an unavailable reason.
- Picks tied to swaps are omitted from browser results and counts. The available data flags swaps without identifying the other pick or the conditions, so Gambit cannot model them correctly. They remain in the catalogue for historical identities and server-side rejection; the browser does not present them as selectable assets.
- Protection text comes from the catalogue. A protected pick with missing terms, or only the generic label Protected, displays Protected · Terms unavailable in details. The browser does not infer a protection threshold, rollover or conveyance schedule.

Refresh exposes a progress status and disables insertion while data is changing. A failure displays a retry action while retaining the existing catalogue and browsing state. If a selected pick disappears, its detail view says it is no longer in the catalogue.

## Exact message references

Add to message inserts an inline Lexical pick token at the remembered caret, or at the end when no valid caret remains. Its visible label uses original-team abbreviation, year and round; the token separately retains `pickId` and the owner's `currentTeamId` at insertion. The request sends `selectedPickIds` plus `pickReferences` containing text offsets, `pickId` and the captured `ownerTeamId`.

The editor namespace is `GambitComposer`. `pick-token` and `player-token` are separate node types; player and pick IDs remain in separate asset namespaces even when their numeric values collide. The native Lexical HistoryPlugin supports editing undo and redo, including pick insertion. This editor history is distinct from conversational requests to undo a committed trade. Typed pick labels remain text; only explicit selections create pick badges. Plain-text paste does not import reference identities.

Duplicate insertion is blocked both in the browser and composer. Result rows and details show a secondary In message badge, alongside a separate outlined In trade · To destination badge when the pick is already in the proposal. The disabled row action also exposes In message through its accessible label; the detail insertion action changes to In message. Removing the token, including through undo, removes its message badge and enables insertion again. On mobile, insertion closes research and returns to the composer with the new token retained.

Server parsing checks reference ranges and selected IDs and rejects overlapping player/pick ranges. Resolution uses the explicit reference to disambiguate identical labels. Before model execution, the harness rejects missing picks, unsupported swaps, non-tradable picks and a mismatch between captured and current ownership. The user is told to refresh and select again. Refreshing does not silently rewrite a token's captured owner or select a different pick.

Submitted references are stored with conversation entries and restored after reload or archive import. Rendering uses stored offsets and exact IDs; it does not infer a reference from text. A pick absent from the current catalogue renders as ordinary text instead of linking to a guessed replacement. Reload verification covers submitted conversation references; it does not establish persistence of unsent editor content or the editor's undo stack across page reloads.

## Workspace behavior and visual contract

The browser stays mounted across research-mode changes, preserving filters and the selected detail. Catalogue refresh preserves those controls and the unsent message. Desktop research uses the existing resizable primitive with a draft-pick default width of 460px, a 360px minimum and a 600px cap, constrained by available conversation space. Compact layouts size the pane from available width. Mobile uses the full research width with its resize handle hidden and chat mounted behind the research view. Closing research returns to the conversation.

This is an ordinary extension of Gambit's incumbent Inter Variable, white/zinc, emerald, shared shadcn/Base UI controls and Hugeicons. Pick identities retain the shared 48px muted circular round marker. Reference badges wrap within the available message width. No new visual identity, design tokens or shipping raster assets were approved. The JPEG captures are review evidence only.

`DESIGN.md` and `.impeccable/design.json` are preserved byte-for-byte. Their existing navigation and fixed-layout descriptions predate this browser and the current resizable research implementation; the feature-specific behavior is recorded here without recanonizing the design system. No pre-existing drift finding from the context launcher was recorded for this documentation handoff.

## Verification evidence

See [Draft pick browser validation](../.impeccable/review/pick-browser-validation.md) for the 8 October 2026 live verification and final capture matrix. The documented live flow distinguished the Boston-owned Charlotte 2030 second-round pick from other matching assets, inserted its exact reference, removed and re-added it through chat, retained the existing mixed package and protections, and obtained valid checked versions. It also verified undo/redo, submitted-reference reload, filter/message preservation on refresh, desktop resizing and mobile insertion without horizontal document overflow.

Six focused tests passed: search/availability; reference ranges and player/pick ID collisions; clarification offset preservation; exact duplicate-label resolution; changed-ownership rejection before model execution; and archive restoration. TypeScript checking and production build passed. Touched-file lint had zero errors and one existing/concurrent `no-shadow` warning in `trade-turn.ts`. The recorded Impeccable detector pass returned no findings.

The full suite was not green: 267 passed and 20 failed out of 287. Independent isolated-comparison evidence reproduced the same 20 failing names with this feature's explicit-resolution, selected-ID seeding and clarification-offset additions removed. That comparison returned 264 passed and 23 failed, including two feature tests whose implementations were deliberately removed and one review-manifest test whose external fixture directory was absent. The baseline conclusion comes from that comparison, not from the finish review. These existing clarification, discovery and routing failures remain outside this browser extension's fixes.

The documentation pass writes only `PRODUCT.md` and this feature note. It makes no source changes and does not repair existing design-document drift.

# Draft picks: shipped documentation

Date: 2026-10-08. Mode: Operate, ordinary extension of the incumbent workspace. Finish reviewer disposition supplied to this pass: **SHIP**, with no material fixes. Documentation disposition: preserve `DESIGN.md` and `.impeccable/design.json`; the extension establishes no new visual world or durable token change.

The authorized surface is conversation, trade cards and saved cards. The Players browser remains outside the requested pick interface. The direction contract is `.impeccable/surfaces/src-components-workspace-trade-card-tsx.md`; durable product authority is `PRODUCT.md`.

## Implementation checked

- `src/components/workspace/pick-asset.tsx`: a shared asset row with a secondary zinc round marker (32px, medium corners), an origin/year/round label, and twelve-pixel protection/sender metadata. Text can wrap; the marker is decorative and hidden from assistive technology because the full label names the round.
- `src/components/workspace/trade-card.tsx`: players and picks counted separately; existing shared Card, Collapsible, bookmark controls and recipient sections retained. A single note explains that picks do not count toward salary matching. Pick rows have no salary cell; incoming/outgoing salary fallbacks filter for players. The record retains pick data and origin-team references.
- `src/components/workspace/saved-trades.tsx`: the same pick row appears under each recipient, retaining the record's protection and sender data. The saved record carries the proposal revision; rendering, unsaving and viewing pass that record through. Recipient columns adapt to the card container.
- Supporting source sampled: `src/lib/trade/picks.ts`, `src/components/workspace/use-trade-workspace.ts`, `src/components/ui/card.tsx`, `src/styles.css`, `src/components/workspace/workspace.css`, and `src/components/workspace/motion.css`.

Origin and sender are separate facts: `pickLabel` uses `originalTeamId`; `PickAsset` takes the transfer's `fromTeamId`. The supplied evidence shows the CHA 2030 second-round pick sent by BOS, alongside the MIA 2029 first-round pick sent by MIA. `pickDetails` retains supplied protection detail, with explicit Protected/Unprotected fallbacks. Missing pick information is reported as unavailable. `tradeKey` includes proposal ID and revision; saving retains the selected record, and viewing targets its exact revision. These are source observations, not a fresh end-to-end execution of the backend.

## Checked raster evidence and provenance

All four supplied local rasters were visually inspected. Dimensions and actual encoding were checked with `file`; hashes identify the exact bytes reviewed. They are JPEG/JFIF data despite their supplied `.png` filenames. Capture producer and capture timestamp were not provided to this pass; no new capture was made.

| Artifact under `.impeccable/review/` | Dimensions | Observed state | SHA-256 |
| --- | --- | --- | --- |
| `draft-picks-chat-desktop-final.png` | 1280 × 1000 | Centred conversation, expanded version 3, two players and two picks, origin/protection/sender labels, player-only salary evidence and composer | `3333ad7e514bda2533b39b05f22ef29de54e70a58b0acb57c9ef7c56fe529a7d` |
| `draft-picks-saved-desktop.png` | 1280 × 900 | Saved panel with version 2, both pick rows and player recipients, View in chat action | `956c37bb3eeefd8afc0f485088836b9f4ad0b6551b83ab356e2b03cef27a1bd8` |
| `draft-picks-saved-mobile.png` | 390 × 844 | Mobile saved version 2; pick identity and sender wrap visibly within recipient columns | `1c795dab159f282b3ec336613c023eb99646a6b9c4705fba50c8a0a8df73ad3c` |
| `draft-picks-chat-mobile-assets.png` | 390 × 844 | Scrolled mobile trade card; recipients stack, both picks and salary totals remain readable above the focused composer | `edb5e42bb7e6dc64d4cc95c7d8f29bc3eec18cbcf46e1ef3cec454ff19bd4cdb` |

The supplied `.impeccable/review/draft-picks-detector.json` contains an empty findings array. This document records existing evidence; it does not claim a new browser, interaction or automated test pass.

## Incumbent system preserved

Palette: white canvas, zinc structure and metadata, emerald meaningful actions; existing semantic OKLCH tokens retained.

Type: Inter Variable; compact card identity and labels, thirteen-pixel chat asset text, fourteen-pixel desktop saved asset text and sixteen-pixel mobile saved asset text. No display family introduced.

Shape and spacing: shared rounded Card and Button geometry, eight-pixel asset-row gaps, restrained secondary round markers and fine dividers.

Meaning Before Colour Rule: protection, sending owner, round and validation state remain expressed in readable text.

One Family Rule: conversation, controls and pick evidence inherit Inter and the incumbent disclosure/reduced-motion behavior.

## Drift not canonized or repaired

Existing system documentation predates the current workspace line-height overrides: source now assigns heading 1.25, body 1.6, data 1.45, label 1.35 and control 1.4, while recorded title/body/control/label token values and sidecar examples retain older values. The composer also uses `max(1.6em, 1.75rem)` rather than the documented 1.9. The older grid-disclosure/custom-dropdown recipes remain in `motion.css` and are already excluded by `DESIGN.md`'s not-canonized note. These incumbent documentation gaps are outside this ordinary extension; they are reported without rewriting the system or legitimizing drift as new rules. Supplied raster filename/encoding mismatch is likewise retained and explicitly described above.

Preserved system-file SHA-256: `DESIGN.md` = `d902e5f9075842d699a6c4617034b0321d65bdc6ba00fdae63ec5178afc864dc`; `.impeccable/design.json` = `9a700cee9afa52e49fa055fa351f220010a1420d8d034453668f10f55148188c`.

Write boundary: this report only. No source, browser, raster, product, direction-contract or design-system edits were made by this documentation pass.

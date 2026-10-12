---
version: 1
slug: "src-components-workspace-pick-browser-tsx"
primary_target: "src/components/workspace/pick-browser.tsx"
related_targets: ["src/components/workspace/workspace-layout.tsx","src/components/workspace/composer/pick-token.tsx"]
---

Mode: Operate. Extend the established research workspace with a draft-pick browser and exact message references. User approved browse → inspect → add to message → submit → check.

## Direction contract
THESIS: Find a specific owned pick and reference it without mutating a trade during browsing.
OWN-WORLD: Inherit Inter, zinc, emerald, shared controls and the 48px muted circular asset marker. Preserve DESIGN.md and its sidecar.
STORY: Search by team/year/round, distinguish origin from owner, inspect supplied restrictions, then insert an exact reference into the editable message. Validation remains explicit after submission.
FIRST VIEWPORT: Draft picks joins the header research modes. A resizable right panel contains search, owner/year filters, secondary filters, a result count and rows with visible ownership. Row selection reveals details within the same pane; Add to message is explicit. Mobile uses the full research width and returns to chat after insertion.
FORM: Local extension of the player research composition, code-led; no concept seed required for the confirmed structure. Distinct in-message and current-trade states accompany each asset. No valuation or invented conveyance terms.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

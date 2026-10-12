---
version: 1
slug: "src-components-workspace-trade-card-tsx"
primary_target: "src/components/workspace/trade-card.tsx"
related_targets: ["src/components/workspace/saved-trades.tsx"]
---

Mode: Operate. Extend the existing conversation and saved-trade cards with draft picks; user chose chat and cards only.

## Direction contract
THESIS: Make each traded pick as inspectable as a player, with its year, round, origin, protection and sending owner visible.
OWN-WORLD: Inherit Gambit's Inter, zinc, emerald, shared Card and disclosure controls. Pick rows use the existing asset-row rhythm and a restrained round marker.
STORY: The user names a pick in conversation, resolves missing identity, checks the package and can inspect or save the exact revision. Browsing controls remain unchanged.
FIRST VIEWPORT: Keep the centred chat and composer. Card descriptions count players and picks separately. Expanded recipient columns show pick rows beside player rows, with protection metadata below the pick name and salary math below all assets. A single salary note explains that picks provide no matching salary.
FORM: Local extension of the established cards; no concept seed or replacement visual world applies. The named interaction is the incumbent accessible expand/collapse and bookmark flow.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

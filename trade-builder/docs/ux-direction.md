# Trade exploration

Mode: Operate. This extends the existing visual system with the interaction structure approved in chat on 7 October 2026. Build directly in code, inheriting the workspace's code-first workflow.

## Direction contract

THESIS: Conversation is the working surface; player research opens beside it and pushes it left. Browse, inspect and compare progressively in one supporting workspace.

OWN-WORLD: Inherit white/zinc surfaces, emerald action colour, Inter, understated rounded controls, Hugeicons and thin structural dividers. Team marks identify assets rather than decorate panels.

STORY: Describe or assemble a trade; inspect players and compare candidates; submit; understand the exact verdict; revise, bookmark and return.

FIRST VIEWPORT: Quiet header with Gambit, Players and Saved trades. A readable centred conversation, one prompt and optional starter action. Bottom composer with inline player badges and # search. Opening research widens the workspace; chat remains readable. A selected player opens details beside the list; comparison replaces details.

FORM: User-selected progressive chat/research workspace; concept seed not applicable to this precisely approved extension. Latest trade card expands; older cards keep recognisable summaries and can reopen. Draft insertion is independent of trade mutation. Signature motion: width resize on the conversation and research workspace, origin-aware composer search, height disclosure on trade cards, all respecting reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Interaction decisions

- Typed player names stay plain text. Player badges require explicit insertion through the picker or player browser; message rendering never infers badges from names.
- # opens teams and players. Selecting a team drills into its roster with Back; selecting a player inserts a token at the preserved caret.
- Hover/focus on a player row reveals an explicit # insertion action. Row selection opens details, not a trade edit.
- Players/Saved modes preserve research state. On mobile supporting content replaces the visible chat while preserving it mounted.
- Bookmarks capture immutable versions. Viewing preserves active state; follow-up chat requests can select or edit a recorded candidate.

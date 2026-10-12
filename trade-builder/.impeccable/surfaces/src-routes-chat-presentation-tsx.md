---
version: 1
slug: "src-routes-chat-presentation-tsx"
primary_target: "src/routes/chat-presentation.tsx"
related_targets: ["src/components/chat-presentation/presentation.css", "src/components/chat-presentation/conversation-stage.tsx", "src/components/chat-presentation/conversation-timeline.tsx", "src/components/chat-presentation/scenario-view.tsx"]
---

Mode: Experience. A separate, local presentation viewer for explaining Gambit's conversation flow to a manager. The user specified a very minimal scenario sidebar, horizontal stages, independent vertical scrolling, and bottom-aligned initial positions; they chose a short curated selection.

## Direction contract
THESIS: Let the real conversation lead, with only scenario selection and chronological wayfinding around it.
OWN-WORLD: Inherit Gambit's Inter, white, zinc and restrained emerald. Flat sidebar, fine rules, unadorned screen frames; no replacement identity.
STORY: Choose one of fourteen representative recorded conversations, then move across request and response stages. Read earlier content by scrolling a single screen upwards.
FIRST VIEWPORT: A 192px scenario rail on the left and full-width conversation screens on the right. The screen strip fills the available height with 8px outer padding and gaps. No title, controls, labels or counters appear above the screens.
FORM: Precisely specified new surface inside the established world; no concept tournament applies. Signature interaction: native horizontal scrolling with no snapping or authored stage jumps; independent vertical scrolling inside frozen HTML screens, initially at the bottom.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented surface facts

The viewer is available at `/chat-presentation` in development. `npm run present:chat` prepares the existing local recordings and opens a separate development server on port 3020; README contains the launch instructions. The fourteen curated scenario IDs live in `src/components/chat-presentation/scenarios.ts`.

Each recorded turn contributes a reply screen containing its submitted message and response. A before-send screen is included for an option selection or the multi-team player-badge draft. Typed draft screens and the empty start screen are omitted, except for the explicitly requested multi-team composer checkpoint showing selected player badges. Screens freeze the real chat renderer into read-only HTML, retaining existing product components and assets. Selecting a scenario immediately queues all its screens in timeline order, loading one at a time regardless of scroll position. Each frozen screen opens at the conversation bottom and keeps independent vertical scroll areas. Scenario selection remains in the sidebar; stage titles are retained only in accessible iframe names.

The loading queue belongs to a retained ConversationTimeline. Switching scenarios pauses unfinished loading while retaining completed screens. Returning resumes only unfinished work. The three most recently selected scenarios remain mounted; a fourth evicts the least recently used and releases its queue and documents. Cached panes retain their dimensions and stable DOM order to avoid reinserting iframe documents. Inactive panes are invisible, inert and hidden from accessibility. A ready or failed screen advances the queue; retry requests join its tail. Hidden preparation frames use the visible canvas geometry so lazy images can settle for offscreen stages. The IntersectionObserver loading trigger has been removed.

Presentation frames use `/chat-presentation-frame`, which authors option-click paths for bare clarification answers that match exactly one offered canonical option. Grant Williams in player clarification and Andrew Wiggins in the edit scenario now appear selected before sending, with selection receipts retained in later history. Existing five-trade selections and direct player/pick edits are preserved. Original UX-review recordings are not rewritten. Frozen screens retain native checked inputs and internal option-list scroll positions.

The curated catalog has fourteen distinct stories and 55 screens. The original four remain, with ten additions covering search refinement, repairs, multi-team routing, research context, pick protections, draft rights, hypothetical contracts, exceptions, signings and unknown-player recovery. Repair and exception replies name specific offered options in prose; presentation-only authorship selects those same options using their controls. Every timeline starts with the first reply. Coverage and exclusions are recorded in `scenario-coverage.md`.

Desktop uses a 192px rail and screens fill the remaining width without a fixed maximum. Stage gaps and outer padding are 8px at all widths. At 767px and below, the rail becomes a horizontal scenario strip. The selected mobile scenario is revealed automatically. Scrolling is entirely native; scroll snapping, stage navigation controls and their state tracking have been removed at the user's request.

The existing Inter/white/zinc/emerald world is preserved. Only the sidebar supplies viewer labels; the conversation uses its original product UI. No new raster assets were introduced. Documentation comparison and evidence limitations are recorded in `.impeccable/review/chat-presentation/documentation.md`; final finish disposition is recorded separately. Existing `DESIGN.md` and `.impeccable/design.json` remain unchanged.

## Copy refinement

The user rejected the original viewer copy as inconsistent with Impeccable's guidance. The shell now retains only scenario names. Stage names remain accessible iframe labels; headings, visible stage labels and navigation counts are absent. Scenario descriptions, scrolling instructions and repeated prompt excerpts were removed. Use Message and Reply for conversation stages. Loading and failure states retain concise operation labels and a recovery action. The recorded conversation text is preserved in the snapshots. Current copy evidence is `desktop-copy.png` and `mobile-copy.png` in the review directory.

## Multi-team composer refinement

The multi-team presentation splits the original combined team-and-player answer into two submissions. The team selector submits only the three teams. An authored intermediate question opens the ordinary composer, followed by a checkpoint with Tatum, Jokic and Curry inserted as real player tokens and their destinations written around those tokens. The original checked three-team and four-team results remain unchanged. The story has six screens. The additional question and badge composition are presentation authorship, not a new recorded backend trace. Original recordings remain intact. ChatPreview now preserves explicit stored player-reference ranges in submitted history as well as its draft. No new selector or backend flow was added.

## Research and context expansion

Research and context now uses `conversation-history-and-focus`, a nine-turn real recording. It follows a checked trade, another unresolved trade request, a salary research detour, the second trade, an explanation of the original proposal, a revision to that original, undo, a fresh start and historical recall. Nine reply screens show these context transitions; the story replaces the former three-turn nickname example. No additional draft screens or model calls were introduced.

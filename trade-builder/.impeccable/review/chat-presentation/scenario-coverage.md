# Curated presentation coverage

Fourteen recorded conversations, 55 screens. Each addition contributes a feature or boundary absent from the original four. No fixture states or new model calls were introduced.

| Sidebar label | Distinct contribution | Screens |
| --- | --- | --- |
| Trade ideas | Browse incoming guards; select and check five ideas | 3 |
| Player clarification | Choose an ambiguous identity; correct it later | 4 |
| Edits and undo | Clarify an edit, undo it, handle a duplicate addition | 6 |
| Players and picks | Keep mixed assets through replacements and removal | 4 |
| Search filters | Remove one filter, preserve the rest, page results, explain unavailable scoring data | 4 |
| Fix a trade | Keep both original players, add a repair asset, select a passing suggestion | 4 |
| Multi-team trades | Select three teams, use the ordinary input with player badges and explicit destinations, then add a fourth team | 6 |
| Research and context | Research during a pending question, discuss a different trade, explain and revise the original, undo its branch, clear focus and recall earlier players | 9 |
| Pick protections | Use current ownership of another team's originating pick; preserve protection when custom edits are unsupported | 2 |
| Draft rights | Transfer rights without salary impact | 1 |
| Hypothetical contracts | Change annual salary and duration, explain payroll, restore original terms | 3 |
| Trade exceptions | Select a named exception, apply it, return to ordinary matching | 5 |
| Signings | Direct signing; explain why a one-year deal cannot immediately become a sign-and-trade | 2 |
| Unknown players | Ask for a correction rather than inventing a player, then resume | 2 |

Repair and exception recordings express their choices in prose. Explicit presentation-only mappings select the identical offered canonical options; original recordings and checked results remain unchanged. Three-team choices already carry authentic multi-selection metadata.

Omitted near-duplicates: additional nickname examples, repeated discovery filters, multiple cancellation fixtures, separate examples of each blocked pick, multiple signing variants, and longer draft-right/edit stories that repeat the existing undo flow.

Verification: every catalog ID resolves to a prepared recording; all timelines start with a response; every authored selection matches an offered option; source recordings remain unchanged. TypeScript, scoped ESLint and Prettier checks pass. Browser checks: Repair loaded all four screens with one checked offered option; Multi-team trades loaded all four screens; Exceptions loaded all five screens with one checked exception. Signings loaded both screens; Hypothetical contracts loaded three; Unknown players loaded both. Cached Signings returned with both screens ready and zero preparation frames. A fourth selection retained exactly three panes and evicted the least recently selected Exceptions pane. Mobile navigation revealed the final catalog item automatically (358px viewport, 1575px strip), with no page overflow. Desktop and mobile inspection found no layout defects.

Evidence: `expanded-scenarios-desktop.png` (1440 × 1000) and `expanded-scenarios-mobile.png` (390 × 844). Development hot updates briefly invalidated old frame modules during editing; a viewer refresh restored normal loading. These are captures of the real renderer and existing assets; no new raster assets ship in the UI.

Multi-team refinement: the team choice now contains no supplemental player text. An authored ordinary question separates it from the next player message. That message is seeded into the existing Lexical composer with three exact player-reference ranges; submitted and later-history messages retain those badges. The original two checked results are reused unchanged. Browser checks confirm six ready frames, an empty team-selection composer, an ordinary player question, three composer badges and three submitted-message badges. Source immutability and idempotent adaptation were verified. TypeScript, scoped ESLint and Prettier pass. Desktop (1440 × 1000) and mobile (390 × 844) evidence: `teams-then-player-badges-desktop.png` and `teams-then-player-badges-mobile.png`.

Research/context expansion: replaces the three-turn nickname story with the existing nine-turn `conversation-history-and-focus` recording. The additional context demonstrates separation between an unresolved question, factual research, a different checked trade, the exact original proposal and later recall after clearing focus. All nine stages are responses; no typed drafts or empty starts were added. The original recording remains untouched. The sidebar label and scenario cache/loading behavior are preserved.

Research/context verification: all nine frozen screens loaded sequentially without scrolling (zero pending preparation frames). The final rendered transcript recalls White and Wiggins after a fresh-start request. Desktop and mobile captures show the final answer and independent conversation scrolling; the selected scenario remains visible in mobile navigation. Evidence: `research-and-context-desktop.png` (1440 × 1000) and `research-and-context-mobile.png` (390 × 844). Catalog asset resolution, nine-response checkpoints, source immutability, total screen count (55), scoped ESLint and Prettier passed.

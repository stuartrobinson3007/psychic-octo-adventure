# Trade discovery and repair conversations

The model interprets an intention and resolves catalogue identities. Code enforces search constraints and constructs browsable ideas. The user chooses up to five ideas for fresh salary/roster checks. Proposals, searches, ordered result batches, questions and outcomes remain independently addressable. Every operation resolves its own targets; recent discussion is evidence rather than a universal current trade.

| User request | Result |
| --- | --- |
| “Find Bulls trades: one player for one incoming center under 25, without increasing payroll.” | A searchable list of trade ideas; select one to five for checks. Every incoming player is a C aged 24 or younger; source payroll cannot increase. No outgoing player selection is required. |
| “Find Boston options: three players for three Miami players.” | Browsable packages containing three players per side; explicit counts cannot be silently reduced. |
| “Show me more options with the same filters.” | Pages through the exact saved query without repeating ideas. |
| “Show more, but incoming players must be under 23.” | Creates a new saved search version, retaining other filters and replacing the maximum age with 22. |
| “Find trades for young guards.” | Asks for a numeric age limit; does not invent an age range. |
| “Find players averaging 25 points per game.” | Explains that performance filters are unsupported; no fabricated statistics or loose substitute results. |
| “Fix this trade.” | Keeps every original player and lists eligible one-player additions to choose for checking. |
| “Suggest a legal version, keeping White. You may replace other players.” | Preserves White and lists one-player replacements; checks only chosen alternatives. |
| “Use the first repair option.” | Checks the exact first idea in the referenced batch. The original trade remains in history. |
| “Fix it with Boston's incoming players under 25.” | Enforces filters for Boston; requests clarification if the team perspective is ambiguous. |
| “Find options with incoming salary at most $12m, saving at least $5m.” | Applies both limits to package totals from the source team's perspective. |
| “Keep post-trade payroll at most $142m.” | Filters locally using known payroll and scenario adjustments; selected ideas then receive authoritative checks. |
| Trade service unavailable, mismatched evidence, or deadline exceeded | Returns no unchecked passing cards and preserves earlier checked proposals. Distinguishes unavailable validation from a checked failure. |

Positions are OR within the allowed set and AND with age limits. Guards means PG/SG, forwards SF/PF, wings SG/SF. Every incoming player must match; unknown positions and placeholder ages cannot satisfy hard filters. Financial filters apply to current-season dollars. Browsing covers the supported combinations, applying requested constraints before paging. Selected checks establish salary and roster eligibility; basketball value and team willingness need separate assessment.

Named player trades support two to four teams with explicit destinations. Team selection preserves existing routes; replacements preserve unrelated transfers and the replaced player's destination. All participating teams must have a transfer before checking. Three- and four-team cards scroll horizontally and retain per-team evidence.

Discovery searches two-team packages with one to three players on each side. Replacement searches preserve the original two-to-four-team routes and every unrelated asset or scenario setting. Local enumeration is exhaustive within that supported scope, with 30 ideas per page and at most 50,000 combinations scanned per paging request. A saved roster and search version make every idea reproducible. Only selected ideas contact the validator, with at most five selected and three concurrent calls. Search, paging and inspection do not trigger checks. The shared selection group also supports exact counts for questions such as choosing three teams. See [trade ideas and selection](trade-ideas.md).

Contract-duration, expiring-contract, experience and height filters also remain unsupported and return explicit limits instead of silently becoming an age filter. Custom pick protections, swap rights, automatic pick discovery, automatic multi-team discovery, trades involving more than four teams, no-trade-clause consent and performance/value evaluation remain unsupported. Existing tradable first- and second-round picks are supported in named packages, with ownership checked locally and existing protections retained. Player repair suggestions preserve picks and draft rights, along with contract/scenario settings. Chat also supports trade exceptions, salary/contract what-ifs, free-agent signings and sign-and-trades, and stretch-and-waive payroll scenarios. See [trade-machine features](trade-machine.md). See [draft picks](draft-picks.md) for the observed engine checks and remaining limits.

Run `npm run typecheck`, `npm run lint` and `npm run build`. `node scripts/check-trade-picker.mjs` exercises the configured model and live validator in isolated conversations, including later-page selections, selection order and recorded receipts. It consumes model usage and requires the configured OpenAI key. No unit tests were added for this workflow.

## Historical verification on 8 October 2026

These results predate the browse-and-select workflow. Current live evidence is in [trade-picker E2E results](evidence/trade-picker-e2e.json).

All 160 automated tests pass, along with TypeScript, ESLint and the production build. Live checks against the configured OpenAI model and trade validator passed filtered discovery, repeated searches without duplicate cards, tighter impossible filters, three-for-three packages, an invalid trade, checked replacements preserving a pinned player, selecting a returned repair, vague-age clarification, answering that clarification and explicit performance-filter rejection. Early live failures involving delegated player choices, optional partners and option selection were fixed and exercised again.

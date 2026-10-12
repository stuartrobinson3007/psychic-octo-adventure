# Player identity interpretation

The request interpreter now identifies people in the same structured model call that interprets the user's intention. It receives the compact player directory, conversation history, current trade and pending question. It can interpret nicknames, initials, spelling mistakes, relationships and contextual references.

Each reference retains the user's wording and an evidence quote. The model returns catalogue player IDs, a canonical name where uniquely resolved, and whether the reference is an individual or a collection. Code checks evidence, catalogue membership and agreement between the name and ID before executing the request. Current catalogue ownership, contracts and salary rules still come from the backend.

Shared names and ambiguous nicknames retain multiple candidates. Unknown people, non-players and players absent from the directory do not get unrelated spelling suggestions. Answers to identity questions bind to the original missing role. Superseded names are removed from the active action, so answering a later question cannot revive an earlier nickname.

Verified user mentions become conversation context for subsequent pronouns. Edit targets are scoped to the referenced trade; incoming players use the whole directory. A historical trade reference is interpreted into an exact displayed reference and checked by code.

## Verification

154 turns passed across 66 conversations using the real configured model, HTTP/SSE endpoint, conversation storage, tools and trade validator. This count uses the latest fully passing run for each scenario; failed prerequisites were corrected and their complete conversations rerun. It is a recorded regression sample, not a guarantee that every possible phrasing will work. No unit tests were added.

The 22 new identity conversations cover common nicknames, initials, accented names, misspellings, ambiguous names, unavailable and invented people, non-player research, nickname answers, historical edits, pronouns, collections, discovery and pagination, contracts, relationship-based signing and repair constraints. The other 44 conversations cover existing edits, routing, undo, topic changes, package handling, picks and mechanical operations.

Live checks exposed and fixed three handoff problems: a nickname answer not filling its pending role, an unknown replacement losing the intended edit, and a superseded name being revived after a later selection. An older check expecting “Dave” to suggest Dalen Terry was replaced with a typed identity clarification followed by verification of the resumed trade.

UX review includes the new conversations and refreshed existing correction flows. Browser inspection verified the ambiguity picker, the recorded question after an answer, and the resulting trade. Atlas verification checks all 172 scenarios have current live preview frames; frozen screenshots were not regenerated for this change.

The detailed outcomes are in [identity-understanding-e2e.json](verification/identity-understanding-e2e.json). The architecture is described in [chat-request-pipeline.md](chat-request-pipeline.md).

## Remaining boundaries

Mechanical name equality, evidence checks and ID checks remain. Some legacy sentence guards also remain around contracts, exceptions and picks; this change does not claim that every regular expression in the project has been removed. Production player interpretation uses the structured identities. Legacy name helpers remain for compatibility paths.

Supplying the full compact directory avoids a separate name-resolution call, but increases input size. Its stable prefix can benefit from provider prompt caching. If the directory grows substantially, candidate retrieval followed by model interpretation should replace sending the full directory. The model can still misunderstand a nickname; catalogue verification prevents nonexistent IDs, while ambiguity handling and E2E evaluation address interpretation quality.

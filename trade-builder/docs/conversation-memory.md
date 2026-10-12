# Conversation records and references

The conversation remembers many proposals, searches, questions and outcomes. Each operation identifies the records it concerns. Recent discussion helps the model resolve phrases such as “that deal”, but never silently supplies a universal current trade.

## Records

- **Proposal versions** contain the complete package, routes, scoped assumptions and checked evidence. An edit copies an exact version, applies all requested changes together and creates a descendant with an explicit parent. Undo displays that parent; it does not select the globally preceding card.
- **Search versions** retain the full discovery, repair or replacement specification: source, partner, fixed assets, exclusions, filters, scenario and exact base proposal. Refining a search creates a version. Continuing it keeps the specification and excludes already shown packages.
- **Result batches** preserve the producing search, assistant message and ordered proposal references. “The middle option” can resolve to an older batch after another deal or search has been discussed.
- **Questions** retain the unresolved request, resolved identities, exact references and human-readable choices. Research hides the option widget without deleting the request. Answering, cancelling or superseding a question records its status.
- **Execution records** retain actual tool arguments and outcomes, including failures. Explanations of what happened use these records, rather than a reconstructed intention. Their turn status distinguishes committed work from a successful staged check followed by a failed turn.
- **Discussion references** are a small ordered list of recently discussed records. They are evidence for interpretation, not an execution target.

Hypothetical contracts, signings, stretch obligations and exception selections belong to one proposal and its descendants. A separate deal starts with catalogue facts. Discussed trades do not execute or globally move players. Players, picks and draft rights use separate identity namespaces. Up to four participating teams and all retained transfer directions are checked in code.

## Model and operations

One ADK agent/tool loop interprets language and can retrieve evidence before revising its decision. There is no compulsory interpretation pass or sentence-pattern intention router. The prompt contains an authoritative player/team directory and bounded record index; `read_records` retrieves exact details and `recall_conversation` retrieves older indexed records.

The model selects semantic identities and operation targets. A player lookup groups candidates by the individual name or phrase: reading two different players does not make either identity ambiguous. Code verifies references, ownership, eligibility, signing offers, route integrity, scenario arithmetic and returned validation evidence. Typed schemas establish argument shape; they cannot prove that the model understood a conversational reference. Live journeys therefore inspect actual assets and search specifications as well as response copy.

Compound proposal edits are applied to a private copy. Provider failures and interrupted turns retain diagnostic evidence without committing staged proposals or search results. Successful validation may return a mechanically invalid trade; this is different from an unavailable service or incomplete turn.

The wire-level `snapshot` field remains a compatibility cursor for the last displayed checked card. Backend operations never use it as a default target. Legacy pending/search state is imported into linked records when its evidence is reliable. Historical batches with no reliable producing search retain `search: null`; migration does not invent one.

## Persistence and concurrency

The local adapter uses Node SQLite, normally `.gambit/conversations.sqlite`; `GAMBIT_CONVERSATION_DB` can relocate it. Cloudflare mode uses the existing browser-owned Durable Object adapter. Model and API work run outside database transactions. A per-conversation queue, database lease and compare-and-swap version prevent late or competing turns overwriting newer history. Request IDs replay saved responses; clients send the conversation version.

Full rendered messages and authoritative records persist. The model receives a bounded index and retrieves older details when needed; prompt truncation does not delete history. Browser storage is a display cache and bookmark store. Imported browser verdicts are not trusted backend evidence. Authentication, ownership and deployment details remain documented in [Cloudflare deployment](cloudflare-deployment.md).

Search paging remains available for 30 minutes after a search version starts. Search records reference an immutable catalogue snapshot in a separate SQL table, shared by searches using the same fetched dataset. Sharing is across conversations in the local database and within each browser's isolated Durable Object in Cloudflare mode. Snapshot retention extends to the last referencing search's deadline; expired snapshots are cleaned up on subsequent snapshot reads or writes. Older inline catalogues are migrated or discarded on load and removed from the conversation payload on its next save.

Expiry stops paging, clears selections and offers **Refresh search** in the list footer. Refresh obtains current catalogue data, preserves the saved scope and filters, starts a new search version from its first page, and records the action without calling the model. Temporary page-loading failures offer **Retry** in the footer and retain existing options. Checked proposal versions and their verdicts remain in conversation history after search expiry. Option checking still resolves server-owned packages against the available catalogue for that turn.

## Live verification

`node scripts/check-conversation-context.mjs /tmp/gambit-context-journeys.json` exercises real model calls, live catalogue data and trade validation against an isolated temporary database. It checks historical batch selection, exact replacement scope, continuation after research, branch undo, three/four-team routing, scoped assumptions, signing ownership, clarification interruptions and filter refinement. The optional next argument filters journey names. It consumes configured model usage and writes actual operation traces and semantic failures.

`node scripts/record-chat-review.mjs REPORT FILTER` records further scenarios from `scripts/ux-review-cases.json`. These recordings are observations, not semantic test-pass claims. Selected refreshed recordings feed UX review. No new unit tests were added for this refactor. The [verification report](verification/conversation-context-e2e.md) documents the final semantic journeys and broader observations.

Limits remain: general discovery supports two teams and one to three players per side; replacement discovery searches the replaced player's sending team; search budgets are bounded. Full basketball value, willingness, automatic multi-team construction, custom pick protections, combined signing budgets and full CBA signing/waiver compliance are not established by salary/roster checks.

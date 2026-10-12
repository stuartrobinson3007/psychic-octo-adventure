# Trade backend

The UI streams submissions through `/api/trade-chat` using versioned application SSE events for start, tool activity, result and error. Vercel AI SDK is no longer a dependency. Credentials, catalogue requests, conversation persistence and validation remain server-side. The live catalogue supplies players, teams, contracts, payroll, picks, draft rights and trade exceptions. Player performance and team willingness are not supplied by these mechanics.

## Configuration and loop

Set `OPENAI_API_KEY` in the ignored `.env.local` for direct OpenAI access. `GAMBIT_EXECUTION_MODEL` selects the model; the default is `gpt-6.1-sol`. Do not prefix credentials with `VITE_`. Cloudflare receives these as server secrets/configuration.

ADK `LlmAgent` and `Runner` run one primary model/tool loop with serial tool calls, low reasoning effort, an 18-call bound and a 90-second request budget. An application `BaseLlm` adapter uses the official OpenAI Responses client, retains continuation IDs within one invocation, and supplies matching function results. There is no mandatory `interpret_request` pass, sentence-pattern intention router or restricted authoritative plan. The model sees the catalogue directory and compact record index, retrieves missing facts, and can revise its interpretation from tool results. See [migration checkpoint](../../docs/ai-sdk-to-adk-migration.md) for session ownership and the application SSE event contract.

## Module responsibilities

- `conversation-records.ts`: independently addressable proposal/search versions, batches, questions, actual outcomes and discussion references; migration and model-visible indexes.
- `conversation-read-tools.ts`: exact record retrieval, older-record recall, player facts, selected team asset sections, signing offers and checked explanations.
- `conversation-turn.ts`: typed task tools, turn-local staging, terminal answers/questions and atomic completion or rollback.
- `proposal-operation.ts`: complete compound edits, asset ownership and routing, contract assumptions, signing validation and exception selection.
- `conversation-search.ts`: saved discovery/repair/replacement specifications and continuation without duplicate packages.
- `trade-harness.ts`: input checks, credentials, lock/version handling, agent execution, streaming activity and persisted responses.
- `adk-trade-agent.ts`: invocation-local ADK session, agent, Runner events and tool callbacks.
- `openai-adk-model.ts`: ADK-to-OpenAI request/response conversion, continuation and bounded provider retries.
- `trade-api.ts`: authoritative API normalization, local proposal integrity checks and validated upstream evidence.

## Tool contracts

`search_players` reads catalogue IDs chosen semantically by the model, including nicknames, relationships and misspellings. Ambiguous identities need a concrete question. `read_team_assets` reads payroll, players, picks, rights or exceptions without constructing a proposal. Exception source labels are fetched from the team's endpoint and reconciled with the catalogue.

`check_proposal` creates an independent proposal or edits an exact saved version. All changes are supplied together. Code preserves unrelated assets and assumptions, validates actual ownership and derives participating teams from the completed package. Ordinary substitution preserves the receiving slot and can replace a sole sending team's role; explicit routes are respected. Up to four teams are supported. Signing offers must be retrieved in the same turn before a signing is checked.

`find_options` stores a complete search specification and opens the composer’s trade picker. `browse_options` opens ideas from its exact saved version. Browsing uses the saved roster and local filters; no validation runs until the user chooses up to five ideas. A result batch records its search and ordered proposal references. Replacement searches keep every unrelated transfer and assumption fixed. General discovery is not substituted for a scoped replacement request.

`ask_question` stores unresolved context and linked records. Concrete choices appear in the option widget; an unrestricted team choice lists all teams with the reusable search input. Questions without choices appear as ordinary assistant messages. Research can hide options while retaining the unresolved request. `finish_response` completes an evidence-based answer, records discussion references and marks answered/cancelled questions.

## Persistence and safety

See [conversation records](../../docs/conversation-memory.md). The existing local SQLite and Cloudflare Durable Object adapters, browser ownership gate, request deduplication, leases and optimistic conversation versions remain in place. The wire `snapshot` is a display compatibility cursor and never an implicit operation target.

Proposals/search results are staged until the turn completes. A provider failure cannot publish a partially edited package. Diagnostic tool arguments/outcomes remain available to explain failures. Canonical checked proposals require matching proposal ID, revision, season and catalogue timestamp. Invalid mechanics, unavailable services and schema failures remain distinct outcomes.

## Search limits and unsupported evidence

Discovery supports one to three players per side and two teams. Deterministic filters cover age, position, total incoming salary, savings and projected payroll. Local candidate enumeration is exhaustive within that supported scope and paged; it does not contact the validator. The user chooses up to five ideas, checked with at most three concurrent calls. Replacement searches preserve unrelated assets, routes and scenario settings. Salary proximity orders ideas; it does not establish fairness or willingness.

Explicit proposals may include picks, draft rights, exceptions and scoped contract/signing assumptions. Automatic pick/right selection, automatic multi-team discovery, custom protections, combined exceptions, full signing-budget allocation and complete CBA signing/waiver compliance remain outside these checks. A hypothetical signing does not execute a transaction or change global catalogue ownership.

## Verification

Prefer E2E journeys and integration tests for useful boundaries; do not add unit tests. Run only the typecheck, build or integration check relevant to the change. Use existing UX recordings or mocked services for routine browser checks. Live conversational verification is `node scripts/check-conversation-context.mjs REPORT [FILTER]`; UX recording is `node scripts/record-chat-review.mjs REPORT [FILTER]`. Both use real configured model/API calls and isolated temporary databases, so run them only when the user requests live model verification and filter to the affected scenario. Semantic journey assertions inspect actual operation scope; recordings provide reviewable observations. See [testing guidance](../../docs/testing.md).

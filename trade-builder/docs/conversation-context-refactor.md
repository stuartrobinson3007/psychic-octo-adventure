# Conversational context refactor

Historical design note: the current harness uses one Google ADK loop and an
application SSE transport. See [the migration implementation](ai-sdk-to-adk-migration.md).
The runtime/interpretation description below records the earlier design.

Research and implementation: 9 October 2026. The record model, primary tool loop and task-level operations described below are now implemented. See [conversation records](conversation-memory.md) for the resulting behavior and live verification commands. The rationale and sources below document the design decision.

**Recommendation**

Keep the Vercel AI SDK, existing conversation persistence, and deterministic trade checks. Refactor the conversation model, context assembly, and tool contracts substantially. Replace the mandatory interpretation pass followed by a restricted execution agent with one primary tool loop that can retrieve evidence and revise its understanding.

The central idea: the conversation remembers many proposals and searches. Each request identifies the records it needs. Recent discussion helps interpret a reference; it does not silently supply a global trade for every operation.

This is an application-specific design recommendation informed by the sources below. An agent framework does not supply basketball proposal semantics or resolve our conversational references for us.

**Infrastructure retained**

We already retain proposals, revisions, parent relationships, rendered messages, and results. Persistence includes request deduplication, conversation version checks, and atomic saves. Those mechanisms should survive this refactor. Editing an older proposal should create a child version while retaining all intervening conversation and results.

**Constraints in the implementation before this refactor**

- Before the refactor, `src/server/trade-session.ts` had one `snapshot`, one saved `discovery`, and one pending request.
- The retired `src/server/trade-request-interpreter.ts` exposed one proposal reference and a candidate index limited to the latest offered batch. Its prompt explicitly sent implicit references back to the current focus.
- The earlier `src/server/trade-harness.ts` first obtained a large structured interpretation. The later agent was instructed to treat that interpretation as authoritative and could not reconsider it from tool evidence.
- The retired `src/server/trade-turn.ts` combined interpretation reconciliation, identities, references, draft edits, search routing, tools, and result commits in roughly 5,000 lines.
- General discovery saved continuation state. Replacement searches lacked equivalent durable search identities and continuation records.
- Recent text, proposal indexes, and saved tool activity existed, but did not consistently describe which search, result batch, and proposal a follow-up belongs to.

Consequently, preserving an earlier proposal as the default can protect its assets while leaving it incorrectly positioned as the subject of later discussion. Renaming `snapshot` or adding more instructions would not fix the underlying model.

**The records we need**

| Record                    | What it remembers                                                                                                                             | Why it matters                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Proposal version          | Exact assets, routes, scenario, validation result, parent version, originating message                                                        | An edit has an unambiguous base; earlier results stay reproducible.                                            |
| Search and search version | Goal, search kind, optional base proposal, fixed assets/routes, replaceable assets, constraints, resolved identities, exclusions, assumptions | “More options” continues the actual search being discussed.                                                    |
| Result batch              | Search version, ordered proposal references, message where they appeared                                                                      | “The middle one” refers to an identifiable displayed group.                                                    |
| Clarification             | Originating request, unresolved slot, candidate choices, saved draft/search reference, status                                                 | A reply fills the right gap; unrelated research can dismiss the options without losing the question’s history. |
| Execution outcome         | Request, resolved targets, actual validated operation, structured result or failure                                                           | The assistant can explain what actually happened.                                                              |
| Discussion context        | A small set of recently mentioned records and their message links                                                                             | Pronouns and follow-ups have useful hints without forcing one proposal to be current.                          |

Search specifications should be versioned when constraints change. Each result batch points to the specification that produced it. Otherwise returning to an earlier batch could silently resume a later, different search.

These are ordinary structured records and relationships. Our existing storage can hold them; a graph database is not required for this design. Add a higher-level exploration grouping only if it becomes useful for retrieval or UI. Avoid requiring the model to classify every message into a permanent topic.

**How a request should run**

1. Assemble recent messages and a compact index of relevant proposals, searches, batches, unresolved questions, and outcomes. Include readable descriptions alongside stable references.
2. Let the model interpret the request and retrieve additional records if needed. It can resolve names, inspect an older batch, or read a failed search before deciding what to do.
3. Require each operation to name its targets: a proposal version for editing, a search version for continuation, several proposals for comparison, or a pending question for answering.
4. Validate those references and operation arguments in code. Check that records belong to this conversation, players exist, preserved assets remain in place, routes are coherent, and search constraints are honored.
5. Execute domain operations and return structured evidence. An empty search, unsupported operation, or invalid trade is a meaningful outcome, not automatically an agent failure.
6. Save new records and the actual outcome atomically. Update discussion context from the records discussed and the work completed. A failed request can become the subject of “why?” without changing any proposal’s assets.
7. Render the answer from the actual outcome, with the existing streamed tool activity and trade cards.

This is a tool loop, so it may take several model calls. The benefit is avoiding a mandatory classification call before every request and allowing retrieval results to inform subsequent decisions. It is not a promise of lower latency on every turn.

**The Curry example, expressed as records**

| User message                                                   | Resolution and operation                                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Find trades for Steph Curry.”                                 | Resolve Stephen Curry; create search S1 and batch B1 with three proposals P1, P2, P3.                                                                             |
| “Swap Davis for White on that last trade.”                     | Read P3 from B1; resolve the two player roles and clarify White if necessary; create an edited proposal P4.                                                       |
| “What player could we swap Mitchell for on that middle trade?” | Read P2 from B1; create replacement search S2 based on P2, holding Curry, Adebayo, and their routes fixed.                                                        |
| “Show me more.”                                                | Continue S2’s applicable search version and exclude previously shown packages.                                                                                    |
| “Why doesn’t that work?”                                       | Resolve the relevant recent candidate or search outcome; retrieve its actual checks. Ask only if more than one interpretation would materially change the answer. |
| “Back to the Coby one; add a pick.”                            | Retrieve P4 and create its child version.                                                                                                                         |
| “Compare that with the original middle one.”                   | Read both explicit proposal versions and compare them.                                                                                                            |

The earlier Coby proposal remains saved throughout. After the Mitchell question, the conversational subject is the replacement search. There is no need for a single proposal to remain the universal default.

**Reference resolution policy**

The model should use explicit user references and supplied card references first, then descriptions and the relationships between records, with recency as supporting context. This is a semantic task, not an expanding list of sentence patterns.

An ordinal belongs to a particular batch. A search continuation belongs to a particular search version. A mention of an original proposal does not automatically select its newest descendant. An undo needs the relevant edit lineage, rather than whichever record happened to be mentioned most recently.

When several plausible targets would produce materially different operations, ask a short clarification with the actual candidates. Do not ask merely because a name was shortened if the conversation already identifies it clearly.

Stable IDs help code verify existence and scope. They do not prove the model chose the intended record. Retain the supporting message links and exercise these choices in real conversational evaluations. Readable labels or short model-facing aliases can accompany durable IDs; aliases must map back to authoritative records before execution.

Expanding a card or scrolling past it should not silently select it. An explicit card action can provide a reference with the request. The UI does not need new “continue” controls or a mandatory topic selector.

**Tool boundaries**

Use a small set of tools representing complete tasks. These are proposed boundaries, not a final exhaustive API:

- Retrieve conversation context or particular proposals/searches/batches, with concise summaries and an option for details.
- Resolve player or team references, returning authoritative identities and ambiguity candidates. The model can interpret nicknames, relationships, and typos; code verifies the resulting identities and catalogue facts.
- Create or edit a proposal using an explicit base reference and typed changes. Code applies the changes, checks routes, validates, and returns a new proposal version.
- Find options using a structured specification, or continue an explicit saved search. General searches, repairs, and player replacements share the same durable search model while retaining their distinct domain rules.
- Explain or compare explicit proposal references using saved validation evidence and current supported research capabilities.
- Ask a clarification tied to a specific unresolved request.

Tools should return enough evidence to distinguish checked results, no results, unsupported work, and execution failure. Each tool can coordinate several internal domain functions. We should avoid exposing every low-level function as a separate model decision.

The model determines meaning and chooses operations. Code retains ownership of identity validity, exact filters, immutable proposal updates, salary and roster calculations, persistence, and concurrency. Exact ID checks and database lookup remain useful; the conversational sentence router is what we should replace.

Compound edits should be staged as one operation and committed as one checked result. A mechanically invalid trade can still be a successfully completed validation. A provider interruption must not leave a partially edited proposal saved as if the request completed.

**Context and memory**

Keep full authoritative records in storage. Give the model a small useful view and let it retrieve exact details. Summaries are navigation aids; they are not replacements for assets, constraints, IDs, or validation evidence.

Use AI SDK runtime/tool context for trusted server dependencies and execution scope. It is not automatically visible to the model. Anything the model needs to reason about must appear in messages or tool results.

Cross-conversation preference memory may be useful later, but an automatic memory service should not become the authoritative store for proposal versions and search constraints. Semantic retrieval can be added when long conversations demonstrate a retrieval problem; exact references remain necessary for execution.

**Implementation sequence**

1. Add durable search versions, batches, clarification links, and execution outcomes alongside existing proposal versions. Migrate records with reliable existing links. Mark older search context as unavailable where it cannot be reconstructed safely.
2. Build one context assembler and retrieval API. Make new domain operations require explicit references; remove hidden fallback to `session.snapshot` in those operations.
3. Unify discovery, repair, and replacement continuation. Associate every rendered batch with its producing search version and message.
4. Introduce the primary tool loop and smaller task schemas. Remove the mandatory global intention schema and authoritative-plan restriction as migrated operations become supported.
5. Split the large turn file into domain execution, context retrieval, search lifecycle, clarification lifecycle, and result persistence modules. Keep the current persistence guarantees and UI streaming.
6. Cut over completely and remove compatibility routing and legacy single-focus/search state once migration is verified.

This can be delivered incrementally, but the destination should be one coherent model rather than two permanent competing conversation systems.

**Verification through real conversations**

Prefer focused E2E browser journeys with existing UX recordings or mocked services; integration tests are appropriate for useful storage and transport boundaries. Do not add unit tests. Run only the relevant journey, and use live model verification only when the user requests it. See [testing guidance](testing.md). Exercise:

- Switching between several proposals, editing an earlier version, and comparing proposals from different batches.
- Continuing a replacement search after an unrelated discussion, with fixed assets and exclusions intact.
- Selecting the second option from an explicitly referenced older batch.
- Short names, nicknames, misspellings, relatives, non-players, unsigned players, and ambiguous identities.
- Replying with a choice plus an additional change; correcting a name while a question is pending.
- Asking research during clarification, then returning to, cancelling, or replacing the earlier request.
- Referring to a failed search or validation with “why?”, and checking that the explanation matches actual evidence.
- Undoing a branch edit, referring to an original version, and editing a newer descendant.
- Empty searches, unsupported constraints, interrupted providers, retries, reloads, long history, and concurrent requests.

Evaluate target selection and asset preservation as well as the rendered answer. A plausible paragraph is insufficient when the backend searched a different package. Save resolved references, validated arguments, and outcomes in review diagnostics. Keep internal diagnostics out of ordinary chat copy.

Use some fresh phrasings and multi-turn journeys that were not used to tune the prompt. This helps distinguish a robust conversational model from another collection of fitted examples.

**What the sources support**

Anthropic recommends deliberate context selection, retrieval of details as needed, and a small amount of useful context rather than continually expanding prompts. That supports a compact record index with retrieval tools. [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

Anthropic recommends a few distinct tools designed around meaningful workflows, with useful responses and evaluations grounded in realistic tasks. That supports task-level proposal/search tools and conversation-based verification. [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)

The AI SDK provides `ToolLoopAgent`, bounded stopping conditions, and `prepareStep` for changing the context and available tools between steps. Those are sufficient building blocks for the recommended harness; the domain record model remains our responsibility. I also checked the matching installed SDK documentation. [AI SDK loop control](https://ai-sdk.dev/docs/agents/loop-control)

Vercel distinguishes runtime/tool execution context from model-visible context. Server state passed through those mechanisms is not automatically placed in the prompt. [Pass state to AI SDK tools and agents with context](https://vercel.com/kb/guide/ai-sdk-runtime-and-tool-context)

OpenAI strict function calling enforces argument schema adherence. That is useful for typed operations, but choosing the intended proposal is a separate semantic problem that we must evaluate and ground in conversation records. [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)

**Decision**

Proceed with this application refactor using our existing SDK and infrastructure. The largest benefit comes from making proposals, searches, batches, and outcomes independently addressable, then allowing the model to use them dynamically through verified operations.

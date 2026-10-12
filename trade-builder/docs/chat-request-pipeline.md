# How a chat request becomes a checked trade

Historical design note: the current harness uses one Google ADK loop and an
application SSE transport. See [the migration implementation](ai-sdk-to-adk-migration.md).
The runtime/interpretation description below records the earlier design.

The backend now separates understanding a sentence from changing a trade. The model explains what the user means in a structured request; the model interprets names and context, while application code verifies catalogue identities and owns previous trade versions, changes, and validation.

## The screenshot example

After “Trade Derrick White for Andrew Wiggins”, “swap derrick for steph curry” means replace White with Curry in that trade. Wiggins remains. The owner and routes are recalculated from the catalogue, so the new exchange is Curry/Wiggins rather than White/Curry. There is no reason to ask which Derrick when the edit targets one asset in the existing trade.

“No I mean swap driick for steph in that first trade” selects the first card actually displayed, including its original revision. The model understands the typo using that card’s assets, and code checks the chosen ID is an asset in that version. The edit uses that version as its parent; it does not silently edit the latest revision or start a new exchange. A genuinely ambiguous incoming identity still needs a choice.

## What happens on each turn

1. The conversation service loads this chat’s history, focus, draft and previous versions. It checks the request ID and conversation version before starting work, so retries and concurrent tabs cannot apply a turn twice.
2. A dedicated interpretation call returns a strict structured object through the AI SDK. It describes the operation, target reference, player roles, search limits, and relationship to any unanswered question. Zod checks its shape at runtime. The backend can request one corrected interpretation when the plan violates a domain rule.
3. In the same call, the model interprets each person reference against a compact directory of catalogue names, IDs and teams. Each interpretation keeps the original query, exact evidence, canonical name, candidate IDs, kind and individual/collection scope. Code verifies that evidence is present and IDs/names agree with the catalogue. An edit target is scoped to the referenced trade. Incoming players are resolved separately. A clarification answer binds an identity to the specific missing role, rather than substituting words into a sentence.
4. Ordinary trades, player edits, discovery, candidate selection, references, undo and draft-right edits run from that plan. Every requested name and route is resolved before the ordinary player changes are applied. Unknown players cannot disappear from the package.
5. Contracts, signings, exceptions and picks still use the bounded AI SDK tool loop. It receives the validated request and current draft, and completes the remaining mechanical operations. Failed required operations block checking and committing the draft.
6. The existing deterministic salary/roster validator checks the resulting proposal. Only a completed result changes the focused trade. A pending question or failed request preserves the last checked trade. The result contains the actual tool activity for the UI.

Context has a defined meaning here. The model can bind a pronoun to the latest clear user referent, including verified nickname mentions, provided that player is in the targeted trade. Multiple references stay ambiguous; assistant prose does not establish a new identity. A complete named exchange can replace an incomplete pending exchange. Research preserves unfinished work without keeping its selection widget open. Relevant hypothetical contract, waiver and signing settings remain active when that player is subsequently traded.

## Why string matching remains

The model now handles nicknames, initials, shortened names, misspellings and contextual references. Catalogue IDs remain authoritative. Name equality, evidence quote checks and ID membership are mechanical verification, rather than an alternative interpretation of the sentence. The complete compact player directory is supplied before changing conversation data, allowing stable request prefixes. This adds no separate name-classification call.

Shared names or nicknames retain all plausible candidates instead of choosing the most famous person. Known players absent from the catalogue, non-players and unknown people have separate outcomes and no random spelling suggestions. Explicit collections (e.g. all players named White) do not request an identity selection. Pending questions carry their original identity query and role; a nickname or selected answer binds that role without losing other assets. Successful interpreted user mentions are stored as conversation context, so a later pronoun need not recover nicknames with spelling rules.

Historical ordinals are interpreted by the model into displayed proposal/revision IDs. Code checks the exact reference exists. The production request no longer calls the ordinal sentence matcher.

Those lookups are different from deciding what the user intends. The production request path no longer uses the old large collection of regular expressions to decide between discovery, replacement, a new exchange, or a filter. Search engines receive numerical predicates; they do not reinterpret age wording. For example “must not be over 25” becomes maximum age 25, while “under 25” becomes maximum age 24.

Some older exported helpers and direct-tool compatibility guards still contain language matching. They remain for compatibility with existing callers. The complex mechanical tool path also retains some wording checks. This is not a claim that every regular expression has been removed.

## The model’s responsibility and its limits

The interpreter uses `GAMBIT_INTERPRETATION_MODEL`, defaulting to `gpt-6.1-sol`. The remaining mechanical tool loop uses `GAMBIT_EXECUTION_MODEL`, also defaulting to `gpt-6.1-sol`. Both calls use low reasoning effort. Live checks exposed asset-ID and exception-owner mistakes with the smaller execution model and additional semantic mistakes with GPT-4.1. The current reasoning model is checked against the same real conversations. Both use the existing OpenAI credential directly. This adds one bounded interpretation call per turn, rather than asking the tool agent to repeatedly reconstruct the intention.

Structured output prevents malformed requests; it does not guarantee perfect understanding. Grounding, role bindings, exact references and domain checks reduce the ways a misunderstanding can corrupt a trade. Live conversation checks remain necessary, particularly for compound operations. Hypothetical contracts remain marked as hypothetical. A salary-valid trade does not establish player value, willingness, consent or basketball fit.

## Recommended next architectural step

The broader mechanical-operation migration is separate from identity understanding. Move the remaining mechanical operations into typed plans as well: contract changes, signing terms, picks and exceptions. The model should provide values and roles; code should execute those commands once. That would remove more repeated tool calls and wording guards. Keep this incremental: preserve the current validator and conversation storage, and verify each change through the real chat endpoint and UX reviewer.

Splitting `trade-turn.ts` into request preparation, identity binding, execution and completion modules would then make those boundaries visible in the code. Merely splitting the file before changing who owns the meaning would leave the same behaviour spread across more files.

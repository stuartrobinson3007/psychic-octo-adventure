# Clarification corrections

Unmatched initial player searches use the same nearby-name candidates as
corrections. The search returns these separately from exact matches, and the
clarification widget offers them for confirmation without resolving an identity
or checking a trade. Empty model-supplied player lists do not discard available
choices. Suggested full names supplied as plain answers, including team labels,
become canonical player choices; duplicate representations are removed. Explicit
team constraints limit suggestions, while guessed team filters do not. Queries
with no nearby candidates remain open for a typed answer.

A clarification selection is provisional when the user adds text. For example,
selecting Yanic Konan Niederhauser and writing “actually I mean dave” must replace
the earlier Nick reference and resolve Dave before asking about Andrew.

## Request contract

`ChatTurnInput.clarificationAnswer` carries `{ optionId, text }`: the offered
option and the user's additional wording separately. The joined message remains
available for conversation history and older clients. The server verifies that
the option belongs to the pending question and that its value plus the additional
text matches the submitted message. Stale or inconsistent answers return a
conflict without applying draft changes.

Legacy joined replies are still supported when their prefix matches an offered
option. Exact offered answers and recognized filter answers can resume directly;
other free-text replies to a pending question require semantic reconciliation.
There is no special case for Dave or a fixed vocabulary of correction phrases.

## Interpretation and enforcement

The model first calls `reconcile_clarification` to distinguish an answer,
amendment, unrelated question, new request, or cancellation. Amendments quote an
earlier player reference and the replacement wording. They cannot authorize an
assumed full name or a replacement absent from the user's text.

`clarification-reconciliation.ts` validates those spans, reduces a rewritten
phrase to its changed words, and applies distinct amendments atomically to a
cloned pending request. It removes superseded identities and transfers while
preserving unaffected references. History remains unchanged. The selected player
is removed when the correction supersedes the reference it answered; correcting
the other side of a trade retains a compatible selection.

Corrected names use the existing catalogue resolver. Unique grounded matches
become required identities. Ambiguous or unknown names produce a clarification
before any other missing reference. Similar-name options are suggestions requiring
an explicit answer, never assumed nickname mappings.

Pending drafts persist amended references and their resolved identities through
further questions. A proposal that omits a required corrected player cannot reach
the validator. Failed model or tool turns preserve the previous pending request
and checked focus. Starting independent work does not inherit the old amendment
requirements.

## Verification

Automated tests cover structured and legacy replies, sentence-level amendments,
more specific names, multiple corrections, overlapping edits, stale metadata,
corrections to either side, supplementary instructions, cancellation, unrelated
research, follow-up resolution, and failed-turn rollback.

Run `node scripts/check-clarification-corrections.mjs` for an opt-in check against
the configured model and validator. It seeds the exact pending checkpoint,
checks both forms of the Dave reply, and follows a known-player correction through
Andrew disambiguation to a checked trade. Reports include tool traces and error
summaries; the default output is `/tmp/gambit-clarification-corrections.json`.

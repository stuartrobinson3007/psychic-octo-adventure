# Draft picks in conversation

Gambit supports existing tradable first- and second-round picks in named two- to four-team trades, including pick-only packages. Picks can be added, removed, replaced, rerouted, checked, undone and saved with a trade version. Existing protections travel with the pick. Custom protection changes, swap rights and automatic discovery of pick packages are outside this feature.

Examples:

- “Add Miami's 2029 first-round pick.”
- “Add the Charlotte 2030 second-round pick owned by Boston and send it to Miami.”
- “Remove the pick.”
- “Send the pick to Chicago instead.”

Availability depends on the current catalogue. Missing years, rounds, origins or owners require clarification; the assistant cannot select the earliest available pick. Offered choices include origin, current owner and protection to distinguish otherwise identical descriptions. A bare year answer resumes the pending pick action and retains all previously traded assets. Two-team packages can use the other participant as an implicit recipient; larger packages require a named destination.

## State and validation

Transfers use a discriminated player/pick asset type. IDs are namespaced by type, so a player and a pick sharing a numeric ID remain distinct. Pick ownership is `currentTeamId`, while `originalTeamId` identifies its origin. Local checks enforce owner, availability, swap scope, uniqueness, participants and routing. Picks never contribute to salary matching or player filters.

The adapter loads `/draft-picks` with the live catalogue and sends separate `sendingPickIds` and `receivingPickIds` to `/trades/validate`. Known pick-unavailability and Stepien-rule HTTP 400 responses become `invalid_trade` with their exact reason. Unfamiliar errors, schema failures and incomplete evidence remain `validation_unavailable`. These checks do not establish comprehensive protection-conveyance, swap, valuation or team-acceptance logic.

Player replacements and salary repair suggestions retain all pick transfers and destinations. Repair search still changes players only. Proposal versions and pending requests serialize picks in the existing SQLite conversation store. Bookmarks capture pick details and origin team identities with the exact version; later catalogue changes do not rewrite saved cards.

## Investigation

Live probes on 8 October 2026 returned 443 picks. Ordinary firsts, seconds and existing protected picks were accepted in the tested proposals. The engine rejected an unavailable swap-encumbered pick and a consecutive-first-round proposal with a Stepien-rule error. It accepted a deliberately wrong sender, demonstrating why local ownership validation is required. A tradable swap was also accepted without sufficient evidence to establish swap semantics; Gambit therefore rejects swap assets locally.

Recorded requests and responses: [validation probes](evidence/draft-pick-validation.json). These are observations of specific cases, not proof of the engine's entire rule coverage.

## Verification

Prefer focused E2E journeys for ownership, mixed player/pick packages, clarification, edits and reloads, with integration coverage where a real boundary warrants it. The old `src/server/draft-picks.test.ts` unit suite is no longer maintained. Use existing recordings or mocked services for routine checks; live model verification requires a user request. See [testing guidance](testing.md).

The chat tools retain an immediately attached ownership qualifier even when the model quotes a shorter pick description. New packages permit pick additions; clarification replies retain their original action. A request about “the pick” cannot silently target an older revision. Runtime operation validation and undo checks prevent a repeated verdict from being presented as an applied undo. Protection-edit attempts preserve the checked trade.

`node scripts/check-draft-picks.mjs` runs the configured chat model and live validator in a separate temporary SQLite database. It consumes model usage and records [live chat traces](evidence/draft-pick-live-chat.json). Browser checks exercise mixed first/second-round packages, transferred ownership, existing protections, saved cards and reloads at desktop and mobile widths.

`node scripts/check-draft-picks.mjs mixed` additionally checks a complete fresh player/pick exchange with separate origin and owner. Impeccable's independent finish review returned **ship**, with no material UI fixes. The [documentation report](../.impeccable/review/draft-picks-documentation.md) records desktop/mobile evidence and preserves the incumbent design system.

Final pick verification on 8 October 2026: all 11 focused tests and all 11 live conversation turns passed, along with the fresh four-asset mixed-trade check. The live flow retained the current players through a pick reroute, resumed an addition from a year answer, reported the validator's Stepien rejection, and preserved the proposal for unsupported protections and ambiguous unavailable picks. Desktop/mobile save and reload checks passed. TypeScript and the production build passed.

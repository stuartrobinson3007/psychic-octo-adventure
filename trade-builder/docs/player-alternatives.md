# Replacing one player in an existing proposal

## What failed

The saved conversation `7cc15dd3-0b16-45f7-b4b7-36950b5f0e6b` asked: “what player could we swap mitchell for on that middle trade?” The middle proposal exchanged Stephen Curry for Davion Mitchell and Bam Adebayo. A subsequent edit of the last option had made the Curry/Riley/Coby White proposal the current trade.

The executed search was `discover_trades`, using the earlier general search: Golden State, Curry outgoing, two unspecified incoming players, any partner. Its recorded work said it checked 12 of 3,321 packages. It did not constrain the Mitchell slot, retain Bam, or preserve Miami as the partner. The Toronto/Boston/Washington cards therefore answered a different request. The later prose described the intended search, rather than the one actually executed.

A second bug could silently change focus to a referenced proposal after discovery or repair returned independent alternatives. Searching an older card must not select that card.

## Behavior now

The interpreter has a separate `player_alternatives` intent. It supplies one existing replacement target through the existing typed player-edit structure, without naming an incoming player. Code validates that structure, resolves the exact proposal and target, and calls `find_player_alternatives`. General discovery cannot accept player edits or serve this operation.

The candidate engine searches same-team replacements for that slot. It keeps every other transfer, asset, participant, contract scenario, exception selection and destination, and attaches the original proposal as parent lineage. It works on both passing and failing proposals. Every offered alternative receives fresh salary and roster validation; candidate generation and checks are bounded. Age and position filters constrain the new player rather than the preserved players. It returns independent cards and does not change focus until one is explicitly selected.

If the target is absent or ambiguous, it asks which existing player to replace. An empty result names the searched team and the assets retained instead of silently expanding to whole-package discovery. An explicit request for broader trade options still uses general discovery.

Conversation-review questions use research rather than salary-verdict explanation. Recent recorded tool labels, search details and card assets are supplied as execution evidence; older conversation recall also returns recorded work. The model can distinguish what was requested from what was actually done.

## Verification

Real HTTP/SSE conversations used the configured model, catalogue and validator with an isolated conversation database. No new unit tests were added.

- `verification/player-alternatives-e2e.json`: 14/14 turns passed across three conversations. Covers the screenshot sequence, historical reference versus current focus, a valid original with no replacements, an invalid package with a passing replacement, selection, filtered no results, a missing target and clarification recovery, explicit broader discovery, and reviewing actual search evidence.
- `verification/player-alternatives-regression.json`: 3/3 turns passed for existing repair, pinned assets and choosing a repair.
- Normal and Cloudflare type checks, changed-file lint and production build passed.
- Added all three recorded flows to UX review: 184 scenarios, 1,744 current frame definitions, 397 recorded turns. These are live frame definitions, not a claim of 1,744 visually inspected screenshots. In-app browser inspection was unavailable because the prior browser session was no longer enabled.

In the reproduced middle proposal, all 12 eligible Miami replacements were checked and none passed while retaining Curry and Bam. That result is limited to a one-player replacement from the same team; it does not claim that no broader trade could work or that a financially valid trade is fair or acceptable to the teams.

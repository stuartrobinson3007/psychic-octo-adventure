# Discovery eligibility and relationship references

The reported conversation successfully interpreted “his brother” as Seth Curry (catalogue ID 17136), following a search for Stephen Curry. The saved conversation confirms this identity. Seth's current catalogue record is `free-agent`, with no active contract and salary 0. Discovery excludes such players from its tradable pool. The previous implementation returned a combined eligibility/source/exclusion error, which hid the actual reason and displayed a failed search tool.

Discovery now checks each named outgoing player's eligibility before starting a search. Unsigned players receive an explanation and signing alternative. Two-way contracts receive a specific supported-contract explanation. Other restrictions and unavailable salary data also have explicit outcomes. The discovery engine uses the same eligibility function, so its underlying validation agrees with the conversation preflight. Source-team and excluded-player conflicts have separate explanations. No player-name or relationship phrase special cases were added.

The previous search and its options are preserved. A subsequent signing request can use the verified person reference from the blocked request.

## Verification

Eight completed live turns were verified across five conversations: the exact Steph → brother flow followed by a signing, direct unsigned and two-way searches, a package containing an unsigned player, and switching the search to KD on his current team. The signing follow-up created a one-year minimum signing for Seth in Boston. Its initial check mistakenly read `teamId`; the correct field is `signingTeamId`. The saved live response was rechecked against the corrected assertion, and this is noted in the report.

An additional pagination attempt and a fresh rerun hit the provider's credit limit. Those unavailable responses are excluded from the passing recordings. No unit tests were added. Type checks and lint passed. UX review includes the five new conversations.

See [the live verification report](verification/discovery-eligibility-e2e.json).

# Conversation context verification

Verified 9 October 2026 with the configured OpenAI model, the live basketball catalogue and live salary/roster validation. Each conversational journey used an isolated temporary database. No new unit tests were added.

## Final semantic verification

**44 turns across eight journeys passed their semantic assertions.** These assertions inspect actual proposal assets, recipients, assumptions, search specifications and persistence—not just whether the assistant returned a plausible answer. [Full results and operation traces](conversation-context-e2e.json).

| Journey | Behavior checked |
| --- | --- |
| Historical batches and replacement search | Identify the middle option from an earlier batch, keep the remaining package fixed, resume the original search after research, compare versions and undo a branch. |
| Multi-team and hypothetical branches | Create three teams, substitute an owner, add a fourth team, create a separate proposal and return to an earlier scenario without leaking assumptions. |
| Signing identity and ownership | Resolve Stephen Curry’s brother, recognize Seth Curry as unsigned, choose a signing team, obtain eligible terms and distinguish hypothetical ownership from catalogue ownership. |
| Clarification interruptions and corrections | Hide choices during unrelated research, resume an unresolved request with a compound answer, preserve the additional player, resolve substitutions, handle a non-player and cancel a request. |
| Filters and search refinement | Remove only the requested age filter, preserve position/financial filters, exclude shown packages on continuation and explain unavailable performance criteria. |
| Exception identity and atomic assumptions | Identify an exception by its originating player, apply a contract override and draft rights together, then remove only the exception. |
| Retry, cancellation and conflicting clients | Replay the same request without repeating writes; cancel before execution and after a real trade check; preserve committed proposals; explain failed staged work; retry successfully; reject one of two stale competing clients. |
| Compound explicit destinations | Replace a player and add another asset in one four-team operation without overriding any explicitly requested recipient. |

The error and conflict responses in the recovery journey are deliberate fault exercises. A successfully checked staged proposal followed by cancellation is recorded as a failed turn and is not committed.

## Broader conversational observations

Additional recordings exercised package sizes, picks, draft rights, protections, stretch/reset scenarios, signing limits, nicknames, accents, misspellings, unknown people, pronouns, badges, research, historical references and unsupported requests. These are observations rather than semantic assertion pass counts. One sparse-routing recorder used an obsolete choice ID; its scenario was corrected and rerun. Identity and exception cases were rerun after the fixes below.

The refreshed review contains **431 recorded turns across 154 recorded conversations**, alongside authored UI fixtures. Its manifest covers **191 scenarios and 1,880 viewport views**. Manifest verification checks frame references, coverage and source freshness; it does not mean every view was visually inspected. No current frozen screenshots are claimed. [Open UX review](http://127.0.0.1:3018/ux-review/index.html).

## Issues found and fixed

- A lookup of different people could report them as an ambiguous identity. Player lookup now resolves each mentioned person separately and keeps alternatives attached to that specific phrase.
- Replacing a sole sending player could leave an orphaned team or redirect an explicitly added asset. Replacement operations derive participation from retained assets/scenarios and preserve explicit recipients.
- Exception dates differed only by timestamp format, making real catalogue entries appear missing. Matching compares the date value and reads the authoritative originating-player label.
- Clarification state was keyed by question text, so repeated identical questions could retain an old selection. Questions and selections now use their unique record identity.
- A response containing both a checked proposal and search candidates could hide the checked proposal. Rendering now retains both.
- A staged check followed by cancellation could appear committed in diagnostic explanations. Execution records now distinguish completed and failed turns.
- Multi-team titles previously included empty outgoing sides; they now use participating team abbreviations while the card details retain every route.
- The chat displays plain text and entity badges. The model’s copy contract now avoids Markdown syntax that this surface would display literally.

## Browser and build verification

Live browser checks confirmed player choices, “Worked for” before the waiting state/card, research dismissing options, the question remaining in the transcript and a resumed compound answer preserving Derrick White, Payton Pritchard and Andrew Wiggins. Refreshed recordings also verified four-team titles and recipients at desktop and mobile widths, all 30 signing-team choices, filtering with “bos,” selection enabling send and the answered signing question remaining in the transcript. The live KD–AD exchange resolved both nicknames without a false identity question. A subsequent live payroll answer rendered without raw Markdown. The eight-turn historical journey was rerun after the copy change and passed again, including a plain-text comparison.

A [browser screenshot](conversation-context-browser.jpg) records the checked historical replacement result. This standalone evidence is separate from the atlas’s frozen-capture verification.

Both application and Cloudflare typechecks passed. Application and Cloudflare production builds passed. No deployment was performed.

## Practical limits

The model can still misunderstand an ambiguous request; references and validation constrain its actions, rather than proving language understanding. General discovery is bounded to two teams and one to three players per side. Replacement discovery searches the replaced asset’s sending team. Search budgets are bounded, so an empty result does not prove that no deal exists. Salary and roster checks do not establish basketball value, willingness, full CBA signing/waiver compliance, combined signing budgets or custom pick protections.

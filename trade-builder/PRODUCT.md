# Gambit trade workspace

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Experienced users working for basketball teams, checking trade ideas, exploring alternate player packages, and revisiting saved candidates. Use established basketball terminology without explaining basic trade rules.

## Product Purpose

Turn conversation into an inspectable trade proposal and explain its validation result. Give player and pick research space without requiring the user to leave the conversation.

## Capabilities and Constraints

Centred chat expands into a workspace with searchable player and draft-pick browsers, player details, comparison of up to four players, and a saved-trades mode. Research panes resize on desktop and use the full research width on mobile. Player and pick selections add badges to an editable message; submission is deliberate.

Draft-pick research searches teams, years and rounds, with owner, original-team, year, round and availability filters. It distinguishes current ownership from origin, displays supplied protection terms, and keeps unavailable ordinary picks inspectable. Picks tied to swaps are omitted from the browser because the available data does not describe their counterpart or conditions. Add to message inserts the exact pick identity and captured owner without changing the trade or choosing a destination. Duplicate insertion is disabled; Lexical undo and redo preserve reference identity. Catalogue refresh and research-mode changes preserve filters and the unsent message. Submitted references persist in conversation history and reopen the same pick. Changed ownership or availability rejects a stale selection before model execution.

Chat can add, remove and reroute existing tradable first- and second-round picks, retaining existing protections and clarifying ambiguous identities. Protection or conveyance terms are never invented. Trade cards and saved versions show pick origin, year, round and protections alongside players. Trade versions appear inline, newest expanded by default; older versions are inspectable and bookmarked versions remain immutable. Persist local history and saved candidates for this demo.

Use bball-GM identities, ownership, contract information and validation. Performance statistics are unavailable; do not invent them or offer performance-based filters. Requests requiring language interpretation use the server-side tool-calling harness with the configured OpenAI model. Selecting trade ideas without additional instructions checks the selected packages directly; cancelling a question does not call the model. Required services must succeed or report an explicit failure; never substitute another model, interpretation path, trade-building flow or bundled catalogue. A check of an existing trade uses its recorded server-owned proposal.

## Brand Commitments

Preserve Gambit's existing Inter, zinc, emerald, shadcn/Base UI and Hugeicons system. User requires UI, Impeccable and Transitions.dev. Minimal copy: every text element must help the user act or understand state. Use Lexical for editable inline player and pick references, adapting Limesite MVP patterns.

## Evidence on Hand

Assignment and API reference in the parent repository; backend inspection notes at ../../temp-trade-backend-notes.md. The live API includes contracts, position, age, team information and trade flags but lacks performance stats and height. Model credentials stay server-side.

## Product Principles

- Conversation expresses intent; structured views support inspection and discovery.
- Browsing does not mutate the current trade.
- Preserve the exact proposal and evidence behind every historical verdict.
- Keep unresolved player identities visible and require resolution before submitting.
- Reveal detail progressively without accumulating unreadable columns.

## Product language

Write user-facing chat and validation copy as Gambit, a trade assistant. State the season and checks performed directly, without references to a demo, synthetic dataset or validation provider. Describe unsupported operations as product capabilities that are not yet supported. Preserve failure reasons, unavailable checks, estimates and the distinction between salary validity and basketball value. Technical data provenance remains in source metadata and developer documentation.

Clarification headings ask only the missing question. The selection controls, answer field and send button explain the interaction; do not add instructions to choose an option, type a full name or reply below. Put alternative answers in structured choices, not in the question text.

Introduce trade, signing and scenario cards with a brief assistant message about the outcome or requested change. Summarize multiple cards once before the group. Keep packages, salary figures and detailed rules in the cards. Preserve that grouping when saving and restoring conversation history.

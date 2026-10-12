# Trade clarification above the composer

Clarifications use the conversation-response pattern from Limesite MVP's
`src/components/prototypes/site-creation-wizard-distilled.tsx`: a question,
stacked single-select rows with circular indicators directly above the message
box. The question has a muted background and bottom divider. There is no
expanded review UI or separate answer footer.

Gambit's implementation is `src/components/workspace/trade-clarification.tsx`.
It uses the existing shadcn/Base UI ToggleGroup and ScrollArea, with
Tailwind classes and Gambit's semantic colours. The response sits in the
composer's existing centred container; the transcript shrinks and scrolls above
it. The response and composer share one rounded surface with no gap. A
foreground ring and extra-small shadow match the existing card depth; typing
focus applies to this shared surface rather than a second nested input ring.
Long option lists scroll within the response, keeping the composer available.

The response uses the same `rounded-md` token as InputGroup (11.2px with the
current root radius). Option rows are at least 64px tall, with 48px portraits,
8px vertical padding and 20px text line heights. Names and supporting details
have a 2px gap. A single divider separates the options from the input. Questions
without options use the header divider alone, avoiding a doubled line.

Single-player options reuse PlayerAvatar, opting into its team mark at the
bottom corner. The info action appears at the far right on row hover or keyboard
focus, and stays visible on touch devices. Options referencing distinct players
across their label and supporting copy reuse MessageText's player badges.
Inspection controls are siblings of the option toggle rather than nested
buttons. Badge and info clicks inspect a player without selecting or changing
the answer; clicking the selection indicator or remaining row area selects it.

The local review frame supports the existing player inspector. Add
`variant=player-options` to the ambiguous-edit checkpoint's URL to inspect the
multi-player component fixture without changing the recorded conversation.

## Answering

- Selecting an option does not send anything. It can be changed or deselected.
- The existing composer send button and Enter submit the reply.
- Users may send an option alone, text alone, or an option with text.
- Combined replies contain the selected value followed by the message. Player
  choices retain their catalogue IDs; typed player references keep correct
  offsets after the selected value is prepended.
- Existing unresolved player references must be resolved before sending.
- The transcript displays a small temporary status notice instead of the
  question and choices while awaiting an answer. Once a reply is submitted,
  the question appears as an assistant message above that reply and stays in
  the conversation history. A failed send retains the question and selection.

## Backend contract

Player lookup uses literal name evidence from the request. An expanded query
such as “Derrick White” cannot turn the user's “White” into an assumed identity:
the search uses the supplied name fragment and retains its ambiguous matches.
An inferred team filter cannot narrow those choices; a team explicitly supplied
by the user can. Globally unique first names also ground discovery constraints,
so “find a suitable trade for Jrue” identifies his owner without asking for a
team and keeps him fixed in every returned option.

Literal full-name references are retained even when the catalogue contains
multiple players with the same name. Before asking about a package or checking
it, the backend asks which identity the user meant, preserving the other named
players. Choices use distinct player IDs and display their catalogue owners;
identical labels never collapse into one option. Typing the shared name alone
does not choose the first result. A structured choice or uniquely grounded owner
supplies the identity, which remains bound across later routing answers.

Outgoing searches must include the entire resolved same-team package.
Players from different owners need clarification about the intended exchange,
rather than a smaller package made from whichever players share a team. Known
owners do not need to be reconfirmed; the remaining question concerns recipients.

Replacement clarification resolves the incoming player before asking about
routing. After a player choice, the pending replacement retains its original
target and the other trade assets. The existing trade supplies the default
destination. The backend redirects redundant team questions to the atomic
replacement operation; genuinely missing multi-team routes still need an answer.

`ask_clarification` accepts one question and optional `playerIds`, `teamIds` or
`answers`. It returns `ChatTurnResult.clarification` with the question and up to
four options. Labels and team details come from the catalogue; unknown player
and team IDs are rejected. Short replies support questions about the intended
operation. No choices are required for an open-ended question.

Use player choices for ambiguous surnames, replacements and references such as
“Remove him”; current-trade players are available for removal. Use team choices
when relevant destinations are known, and short replies for a small set of
useful next actions. Avoid arbitrary team suggestions or invented identities
when more information is needed. The user's message remains available even
when choices are offered.

Production consumes this structured result directly. Historical conversations
predating the contract are adapted only by the local review model. That adapter
supports named candidates, ambiguous surnames, current-trade removal and an
explicitly offered exploration reply. An explicit structured question with an
empty options array remains text-only.

For a known outgoing player or same-team package without a requested return,
the backend finds checked trade options directly. A desire to trade those
players already delegates the return search; it does not need a second question
or a “Find trade options” confirmation. An ambiguous name gets an identity
question, then resumes the same discovery goal as soon as the user answers.
The search retains every named outgoing player and user-supplied filter and
preserves the focused checked trade. A specified return package instead builds
that named exchange; players from different owners still require any missing
exchange directions.

Older saved `purpose: "trade_preferences"` questions and
`action: "find_trade_options"` choices remain answerable. A unique return name
can complete their original swap, and their search choice resumes discovery.
New outgoing-only requests do not create these questions. A legacy tool call
attempting to ask one redirects to the actual discovery tool, retaining visible
search progress.

Live checks cover “i want to trade white”, the Derrick White selection followed
immediately by checked candidates, a fully named outgoing request, explicit
Miami/one-incoming-player constraints, and a same-team outgoing package.

## Validation

The requested Williams and removal checkpoints were checked at desktop and
mobile sizes. Selection waits for Send; the last Williams option is reachable
by scrolling; the panel stays above the composer without horizontal overflow.
The completed removal checkpoint has neither a response panel nor the
temporary notice. Review scrolling targets entry identity so removing a
temporary notice does not shift its conversation anchor.

The five focused clarification tests, scoped ESLint and TypeScript pass for
the joined composer refinement. The production build passed in the previous
component refinement. Coverage includes option identities across
labels and supporting copy, combined reply references, lifecycle and review
adaptation. Browser checks confirm matching radii, no mobile horizontal
overflow, keyboard selection, and inspection that preserves an existing choice
or leaves an unselected choice unchanged. Backend coverage uses the mock model;
provider response quality was not evaluated in this change.

Desktop and 390px mobile checks confirm a zero-pixel gap, one existing Send
message control, no Send answer footer, a muted header with a 1px divider, and
selection plus optional text ready to send. Selecting an option alone enables
the composer send button without submitting.

Proof: [player portraits](trade-clarification-avatars-mobile.jpg) and
[multi-player badges](trade-clarification-packages-mobile.jpg). Current joined
surface: [desktop](trade-clarification-joined-desktop.jpg) and
[mobile](trade-clarification-joined-mobile.jpg).

The Impeccable documentation pass ran inline. No changes were needed to
`DESIGN.md` or its sidecar after checking the recorded system against
`src/styles.css`, the workspace layout and shared controls:

- Palette: existing white/zinc surfaces and emerald actions.
- Typography: Inter Variable; 16px option text on mobile, 14px on desktop.
- Layout: existing centred conversation and composer container.
- Depth: subtle foreground ring, extra-small shadow and muted question header.
- Controls: shared shadcn/Base UI selection, scrolling and actions.

No new design-system drift was identified or canonized. This feature adds a
local interaction pattern within the established system.

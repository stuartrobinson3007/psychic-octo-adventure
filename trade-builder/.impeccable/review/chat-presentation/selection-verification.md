Scope: select offered clarification options in the presentation instead of typing player names.

Curated-scenario audit found two typed answers to offered choices: Grant Williams in Player clarification and Andrew Wiggins in Edits and undo. Both presentation paths now select their canonical option through the real UI controls. Trade ideas already contains five recorded selections. Players and picks contains direct edits without pending offered choices.

The presentation uses a separate frame route and immutable scenario adaptation. Original review recordings, backend responses and checked trade results remain unchanged. Only complete replies matching one offered canonical option become selections; extra instructions and ambiguous values remain text. Later conversation snapshots preserve selection receipts.

Validation: six targeted regression tests pass, TypeScript passes, targeted ESLint passes, Prettier passes, production build passes. Browser inspection confirms Grant Williams and Andrew Wiggins selected before sending with an empty composer, and You selected receipts after the reply. In the frozen Grant Williams screen, the option has aria-pressed=true and inert; the composer is empty and there are no scripts. The captured option-list scrollTop of 296 is restored to 296, placing Grant's full 64px row inside the visible option area. Native checked input properties are serialized for checkbox selections.

`player-option-selected.png` is a valid browser capture of the presentation frame's selected Grant Williams state, not the outer viewer shell. Existing DESIGN.md and sidecar remain unchanged.

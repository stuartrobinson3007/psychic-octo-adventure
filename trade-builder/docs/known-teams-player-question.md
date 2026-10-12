# Choosing players for known teams

For “Build a three-team trade between Boston, Miami and Chicago”, ask “Which players would you like to include?” with a text field and no placeholder option. “Provide players and destinations” is an instruction, not an answer. The draft retains the selected teams.

Once players are identified, offer concrete choices for missing destinations. A reply that includes players and destinations together proceeds to a checked trade. Explicit routes are distinguished from unapplied transfers: the backend requires the missing transfer operations instead of asking the user to repeat a supplied destination. It still asks about genuinely unspecified routes.

Clarification instructions request one missing question at a time and concrete answer choices. Presentation removes redundant listing instructions even when the question has no options. The original conversation also now explains why an unsigned player cannot be traded without producing a service failure; explicitly requested sign-and-trade flows retain their contract setup path.

Verified on 8 October 2026: 15 live HTTP/SSE turns across four conversations passed, using the configured model and validator. Coverage includes the original six-turn conversation, staged player selection and routing, complete routed answers, and individual destination selections. The real browser composer showed the simplified question with no placeholder option. No unit tests were added or run.

See [the recorded verification summary](verification/known-teams-player-question-e2e.json).

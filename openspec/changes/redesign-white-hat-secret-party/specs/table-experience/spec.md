# Mũ Trắng Experience Delta

## MODIFIED Requirements

### Requirement: Independent gamified visual theme

Mũ Trắng SHALL use a complete independent bright Secret Party visual system across lobby, moderator setup, all gameplay stages, result, chat, invitation, rules, management and connection states. It SHALL replace the current dark table colors, system-font presentation, letter avatars and form-like candidate list with the approved palette, local character assets, game board and tactile controls. Poker/Liars and the shared entry page SHALL retain their current theme.

#### Scenario: Game board and progress

Given a participant is in an active match, when a stage changes, then the UI shows the real round, stage progress, current actor, applicable server deadline and submission progress without adding score, XP, currencies or changed rules.

#### Scenario: Selecting a ballot

Given the viewer can vote, when they choose a candidate portrait, then the corresponding accessible checkbox selection updates, the selected card gains a visible mark, the K counter updates and confirmation remains disabled until the exact legal number is selected. Submitted ballots remain immutable and hidden to other recipients until server closure.

### Requirement: Privacy-neutral decoration

Avatar, decorative color, layout and animation SHALL NOT derive from hidden role/word or disclose information absent from the public snapshot. Hidden private text SHALL remain absent from DOM/accessibility labels; existing blur/offline/match-scope concealment SHALL remain effective.

#### Scenario: Eliminated role remains hidden

Given a player was vote-eliminated and their role is not public, when the elimination/last-guess view renders, then neither their portrait, color, label nor effect identifies the hidden role. Publicly revealed roles and final results may be represented only when the snapshot permits them.

### Requirement: Responsive accessible gameplay

The new theme SHALL be playable from 320px through desktop, with 4–12 players plus moderator, long names, keyboard access, visible focus, 44px touch controls, readable inputs and no horizontal overflow. Mobile action docks SHALL reserve safe-area/page space and not obscure the focused input, chat or result.

#### Scenario: Reconnect and reduced motion

When the user reconnects or reloads, then current state and remaining server deadline appear directly without replaying missed effects. With reduced motion enabled, then no bounce/confetti/decorative motion plays, while textual state and all actions remain available.

### Requirement: Complete match feedback

Actual server stage/results SHALL drive current-turn spotlight, selection confirmation, elimination and victory presentation. Decorative motion SHALL not delay server state, authorize actions or consume a guess. Victory celebration SHALL occur at most once per live result and SHALL use actual winner names/faction.

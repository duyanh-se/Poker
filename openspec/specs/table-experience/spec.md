# Table Experience Specification

## Requirement: Vietnamese playable table

The interface SHALL use Vietnamese and support desktop and landscape mobile screens. Portrait mobile screens shall prompt the player to rotate while retaining room creation and joining capability. The table shall show seats, button, blinds, current actor, deadline, stacks, contributions, pots and shared cards.

### Scenario: Player action controls

Given it is the viewer's turn
When the action panel is shown
Then only legal actions are enabled, call states the additional chips required, and raise states the resulting total wager.

## Requirement: Local card privacy

The player SHALL be able to hide both their private cards and private hand name/highlight from the screen. Cards begin hidden. The interface shall hide them again when the application loses visibility or focus. This display preference shall not change information legitimately public at showdown.

### Scenario: Privacy survives updates

Given a player has hidden their private cards
When a new hand starts or shared cards update
Then the private cards and hand-derived information remain hidden.

## Requirement: Rule help

The system SHALL show the hand-ranking order with examples and identify the viewer's current best hand from known cards. Before the flop it shall identify only the starting cards. It shall not calculate odds, outs or recommend actions.

### Scenario: Current hand after flop

Given the flop has been revealed
When a player views their hand help
Then the interface shows the current best hand and the cards composing it.

### Scenario: Explain showdown

Given a hand settled at showdown
When a player opens the result explanation
Then the interface explains each pot winner or tie using public cards.

## Requirement: Non-blocking motion

Animation SHALL communicate dealing, shared-card reveals, chip movement and pot awards without delaying state updates or hiding actionable controls. Reduced-motion user preferences SHALL use minimal transitions.

### Scenario: Snapshot after reconnect

Given the client reconnects after several state changes
When it receives the current snapshot
Then it displays current state directly rather than replaying missed animations.

# Table Experience Delta

## Added Requirements

### Requirement: Realistic readable table

The system SHALL render a fixed-camera modern 3D oval table with cards, chip stacks and distinct D/SB/BB discs, with readable HTML controls. The viewer is at the bottom; clockwise seating is preserved. Exact numeric chip values remain visible. A viewport narrower than 1024 CSS pixels or shorter than 600 CSS pixels, and WebGL failure, SHALL provide a playable 2D table instead.

#### Scenario: Heads-up on mobile

Given two players including a dealer who is small blind
When shown on landscape mobile
Then D and SB are both identifiable without overlap and legal actions remain reachable.

### Requirement: Safe restoration and commands

Given a returning browser
When its session is being restored
Then show restoration state, distinguish network failure from missing session, and read invitation storage only after hydration for the matching room and host.

Given a pending command
When the user clicks again or acknowledgement times out
Then do not submit a second command; synchronize before allowing another action and never automatically replay a bet.

### Requirement: Clear accessible controls

Only server-legal actions SHALL be enabled. Wager controls SHALL display the total wager and bounds. All-in and destructive room actions require explicit confirmation. Panels support keyboard dismissal and focus containment. Cards and private derived information remain concealed on blur.

### Requirement: Confirmed motion and results

Given reconnect or reduced-motion preference
When a snapshot arrives
Then render current state without replaying missed animations. Normal transitions may animate dealing, reveal and chip movement without blocking controls. Results show public cards and pot payouts, waiting for host confirmation of the next hand.

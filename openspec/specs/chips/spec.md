# Chips Specification

## Requirement: Host grants

New members SHALL start with zero chips. Only the host may grant a positive whole-number amount of play chips to any room member, including the host. The system SHALL not provide buying, selling, withdrawing or converting chips.

### Scenario: Grant chips to a waiting player

Given a member is not in an active hand
When the host grants a valid chip amount
Then the member's stack increases and can be eligible for the next hand.

## Requirement: Fixed active-hand stack

Chip grants to a member in the active hand SHALL be pending and added only after that hand settles. Grants to members not in the active hand may apply immediately.

### Scenario: Grant to an all-in player

Given a player is all-in in the current hand
When the host grants chips to that player
Then the player remains all-in and cannot use the grant until the hand settles.

## Requirement: Chip accounting

Chip values SHALL be non-negative safe integers. Betting and settlement SHALL conserve total room chips; host grants add chips and a departed member's uncommitted stack leaves the session. Operations exceeding JavaScript's maximum safe integer SHALL be rejected.

### Scenario: Retried grant

Given a chip grant command has succeeded
When the same command identifier is submitted again
Then chips are not granted a second time.

### Scenario: Settlement reconciliation

Given a hand settles
When pots and unmatched contributions are distributed
Then all distributed and returned chips equal the hand's total contributions.

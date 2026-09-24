# Rooms Specification

## Requirement: Fixed table configuration

A room SHALL represent exactly one table with two to nine seats. Its small blind, big blind and ante SHALL be selected when created and remain fixed until closure. Small blind and big blind SHALL be positive integers with small blind less than big blind; ante SHALL be a non-negative integer.

### Scenario: Attempted configuration change

Given an existing room
When the host attempts to change blind or ante
Then the system rejects the request.

## Requirement: Continuous play

The host SHALL start the first hand. A player is eligible for a new hand only when connected, not sitting out and holding more than zero chips. After a settled hand, results SHALL remain visible for eight seconds, then a new hand starts when at least two players are eligible.

### Scenario: Late join

Given a hand is underway
When a visitor joins the room
Then the visitor waits for the next hand.

### Scenario: Insufficient eligible players

Given fewer than two eligible players
When the table is ready to start another hand
Then it waits and states why no hand begins.

## Requirement: Pause

The host SHALL be able to pause and resume the room. A pause requested during a hand SHALL take effect only after that hand settles.

### Scenario: Pause requested mid-hand

Given a hand is active
When the host pauses the room
Then the table displays that it will pause after the hand and completes that hand normally.

## Requirement: Leaving and kicking

Leaving or being kicked SHALL immediately revoke a member's ability to send commands. A non-all-in member shall check when possible or fold on its next turn. An all-in member remains eligible to win pots it funded. Committed chips remain in the pot; the seat releases after hand obligations end and uncommitted chips leave the session.

### Scenario: Kicked all-in player

Given a player is all-in
When the host kicks the player
Then the player remains eligible for the relevant pots until settlement.

### Scenario: Kicked player facing a bet

Given a kicked non-all-in player must add chips on its next turn
When that turn starts
Then the system folds the player.

## Requirement: Host and room closure

The host SHALL transfer ownership only to a connected member. If a host deliberately leaves without transferring ownership, or closes the room, the system SHALL close the room, cancel any unfinished hand and discard session data.

### Scenario: Ownership transfer

Given host A transfers ownership to connected member B
When A leaves the room
Then the room remains open with B as host.

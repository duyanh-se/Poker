# Session Access Specification

## Requirement: Private room entry

The system SHALL create a random room code and password with every room. A visitor SHALL supply the code, password and a display name to join. The system SHALL not expose a public room list.

Display names SHALL be unique within a room after trimming whitespace, Unicode normalization and case-insensitive comparison.

### Scenario: Visitor joins a room

Given an open room with an available seat
When a visitor supplies valid credentials and an unused display name
Then the visitor becomes a room member and receives the first vacant seat.

### Scenario: Invalid credentials

Given a room code or password is invalid
When a visitor requests to join
Then the system rejects the request and does not disclose the table state.

### Scenario: Full room

Given a room has nine occupied seats
When a visitor requests to join
Then the system reports that the room is full.

## Requirement: Guest identity continuity

The system SHALL identify a returning visitor by its guest session, not by display name.

### Scenario: Reload with a valid session

Given a member has a valid guest session
When the member reloads the application
Then the system restores that member's seat, stack and current room permissions.

### Scenario: Name impersonation

Given a display name is already in use in a room
When another visitor supplies that display name
Then the visitor cannot take the existing seat or view its private cards.

## Requirement: Room-scoped permissions

The system SHALL authorize every command using the guest session, room membership, actor role and current table state.

### Scenario: Player attempts a host action

Given a non-host room member
When the member requests to grant chips, kick a member or transfer host ownership
Then the system rejects the request.

# Realtime Specification

## Requirement: Turn deadlines

Each decision SHALL have a server-defined deadline no later than 180 seconds after the turn begins. Reloading or disconnecting shall not extend it. At or after the deadline, the system checks when legal and otherwise folds.

### Scenario: Timeout with no call

Given the acting player has no outstanding call
When the deadline expires
Then the system checks for the player.

### Scenario: Timeout facing a wager

Given the acting player must contribute chips to continue
When the deadline expires
Then the system folds the player.

After a player's first timeout in a hand, the system SHALL automatically check or fold that player's remaining turns until the player explicitly signals return. The player then sits out after the hand.

## Requirement: Temporary disconnection

A disconnected member retains its active-hand cards and stack, but does not join a future hand until connected again. A reconnecting valid session SHALL receive a current filtered snapshot, including any current deadline; missed or timed-out actions are not restored.

### Scenario: Host disconnect expiry

Given the host disconnects
When the host has not reconnected for 180 seconds
Then the system closes the room and cancels any unfinished hand.

### Scenario: Host reconnects

Given the host reconnects within 180 seconds
When its session is validated
Then the room remains open and the pending closure is cancelled.

## Requirement: Idempotent and current commands

The system SHALL apply a successfully accepted command at most once. A game command SHALL identify its target hand and turn, and shall be rejected when either is no longer current.

### Scenario: Retried action

Given a call command succeeded but its response was not received
When the caller retries the same command identifier
Then the system does not deduct chips a second time.

### Scenario: Stale action

Given a connection interrupted while the turn changed
When the client submits an action for the old turn
Then the system rejects it and provides current state.

## Requirement: Ephemeral data

Closing a room or restarting the backend SHALL remove all room, member, hand and result data.

### Scenario: Return after restart

Given the backend restarted
When a browser requests its prior room
Then it is told that the room no longer exists.

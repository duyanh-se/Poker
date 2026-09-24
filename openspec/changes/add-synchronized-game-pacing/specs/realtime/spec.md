## ADDED Requirements

### Requirement: Server-owned transition timing

The server SHALL publish serverTime and a unique timed transition. Game commands during transitions SHALL fail with TRANSITION_IN_PROGRESS. No playable turn deadline runs during transitions.

#### Scenario: Transition completes

- **Given** a current transition whose end time has arrived
- **When** its guarded callback advances
- **Then** the next stage is published, or a new turn receives a full 180-second deadline.

#### Scenario: Stale callback or reconnect

- **When** a callback is duplicated, a room closes, or a player reconnects
- **Then** no duplicate mutation occurs and no transition/deadline is restarted.

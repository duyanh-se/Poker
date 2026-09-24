## MODIFIED Requirements

### Requirement: Room administration is only available between hands

The system MUST permit host chip grants, pause/resume, kick, host transfer and room closure only while a room is waiting or paused. A player MUST not voluntarily leave while a hand is active.

#### Scenario: Host attempts administration during a hand

- **Given** a hand is running
- **When** the host sends a grant, pause, kick, transfer-host or close command
- **Then** the system rejects the command and does not change table state.

### Requirement: The host confirms every next hand

The system MUST wait for the host to start every hand, including the hand after settlement. It MUST NOT automatically start a next hand.

#### Scenario: A hand settles

- **Given** a running hand reaches a winner or showdown
- **When** settlement completes
- **Then** the room enters waiting state and keeps its result visible until the host starts a new hand.

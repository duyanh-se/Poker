## ADDED Requirements

### Requirement: Paced claims and resolution

Dealing SHALL last 1800ms and claims 450ms before the next turn. Challenge SHALL announce for 450ms, reveal disputed cards for 750ms, announce verdict for 600ms and update lives for 600ms. Timeout/forfeit SHALL use 1200ms. Premature snapshots SHALL not contain future reveal, verdict or life changes. Only the host can start the next round after resolution.

#### Scenario: Challenge

- **When** an authorized challenge is accepted
- **Then** only disputed cards become public at reveal, the verdict follows, and the penalty is applied once at the life stage.

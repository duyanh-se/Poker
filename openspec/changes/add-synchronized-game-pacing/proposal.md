# Change: add-synchronized-game-pacing

Approved by the user's explicit implementation request on 2026-09-24.

## Purpose and scope

Give Poker and Bài nói dối a readable, synchronized rhythm. The backend owns transitions; each playable turn retains its full 180 seconds. Preserve host confirmation of every new hand/round, privacy, existing commands and RAM-only deployment.

## Acceptance

Deal 1800ms, ordinary action 450ms, Poker street 900ms, staged showdown/challenge 2400ms, fold win/timeout/forfeit 1200ms. Reject premature commands; publish only information belonging to the current stage. Reconnect never resets time or replays missed motion. Support reduced motion, 2D/3D Poker and landscape mobile. All applicable quality checks pass and test servers are stopped.

## Non-goals and risks

No sound, new dependencies, database, configurable speed or client completion acknowledgements. Risks are premature disclosures, duplicate settlement, stale timers and slow-client animation backlogs; mitigate with stage IDs, guarded advancement, filtered snapshots and latest-state rendering.

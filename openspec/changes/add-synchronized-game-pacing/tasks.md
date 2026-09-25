# Tasks

- [x] Record approved scope, design and spec deltas.
- [x] Add shared transition contract and guarded backend scheduling.
- [x] Stage Bài nói dối dealing, claims, challenge and penalties with tests.
- [x] Stage Poker dealing, actions, streets, runout and payouts with tests.
- [x] Add shared frontend timeline, locks, labels and reconnect handling.
- [x] Add two-game effects and panel/entry motion with privacy/reduced-motion coverage.
- [x] Run unit/integration/E2E, lint, typecheck, format and build; inspect UI and stop owned servers.
- [x] Record verification and limitations. Keep change unarchived pending acceptance.
- [ ] Human visual/usability acceptance (do not archive automatically).

## Turn-stall correction (2026-09-25)

Within the approved server-owned timing scope: an early timer callback must rearm against the same deadline instead of permanently abandoning the transition. No new behavior, timing constants, API or dependency.

- [x] Reproduce abandoned transition with an early wall-clock callback.
- [x] Rearm early transition and action deadline timers.
- [x] Verify regression tests, lint, typecheck and build.

Verification: early-callback regression failed before the fix and passed afterward. API suite 72/72 passed; after adding action-deadline regression, focused gateway suite 14/14 passed. Repository lint, API typecheck/build and changed-file Prettier check passed. No listeners remained on test ports 3100/3101. The reproduced scheduler defect explains a possible intermittent stall; no production trace was available to establish that it accounts for every reported occurrence.

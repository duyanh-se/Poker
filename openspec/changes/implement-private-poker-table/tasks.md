# Tasks: implement-private-poker-table

## 1. Shared contracts and configuration

- [x] Add recipient-safe HTTP and Socket.IO contract types to `packages/contracts`.
- [x] Add session-cookie configuration validation and update `.env.example`/README.
- [x] Add `socket.io-client@4.8.1` to the web workspace and regenerate the npm lockfile.
- [x] Add contract/configuration unit tests where behavior is observable.

## 2. Session access and room lifecycle

- [x] Implement opaque guest-session cookie creation, validation and expiration on room closure.
- [x] Implement display-name normalization, unique-name checks and safe room/password generation with password hashing.
- [x] Add `POST /rooms`, `POST /rooms/join` and `GET /rooms/current` with DTO validation and Swagger documentation.
- [x] Implement in-memory room registry, seat allocation, room-full handling and room-scoped membership checks.
- [x] Add integration tests for create, valid join, invalid password, duplicate name, full room, reload and expired room session.

## 3. Room administration and chips

- [x] Implement fixed blind/ante validation and room lifecycle states: waiting, running, pause-pending, paused and closed.
- [x] Implement host start, pause/resume, transfer ownership, leave, kick and close semantics.
- [x] Implement immediate and pending host chip grants with safe-integer accounting.
- [x] Add tests for permissions, pause timing, host departure, kicked/all-in members and grant idempotency.

## 4. Pure poker domain: cards, positions and evaluation

- [x] Implement card representation, cryptographic shuffle and uniqueness invariant.
- [x] Implement eligible-player ordering, moving button, blinds/antes and heads-up positions.
- [x] Implement best-five-card hand evaluation with rank vectors and explanatory result data.
- [x] Add unit tests for all hand classes, wheel, kickers, board play, positions and short mandatory contributions.

## 5. Pure poker domain: betting and settlement

- [x] Implement hand start, per-street state, legal fold/check/call/bet/raise/all-in actions and turn progression.
- [x] Implement full/short raise tracking and raise-reopen rules.
- [x] Implement early win, automatic runout and showdown transition.
- [x] Implement main pots, side pots, unmatched-contribution return, winner determination and odd-chip allocation.
- [x] Add unit tests for legal-action edge cases, all-in sequences, side pots, folded contributors, ties and chip conservation.

## 6. Realtime coordination

- [x] Replace the empty gateway with authenticated cookie-based connection handling and one active control socket per member.
- [x] Implement command envelope validation, acknowledgement reasons, bounded idempotency cache and stale hand/turn rejection.
- [x] Implement recipient-filtered, versioned snapshot projection and initial/reconnect synchronization.
- [x] Implement turn, result-delay and disconnected-host timers.
- [ ] Route Socket.IO commands and timer callbacks through the room queue.
- [x] Implement disconnect/reconnect, timeout auto-action, sit-out-after-timeout and host disconnect expiry.
- [x] Add multi-client integration tests for private-card isolation, duplicate/stale commands, reconnect, timeout and host expiry.

## 7. Frontend room access and table state

- [x] Replace the bootstrap shell with Vietnamese create-room and join-room forms and accessible error states.
- [x] Add current-room restoration, same-origin API client and Socket.IO lifecycle client.
- [x] Add Zustand stores for recipient snapshot, request state and local privacy/display preferences.
- [x] Render room waiting/admin controls and explain the RAM-only lifecycle.
- [x] Add component tests for access forms, validation and host/non-host control visibility.

## 8. Frontend poker experience

- [x] Build the responsive table view with seats, board, button, blinds, stacks, bets, pot, actor and deadline.
- [x] Add action panel that derives enabled actions and valid raise amounts from the server snapshot.
- [x] Add card privacy on initial display, toggle and browser visibility/focus changes.
- [x] Add current-hand/ranking help and showdown result explanation without odds or action advice.
- [x] Add confirmed-state card/chip animations and reduced-motion support.
- [x] Add component tests for privacy, legal controls, hand help and landscape/portrait behavior.

## 9. End-to-end verification and review

- [ ] Add Playwright multi-context scenarios for create/join/grant/play/showdown/next hand.
- [ ] Add Playwright scenarios for reconnect/reload, host controls, timeout behavior and mobile landscape UI.
- [ ] Run `npm ci`, format check, lint, typecheck, unit/integration tests, build and E2E.
- [x] Run production dependency audit and API startup/health verification.
- [ ] Validate Docker Compose build/routing when Docker daemon is available; record any environment blocker.
- [ ] Review implementation against all six living specs, security boundaries and this change's acceptance criteria.

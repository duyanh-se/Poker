# Design: implement-private-poker-table

## Context and Constraints

The approved product is a single-process, RAM-only private Texas Hold'em table. The existing NestJS application owns HTTP health and an empty Socket.IO namespace; the existing Next.js application is only a shell. PostgreSQL, Prisma, Redis, persistence, paid services and background workers remain out of scope.

## Architecture

The API process owns every mutable room object. A `RoomRegistry` maps a non-secret room code to a room aggregate and maps opaque guest-session ids to room membership. Each room has a serialized command queue: HTTP mutations, socket commands and timer callbacks enqueue work and publish snapshots only after one complete transition. There is no distributed lock because there is one API process.

```text
Browser
  | HTTP: create room, join room, restore session
  v
NestJS controllers ---- RoomRegistry ---- Room aggregate ---- Poker domain
  ^                         |                    |
  | Socket.IO commands      |                    +-- timers: turn, result, host reconnect
  +-------------------------+
                 filtered table snapshot
```

The pure poker domain accepts validated room/hand state and returns an immutable next state plus settlement information. It has no dependency on NestJS, Socket.IO, cookies, timers or React.

## Backend Modules

| Module           | Responsibility                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session-access` | Guest cookie lifecycle, room-code/password verification, display-name normalization, membership lookup and HTTP create/join/restore DTOs.                 |
| `rooms`          | In-memory registry, seats, fixed configuration, host lifecycle, pause, leave, kick, transfer and room closure.                                            |
| `chips`          | Host grants, pending grants, safe-integer validation and stack reconciliation.                                                                            |
| `poker`          | Cards, cryptographic shuffle, positions, forced contributions, legal actions, betting rounds, hand ranking, pots and settlement.                          |
| `realtime`       | Gateway authentication, connection replacement, command ids, snapshots, deadlines, disconnect/reconnect and server timers.                                |
| `contracts`      | Public HTTP/socket request types and recipient-safe snapshot types only. It must never define undealt cards or another player's unrevealed private cards. |

`AppModule` composes these modules. Existing health remains independent.

## Data Ownership and Lifetime

- The API exclusively creates deck order, hand ids, turn ids, deadlines, stacks, contributions and legal actions.
- A room retains its password hash, never its plaintext password after creation response serialization.
- Session records retain an opaque id, room membership and member id only for as long as their room exists.
- Client state holds the latest filtered snapshot, optimistic UI status and private display preferences. It cannot be trusted for game decisions.
- Room close and API process restart discard every record. No client payload reconstructs a hand.

## Access and Transport

### HTTP

HTTP endpoints are deliberately small:

- `POST /rooms` creates a room and creator membership.
- `POST /rooms/join` verifies a room code/password and creates a member session.
- `GET /rooms/current` restores the caller's current membership/snapshot, or reports that no active room remains.

All mutations validate DTOs through NestJS validation. The session cookie is set by HTTP responses and is never returned to frontend JavaScript. Room password is excluded from logs, URLs and subsequent snapshots. Swagger documents the HTTP lifecycle endpoints but no internal table state.

### Socket.IO

The `/game` namespace obtains session identity from the cookie handshake and rejects a missing, invalid or stale session. A new connection for the same room member replaces the old controlling socket.

Each command contains `commandId`. Game actions additionally contain the expected `handId` and `turnId`. The server responds with an acknowledgement containing either an accepted result or a stable reason code, and emits a monotonically versioned snapshot. A bounded per-member command-result cache handles retries; stale hand/turn checks remain authoritative after cache eviction.

Commands cover start, pause, resume, grant chips, kick, transfer host, close room, leave room, return from timeout and player betting actions. No command is registered until it has server-side membership, role and current-state validation.

## Room and Game State

A room contains fixed blinds/ante, up to nine seat-ordered members, host member id, lifecycle state, current hand, result summary and timers. A member has display name, normalized name, seat, active connection state, stack, pending grant, sit-out status and hand-specific status.

The hand state stores the deck internally, hole cards by member id, board, button, street, contributions, current wager, last full raise size, acting member, action requirements and fold/all-in flags. Snapshot projection removes internal deck and all private cards other than those due to the recipient or public at showdown.

Turn deadline is an absolute server timestamp. Timeout checks when no call is due and folds otherwise. A disconnect does not alter the deadline. The first timeout starts automatic check/fold for remaining turns and sets the member to sit out after settlement. A disconnected host gets a 180-second closure deadline; reconnect cancels it.

## Poker Rules

The implementation follows the approved `poker` specification exactly:

- 52 unique cards, random initial button, moving button, blinds before antes and the documented heads-up rule.
- No-Limit legal-action calculation, including min bet, full raises, short all-in raises and raise-reopen tracking.
- Automatic street completion when wagering is impossible, immediate award when one player remains and no extra bet into an uncontestable pot.
- Best five-card evaluator from seven cards, including wheel straight, board plays and kickers.
- Main/side pot derivation from total contributions, unmatched excess returns, ineligible folded contributors, odd chips left of button and public showdown disclosure only for non-folded players.

## Frontend

Next.js routes provide a Vietnamese home page with create/join forms and a room table route. A small API client uses same-origin credentials. A socket client connects only after a current room session exists.

Zustand stores the current table snapshot and transient request status. A separate local UI store holds card hiding, rule-help panel, action amount and reduced-motion preference. Countdown is calculated from snapshot deadline and local time; it is not a server state mutation. All actions remain disabled until the snapshot says they are legal.

The table renders semantic labels for seats, cards, chip stacks, blinds, button, pot, action deadline and result. CSS handles a desktop table and landscape-mobile layout; portrait presents a rotate hint while keeping create/join available. Card and chip transitions respond to confirmed snapshot changes and respect `prefers-reduced-motion`.

## Configuration and Dependency Changes

- Add `SESSION_COOKIE_NAME` with a non-secret default and validate it as a cookie-safe name.
- Add `ROOM_IDLE_TTL_SECONDS` only if an idle cleanup policy is required by the implementation; otherwise do not introduce it.
- Keep `PUBLIC_ORIGIN` as the exact allowed HTTP and Socket.IO origin. Production cookie security derives from `NODE_ENV`.
- Add `socket.io-client@4.8.1` to `apps/web` dependencies. No other new runtime dependency is necessary.

## Error Handling and Observability

HTTP returns stable validation, unauthenticated, forbidden, not-found and conflict responses without room secrets. Socket acknowledgements use stable error codes and the next filtered snapshot when relevant. Structured logs contain internal room/hand/member correlation ids and reasons but never room passwords, cookies, deck order or private cards.

Metrics remain in-process operational counters: room count, connected member count, accepted/rejected commands, timeout count and command duration. They do not record game history.

## Testing Strategy

- Jest unit tests cover card uniqueness, ranking, wheel/kicker/board tie, positions, blinds/antes, legal actions, short raises, all-in, main/side pots, unmatched returns, odd chips and chip conservation.
- Nest integration tests use HTTP and Socket.IO clients for room lifecycle, permissions, cookie reuse, private snapshot filtering, retries, stale actions, timers, disconnect and host closure.
- React Testing Library covers Vietnamese forms, legal action availability, privacy reset, hand help and reduced-motion behavior.
- Playwright uses isolated browser contexts to exercise create → join → grant → start → play → showdown → next hand, reconnect and desktop/landscape mobile flows.
- Verification includes lint, strict typecheck, build, complete test suite, production audit and Docker Compose routing when a daemon is available.

## Spec Coverage

The existing living specs under `openspec/specs/session-access`, `rooms`, `chips`, `poker`, `realtime` and `table-experience` already define the observable behavior for this change. No spec delta is proposed. The concrete transport names above are implementation contracts that must preserve those behaviors.

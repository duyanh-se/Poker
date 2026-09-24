# Change: add-liars-deck-game

## Approval

User approved the gameplay plan, selected life loss with host-configured starting lives, approved the revised 2.5D bar-style UI, and explicitly requested implementation. Implement this scope without another approval gate. Do not archive before acceptance.

## Purpose / Goals

Let private groups choose Poker or Bài nói dối when creating a room. Preserve existing Poker and RAM-only sessions. Add a complete 2–4-player bluffing match with 1–10 starting lives (default 3), server-authoritative cards/turns/challenges and host-confirmed rounds.

## Scope

Game selection, conditional configuration, engine, realtime commands, private snapshots, 2.5D wood/bar table, card fan, life counters, challenge/reveal/results, reconnect, testing and docs.

## Non-goals

No gambling, weapons, voice/video, character models, physics, persistence, new dependencies, new spectator joins mid-match or cross-room identity ban. No Poker rule changes.

## Compatibility

Missing gameType means Poker for existing create requests. New snapshots identify their game; original Poker payloads remain accepted by the client. One room has one immutable game type. No database/migration.

## Risks / Assumptions

Existing room service combines Poker and room lifecycle; extract Poker behind a small facade rather than a plugin framework. Liar seats cap at 4; no cross-game command routing. Joining is locked for an entire active match so forfeiting cannot reset lives. Nicknames do not provide real-world identity. Host still controls rounds if eliminated.

## Acceptance

Both games can run concurrently; game-specific config validates and Swagger is usable. Challenges/timeouts subtract exactly one life, zero-life players cannot act, only host starts the next round/match. Browser reload restores correct game and private hand. UI supports 2–4 seats, desktop and landscape phone, reduced motion, concealment and clear public results. Regression tests, lint, typecheck/build and real browser checks reported accurately. Owned test servers cleaned up.

# Change: add-white-hat-game

## Approval

The user explicitly approved the complete gameplay and implementation plan and requested implementation on 2026-10-27. This change implements that approved scope; no further approval gate is required. Do not archive before human acceptance.

## Summary / Goals

Add Mũ Trắng as a third immutable room game for 4–12 players plus one non-playing moderator. The moderator supplies civilian/spy words, can override balanced role counts and sets K eliminations per round. Preserve Poker, Liars, private invitations, guest sessions and RAM-only storage.

## Proposed behavior

Server-authoritative sequential descriptions, private words without self-role labels, secret ballots published at close, one runoff then moderator tie resolution, simultaneous vote eliminations, white-hat guesses and faction victory. Eliminated roles remain hidden until match end, except voluntary white-hat revelations. A uniform 30-second last-guess window follows every vote batch to avoid revealing eliminated roles through timing.

## Compatibility / Non-goals

Omitted gameType remains Poker. No persistence, paid services, dependencies, semantic description judging, spectators joining active matches or unrelated refactors. Existing games retain their configuration and rules.

## Risks / Acceptance

Recipient-filtered snapshots must never expose moderator secrets or living role counts. Stale/repeated commands and timer callbacks cannot apply twice. Reconnect retains deadlines. All approved rule scenarios, browser flows, 320px layout and existing-game regressions must be verified with tests, lint, typecheck, build and format checks. Stop owned verification processes.

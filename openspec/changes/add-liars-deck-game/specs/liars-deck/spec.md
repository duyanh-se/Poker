# Liars Deck Requirements

## Requirement: Match and rounds

Rooms SHALL seat 2–4 players and set startingLives to an integer 1–10, default3, immutable after creation. Host starts each round. First start/new match resets all current members to starting lives. All participating living members must be connected to begin. Match roster is locked from first start through match completion. A 20-card deck contains 6A,6K,6Q,2JOKER; every living player gets5, undealt cards stay secret. Table rank is randomly A/K/Q; Joker always matches. First starter random; later starters rotate clockwise over living members.

## Requirement: Play and challenge

Only current actor SHALL play1–3 distinct cards owned by that actor, or challenge the latest claim by the preceding actor. Playing accepts that claim and replaces it. Public claim exposes author/count, not ranks. Empty hands are skipped, but the last claim remains challengeable. When only one nonempty hand remains it must challenge, not play.

### Scenario: Lie

Given latest played cards contain at least one non-target non-Joker
When the next actor challenges
Then reveal only that played group, subtract1 life from its author and end the round.

### Scenario: Truth

Given all latest played cards are target rank or Joker
When challenged
Then challenger loses1 life and round ends.

## Requirement: Loss, timeout and forfeit

Zero lives eliminates from match, but retains room membership/public viewing and any host role. Last living participant wins. Every active turn has180 seconds. At/after deadline actor loses1 life and round ends; reload/disconnect do not reset it. Between rounds host may kick or a member leave; active-match departure forfeits remaining lives and may end match. No new joins during active match, including between rounds. Host may transfer to a connected member between rounds. Host disconnect180 seconds or deliberate departure without transfer closes room. No chip/life grants. Timeout does not invent a play/challenge.

## Requirement: Privacy and integrity

Backend SHALL decide cards, legal actions, losses and results. Only viewer receives own cards; eliminated viewers do not receive live opponents' cards. Duplicate commands cannot double-decrement lives. Wrong game, foreign card, stale match/round/turn or unauthorized commands rejected. Result preserves reason/loser/disputed cards for explanation; no weapon mechanic.

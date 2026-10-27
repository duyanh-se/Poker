# Mũ Trắng Specification Delta

## ADDED Requirements

### Requirement: Preparation and roles

The system SHALL support 4–12 players plus one moderator who does not describe or vote. Automatic spy counts SHALL be 1 for 4–5, 2 for 6–8 and 3 for 9–12, with one white hat and remaining civilians. Moderator overrides SHALL retain at least one of each role and fewer spies than all other players combined. K SHALL be 1…N−1, default 1. Two distinct words and all participants connected SHALL be required to start. Configuration and words SHALL remain fixed throughout the match.

#### Scenario: Private distribution

Given a match starts, when a player receives state, then only their assigned word (or no word for a white hat) is sent, without a self-role label. Only the moderator receives the full assignment. Eliminated roles remain hidden until match end except revealed white hats.

### Requirement: Description and voluntary guesses

Living players SHALL describe once sequentially in 60 seconds each. Expiry skips without elimination. First-round order is shuffled and later starters rotate over survivors. The moderator SHALL open voting after discussion and start later rounds after intermission. Living white hats MAY guess during discussion or intermission. One guess per white hat; wrong eliminates immediately, correct ends the match with only that guesser winning. Comparison SHALL normalize Unicode/case/whitespace, preserve Vietnamese accents and reject synonyms.

### Requirement: Ballots and ties

Each living voter SHALL choose min(K, living−1) distinct other living players. Submitted ballots are immutable; voting/runoff lasts 60 seconds or ends early when all submit. Expiry abstains. Only submission status and own choices are visible until close; then publish totals and who voted for whom. A cutoff tie SHALL preserve clear selections and run one runoff among the tied group for remaining places; another tie SHALL be resolved by the moderator within that tied group. Eliminations SHALL apply simultaneously.

### Requirement: Last guesses and victory

Every vote elimination batch SHALL open the same 30-second window; only eliminated white hats may guess privately before publicly revealing themselves through submission. Wrong/expired guesses eliminate; first accepted correct guess wins. Faction victory SHALL wait until these rights expire. Civilians win when no spies or white hats remain, including dead civilians. Spies win with at least one spy and spies >= civilians plus white hats alive. If only white hats remain they SHALL receive a final 30-second guess window; failure awards civilians victory. All roles and both words SHALL be published on completion.

### Requirement: Integrity and lifecycle

Active matches SHALL prohibit joining, config edits, kicking and moderator transfer. Eliminated players may observe but cannot chat/describe/vote; only vote elimination grants a last guess. Living departure forfeits and cancels an unclosed ballot to discussion with the new roster. Reconnect SHALL restore recipient-filtered state without changing deadlines. Commands SHALL reject wrong game, wrong actor, stale IDs, expired deadlines and malformed input; accepted retries SHALL not apply twice. Moderator departure/closure or 180-second disconnect SHALL close the room. Transfer between matches SHALL clear prepared words. Restart discards all state.

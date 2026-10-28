# Mũ Trắng Rules Delta

## MODIFIED Requirements

### Requirement: Description validation

The system SHALL accept a description only from the current living actor and only if its normalized text contains 1–15 Unicode code points. Normalization SHALL apply NFKC, trim leading/trailing whitespace and collapse whitespace runs. Word setup and guess limits SHALL remain 1–80 code points.

The system SHALL reject a description whose entire normalized, case-insensitive text equals any previously accepted description in the same match, across all rounds and participants. It SHALL ignore skipped descriptions with null text. It SHALL reject a description containing any complete word token also present in the civilian word. Tokens SHALL be maximal Unicode letter/number sequences, separated by punctuation/whitespace; comparisons SHALL preserve Vietnamese accents. It SHALL NOT apply substring matching or spy-word token filtering.

#### Scenario: Unicode length boundary

Given the current actor submits normalized text of exactly 15 code points, when no other rule is violated, then the description is accepted. Given text of 16 code points or empty normalized text, when submitted, then it is rejected without adding history, changing actor or resetting the deadline.

#### Scenario: Duplicate from an earlier round

Given any participant described `Buổi sáng` in an earlier round, when the current actor submits `BUỔI   SÁNG`, then the description is rejected even if the original participant has been eliminated or departed. When a new match begins, then the old match's descriptions no longer reserve those phrases.

#### Scenario: Civilian tokens and boundaries

Given the civilian word is `cà phê`, when `CÀ!` or `phê sữa` is submitted, then the description is rejected with a message that does not identify the forbidden token or reveal the civilian word. When `cá` or `càng` is submitted, then this token rule does not reject it. Canonically equivalent Unicode forms SHALL compare equivalently.

#### Scenario: Rejected input may be corrected

Given an invalid description is rejected, when the same actor supplies a different valid description before the original deadline, then it may be accepted once. A retry of an accepted command SHALL NOT create another description.

### Requirement: Voluntary guesses throughout active play

A living white hat who has not guessed and has not departed SHALL be allowed to voluntarily reveal and guess in any active stage, including another player's description turn, voting, runoff and moderator tie resolution. Opening/cancelling confirmation SHALL NOT consume the guess or publish the role. An accepted guess SHALL reveal that white hat and consume their only guess. Correct comparison and exclusive first-correct-guesser victory SHALL retain the existing normalized, accent-preserving rules; an incorrect guess SHALL eliminate the guesser immediately.

#### Scenario: Guess during a description

Given a white hat is alive and has not guessed, when they confirm a correct guess during any description turn, then the match finishes immediately with that player as the sole winner. When they guess incorrectly during their own turn, then the next living actor receives the next turn. When another participant is acting, then that participant's turn and deadline are preserved unless the match ends or enters its final-only-white opportunity.

#### Scenario: Incorrect guess during voting or tie resolution

Given voting, runoff or moderator tie resolution is open, when a living white hat guesses incorrectly, then the unfinished voting operation and its tentative selections are cancelled, closed ballot history is retained, and the game returns to discussion with the updated living roster unless victory/final guessing resolves the match. The next ballot SHALL use the existing K rule capped to the new roster.

#### Scenario: Unauthorized or repeated guess

Given the caller is a civilian, spy, moderator, departed participant or white hat who already guessed, when they submit a guess, then the server rejects it without changing the match. A previously eliminated white hat SHALL only guess when specifically retaining a current vote-elimination last-guess right.

### Requirement: Conditional post-vote guessing and victory

After simultaneous vote eliminations, the system SHALL open a single server-timed 30-second window only if at least one non-departed white hat remains eligible: a living unguessed white hat or an unguessed white hat just eliminated by that vote batch. Both groups SHALL be able to guess during that window. With no eligible white hat, the system SHALL evaluate faction victory or enter intermission immediately without a last-guess timer.

The conditional presence of a window SHALL intentionally replace the previous uniform-window timing privacy rule. Individual unrevealed roles and live role counts SHALL remain filtered from public snapshots. Faction victory SHALL wait while eligible guesses remain. A correct guess SHALL end the match immediately; exhaustion of all rights SHALL resolve the window early. Reconnect SHALL preserve its absolute deadline.

#### Scenario: No remaining eligible white hat

Given all white hats already guessed, departed or lost an earlier last-guess right, when a vote batch is resolved, then no 30-second stage is created and the next observable state is the applicable faction result or intermission.

#### Scenario: Living white hat elects not to guess

Given the post-vote window contains a living white hat and other factions remain, when 30 seconds expire without that white hat guessing, then the player remains alive with their unused voluntary guess and the game evaluates victory or continues to intermission. A newly vote-eliminated white hat who did not guess SHALL lose their last-guess right at that deadline.

#### Scenario: Last-guess rights precede a spy victory

Given a vote batch would leave the spies at their winning threshold and includes an eligible white hat, when the vote closes, then faction victory waits for the guessing window. If an eligible white hat guesses correctly, then only that guesser wins. Otherwise, when rights end, then the normal faction result is applied.

#### Scenario: Only white hats survive a vote

Given only white hats survive and there are eligible guesses after a vote batch, when the window opens, then it is also the final-only-white opportunity. If no correct guess is accepted before that single deadline or all rights are exhausted, then civilians win under the existing rule, including previously eliminated civilians. The system SHALL NOT open a second consecutive 30-second window for the same vote batch.

#### Scenario: Player leaves during the window

Given one or more white hats have current rights, when one departs, then that participant's rights are revoked without extending the deadline or revoking other participants' rights. If no eligible right remains, then the window resolves immediately.

## ADDED Requirements

### Requirement: Moderator ends the current match early

Only the current moderator SHALL be able to end an active match early. The result SHALL be cancelled due to moderator action, with no winning faction and no winner members. The system SHALL publish roles and both words, clear action deadlines and guess rights, and reject later gameplay commands for that match. It SHALL retain the room, sessions, avatar choices and completed history until a new match starts. Preparing a subsequent match SHALL require saving a fresh word setup, as after normal completion.

#### Scenario: End while a last guess is pending

Given the match is in last-guess, when the moderator confirms ending it and the server accepts that command before a winning guess, then the result is cancelled, the pending guess deadline is removed, and a later guess or timeout cannot overwrite the cancellation. If a correct guess was accepted first, then the completed win is retained.

#### Scenario: Permission, retry and room reuse

Given a guest submits an end-match command, then it is rejected. Given an accepted moderator command is retried with the same commandId, then it has no second effect. Given the moderator configures fresh words after cancellation and the normal roster conditions hold, when starting a new match, then the same room and member sessions remain usable.

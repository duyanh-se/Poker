# Mũ Trắng Rooms and Realtime Delta

## ADDED Requirements

### Requirement: Self-selected room avatar

Each WhiteHat room member SHALL have a public avatar selection from the existing 12-character catalog, identified by an integer 0–11. Each authenticated member SHALL be able to change only their own selection while their room session remains valid, including lobby, active play, eliminated observation and finished states. Duplicate selections SHALL be allowed. The selection SHALL persist in room memory across reconnect, reload, subsequent matches and moderator transfer, and SHALL be discarded with the room or API restart.

#### Scenario: Selection is synchronized without changing gameplay

Given a valid member selects a catalog avatar, when the server accepts it, then all recipients receive that member's selected avatar in a newer snapshot. Current match/round/turn, deadline, description order and ballots SHALL remain unchanged. Board, chat, history and management views SHALL use that same selection.

#### Scenario: Invalid or unauthorized selection

Given a command contains a non-integer, out-of-range or malformed avatar identifier, or originates from a revoked/replaced controlling session/socket or another game, when it is submitted, then it is rejected without changing any avatar or gameplay state. A member SHALL NOT be able to target another member's avatar by supplying an identifier.

### Requirement: Current, authorized realtime mutations

Avatar selection and early ending SHALL use the existing session authorization, controlling-socket checks, commandId idempotency, room-version publication and recipient filtering. End-match SHALL additionally identify the active match, round and turn and require moderator authority. An expired action deadline alone SHALL NOT prevent ending an otherwise still-current active match. A stale match/stage command SHALL NOT end a later match/stage. Once finished, previously scheduled callbacks SHALL NOT modify the result.

#### Scenario: Retry after an accepted ending

Given an end-match command succeeded but its acknowledgement was lost, when it is retried, then the same room remains finished once and no state is discarded or recreated. When a stale timeout fires, then it does not resume the match or assign a winner.

## MODIFIED Requirements

### Requirement: Secret filtering remains recipient-specific

Description token filtering SHALL execute on the server and SHALL NOT add the civilian word or forbidden-token list to another recipient's snapshot. Public avatars SHALL NOT depend on role, word, guess eligibility or faction. Conditional post-vote timing may reveal the presence of an eligible white hat as requested, but SHALL NOT publish their identity or a live role count. Voluntary revelation and finished-match publication SHALL retain their explicitly public behavior.

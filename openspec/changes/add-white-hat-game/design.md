# Design: Mũ Trắng

Keep Nest/Next/Socket.IO/Zustand/npm and RAM-only rooms. Add a transport-independent WhiteHatEngine and a WhiteHatRoomService for room/session lifecycle and filtered snapshots. RoomService routes the third game; existing cookie and gateway publishing/timers are shared. No game-plugin framework.

## State and commands

Stages: lobby, description, discussion, voting, revote, tie-break, last-guess, intermission, finished. A fresh turnId identifies every description turn or stage; active commands identify matchId/roundId/turnId and carry the existing commandId. room:start starts a match; white-hat:configure sets pre-match words/config; describe, vote, guess, advance and resolve-tie handle gameplay. Authorize current controlling sockets, not client-supplied identities. Timer expiration is guarded by the same round/turn and absolute deadline.

## Privacy

Every room member appears in players for shared membership/chat; the moderator is marked separately and excluded from role counts and participation. The host alone receives moderator secrets. Players receive only own word (null for white hats), not own role. Public role appears only for a revealed white hat or after match end. Ballot targets are private until ballot closure. No public live-role counts. Always wait the complete 30-second post-vote window unless a correct guess ends the match. Words and text are 1–80 Unicode code points, normalized; compare guesses case-insensitively with collapsed whitespace and preserved accents.

## Lifecycle and UI

An active roster is locked. A living departure forfeits, cancels an unfinished ballot and returns to discussion; last-guess rights already granted to other players remain intact. Departed match entries remain for history but their session is revoked. Only between matches may members be kicked or moderator transferred; transfer clears prepared words. Host disconnect expiry remains 180 seconds.

The original dark-token/system-font visual direction is superseded by the explicitly approved `redesign-white-hat-secret-party` change (2026-10-27): independent bright game theme, neutral character art and local Nunito Sans. Session, server-anchored clock and dialog focus behavior remain shared. Conceal words on blur/offline and reset concealment between matches/viewers. Backend blocks eliminated chat while frontend presents read-only history. New match clears old gameplay history and prepared words are required again.

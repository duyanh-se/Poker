# Design

Keep Nest/Next/Socket.IO/Zustand/npm, no added dependencies. Existing Poker service remains authoritative for Poker; a room facade routes creation, sessions, administrative commands and timeout to either Poker or Liars room service. Liar engine handles deck/turn/challenge/lives independently of transport. Common cookie/controller/gateway infrastructure remains shared. No general-purpose game-plugin framework.

## Contracts

Create supports gameType poker (default) or liars-deck; Poker keeps smallBlind,bigBlind,ante; Liars accepts startingLives integer 1–10 default3. Reject mixed configuration. RoomSnapshot is a union of Poker TableSnapshot and LiarsTableSnapshot. Liars snapshots have match/round/turn IDs, target rank, life/card counts, viewer-only cards, latest claim count and public result. Card IDs opaque and unique. No undeclared card values in transport.

Commands liars:play and liars:challenge carry commandId,matchId,roundId,turnId; play carries cardIds. Existing room:start advances Liar lobby/round/finished-match according to state; room admin routes by session, never a client-specified game. Timer generation uses roundId or Poker handId plus turnId. Process each command synchronously before the next; retain existing deduplication and snapshot versions.

## UI

Client entry chooses game and hides irrelevant fields. A game dispatcher selects Poker or dedicated Liars view using the restored snapshot. Reuse session hook, invitation, accessible dialogs and networking state. Liars uses CSS/SVG 2.5D: dark bar backdrop, wood table, fixed seated perspective, face-down central pile, large target rank, avatar initials, hearts and bottom fan. No Three scene needed for Liars. Selected cards rise; confirmed play moves to pile; challenge reveals only disputed cards. Keep 1–3 selection, forced challenge, time remaining and elimination clear. Match/round boundaries clear selection. Hide private ranks on blur including accessibility labels. No asset downloads.

## Verification

Engine and service tests use deterministic setup to cover truth/lie/Joker, exhaustion and stale/duplicate actions. Integrate actual transport, reload and both game types. Playwright on isolated build output/ports so active developer servers need not stop. No physical-phone FPS claim.

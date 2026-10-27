# Rooms / Realtime / Chat Delta

## ADDED Requirements

Creation SHALL accept gameType white-hat with 12 player seats and one moderator. Mixed game configuration SHALL be rejected. Omitted gameType remains Poker. New room snapshots SHALL discriminate all three games; join and restore infer the game. White-hat deadlines SHALL be 60 seconds for descriptions/votes/runoffs and 30 seconds for last guesses, with no extension on reconnect. Shared chat SHALL reject eliminated white-hat participants during an active match, retaining read access and preserving chat behavior in Poker and Liars.

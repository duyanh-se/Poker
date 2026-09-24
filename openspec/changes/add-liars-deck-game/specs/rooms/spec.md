# Rooms Delta

## Added: Immutable game selection

Creation SHALL select poker or liars-deck. Omitted gameType is Poker for compatibility. Poker accepts its existing blind/ante config and max9; Liars accepts startingLives and max4. Mixed config/unknown game type rejected. Joining and restoration infer game from room; users do not choose it again. Active Liars match prohibits new joins; Poker late-join policy unchanged. Restart discards both game types.

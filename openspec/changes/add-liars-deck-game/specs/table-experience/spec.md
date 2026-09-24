# Table Experience Delta

## Added: Liars 2.5D bar table

The UI SHALL offer game cards at creation and show only relevant config. Liars uses dark wood, warm bar lighting, fixed perspective, avatar/lives/card counts, target rank and a private fan at bottom. It SHALL not show Poker chips/blinds/dealer markers. UI has select1–3, play count, challenge, forced-challenge explanation, result and host next-round/new-match controls.

### Scenario: Concealed fan

Given viewer has private cards
When concealed or browser loses focus
Then card ranks and accessible labels are concealed, without affecting public challenged cards.

### Scenario: Reconnect

Given viewer returns to a Liars room
When session is restored
Then show correct game, same hand/lives/deadline and no replay of missed motion.

### Scenario: Round result

Given a challenge is resolved
When result is shown
Then show disputed cards, which are invalid, loser/reason and remaining lives, waiting for host; reduced-motion preference suppresses decorative movement.

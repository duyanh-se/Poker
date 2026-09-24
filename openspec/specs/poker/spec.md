# Poker Specification

## Requirement: Texas Hold'em dealing and positions

Each hand SHALL use one shuffled 52-card deck without duplicates. Every participant receives two private cards, and shared cards are revealed as flop, turn and river. Undealt cards and another player's private cards SHALL never be disclosed.

The initial button is random. With three or more players, the button moves clockwise to the next eligible player. The next two eligible players post small and big blinds. Heads-up, the button posts the small blind and acts first pre-flop; the other player posts the big blind and acts first on later streets. Antes apply to every dealt player after blinds. A player unable to pay a required amount contributes its remaining stack and is all-in.

### Scenario: Heads-up pre-flop

Given exactly two eligible players
When a hand starts
Then the button posts the small blind and acts first pre-flop.

### Scenario: Short mandatory contribution

Given a participant lacks enough chips for blind and ante
When mandatory contributions are collected
Then the participant's stack does not become negative and the participant can win only pots funded by its contribution.

## Requirement: No-Limit betting

The system SHALL allow fold, check, call, bet, raise and all-in only when legal. Check requires no outstanding call. Call contributes the amount needed, or the caller's remaining stack. An ordinary opening bet is at least the big blind. A full raise increases the wager by at least the previous full raise size. Short all-in raises are allowed but do not reopen raising for players that already acted unless the cumulative increase they face reaches the applicable full-raise threshold. A player cannot wager more than its stack.

### Scenario: Too-small ordinary raise

Given the current wager is 100 and the last full raise increased it by 100
When a player with sufficient chips raises to 150
Then the system rejects the action and requires a total wager of at least 200.

### Scenario: Short all-in does not reopen betting

Given A has acted at a wager of 100 and B goes all-in to 150
When action returns to A without a further full raise
Then A may call or fold but may not raise.

### Scenario: Big blind option

Given all pre-flop participants only call the big blind
When action reaches the big blind
Then the big blind may check or raise.

## Requirement: Street completion and early finish

A street SHALL finish only after every non-folded, non-all-in player has met the current wager and required actions are complete. If one non-folded player remains, that player wins without showdown. If no legal betting decision remains, remaining shared cards shall be revealed and the hand shall settle.

### Scenario: All opponents fold

Given exactly one player remains non-folded
When the last fold occurs
Then the system awards the pot immediately and does not reveal the winner's private cards.

## Requirement: Hand ranking

The system SHALL choose each player's best five-card hand from up to seven known cards. Ranking is straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, pair and high card. Kickers break ties where applicable, suits never break ties, and ace may be low in A-2-3-4-5.

### Scenario: Playing the board

Given shared cards form the best five-card hand for multiple players
When no player can improve the hand
Then those players tie even if their private cards differ.

## Requirement: Pots and settlement

The system SHALL derive a main pot and side pots from contributions. Folded players remain contributors but cannot win. Unmatched excess contributions are returned before payout. Tied pots divide in one-chip units; leftover chips are awarded clockwise to tied winners starting at the first seat left of the button.

### Scenario: Side pot

Given A contributes 100 and B and C contribute 300 each
When the hand settles
Then the main pot is 300 and the 400-chip side pot is contested only by B and C.

### Scenario: Odd chip

Given a 101-chip pot has two tied winners
When the pot is distributed
Then each winner receives 50 and the first winner clockwise from the button receives the remaining chip.

## Requirement: Showdown disclosure

At showdown, the system SHALL reveal both private cards of every non-folded participant and identify each pot winner and winning hand. Folded cards remain hidden. The initial version does not offer voluntary show or muck.

### Scenario: Showdown

Given a hand reaches showdown
When settlement is displayed
Then all non-folded private cards and the result for each pot are visible.

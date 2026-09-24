## ADDED Requirements

### Requirement: Paced Poker hand

Dealing SHALL last 1800ms; ordinary action handoff 450ms; each new street 900ms. All-in runout SHALL reveal streets separately. Showdown SHALL reveal public cards for 600ms, announce winners for 800ms, apply payouts for 1000ms, then await host confirmation. Fold wins SHALL retain private cards and use 1200ms. No chip payout is applied twice; hidden future cards never enter snapshots. Administration SHALL remain unavailable through result transitions.

#### Scenario: All-in on preflop

- **When** betting obligations finish
- **Then** flop, turn and river are published separately before showdown and settlement.

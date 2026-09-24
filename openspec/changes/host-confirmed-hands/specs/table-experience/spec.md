## MODIFIED Requirements

### Requirement: Seat position markers are understandable

While a hand is active, the table MUST mark the dealer, small blind and big blind seats as `D`, `SB` and `BB` respectively.

#### Scenario: A hand begins

- **Given** the server has assigned positions for a hand
- **When** a player receives the table snapshot
- **Then** the table identifies the assigned D, SB and BB seats without inferring them in the browser.

## ADDED Requirements

### Requirement: Distinct Poker action effects

Approved follow-up on 2026-09-25: dealing SHALL send one card at a time clockwise, completing the first round before the second within the existing 1800ms. Private reveal/conceal SHALL flip table cards while conceal replaces private content immediately. Check SHALL show an authored finger tapping twice without chip motion. Fold SHALL show backs moving away and fading. All-in SHALL have a distinct ALL IN badge and chip accent. These effects also apply when the action closes a betting round; reduced motion suppresses decorative movement.

### Requirement: Readable shared rhythm

Both games SHALL show why controls are temporarily unavailable, animate only confirmed information and preserve usable controls/layout. Snapshot duplicates SHALL not replay effects; reconnect or tab restoration SHALL show the current stage without an animation backlog. Reduced motion SHALL preserve server timing using minimal visual motion. Blur SHALL conceal private cards and labels immediately, including animated layers.

#### Scenario: Slow or returning client

- **When** several transitions were missed
- **Then** the latest state appears immediately and only the remaining server interval is awaited.

# Design

Use existing Next/React/Tailwind/session state and native dialog Panel. Split card/seat/result primitives, turn controls and room panels from the table shell. Scoped .liar-shell CSS draws perspective wood with gradients. Inline authored SVG creates A/K/Q/Joker, back and life icons.
Keep shell keyed by room, controls keyed by match/round/turn so only selection resets. Deadlines use client clock after hydration, never fabricate 180 seconds. Session animate flag disables confirmed-state animation on restoration; CSS reduced-motion disables animation.
Layout: compact header, flexible stage and dock; local player bottom, clockwise rotated opponents mapped to top (2), upper left/right (3), left/top/right (4). Public result replaces central claim; no overlay covering controls.
Use existing server legalActions. Starting requires two eligible connected players, including resetting eliminated members for new matches. No optimistic life/card mutation. Dialog confirmation rechecks current phase, authority, connection and target before sending.
Result optionally adds loserDisplayName captured before removal, no private information. UI computes invalid revealed cards only using public tableRank.
No migrations, environment changes or dependencies. E2E uses existing isolated ports 3100/3101 and .next-e2e output; ignore that generated directory for lint.

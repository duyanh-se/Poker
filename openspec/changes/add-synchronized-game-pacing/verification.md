# Verification

Third 2026-09-25 follow-up: per-card clockwise deal timing in 2D/3D, concealed-back flip, authored finger double-tap, folded-back discard and distinct ALL IN marker. Poker transition metadata now preserves the triggering action even when it advances a street or ends the hand. No extra private data is sent.

Second 2026-09-25 visual follow-up: private cards on the 3D table flip locally on concealed-to-visible changes, independently of server dealing; 2D shows the same private cards at the local seat. Immediate conceal/reduced motion remain supported. Hand explanations name the actual combination cards in Vietnamese and separate pair/trips/quads/two-pair kickers. Added pair/two-pair/straight explanation assertions and extended DOM privacy coverage.

Follow-up requested 2026-09-25: private-card reveal uses a 320ms flip, conceal remains immediate; Check uses a tap label without chip movement in 2D/3D. Private hand name/details have larger responsive typography. This is a visual correction within the approved experience scope.

Follow-up verification: 32 web tests, lint, web typecheck/build and focused formatting passed. Poker E2E: 18/19 passed initially; the two-seat desktop WebGL-loss simulation timed out waiting for a canvas that had disappeared. Its isolated rerun passed. Test ports 3100/3101 were confirmed free afterward; physical-device animation quality remains unverified.

Implemented approved server-owned pacing and frontend effects. Change remains unarchived for human acceptance.

## Checks

- Full `npm run test`: 66 API tests and 32 web tests passed. Subsequently added three deterministic A/K/Joker cases; focused Liar suite passed 10/10 (69 API cases in total).
- `npm run lint` and `npm run typecheck`: passed.
- `npm run build`: passed after fixing API's type-only contracts import and adding contracts prebuild/pretypecheck/pretest. No new dependency.
- `npm run format:check`: passed.
- Final `npm run test:e2e`: 31/31 passed against rebuilt backend, including matching transition IDs across two clients, reload during deal, staged challenge privacy, and Poker 2D/3D regressions.
- Inspected live Poker dealing screenshot and landscape Liar layout. Automated viewport coverage: 1440×900, 844×390, 667×375.
- No listeners remain on verification ports 3100/3101. User development servers were preserved.

## Review

Transition callbacks are guarded by ID and end time; new turns receive 180 seconds after transitions. Reveal/verdict/payout happen separately, premature commands are blocked, and results await host confirmation. Unit coverage checks runout, no lone betting, chip conservation, stale callbacks, disclosure timing, timeout, forfeit and exactly-once penalties. Client tests cover server-time anchoring, restored-stage suppression, reduced motion and privacy. Native dialogs keep focus behavior with a short exit transition.

No database, migrations, sound, external services or runtime dependencies added. An accidentally emitted contracts source JavaScript file from the failed build was removed; TypeScript source was preserved.

## Limits

Browser verification uses Chromium and emulated viewports, not physical mobile/GPU performance measurements. Screenshots verify layout, not subjective animation quality. Existing short-screen vertical scrolling remains possible with expanded results or connection notices. Final visual acceptance remains with the user.

# Verification — 2026-09-24

## Executed

- Approved dependency installation succeeded; pinned Three 0.180.0, Fiber 9.3.0 and Three types 0.180.0. npm warned that workstation Node 22.20.0 differs from project Node 24.
- API Jest: 52 tests passed, including real transport/integration; process exits after shutdown timer cleanup.
- Web Vitest: 19 tests passed (entry, admin permissions, wager bounds, privacy, restored invitation, duplicate and timed-out command handling, public hand comparison).
- Root lint and all workspace typechecks passed.
- API, contracts and Next production builds passed. Next build checks TypeScript again.
- Prettier check passed for changed frontend, contracts, E2E, change documents and README.
- Playwright: 21 tests passed: health, shell, two real browser sessions, host reload/invitation, grants, fold settlement and host-confirmed next hand; 2/6/9 seats at 1440x900, 844x390, 667x375 in WebGL and forced 2D fallback; context-loss fallback. Tests assert seat rectangles do not overlap and no horizontal overflow.
- Inspected generated desktop/mobile screenshots. Small-screen community cards use crisp DOM overlays over the 3D table; desktop uses 3D faces. This is a readability adaptation, not a game-state change.
- Production dependency audit reported zero vulnerabilities. Full dependency install reported two development dependency findings; no unrelated dependency upgrade was applied.

## Limits / acceptance

Chromium viewport emulation is not physical-phone GPU testing. No FPS guarantee or claim of Safari/Firefox device verification. Layout fixtures intercept the current-room snapshot; actual transport is separately exercised by the two-browser test. No VPS deployment or external CI run was performed. No database/migration is applicable.

Core privacy and host-confirmed-hand behavior remain unchanged. Public-hand calculation is presentation only, operates on already revealed cards and never decides payouts. Existing backend namespace replacement lookup was fixed as required for reliable reload; shutdown no longer schedules timers after destruction.

Assets are generated in code; no third-party image license or user-provided asset is required. Change remains unarchived for user visual acceptance. Test servers use isolated 3100/3101 and are stopped by Playwright; a pre-existing API on 3001 is not owned by this verification.

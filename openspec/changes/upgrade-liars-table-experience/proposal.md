# Upgrade Liars Table Experience

## Approval

The user explicitly approved and requested implementation of the 2.5D UI/UX plan. Normal change; no further implementation approval needed.

## Purpose

Complete missing table styles and make the private bluffing game understandable on desktop and landscape phones.

## Goals

Warm wooden bar table; readable 2–4 seats; private SVG fan; explicit selection, challenge, waiting, elimination and result states; accessible invitation/help/admin dialogs.

## Non-goals

No audio, new dependencies, WebGL, changed game rules, persistent data, strategy advice or copied assets.

## Compatibility

Keep commands and session hook. Add optional public loserDisplayName to result for departed members only. Poker unaffected.

## Risks

Small landscape screens, accidental private-card leakage, animation replay after reconnect and stale confirmation actions require regression checks.

## Acceptance

2/3/4 seats at 1440x900, 844x390 and 667x375; 44px controls; accurate results; masked invitation; keyboard dialogs; no remount on turn changes; tests/lint/typecheck/build and browser visual review. Leave unarchived.

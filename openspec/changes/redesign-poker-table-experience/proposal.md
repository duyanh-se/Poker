# Change: redesign-poker-table-experience

## Approval

Approved by the user's explicit “PLEASE IMPLEMENT THIS PLAN” instruction. Implementation follows that plan; no further approval is required for the listed scope. Do not archive before acceptance.

## Summary / Purpose

Replace the text-heavy table with a modern casino 3D table and readable Vietnamese HTML controls. Cover entry, restoration, play, administration, results and help.

## Goals

Fixed perspective camera, own seat at bottom, readable cards/chips/D/SB/BB, landscape mobile and desktop, accessible actions, safe reconnection and privacy.

## Non-goals

No rule changes, odds, coaching, persistence, payments, avatars uploaded by users, free camera, physics or casino room environment.

## Compatibility / Scope

Preserve existing HTTP and Socket.IO commands and host-confirmed hands. Reconcile shared snapshot types to existing payloads. Add only Three.js, React Three Fiber 9 and Three types. Procedural assets require no paid service.

## Risks

GPU support and nine-seat mobile crowding require a playable 2D fallback and browser checks. Existing tests do not prove visual fidelity. Node on this workstation is 22 whereas the project targets 24; report this verification limitation.

## Acceptance

- Table, cards, chips and position discs have depth and readable labels.
- Entry, restoration, legal actions, admin, results and help work in Vietnamese.
- No secret cards leak, no duplicate command while pending, no optimistic game mutations.
- Every hand remains host-confirmed; administration remains between hands.
- Tests, lint, typecheck, build and real browser smoke are reported accurately; verification servers cleaned up.

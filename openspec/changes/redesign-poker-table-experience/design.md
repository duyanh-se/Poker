# Design

Use existing Next/React/Tailwind/Zustand with a client-only React Three Fiber scene. Keep authoritative game state in Nest. HTML controls and labels overlay a fixed camera scene; viewer-relative seat coordinates preserve clockwise order. Procedural meshes and SVG/canvas textures provide cards, limited chip stacks and markers. No remote assets.

Separate transport/restoration hook, entry forms, table controls/panels, card presentation and scene. Shared contracts describe actual public snapshots, never the deck. Backend behavior remains unchanged except correcting a namespace socket lookup required for reload/replacement connections.

SSR renders deterministic loading UI; sessionStorage and WebGL are accessed after mount. Restore invitation only for the matching room and current host. A pending ref blocks duplicate clicks. Ack timeout triggers resynchronization, never replay. Disconnected controls are disabled.

3D fallback preserves HTML controls and public card presentation. Cap DPR, reuse resources, render on demand, respect reduced motion and tab visibility. Camera is fixed, no physics/postprocessing. Mobile uses compact seat labels and overlay panels, desktop uses side panel. Dialogs trap focus and restore trigger focus.

Tests cover privacy, rights, legal wager input, restore, pending, fallback and real transport. E2E uses isolated ports and closes owned processes. No database, migration or deployment architecture changes.

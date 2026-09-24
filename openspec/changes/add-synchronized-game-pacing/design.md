# Design

Add a shared public GameTransition contract with id, kind, startedAt, endsAt and optional actor/action information, plus serverTime on snapshots. A room owns an internal transition continuation. advanceTransition(roomCode, id) is time-checked and idempotent; it clears the old continuation before applying the next step. Gateway schedules the current transition or turn timer, publishes each stage and cancels timers at room closure/shutdown.

During a transition actingMemberId/turnId/deadline and legal actions are absent. New turns receive Date.now()+180000 only after transition completion. Administration/start remain blocked throughout settlement. Commands cannot skip time. Stage callbacks are never supplied by clients.

Poker: deal -> turn; action -> turn, or street reveal -> turn/runout. Runout opens one street per 900ms. Showdown publishes cards for 600ms, winners for 800ms, credits chips for 1000ms, then waiting. Fold win stays private and holds 1200ms. Bài nói dối: challenge announcement 450ms, reveal 750ms, verdict 600ms, life update 600ms, then waiting; timeout/forfeit 1200ms. No result is precomputed into public payload before its stage.

Frontend uses a shared timeline based on serverTime and transition identity. It renders current snapshots, never queues old snapshots. Reconnection, hidden tabs and reduced motion suppress replay. CSS/SVG and existing Three scene share durations; blur conceals private information immediately. UI provides a transition label and keeps controls disabled until server permission. No new API endpoints or persistent data.

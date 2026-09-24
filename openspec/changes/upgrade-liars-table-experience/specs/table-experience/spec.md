# Added requirements

## Readable bar table

The interface SHALL show Vietnamese target rank, Joker rule, current actor/deadline, role, connection, exact lives and card counts for 2–4 seats. Local player stays below. Controls SHALL remain visible at desktop and landscape mobile sizes and offer 44px targets.

## Private selection

Given concealed cards or blur, when the hand renders, then private ranks are absent from content and accessible names.
Given a legal turn, when 1–3 cards are selected, then the count, clear-selection control and declared target are explicit; duplicate/offline actions are disabled.
Given a new turn, when the snapshot changes, then selection resets without closing unrelated dialogs.

## Public result

Given a challenge result, when shown, then only disputed public cards are revealed and labeled valid/invalid; loser, remaining lives and elimination are explained.
Given forfeit, then explain loss of all remaining lives, not one life; preserve departed display name.
Given a completed round, then wait for host confirmation and leave next-round control unobstructed.

## Dialogs and safety

Invitation SHALL mask password initially and on reopening, provide copy feedback and use only the currently authorized invitation.
Management SHALL require confirmation for destructive/ownership changes and disable commands while offline/pending or no longer authorized.
Dialogs SHALL support Escape, focus containment and focus restoration.

## Motion

Confirmed play/reveal/life changes SHALL animate for 150–400ms without delaying state. Restoration SHALL not replay animation. Reduced-motion SHALL suppress it. No audio.

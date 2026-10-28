# Mũ Trắng Table Experience Delta

## MODIFIED Requirements

### Requirement: Desktop gameplay fits one screen

At desktop viewport sizes 1280×720, 1366×768, 1440×900 and 1920×1080 at 100% zoom, the WhiteHat main screen SHALL fit without horizontal or vertical document scrolling and without clipped controls or characters. It SHALL support 4–12 players plus the moderator and 24-character participant names across lobby/default setup, description, discussion, voting, runoff, tie resolution, last guessing, intermission and finished states. Chat, complete history, long moderator details and room management MAY use explicitly opened panels with internal scrolling. Smaller screens and increased zoom SHALL retain usable responsive scrolling rather than hide content.

#### Scenario: Twelve-player vote on a laptop

Given twelve players and long names at 1280×720, when voting opens, then every candidate card, its current/latest clue and the centered selection counter/submit button are within the visible main screen without scrolling. Selecting a candidate SHALL remain possible without dismissing a modal covering the board. Desktop verification SHALL assert real element bounds and document dimensions without scrolling controls into view.

#### Scenario: Long auxiliary content

Given many chat messages or completed rounds, when the user opens chat/history, then the panel contains the long content without growing the main document. It SHALL support keyboard navigation, visible focus, Escape to close and focus return. Opening or closing it SHALL NOT reset drafts, gameplay selection, a deadline or a room session.

### Requirement: Centered contextual actions

When a viewer can describe, vote, resolve a tie or guess, the relevant controls SHALL be visually prominent in the center gameplay area. The moderator's applicable stage controls SHALL use the same central hierarchy. Controls SHALL reflect recipient legalActions, pending and connection state. Guess availability SHALL NOT require waiting for discussion/intermission if the server grants it earlier.

#### Scenario: Simultaneous stage and guess permissions

Given a white hat can both describe/vote and guess, when the screen renders, then the normal stage action remains usable and a clearly visible central reveal-and-guess control opens a focused guess form/confirmation. Opening or cancelling it SHALL NOT reveal the role or consume a guess. A stale confirmation SHALL NOT apply to a changed stage.

### Requirement: Prominent description on player cards

The most recent accepted description from each player in the current match SHALL be rendered prominently with readable contrast and emphasis relative to avatar decoration. It SHALL remain visible during vote/runoff and when its player is eliminated. A description from an earlier round SHALL identify that round. Skipped turns SHALL be labelled distinctly; full history SHALL remain accessible. The display SHALL NOT obscure selection controls, names or public status.

#### Scenario: Compare clues while voting

Given the viewer is selecting a ballot, when they inspect candidate cards, then their descriptions are directly readable without opening history, hovering or scrolling the desktop main screen. Previously hidden role/word information SHALL NOT be exposed through styling or labels.

## ADDED Requirements

### Requirement: Description input feedback

The description form SHALL show a 15-character limit and Unicode-aware counter, provide inline feedback for length or public-history duplicates, and surface server rejection without losing the user's ability to correct and resubmit before the same deadline. Secret token validation SHALL not require disclosing the civilian word to the client. All input and gameplay controls SHALL remain keyboard accessible, and offline/pending state SHALL prevent conflicting submission.

### Requirement: Avatar chooser

A room member SHALL be able to open a clearly labelled character chooser for themselves, inspect the 12 available avatars, identify the current selection and confirm a new one. Selection controls SHALL have accessible names and a visible focus/selected state. Choosing a character SHALL be distinct from selecting a player for a ballot. The choice SHALL be reflected consistently after server acceptance and reconnect.

### Requirement: Confirm and present early ending

During an active match the moderator SHALL see a distinct “Kết thúc ván” control. It SHALL open a confirmation stating that no faction wins, roles/words are published and the room remains available. Cancellation of the confirmation SHALL send no command. The accepted cancelled result SHALL use neutral messaging without winner text or victory/confetti animation. “Đóng phòng” SHALL remain a separate action with its existing room-deletion meaning.

### Requirement: Preserve the established visual system and access

The change SHALL retain Secret Party colors, local font/character assets, private-word concealment on blur/offline, recipient filtering, keyboard focus, reduced motion, input sizes of at least 16px and interactive targets of at least 44px. Mobile 320/390/430px SHALL remain playable without horizontal overflow or controls obscuring the focused input. Poker and Liars SHALL retain their current presentation and behavior.

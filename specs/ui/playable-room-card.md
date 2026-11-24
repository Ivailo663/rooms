# Playable room card (player browse)

Code: `client/src/features/rooms/player/` (`PlayableRooms.vue`,
`PlayableRoomCard.vue`, `SlotCarousel.vue`, `SlotRoster.vue`,
`SlotAvatars.vue`). E2E: [client/e2e/playable-room-card.spec.ts](../../client/e2e/playable-room-card.spec.ts).

Status: in progress on `rooms-restructure-and-mobile-pass`.

## Layout

- **CARD-01** The header is stacked: title and address, then description.
  Features and price aren't in the header, because they belong to a slot, not
  the room. Features are on each slot's tile (CARD-11) and the price is in the
  tile's action line (CARD-31).
- **CARD-02** Room cards are a fixed height, one per screen, and the deck
  scrolls vertically. There is no footer bar: the slot picker fills the card
  down to its bottom padding, and empty space in the tiles on tall phones is
  accepted. (A content-fit card was tried and
  rejected.)
- **CARD-03** The "You're in" / "Requested" pill is small and centred on the
  card's top edge, half outside it. It isn't clipped when a card snaps into
  view. "You're in" wins when both apply.
- **CARD-04** Nothing has a dark fill, and the slot tiles have no hue of their
  own. The centred tile is a plain white card with a hairline border and a
  soft shadow; there is no glass, 3D or tilt effect. Colour on a tile appears
  only as signals: the seat bar and spots-left text (CARD-15, CARD-19), the
  joined/pending dot, the red leave line (CARD-34) and the current user's
  avatar.
- **CARD-05** The header adapts in steps to the card's own height, not the
  screen's. Roomy: everything. Compact: the description is cut to one line.
  Tight: no description and no slot message.
- **CARD-06** The header and slot picker never overlap, and the picker never
  runs past the card's bottom padding, at any card height the deck can
  produce.
- **CARD-07** The card's background has texture around the slot tiles. Its
  top-edge tint (faint indigo, emerald once the user holds a seat here) covers
  the whole card and is strongest low down, behind the picker.

## Slot picker (SlotCarousel)

- **CARD-10** It's a cover-flow of large tiles. The current tile is centred,
  larger and in front. At most 3 tiles are visible, and a neighbour peeks in
  only if it exists. Every tile is a perfect square: its side is the smaller
  of 86% of the picker's width and the picker's height, and it sits centred
  vertically in the picker. Neighbour tiles are a flatter version of the same
  white card with a hairline border, so they read as cards behind the current
  one, not grey blocks.
- **CARD-11** Each tile shows its slot's time, centred horizontally and
  vertically in the space above the roster. That slot's features sit in the
  tile's top-right corner as icons only, side by side, each still named for
  screen readers. When they don't fit on one line, they wrap onto the next
  line, left-aligned. Below the time is the slot's roster: count, seat bar
  (CARD-15), overlapping circle avatars (the current user first, in emerald),
  and a "+N" overflow, then the action line (CARD-31). The tiles fill the
  space between the header and the card's bottom, and there's no separate
  roster block.
- **CARD-12** A horizontal swipe, a tap on a neighbour, or the arrow keys
  (while the picker has focus) switch slots. The slot on screen is the
  selected one, marked with `aria-current`. Neighbour tiles are plain
  containers: tapping one slides it to the centre. The centred tile is a
  button only while it has an action (CARD-33, CARD-34), and it acts on a
  hold, never a tap. A tap on an avatar inside a tile opens the details card
  (CARD-24), never slides the tile and never starts a hold.
- **CARD-13** Horizontal swiping in the picker doesn't trigger the app-wide
  drawer swipe, and vertical scrolling of the deck still works.
- **CARD-14** On load, the selection is the user's joined slot, else their
  pending one, else the first slot.
- **CARD-15** A slot shows a dot in the tile's top-left corner for joined
  (emerald) or pending (amber). How
  full it is shows as a seat bar: one segment per seat, filled for a taken
  seat and empty for an open one. Above 14 seats it's one continuous bar
  instead. A full slot's bar is grey.
- **CARD-16** There are no arrows, no counter, no progress rail and no
  "Available slots" header.
- **CARD-17** Tiles adapt in steps to their own size (the square's side,
  CARD-10), not the screen's. That height depends on the header too, such
  as a long description. Roomy: everything. Compact: smaller time, tighter
  padding, smaller avatars. Tight: at most 3 avatars, then "+N".
- **CARD-18** A tile's content is never clipped and never scrolls vertically,
  at any height the card can have.
- **CARD-19** The "spots left" text is emerald with 3 or more spots left,
  amber with 1 or 2, and grey when the squad is full.

## Roster (SlotRoster + SlotAvatars, shared with MyGameHub)

- **CARD-20** The avatar row (`SlotAvatars`) is shared by the slot picker
  tiles, the My games roster (`SlotRoster`) and the host's players widget, and
  the avatars look and behave the same in all three. What surrounds the row is
  each surface's own. The roster is one flat section, with no panel, no flip
  and no teams view.
- **CARD-21** In a slot picker tile the count reads "N / M players"; in the My
  games roster the header reads "Roster". Both have "N spots left" or "Full
  squad" on the right ([spotsLeft.ts](../../client/src/features/rooms/composables/spotsLeft.ts)).
  Screen readers hear the tile's count as "N of M players".
- **CARD-22** The avatar row draws one circle per joined player and nothing for
  an open seat. The current user comes first, in emerald. When the avatars
  don't fit, the row ends with a "+N" circle.
- **CARD-23** Each avatar has an `aria-label` with the player's name ("You" for
  the current user). There's no `title` tooltip, because the details card
  (CARD-24) replaces it.
- **CARD-24** Each player avatar is a button that opens that player's details
  card, in the slot picker tiles and in the My games roster alike. It
  behaves the same as in the host's players widget
  ([PROF-01..05](../player-profile.md)). The "+N" circle isn't a button.
- **CARD-25** In the My games roster, open seats are drawn after the avatars as
  dashed rings, one per seat however many there are. A ring is an avatar's
  diameter and overlaps its neighbour by the same quarter of that diameter, and
  carries the same white halo, so taken and open seats stack into one unbroken
  strip rather than reading as two kinds of thing set apart. A full squad draws
  none. How full the game is reads from the strip and CARD-21's label, and
  there is no progress bar. A game with one player and eleven gaps is the case
  this has to serve best, not an edge case.
- **CARD-26** The rings never cost the roster an avatar. They wrap onto further
  lines when the row runs out, and a squad too wide to share a line with them
  keeps the line to itself and folds to "+N" exactly as it would alone. Who is
  in outranks how many gaps are left, which the label states anyway. Every line
  starts at the same left edge, the first and the wrapped ones alike, flush with
  the "Roster" header above: the strip is a block of seats, not a ragged one.
- **CARD-27** The rings aren't buttons and carry no label: the seat count
  reaches a screen reader through CARD-21 alone, so they never repeat it. The
  slot picker tiles are unaffected — they keep the seat bar (CARD-15) and draw
  no open-seat rings.

## Slot action (in the tile; MyGameHub keeps a footer)

- **CARD-30** Whether the player can join comes from `getSlotJoinability`
  ([MEM-03..08](../membership.md)), and whether they can leave comes from
  `getSlotLeavability` ([MEM-12](../membership.md)).
- **CARD-31** The card has no footer bar. The centred tile's last line says
  what holding it does: "Hold to join · 5€" (the price only when the slot has
  one), or "Hold to leave" in red. While the tile is actionable the words
  carry a slow light sweep; with reduced motion they don't. Side tiles keep
  the line's space but don't show it, so every tile lays out alike.
- **CARD-32** Only joining and leaving are actions. Every other state is the
  same line as text with an icon, and the tile isn't pressable: "Awaiting
  approval" (amber), "Not accepted" (grey, with the host's denial message
  under the picker when there is one), the reason the player can't join, and
  the reason they can't leave.
- **CARD-33** The player joins by pressing and holding the centred tile for
  1 s. Over the hold a faint neutral shade rises inside the tile, behind its
  content; the tile itself doesn't move. Letting go early cancels with nothing sent, and the line reads
  "Keep holding…" for a moment. A sideways swipe of more than 8px cancels; a
  smaller shift (the browser nudging the strip as the tile takes focus)
  doesn't. While the join is in flight the line shows a spinner and
  "Joining…".
- **CARD-34** Leaving works the same way: hold the centred tile for 1 s,
  early release cancels with "Keep holding…", and "Leaving…" shows while it's
  in flight. For both actions, mouse, touch and keyboard (holding Enter or
  Space on the focused tile) all work, a long press never opens the browser's
  context menu or selects text, and assistive tech hears "Press and hold for
  one second to join" (or "to leave") with no separate confirm step.
- **CARD-35** MyGameHub keeps its own footer for leaving (the hub has no
  slot tile to hold). It uses the same states as CARD-32 and the same 1 s
  hold-to-leave on red text.
- **CARD-36** In MyGameHub, the leave action or its status sits alone and
  centred under the roster, with no slot facts beside it, because the hub
  already shows them in large type. The way back to the deck ("More") sits in
  the card's top-right corner and carries no "N/M players" count, which the
  roster header already shows.
- **CARD-37** The hub's status pill ("You're in", "Game off") straddles the
  card's top edge exactly as CARD-03's does, and nothing clips it: the card
  keeps its own clipping for the rounded glow, so the pill hangs outside the
  card rather than inside it, and the hub reserves that overhang at the top of
  its own space so a full-height card can't push the pill under the view's
  edge. Raising it by z-index alone doesn't count — a clip isn't a stacking
  question.

## Out of scope for this pass

- A min-player / "will it run" indicator (it needs `min_players` in the
  playable feed).
- Removing player emails from the playable payload.

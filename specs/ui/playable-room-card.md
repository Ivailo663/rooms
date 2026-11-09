# Playable room card (player browse)

Code: `client/src/features/rooms/player/` (`PlayableRooms.vue`,
`PlayableRoomCard.vue`, `SlotCarousel.vue`, `SlotRoster.vue`,
`SlotAvatars.vue`). E2E: [client/e2e/playable-room-card.spec.ts](../../client/e2e/playable-room-card.spec.ts).

Status: in progress on `rooms-restructure-and-mobile-pass`.

## Layout

- **CARD-01** The header is stacked: title, then description, then features with
  the price, each on its own line.
- **CARD-02** Room cards are a fixed height, one per screen, and the deck
  scrolls vertically. The Join button is pinned to the bottom, and empty space
  above it on tall phones is accepted. (A content-fit card was tried and
  rejected.)
- **CARD-03** The "You're in" / "Requested" pill is small and centred on the
  card's top edge, half outside it. It isn't clipped when a card snaps into
  view. "You're in" wins when both apply.
- **CARD-04** Nothing has a dark fill. The selected slot uses a light emerald
  tint with an emerald outline.

## Slot picker (SlotCarousel)

- **CARD-10** It's a cover-flow of large tiles. The current tile is centred,
  larger and in front. At most 3 tiles are visible, and a neighbour peeks in
  only if it exists.
- **CARD-11** Each tile carries its slot's roster: count, bar, overlapping
  circle avatars (the current user first, in emerald), and a "+N" overflow. The
  tiles fill the space between the label and the Join button, and there's no
  separate roster block.
- **CARD-12** A horizontal swipe, a tap on a neighbour, or the arrow keys
  (while the picker has focus) switch slots. The slot on screen is the
  selected one, marked with `aria-current`. A tile is a plain container, not a
  button. Tapping a neighbour slides it to the centre, and tapping the centred
  tile does nothing. A tap on an avatar inside a tile opens the details card
  (CARD-24) and never slides the tile.
- **CARD-13** Horizontal swiping in the picker doesn't trigger the app-wide
  drawer swipe, and vertical scrolling of the deck still works.
- **CARD-14** On load, the selection is the user's joined slot, else their
  pending one, else the first slot.
- **CARD-15** A slot shows a dot for joined (emerald) or pending (amber), and a
  thin bar for how full it is.
- **CARD-16** There are no arrows, no counter, no progress rail and no
  "Available slots" header.

## Roster (SlotRoster + SlotAvatars, shared with MyGameHub)

- **CARD-20** One roster component is used in both PlayableRoomCard and
  MyGameHub, and it looks the same in both. It's one flat section, with no
  panel, no flip and no teams view.
- **CARD-21** The header reads "N of M players", with "N spots left" or "Full
  squad" on the right ([spotsLeft.ts](../../client/src/features/rooms/composables/spotsLeft.ts)).
- **CARD-22** The roster shows one row of circle avatars for joined players
  only, with no open-seat placeholders. The current user comes first, in
  emerald. When the avatars don't fit, the row ends with a "+N" circle.
- **CARD-23** Each avatar has an `aria-label` with the player's name ("You" for
  the current user). There's no `title` tooltip, because the details card
  (CARD-24) replaces it.
- **CARD-24** Each player avatar is a button that opens that player's details
  card, in the slot picker tiles and in the My games roster alike. It
  behaves the same as in the host's players widget
  ([PROF-01..05](../player-profile.md)). The "+N" circle isn't a button.

## Join button

- **CARD-30** The button's enabled state and label come from
  `getSlotJoinability` ([MEM-03..08](../membership.md)), and leaving from
  `getSlotLeavability` ([MEM-12](../membership.md)).

## Out of scope for this pass

- A min-player / "will it run" indicator (it needs `min_players` in the
  playable feed).
- Removing player emails from the playable payload.

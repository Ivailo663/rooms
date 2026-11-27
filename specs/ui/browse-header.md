# Browse header (the island)

Code: [RoomsHeader.vue](../../client/src/features/rooms/components/RoomsHeader.vue),
[ReturnToGameBar.vue](../../client/src/features/rooms/player/ReturnToGameBar.vue),
[HomeView.vue](../../client/src/views/HomeView.vue).

The browse view's chrome is one element, not a stack of bars: the day selector
and the way back to the player's game share a single container, and that
container changes shape with what it holds.

- **HEAD-01** In Play view the header is one island: a single rounded,
  translucent container holding the day selector and, when the player has a
  game, the way back to it. Nothing sits above, below or beside it — the
  return-to-game bar stops being its own element in `HomeView`.
- **HEAD-02** With no confirmed game the island holds the day buttons alone
  and hugs them, centred on the page.
- **HEAD-03** With a confirmed game the island spans the full width of the
  deck below it, the day buttons at its left end and the game block at its
  right. The days are not centred in this state.
- **HEAD-04** The island animates between those two widths: gaining the block
  it grows and the days slide left, losing it it shrinks back around the
  centred days. The day buttons keep their size and never re-wrap while it
  moves. With reduced motion the width changes without animating.
- **HEAD-05** The game block is two stacked lines: "My games" on top, the game
  itself underneath.
- **HEAD-06** For a game that hasn't started, the line underneath is its day
  and time, the day in the same relative words the rest of the app uses —
  "Today 19:00", "Tmrw 19:00", "Thu 19:00", "Next Thu 19:00". Nothing else: no
  room name, no countdown and no label in front of it.
- **HEAD-07** For a game in progress, the line underneath is the live dot and
  that game's hour. Nothing else: no elapsed minutes and no "live" wording.
- **HEAD-08** The game named is the soonest of the player's confirmed games —
  the one My games opens.
- **HEAD-09** The block is one control: a tap anywhere on it opens My games
  (`MyGameHub`). It works by tap, not only by mouse, and it is the only way
  back to the hub from the deck.
- **HEAD-10** On a phone (390px) the island still spans the width with the
  days at one end and the block at the other, and neither the day row nor
  either line of the block wraps.
- **HEAD-11** In Host view the header stays what it is today: the title and
  its subtitle, with no island, no day selector and no way back to a game.

## Open questions

1. **A game hosted but not played (HOST-33).** Not built yet: `membership` is
   `"joined" | "pending"` today, with no `"hosting"`, so this bites only when
   hosting ships. [HOST-33](../slot-hosting.md) promises a way into My games
   for a player who hosts a game without taking a seat in it, and names it as
   a trigger "next to `ReturnToGameBar`" — an element HEAD-01 removes. Since
   such a player has no confirmed game, HEAD-02 leaves them with no block and
   no way in. Either the block widens to cover hosted games when hosting
   ships, or HOST-33 needs its own way in. Deciding it now only matters if the
   wording of HOST-33 should change in this pass.

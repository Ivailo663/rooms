export type HeaderStep = "roomy" | "compact" | "tight";

// Heights are the whole card's, which is what the deck decides. A card needs its
// borders and padding (50, or 58 from sm up), the header, its margin (12) and
// the picker's floor, in that order; the card has no footer. The picker's floor
// is 196px, or 220px while a note shows under it (PICKER_FLOOR and PICKER_NOTE in
// slotTileStep). Measured at 1280px, the widest the header gets, it is 96px
// roomy, 76px compact and 48px tight, so the steps need 386, 366 and 314px
// (338px for a declined slot's note). Each threshold adds 2px. Below 338px the
// deck's own minimum card height (PlayableRooms.vue) takes over.
const ROOMY_MIN = 388;
const COMPACT_MIN = 368;

// An unmeasured card (0) is treated as roomy: the resize observer reports before
// first paint, so nobody sees the guess.
export const headerStep = (cardHeight: number): HeaderStep => {
  if (!cardHeight || cardHeight >= ROOMY_MIN) return "roomy";
  return cardHeight >= COMPACT_MIN ? "compact" : "tight";
};

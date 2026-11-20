export type TileStep = "roomy" | "compact" | "tight";

// The strip's own vertical padding (py-3 in SlotCarousel); a tile's side is the
// strip's height less this.
export const STRIP_PADDING_Y = 24;

// Thresholds are on the square's side (CARD-10). Measured at 320-1280px wide
// with a slot carrying all five features, a full squad and the longest status
// line ("Game has already started"). On a square it is the width that binds
// first, not the height:
// - roomy needs 208px of height (the time is larger from sm up; 202 on a
//   phone), and its 16px padding leaves the widest line, 163px, room to spare;
// - compact needs 168px of height, but has 12px padding, so its content is 26px
//   narrower than the side: the five feature icons (152 with their margin)
//   need 178;
// - tight needs 142px of height, but with 8px padding and a smaller status
//   line (152px) it needs 172 across.
// Each threshold adds 2px to its measurement.
const ROOMY_MIN = 210;
const COMPACT_MIN = 180;

// The smallest square a tile can be: the picker never offers less (see the
// floors below), so tight is the last step.
export const MIN_SIDE = 172;

// What the picker section reserves, so its strip is never shorter than the
// tight square plus its padding. A note under the strip (a slot message or the
// host's denial) takes a line of its own.
export const PICKER_FLOOR = MIN_SIDE + STRIP_PADDING_Y;
export const PICKER_NOTE = 24;

// An unmeasured strip (0) is treated as roomy: the resize observer reports
// before first paint, so nobody sees the guess.
export const tileStep = (side: number): TileStep => {
  if (!side || side >= ROOMY_MIN) return "roomy";
  return side >= COMPACT_MIN ? "compact" : "tight";
};

// Circle avatar diameter per step, and how many a tile shows before "+N".
export const AVATAR_SIZE: Record<TileStep, number> = {
  roomy: 32,
  compact: 28,
  tight: 24,
};

export const avatarCap = (step: TileStep): number | undefined =>
  step === "tight" ? 3 : undefined;

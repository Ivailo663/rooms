// The roster's capacity line, shared by the hub's roster and the picker tiles
// so both say the same thing about the same slot.
export const spotsLeftLabel = (taken: number, max: number): string => {
  const left = Math.max(0, max - taken);
  if (left === 0) return "Full squad";
  return `${left} ${left === 1 ? "spot" : "spots"} left`;
};

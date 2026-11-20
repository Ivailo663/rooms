// The roster's capacity line, shared by the hub's roster and the picker tiles
// so both say the same thing about the same slot.
export const spotsLeftLabel = (taken: number, max: number): string => {
  const left = Math.max(0, max - taken);
  if (left === 0) return "Full squad";
  return `${left} ${left === 1 ? "spot" : "spots"} left`;
};

export type SpotsTone = "plenty" | "few" | "full";

// Urgency of the capacity line: three or more open spots is calm, one or two
// is "go now", none is over. The picker colours the label from this.
export const spotsLeftTone = (taken: number, max: number): SpotsTone => {
  const left = Math.max(0, max - taken);
  if (left === 0) return "full";
  return left <= 2 ? "few" : "plenty";
};

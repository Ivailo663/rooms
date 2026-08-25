import type { LiveSlotSummary, TimeslotResponse } from "@football/shared";

export interface SlotPlayerInfo {
  count: number;
  max: number;
  gathered: boolean;
}

type QuorumSlot = Pick<
  TimeslotResponse,
  "players" | "min_players" | "max_players"
>;

// The rule the worker applies at go-live: enough players to run, which with no
// configured minimum means simply "somebody joined". Anything stricter would
// promise green for a game that then fails, or withhold it from one that runs.
export const hasGathered = (count: number, min: number | null): boolean =>
  count > 0 && (min === null || count >= min);

// Counts plus quorum for a scheduled slot. Pass `live` for a slot the clock
// says is running: the server only starts one after the quorum check held, so
// a live roster has gathered regardless of who has left since.
export const slotPlayerInfo = (
  slot: QuorumSlot,
  live = false
): SlotPlayerInfo => ({
  count: slot.players.length,
  max: slot.max_players,
  gathered: live || hasGathered(slot.players.length, slot.min_players),
});

// Same shape from the room-level live summary, which carries a count instead of
// a roster and no minimum of its own to re-check against.
export const liveSlotPlayerInfo = (slot: LiveSlotSummary): SlotPlayerInfo => ({
  count: slot.players_count,
  max: slot.max_players,
  gathered: true,
});

export const gatheredTitle = (live: boolean): string =>
  live ? "Players gathered — game is running" : "Enough players to run";

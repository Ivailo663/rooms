import type { PlayableRoomResponse } from "@football/shared";
import {
  getSlotJoinability,
  getSlotLeavability,
  type HeldSlot,
} from "./slotJoinability";

type Slot = PlayableRoomResponse["timeslots"][number];

export type TileAction = {
  state: "join" | "leave" | "awaiting" | "declined" | "cantJoin" | "cantLeave";
  label?: string;
  icon?: string;
};

const STATUS_ICON: Partial<Record<TileAction["state"], string>> = {
  awaiting: "fa-user-clock",
  declined: "fa-circle-xmark",
};

// What holding a tile does for this user. A seat held wins, then a request in
// flight, then a denial, then the join gates, which mirror the server's so a
// hold reflects what would actually be accepted. A locked roster keeps the slot
// visible for its hour but removes the exit. A denial lasts for the current
// occurrence only: the row resets when the slot ends.
export const getSlotAction = (
  slot: Slot,
  rules: Pick<PlayableRoomResponse, "lateJoinCutoff" | "allowJoinOnLive">,
  now: Date,
  heldSlots: readonly HeldSlot[],
  userId: number | undefined
): TileAction => {
  if (userId !== undefined && slot.players.some((p) => p.id === userId)) {
    const { canLeave, label, icon } = getSlotLeavability(
      slot,
      rules.lateJoinCutoff,
      now
    );
    return canLeave ? { state: "leave" } : { state: "cantLeave", label, icon };
  }
  if (slot.requestStatusForCurrentUser === "pending") {
    return { state: "awaiting" };
  }
  if (slot.requestStatusForCurrentUser === "denied") {
    return { state: "declined" };
  }

  const { joinable, label, icon } = getSlotJoinability(
    slot,
    rules,
    now,
    heldSlots
  );
  return joinable ? { state: "join" } : { state: "cantJoin", label, icon };
};

// The last line of a tile: what holding it does, or why nothing does.
export const tileBottomText = (
  action: TileAction,
  { pending, releasedEarly }: { pending: boolean; releasedEarly: boolean }
): { text: string; icon?: string } => {
  const icon = action.icon ?? STATUS_ICON[action.state];

  if (pending) {
    return { text: action.state === "leave" ? "Leaving…" : "Joining…", icon };
  }
  switch (action.state) {
    case "join":
      return { text: releasedEarly ? "Keep holding…" : "Hold to join", icon };
    case "leave":
      return { text: releasedEarly ? "Keep holding…" : "Hold to leave", icon };
    case "awaiting":
      return { text: "Awaiting approval", icon };
    case "declined":
      return { text: "Not accepted", icon };
    default:
      return { text: action.label ?? "", icon };
  }
};

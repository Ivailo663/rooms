import type { PlayableRoomResponse, SlotStatus } from "@football/shared";
import { isSlotFailedNow, isSlotLiveNow } from "./isSlotLiveNow";

type Slot = PlayableRoomResponse["timeslots"][number];
type RoomPolicy = Pick<
  PlayableRoomResponse,
  "lateJoinCutoff" | "allowJoinOnLive"
>;

const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};
const SLOT_DURATION_MINUTES = 60;

export type JoinBlockReason = "no-game" | "live" | "closed" | "full" | "clash";

// A seat the player already holds, for the one-game-per-hour gate. Structural
// so both the browse feed's timeslots and the hub's JoinedSlotSummary fit.
export type HeldSlot = { timeslotId: number; day: string; start_time: number };

export interface Joinability {
  joinable: boolean;
  reason?: JoinBlockReason;
  label?: string;
  icon?: string;
}

const BLOCK: Record<JoinBlockReason, { label: string; icon: string }> = {
  "no-game": { label: "No game this round", icon: "fa-circle-xmark" },
  live: { label: "Game has already started", icon: "fa-hourglass-end" },
  closed: { label: "Joining has closed", icon: "fa-lock" },
  full: { label: "Game is full", icon: "fa-users-slash" },
  clash: { label: "You're in another game", icon: "fa-calendar-xmark" },
};

// Mirrors the server's clash rule: same day, and the two 60-minute occurrence
// windows overlap.
const clashesWith = (slot: Slot, held: HeldSlot): boolean =>
  held.timeslotId !== slot.id &&
  held.day === slot.day &&
  Math.abs(held.start_time - slot.start_time) < SLOT_DURATION_MINUTES;

// The roster freezes from `cutoff` minutes before start until the end of the
// occurrence window — mirrors the server's isRosterLocked so the button and the
// actual join outcome never disagree.
const isRosterLocked = (
  day: string,
  startTime: number,
  cutoff: number,
  now: Date
): boolean => {
  if (now.getDay() !== DAY_INDEX[day]) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return (
    minutesNow >= startTime - cutoff &&
    minutesNow < startTime + SLOT_DURATION_MINUTES
  );
};

// Whether the current user can still join `slot`, and if not, why. The reason
// order matches the server join handler's gate order so the label reflects the
// error a click would have produced.
export const getSlotJoinability = (
  slot: Slot,
  room: RoomPolicy,
  now: Date,
  heldSlots: readonly HeldSlot[] = []
): Joinability => {
  const block = (reason: JoinBlockReason): Joinability => ({
    joinable: false,
    reason,
    ...BLOCK[reason],
  });

  if (
    slot.status === "failed" ||
    slot.status === "redistributed" ||
    slot.status === "ended"
  ) {
    return block("no-game");
  }
  if (slot.status === "live") {
    return room.allowJoinOnLive ? { joinable: true } : block("live");
  }
  if (isRosterLocked(slot.day, slot.start_time, room.lateJoinCutoff, now)) {
    return block("closed");
  }
  if (heldSlots.some((held) => clashesWith(slot, held))) {
    return block("clash");
  }
  if (slot.players.length >= slot.max_players) {
    return block("full");
  }
  return { joinable: true };
};

// A slot the player is already in, for the leave gate. Structural so it fits
// both the browse feed's timeslots and the hub's JoinedSlotSummary.
type JoinedSlot = { day: string; start_time: number; status: SlotStatus };

export interface Leavability {
  canLeave: boolean;
  label?: string;
  icon?: string;
}

// Whether the player can still drop out of a slot they've joined. The seat is
// committed for the whole locked window — mirrors the server's leave gate, so
// the button and the actual outcome never disagree.
//
// A "no game" verdict does not reopen it: the occurrence is spent either way,
// and the player keeps seeing the slot until its hour is up (the roster is
// cleared wholesale when the occurrence ends).
export const getSlotLeavability = (
  slot: JoinedSlot,
  cutoff: number,
  now: Date
): Leavability => {
  if (!isRosterLocked(slot.day, slot.start_time, cutoff, now)) {
    return { canLeave: true };
  }
  if (isSlotFailedNow(slot, now)) {
    return {
      canLeave: false,
      label: "No game this round",
      icon: "fa-circle-xmark",
    };
  }
  if (isSlotLiveNow(slot, now)) {
    return { canLeave: false, label: "Game in progress", icon: "fa-futbol" };
  }
  return { canLeave: false, label: "You're locked in", icon: "fa-lock" };
};

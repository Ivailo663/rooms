import type { TimeslotResponse } from "@football/shared";
import { dayValueOf } from "@/constants";

const SLOT_DURATION_MINUTES = 60;

// A weekday plus a start time is all the occurrence math needs, so this serves
// the host's TimeslotResponse and the player's JoinedSlotSummary alike.
export type SlotWindow = Pick<
  TimeslotResponse,
  "status" | "day" | "start_time"
>;

// True when the wall clock currently sits inside this slot's occurrence window
// on its scheduled day. The server drives `status`, but that value can go stale
// (e.g. the scheduler missed a transition while the process was down), so any
// occurrence-scoped presentation is gated on the clock rather than trusting the
// stored status indefinitely.
export const isWithinWindow = (slot: SlotWindow, now: Date): boolean => {
  if (slot.day !== dayValueOf(now)) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return (
    minutesNow >= slot.start_time &&
    minutesNow < slot.start_time + SLOT_DURATION_MINUTES
  );
};

// A slot is only genuinely "live" when the clock sits inside its window — never
// before its time has come, nor after it has passed.
export const isSlotLiveNow = (slot: SlotWindow, now: Date): boolean =>
  slot.status === "live" && isWithinWindow(slot, now);

// "failed" (didn't reach minimum players) is likewise only shown during the
// slot's own hour. Once that hour passes the slot reverts to a normal scheduled
// occurrence for next time, so a stale "failed" must not keep showing.
export const isSlotFailedNow = (slot: SlotWindow, now: Date): boolean =>
  slot.status === "failed" && isWithinWindow(slot, now);

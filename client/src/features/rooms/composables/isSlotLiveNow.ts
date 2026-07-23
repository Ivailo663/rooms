import type { TimeslotResponse } from "@football/shared";

const DAY_MAP = ["su", "mo", "tu", "we", "th", "fr", "sa"];
const SLOT_DURATION_MINUTES = 60;

// A slot is only genuinely "live" when the wall clock sits inside its window.
// The server drives `status`, but that value can go stale (e.g. the scheduler
// missed the end transition while the process was down), leaving a future or
// past slot marked "live". Gating the UI on the clock keeps us from showing a
// slot as live before its time has come — or after it has passed.
export const isSlotLiveNow = (
  slot: Pick<TimeslotResponse, "status" | "day" | "start_time">,
  now: Date
): boolean => {
  if (slot.status !== "live") return false;
  if (slot.day !== DAY_MAP[now.getDay()]) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return (
    minutesNow >= slot.start_time &&
    minutesNow < slot.start_time + SLOT_DURATION_MINUTES
  );
};

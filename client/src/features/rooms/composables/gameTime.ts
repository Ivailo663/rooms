import {
  DAYS_PER_WEEK,
  MINUTES_PER_DAY,
  daysUntilDay,
  relativeDayLabel,
} from "@/constants";
import {
  isSlotLiveNow,
  isWithinWindow,
  type SlotWindow,
} from "./isSlotLiveNow";

export { MINUTES_PER_DAY };

const minutesOf = (now: Date) => now.getHours() * 60 + now.getMinutes();

// Minutes until the slot's next occurrence; a slot already passed today rolls
// over to next week. Live slots sort first.
export const minutesUntil = (slot: SlotWindow, now: Date) => {
  if (isSlotLiveNow(slot, now)) return -1;
  const delta =
    daysUntilDay(slot.day, now) * MINUTES_PER_DAY +
    slot.start_time -
    minutesOf(now);
  return delta < 0 ? delta + DAYS_PER_WEEK * MINUTES_PER_DAY : delta;
};

// Calendar days until the slot's next occurrence, derived from minutesUntil so
// it agrees with the countdown. A same-weekday slot whose time already passed
// correctly reads as 7 (next week), not 0 (today).
export const effectiveDayOffset = (slot: SlotWindow, now: Date) => {
  // A slot whose own hour is running is today whatever its stored status says,
  // so one that failed or was redistributed mid-hour still reads "Today"
  // instead of jumping to next week's occurrence.
  if (isWithinWindow(slot, now)) return 0;
  return Math.floor(
    (minutesOf(now) + minutesUntil(slot, now)) / MINUTES_PER_DAY
  );
};

// Minutes a live slot has been running, as shown on the "12'" match clock.
// Floors at 1 so a slot that just kicked off never reads "0'".
export const elapsedMinutes = (startTime: number, now: Date) =>
  Math.max(1, now.getHours() * 60 + now.getMinutes() - startTime);

// "Today" / "Tomorrow" / "Friday" / "Next Friday" for a slot's next occurrence.
export const dayDisplay = (slot: SlotWindow, now: Date) =>
  relativeDayLabel(slot.day, effectiveDayOffset(slot, now), now);

// Compact variant for chips/switchers.
export const shortDay = (slot: SlotWindow, now: Date) =>
  relativeDayLabel(slot.day, effectiveDayOffset(slot, now), now, {
    short: true,
  });

// "2d 3h" / "5h 12m" / "42m"
export const formatCountdown = (minutes: number) => {
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

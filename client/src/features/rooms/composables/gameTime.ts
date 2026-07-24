import type { JoinedSlotSummary } from "@football/shared";
import { DAYS, getTodayValue } from "@/constants";
import { isSlotLiveNow } from "./isSlotLiveNow";

export const MINUTES_PER_DAY = 24 * 60;

// Weekday distance ignoring the clock (0 = same weekday as today). Used only as
// the seed for minutesUntil, which layers the time-of-day rollover on top.
const weekdayOffset = (slot: JoinedSlotSummary) => {
  const todayIndex = DAYS.findIndex((d) => d.value === getTodayValue());
  const slotIndex = DAYS.findIndex((d) => d.value === slot.day);
  return (slotIndex - todayIndex + 7) % 7;
};

// Minutes until the slot's next occurrence; a slot already passed today rolls
// over to next week. Live slots sort first.
export const minutesUntil = (slot: JoinedSlotSummary, now: Date) => {
  if (isSlotLiveNow(slot, now)) return -1;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const delta =
    weekdayOffset(slot) * MINUTES_PER_DAY + slot.start_time - minutesNow;
  return delta < 0 ? delta + 7 * MINUTES_PER_DAY : delta;
};

// Calendar days until the slot's next occurrence, derived from minutesUntil so
// it agrees with the countdown. A same-weekday slot whose time already passed
// correctly reads as 7 (next week), not 0 (today).
export const effectiveDayOffset = (slot: JoinedSlotSummary, now: Date) => {
  if (isSlotLiveNow(slot, now)) return 0;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return Math.floor((minutesNow + minutesUntil(slot, now)) / MINUTES_PER_DAY);
};

const FULL_DAY_NAMES: Record<string, string> = {
  mo: "Monday",
  tu: "Tuesday",
  we: "Wednesday",
  th: "Thursday",
  fr: "Friday",
  sa: "Saturday",
  su: "Sunday",
};

// Does the slot's next occurrence fall in a later week than today? DAYS runs
// Monday→Sunday, so today's Monday-based index plus the day offset crossing 7
// means we've stepped past this Sunday into next week. Covers both "a later
// weekday next week" and "same/earlier weekday whose time already passed".
const isNextWeek = (slot: JoinedSlotSummary, now: Date) => {
  const todayIndex = DAYS.findIndex((d) => d.value === getTodayValue());
  return todayIndex + effectiveDayOffset(slot, now) >= 7;
};

export const dayDisplay = (slot: JoinedSlotSummary, now: Date) => {
  const offset = effectiveDayOffset(slot, now);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  const name = FULL_DAY_NAMES[slot.day] ?? slot.day;
  return isNextWeek(slot, now) ? `Next ${name}` : name;
};

// Compact variant for chips/switchers.
export const shortDay = (slot: JoinedSlotSummary, now: Date) => {
  const offset = effectiveDayOffset(slot, now);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tmrw";
  const label = DAYS.find((d) => d.value === slot.day)?.label ?? slot.day;
  return isNextWeek(slot, now) ? `Next ${label}` : label;
};

// "2d 3h" / "5h 12m" / "42m"
export const formatCountdown = (minutes: number) => {
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

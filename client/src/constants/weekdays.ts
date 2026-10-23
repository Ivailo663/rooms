// The app's single weekday table. `value` is the `day` code stored on every
// slot; `label`/`full` are the only spellings the UI should use.
//
// It runs Monday→Sunday while JS `Date.getDay()` runs Sunday→Saturday, which is
// what every hand-rolled copy of this table kept getting subtly wrong. Nothing
// outside this module should index a weekday array with `getDay()` — go through
// `dayValueOf` instead.
export const DAYS = [
  { label: "Mo", value: "mo", full: "Monday" },
  { label: "Tu", value: "tu", full: "Tuesday" },
  { label: "We", value: "we", full: "Wednesday" },
  { label: "Th", value: "th", full: "Thursday" },
  { label: "Fr", value: "fr", full: "Friday" },
  { label: "Sa", value: "sa", full: "Saturday" },
  { label: "Su", value: "su", full: "Sunday" },
];

export const DAYS_PER_WEEK = 7;
export const MINUTES_PER_DAY = 24 * 60;

// Monday-based index of a day code; -1 when the code is unknown.
export const dayIndex = (day: string): number =>
  DAYS.findIndex((d) => d.value === day);

// The day code for a given moment — the one place Sunday-first `getDay()` is
// translated into this table's order. Always pass the clock you are rendering
// against: a day captured once at setup goes stale at midnight.
export const dayValueOf = (now: Date): string =>
  DAYS[(now.getDay() + 6) % DAYS_PER_WEEK]!.value;

export const dayFullName = (day: string): string =>
  DAYS.find((d) => d.value === day)?.full ?? day;

export const dayShortName = (day: string): string =>
  DAYS.find((d) => d.value === day)?.label ?? day;

// Calendar days from `now` to the next occurrence of `day`, ignoring the clock.
// 0 means today — callers that treat today as already spent bump it themselves.
export const daysUntilDay = (day: string, now: Date): number => {
  const idx = dayIndex(day);
  if (idx === -1) return -1;

  return (idx - dayIndex(dayValueOf(now)) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
};

// How a day `offset` calendar days out is named: "Today", "Tomorrow", a bare
// weekday for one still inside this calendar week, and "Next <day>" once the
// offset crosses Sunday into the following one. Every relative day in the app
// goes through here so the wording cannot drift between views again.
export const relativeDayLabel = (
  day: string,
  offset: number,
  now: Date,
  { short = false }: { short?: boolean } = {},
): string => {
  if (offset === 0) return "Today";
  if (offset === 1) return short ? "Tmrw" : "Tomorrow";

  const name = short ? dayShortName(day) : dayFullName(day);
  const crossesIntoNextWeek =
    dayIndex(dayValueOf(now)) + offset >= DAYS_PER_WEEK;

  return crossesIntoNextWeek ? `Next ${name}` : name;
};

// Convenience for one-shot initial values (the day switcher's starting
// selection). Anything that re-renders over time wants `dayValueOf(now)`.
export const getTodayValue = (): string => dayValueOf(new Date());

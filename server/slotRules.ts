import type { SlotStatus } from "@prisma/client";
import type { TenantSettings } from "../packages/shared/index.js";

// Pure slot rules: no Prisma client, queues or Firebase in here, so they can be
// unit-tested without any infrastructure. The DB-facing code (scheduler,
// worker, routes, redistribution) calls into these for every decision.

export const SLOT_DURATION_MINUTES = 60;

// Fallback roster-lock / redistribution lead time when a tenant has no usable
// setting (or the room is untenanted). Kept in sync with the client default so
// both sides compute the same lock window.
export const DEFAULT_LATE_JOIN_CUTOFF = 15;

export const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

export const resolveCutoff = (settings: unknown): number => {
  const value = (settings as Partial<TenantSettings> | null | undefined)
    ?.lateJoinCutoff;
  return typeof value === "number" && value > 0
    ? value
    : DEFAULT_LATE_JOIN_CUTOFF;
};

const minutesOfDay = (now: Date): number =>
  now.getHours() * 60 + now.getMinutes();

// The occurrence window: [start, start + 60) on the slot's weekday.
export const isInsideWindow = (
  day: string,
  startMinutes: number,
  now: Date
): boolean => {
  if (now.getDay() !== DAY_INDEX[day]) return false;
  const minutesNow = minutesOfDay(now);
  return (
    minutesNow >= startMinutes &&
    minutesNow < startMinutes + SLOT_DURATION_MINUTES
  );
};

// The roster freezes from `cutoff` minutes before start until the end of the
// occurrence window — the span over which the scheduler runs its verdict and
// the game plays out. Joins into a still-"scheduled" slot are rejected, and so
// are departures: the headcount the cutoff verdict is about to judge (and the
// one the host is staffing for) must not move under it.
//
// Deliberately clock-derived rather than status-derived: a stale status left
// behind by a missed transition would otherwise lock a roster forever.
export const isRosterLocked = (
  day: string,
  startTime: number,
  cutoff: number,
  now: Date
): boolean => {
  if (now.getDay() !== DAY_INDEX[day]) return false;
  const minutesNow = minutesOfDay(now);
  return (
    minutesNow >= startTime - cutoff &&
    minutesNow < startTime + SLOT_DURATION_MINUTES
  );
};

// Converts a (day, minutes-from-midnight) pair into a "minute hour * * dow"
// cron pattern. minutesFromMidnight may exceed 1440 (e.g. start_time + 60 for
// a slot starting at 23:00+) or go negative (start_time - cutoff just after
// midnight), in which case the day-of-week rolls over too.
export const toCron = (day: string, minutesFromMidnight: number): string => {
  const wrapped = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const dayOffset = Math.floor(minutesFromMidnight / 1440);
  const dow = (DAY_INDEX[day] + dayOffset + 7) % 7;
  return `${wrapped % 60} ${Math.floor(wrapped / 60)} * * ${dow}`;
};

// A slot may run only with a real game: at least one player, and its minimum
// met when one is set. Enforced at BOTH the cutoff verdict and go-live, so a
// slot never kicks off empty even if the cutoff job never fired (server down
// at the cutoff minute, or the slot was launched after the cutoff had passed).
export const meetsQuorum = (playerCount: number, min: number | null): boolean =>
  playerCount > 0 && (min === null || playerCount >= min);

// One game per hour: two seats clash when they fall on the same day and their
// 60-minute windows overlap. Callers are responsible for the "both enabled"
// half of the rule, which they filter in the query.
export const slotsClash = (
  a: { day: string; start_time: number },
  b: { day: string; start_time: number }
): boolean =>
  a.day === b.day &&
  Math.abs(a.start_time - b.start_time) < SLOT_DURATION_MINUTES;

export type CutoffVerdict = "keep" | "redistribute" | "fail";

// What the cutoff job should do with a slot, or null when it isn't
// "scheduled" and so isn't the verdict's to judge. "redistribute" falls back to
// "fail" at the call site if no sibling can take the group.
export const cutoffVerdict = (
  status: SlotStatus,
  playerCount: number,
  min: number | null,
  autoRedistribute: boolean
): CutoffVerdict | null => {
  if (status !== "scheduled") return null;
  if (meetsQuorum(playerCount, min)) return "keep";
  return playerCount > 0 && autoRedistribute ? "redistribute" : "fail";
};

export const goLiveVerdict = (
  status: SlotStatus,
  playerCount: number,
  min: number | null
): "live" | "failed" | null => {
  if (status !== "scheduled") return null;
  return meetsQuorum(playerCount, min) ? "live" : "failed";
};

// Only an enabled, still-scheduled slot with a configured minimum that has
// some players but not enough is worth evacuating.
export const needsRedistribution = (
  slot: { enabled: boolean; status: SlotStatus; min_players: number | null },
  playerCount: number
): boolean =>
  slot.enabled &&
  slot.status === "scheduled" &&
  slot.min_players !== null &&
  playerCount > 0 &&
  playerCount < slot.min_players;

export type RedistributionCandidate = {
  id: number;
  open: number;
  members: ReadonlySet<number>;
  denied: ReadonlySet<number>;
};

// Assigns players (in the given order) to candidate slots, each to the first
// candidate that still has an open seat and is allowed for them. A player
// already seated in a candidate can't take a second seat there (unique
// timeslotId+accountId), and one the candidate's host denied this occurrence
// must not be sneaked past the denial. All or nothing: returns null if any
// player can't be placed, since a partial evacuation would leave the source in
// a half-cancelled state with no clean way to represent it.
export const planRedistribution = (
  playerIds: readonly number[],
  candidates: readonly RedistributionCandidate[]
): Map<number, number[]> | null => {
  const open = candidates
    .filter((c) => c.open > 0)
    .map((c) => ({ ...c, members: new Set(c.members) }));

  const totalOpen = open.reduce((sum, c) => sum + c.open, 0);
  if (totalOpen < playerIds.length) return null;

  const assignments = new Map<number, number[]>();

  for (const accountId of playerIds) {
    const target = open.find(
      (c) => c.open > 0 && !c.members.has(accountId) && !c.denied.has(accountId)
    );
    if (!target) return null;

    target.open -= 1;
    target.members.add(accountId);
    const accountIds = assignments.get(target.id) ?? [];
    accountIds.push(accountId);
    assignments.set(target.id, accountIds);
  }

  return assignments;
};

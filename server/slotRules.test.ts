import { describe, expect, it } from "vitest";
import {
  DEFAULT_LATE_JOIN_CUTOFF,
  cutoffVerdict,
  goLiveVerdict,
  isInsideWindow,
  isRosterLocked,
  meetsQuorum,
  needsRedistribution,
  planRedistribution,
  resolveCutoff,
  slotsClash,
  toCron,
  type RedistributionCandidate,
} from "./slotRules.js";

// 2026-01-04 is a Sunday, so day offset n lands on getDay() === n in local time.
const DAY_OFFSET = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const at = (day: keyof typeof DAY_OFFSET, hh: number, mm: number): Date =>
  new Date(2026, 0, 4 + DAY_OFFSET[day], hh, mm);

const H18 = 18 * 60;

describe("lock window", () => {
  it("LIFE-01: locks from start − cutoff (inclusive) to start + 60 (exclusive)", () => {
    expect(isRosterLocked("we", H18, 15, at("we", 17, 44))).toBe(false);
    expect(isRosterLocked("we", H18, 15, at("we", 17, 45))).toBe(true);
    expect(isRosterLocked("we", H18, 15, at("we", 18, 0))).toBe(true);
    expect(isRosterLocked("we", H18, 15, at("we", 18, 59))).toBe(true);
    expect(isRosterLocked("we", H18, 15, at("we", 19, 0))).toBe(false);
  });

  it("LIFE-01: only on the slot's own weekday", () => {
    expect(isRosterLocked("we", H18, 15, at("th", 18, 0))).toBe(false);
    expect(isRosterLocked("we", H18, 15, at("tu", 17, 50))).toBe(false);
  });

  it("LIFE-01: Sunday (getDay 0) is matched", () => {
    expect(isRosterLocked("su", H18, 15, at("su", 17, 50))).toBe(true);
    expect(isRosterLocked("su", H18, 15, at("sa", 17, 50))).toBe(false);
    expect(isRosterLocked("sa", H18, 15, at("su", 17, 50))).toBe(false);
  });

  it("LIFE-01: an unknown day never locks", () => {
    expect(isRosterLocked("xx", H18, 15, at("we", 18, 0))).toBe(false);
  });

  it("LIFE-01: honours a non-default cutoff", () => {
    expect(isRosterLocked("mo", H18, 30, at("mo", 17, 29))).toBe(false);
    expect(isRosterLocked("mo", H18, 30, at("mo", 17, 30))).toBe(true);
  });

  it("MEM-05/MEM-12: join and leave are rejected exactly inside the lock window", () => {
    const cutoff = resolveCutoff({ lateJoinCutoff: 20 });
    const locked = (d: Date) => isRosterLocked("fr", 20 * 60, cutoff, d);
    expect(locked(at("fr", 19, 39))).toBe(false);
    expect(locked(at("fr", 19, 40))).toBe(true);
    expect(locked(at("fr", 20, 59))).toBe(true);
    expect(locked(at("fr", 21, 0))).toBe(false);
  });

  it("LIFE-01: occurrence window is [start, start + 60) on the weekday", () => {
    expect(isInsideWindow("tu", H18, at("tu", 17, 59))).toBe(false);
    expect(isInsideWindow("tu", H18, at("tu", 18, 0))).toBe(true);
    expect(isInsideWindow("tu", H18, at("tu", 18, 59))).toBe(true);
    expect(isInsideWindow("tu", H18, at("tu", 19, 0))).toBe(false);
    expect(isInsideWindow("tu", H18, at("we", 18, 30))).toBe(false);
    expect(isInsideWindow("su", H18, at("su", 18, 30))).toBe(true);
  });
});

describe("cutoff resolution", () => {
  it("LIFE-02: uses lateJoinCutoff when it is a number > 0", () => {
    expect(resolveCutoff({ lateJoinCutoff: 30 })).toBe(30);
    expect(resolveCutoff({ lateJoinCutoff: 1 })).toBe(1);
  });

  it("LIFE-02: falls back to 15 for unset, 0, negative, non-number or untenanted", () => {
    expect(DEFAULT_LATE_JOIN_CUTOFF).toBe(15);
    for (const settings of [
      {},
      { lateJoinCutoff: 0 },
      { lateJoinCutoff: -5 },
      { lateJoinCutoff: "30" },
      { lateJoinCutoff: null },
      { lateJoinCutoff: Number.NaN },
      null,
      undefined,
    ]) {
      expect(resolveCutoff(settings)).toBe(15);
    }
  });
});

describe("cron patterns", () => {
  it("LIFE-04: cutoff job fires at start − cutoff on the slot's weekday", () => {
    expect(toCron("we", H18 - 15)).toBe("45 17 * * 3");
    expect(toCron("su", H18)).toBe("0 18 * * 0");
  });

  it("LIFE-04: rolls the weekday over past midnight in either direction", () => {
    expect(toCron("sa", 23 * 60 + 60)).toBe("0 0 * * 0");
    expect(toCron("su", -15)).toBe("45 23 * * 6");
  });
});

describe("quorum", () => {
  it("LIFE-03: needs count > 0 and count ≥ min when min is set", () => {
    expect(meetsQuorum(0, 4)).toBe(false);
    expect(meetsQuorum(3, 4)).toBe(false);
    expect(meetsQuorum(4, 4)).toBe(true);
    expect(meetsQuorum(5, 4)).toBe(true);
  });

  it("LIFE-03: with min null, somebody joining is enough", () => {
    expect(meetsQuorum(0, null)).toBe(false);
    expect(meetsQuorum(1, null)).toBe(true);
  });
});

describe("cutoff verdict", () => {
  it("LIFE-04: a scheduled slot with quorum is left unchanged", () => {
    expect(cutoffVerdict("scheduled", 4, 4, true)).toBe("keep");
    expect(cutoffVerdict("scheduled", 1, null, false)).toBe("keep");
  });

  it("LIFE-05: below quorum, ≥ 1 player and autoRedistribute → redistribution", () => {
    expect(cutoffVerdict("scheduled", 2, 4, true)).toBe("redistribute");
  });

  it("LIFE-06: any other scheduled slot below quorum fails", () => {
    expect(cutoffVerdict("scheduled", 2, 4, false)).toBe("fail");
    expect(cutoffVerdict("scheduled", 0, 4, true)).toBe("fail");
    expect(cutoffVerdict("scheduled", 0, null, true)).toBe("fail");
  });

  it("LIFE-04: a slot that isn't scheduled is not judged", () => {
    for (const status of ["live", "failed", "redistributed", "ended"] as const) {
      expect(cutoffVerdict(status, 0, 4, true)).toBeNull();
    }
  });
});

describe("go-live", () => {
  it("LIFE-07: a scheduled slot with quorum goes live", () => {
    expect(goLiveVerdict("scheduled", 4, 4)).toBe("live");
    expect(goLiveVerdict("scheduled", 1, null)).toBe("live");
  });

  it("LIFE-07: a scheduled slot below quorum fails", () => {
    expect(goLiveVerdict("scheduled", 3, 4)).toBe("failed");
    expect(goLiveVerdict("scheduled", 0, null)).toBe("failed");
  });

  it("LIFE-07: any other status is untouched", () => {
    for (const status of ["live", "failed", "redistributed", "ended"] as const) {
      expect(goLiveVerdict(status, 10, 1)).toBeNull();
    }
  });
});

describe("one game per hour", () => {
  const slot = (day: string, start_time: number) => ({ day, start_time });

  it("MEM-20: same day and |Δstart| < 60 clash", () => {
    expect(slotsClash(slot("mo", H18), slot("mo", H18))).toBe(true);
    expect(slotsClash(slot("mo", H18), slot("mo", H18 + 59))).toBe(true);
    expect(slotsClash(slot("mo", H18 + 59), slot("mo", H18))).toBe(true);
  });

  it("MEM-20: exactly 60 minutes apart does not clash", () => {
    expect(slotsClash(slot("mo", H18), slot("mo", H18 + 60))).toBe(false);
    expect(slotsClash(slot("mo", H18), slot("mo", H18 - 60))).toBe(false);
  });

  it("MEM-20: different days never clash", () => {
    expect(slotsClash(slot("mo", H18), slot("tu", H18))).toBe(false);
  });
});

describe("redistribution", () => {
  const source = (
    overrides: Partial<Parameters<typeof needsRedistribution>[0]> = {}
  ) => ({
    enabled: true,
    status: "scheduled" as const,
    min_players: 4,
    ...overrides,
  });

  const candidate = (
    id: number,
    open: number,
    members: number[] = [],
    denied: number[] = []
  ): RedistributionCandidate => ({
    id,
    open,
    members: new Set(members),
    denied: new Set(denied),
  });

  const plan = (
    players: number[],
    candidates: RedistributionCandidate[]
  ): Record<number, number[]> | null => {
    const result = planRedistribution(players, candidates);
    return result && Object.fromEntries(result);
  };

  it("RED-01: runs only for enabled, scheduled, min set, 1 ≤ count < min", () => {
    expect(needsRedistribution(source(), 1)).toBe(true);
    expect(needsRedistribution(source(), 3)).toBe(true);
    expect(needsRedistribution(source(), 0)).toBe(false);
    expect(needsRedistribution(source(), 4)).toBe(false);
    expect(needsRedistribution(source({ min_players: null }), 2)).toBe(false);
    expect(needsRedistribution(source({ enabled: false }), 2)).toBe(false);
    expect(needsRedistribution(source({ status: "live" }), 2)).toBe(false);
    expect(needsRedistribution(source({ status: "failed" }), 2)).toBe(false);
  });

  it("RED-02: only candidates with an open seat are used", () => {
    expect(plan([1], [candidate(10, 0), candidate(11, 1)])).toEqual({
      11: [1],
    });
    expect(plan([1], [candidate(10, 0), candidate(11, -2)])).toBeNull();
  });

  it("RED-03: never places a player where they already hold a seat", () => {
    expect(plan([1], [candidate(10, 3, [1]), candidate(11, 3)])).toEqual({
      11: [1],
    });
  });

  it("RED-03: never places a player where they were denied", () => {
    expect(plan([1], [candidate(10, 3, [], [1]), candidate(11, 3)])).toEqual({
      11: [1],
    });
  });

  it("RED-04: nothing changes when total open seats are fewer than players", () => {
    expect(plan([1, 2, 3], [candidate(10, 1), candidate(11, 1)])).toBeNull();
  });

  it("RED-04: nothing changes when any single player can't be placed", () => {
    // Enough seats overall, but player 2 is denied in the only candidate.
    expect(plan([1, 2], [candidate(10, 5, [], [2])])).toBeNull();
  });

  it("RED-05: players go in the given order, each to the first allowed candidate with room", () => {
    expect(
      plan([3, 1, 2], [candidate(10, 2), candidate(11, 2), candidate(12, 2)])
    ).toEqual({ 10: [3, 1], 11: [2] });
  });

  it("RED-05: a candidate filled by earlier players is skipped", () => {
    expect(
      plan([1, 2], [candidate(10, 1, [], [2]), candidate(11, 1)])
    ).toEqual({ 10: [1], 11: [2] });
  });

  it("RED-05: the planner does not mutate its inputs", () => {
    const candidates = [candidate(10, 2)];
    planRedistribution([1, 2], candidates);
    expect(candidates[0].open).toBe(2);
    expect(candidates[0].members.size).toBe(0);
  });
});

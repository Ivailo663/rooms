import { describe, expect, it } from "vitest";
import {
  enabledDayPlayerInfo,
  hasGathered,
  liveSlotPlayerInfo,
  slotPlayerInfo,
} from "./slotQuorum";

const roster = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
    email: `p${i + 1}@example.invalid`,
  }));

describe("hasGathered", () => {
  it("LIFE-03: an empty slot never has quorum, even with no minimum", () => {
    expect(hasGathered(0, null)).toBe(false);
    expect(hasGathered(0, 0)).toBe(false);
  });

  it("LIFE-03: with no minimum, one player is quorum", () => {
    expect(hasGathered(1, null)).toBe(true);
  });

  it("LIFE-03: with a minimum, quorum starts exactly at the minimum", () => {
    expect(hasGathered(5, 6)).toBe(false);
    expect(hasGathered(6, 6)).toBe(true);
    expect(hasGathered(7, 6)).toBe(true);
  });
});

describe("slotPlayerInfo", () => {
  it("LIFE-03: re-checks the minimum for a scheduled slot", () => {
    const slot = { players: roster(3), min_players: 4, max_players: 10 };
    expect(slotPlayerInfo(slot)).toEqual({ count: 3, max: 10, gathered: false });
    expect(slotPlayerInfo({ ...slot, min_players: 3 }).gathered).toBe(true);
  });

  it("LIFE-03: a live slot counts as gathered whoever has left since", () => {
    const slot = { players: roster(1), min_players: 6, max_players: 10 };
    expect(slotPlayerInfo(slot, true).gathered).toBe(true);
    expect(slotPlayerInfo({ ...slot, players: [] }, true).gathered).toBe(true);
  });
});

describe("summary variants", () => {
  it("LIFE-03: the room-level live summary is always gathered", () => {
    const info = liveSlotPlayerInfo({
      players_count: 0,
      max_players: 10,
    } as Parameters<typeof liveSlotPlayerInfo>[0]);
    expect(info.gathered).toBe(true);
  });

  it("LIFE-03: a later day's summary re-checks the minimum", () => {
    const entry = (players_count: number, min_players: number | null) =>
      ({ players_count, min_players, max_players: 10 }) as Parameters<
        typeof enabledDayPlayerInfo
      >[0];
    expect(enabledDayPlayerInfo(entry(0, null)).gathered).toBe(false);
    expect(enabledDayPlayerInfo(entry(1, null)).gathered).toBe(true);
    expect(enabledDayPlayerInfo(entry(3, 4)).gathered).toBe(false);
    expect(enabledDayPlayerInfo(entry(4, 4)).gathered).toBe(true);
  });
});

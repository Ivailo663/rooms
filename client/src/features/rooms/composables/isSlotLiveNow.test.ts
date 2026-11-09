import { describe, expect, it } from "vitest";
import type { SlotStatus } from "@football/shared";
import { isSlotFailedNow, isSlotLiveNow } from "./isSlotLiveNow";

// Monday 26 Oct 2026; the slot runs 18:00–19:00 on Mondays.
const at = (h: number, m: number, date = 26) => new Date(2026, 9, date, h, m);
const slot = (status: SlotStatus) => ({ status, day: "mo", start_time: 18 * 60 });

describe.each([
  ["live", isSlotLiveNow],
  ["failed", isSlotFailedNow],
] as const)("%s presentation", (status, predicate) => {
  it(`LIFE-13: a ${status} slot shows as ${status} inside its window`, () => {
    expect(predicate(slot(status), at(18, 0))).toBe(true);
    expect(predicate(slot(status), at(18, 59))).toBe(true);
  });

  it(`LIFE-13: a leftover ${status} status before the window shows as scheduled`, () => {
    expect(predicate(slot(status), at(17, 59))).toBe(false);
  });

  it(`LIFE-13: a leftover ${status} status from start+60 shows as scheduled`, () => {
    expect(predicate(slot(status), at(19, 0))).toBe(false);
  });

  it(`LIFE-13: a leftover ${status} status on another weekday shows as scheduled`, () => {
    expect(predicate(slot(status), at(18, 30, 27))).toBe(false);
  });

  it(`LIFE-13: a scheduled slot inside the window is not ${status}`, () => {
    expect(predicate(slot("scheduled"), at(18, 30))).toBe(false);
  });
});

it("LIFE-13: Sunday slots resolve against Sunday's clock", () => {
  const sunday = { status: "live" as const, day: "su", start_time: 20 * 60 };
  expect(isSlotLiveNow(sunday, new Date(2026, 10, 1, 20, 15))).toBe(true);
  expect(isSlotLiveNow(sunday, new Date(2026, 9, 26, 20, 15))).toBe(false);
});

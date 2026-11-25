import { describe, expect, it } from "vitest";
import { getSlotAction, tileBottomText } from "./tileBottomText";

const idle = { pending: false, releasedEarly: false };

describe("tileBottomText", () => {
  it("CARD-31: join and leave say what holding does", () => {
    expect(tileBottomText({ state: "join" }, idle).text).toBe("Hold to join");
    expect(tileBottomText({ state: "leave" }, idle).text).toBe("Hold to leave");
  });

  it("CARD-33: letting go early says Keep holding, and only for join and leave", () => {
    const early = { pending: false, releasedEarly: true };
    expect(tileBottomText({ state: "join" }, early).text).toBe("Keep holding…");
    expect(tileBottomText({ state: "leave" }, early).text).toBe(
      "Keep holding…"
    );
    expect(tileBottomText({ state: "awaiting" }, early).text).toBe(
      "Awaiting approval"
    );
  });

  it("CARD-33: while in flight it reads Joining… or Leaving…, whatever else is set", () => {
    const busy = { pending: true, releasedEarly: true };
    expect(tileBottomText({ state: "join" }, busy).text).toBe("Joining…");
    expect(tileBottomText({ state: "leave" }, busy).text).toBe("Leaving…");
  });

  it("CARD-32: awaiting and declined have fixed words and icons", () => {
    expect(tileBottomText({ state: "awaiting" }, idle)).toEqual({
      text: "Awaiting approval",
      icon: "fa-user-clock",
    });
    expect(tileBottomText({ state: "declined" }, idle)).toEqual({
      text: "Not accepted",
      icon: "fa-circle-xmark",
    });
  });

  it("CARD-32: a status line carries its own label and icon, join and leave have none", () => {
    expect(
      tileBottomText(
        { state: "cantLeave", label: "Roster locked", icon: "fa-lock" },
        idle
      )
    ).toEqual({ text: "Roster locked", icon: "fa-lock" });
    expect(tileBottomText({ state: "cantJoin" }, idle).text).toBe("");
    expect(tileBottomText({ state: "join" }, idle).icon).toBeUndefined();
  });
});

describe("getSlotAction", () => {
  // A weekday that is never today, so the roster is never locked.
  const slot = (extra: object = {}) =>
    ({
      id: 1,
      day: "never",
      start_time: 600,
      status: "scheduled",
      max_players: 10,
      players: [],
      requestStatusForCurrentUser: null,
      ...extra,
    }) as never;
  const rules = { lateJoinCutoff: 30, allowJoinOnLive: false };
  const now = new Date(2026, 9, 26, 10, 0);
  const me = { id: 1, name: "Me" };

  it("CARD-30: an open slot is joinable, with the gate's reason when it isn't", () => {
    expect(getSlotAction(slot(), rules, now, [], 1)).toEqual({
      state: "join",
    });
    const full = slot({
      players: Array.from({ length: 10 }, (_, i) => ({ id: 100 + i })),
    });
    expect(getSlotAction(full, rules, now, [], 1)).toMatchObject({
      state: "cantJoin",
      label: "Game is full",
    });
  });

  it("CARD-30: a seat held in another game blocks the join", () => {
    const held = [{ timeslotId: 2, day: "never", start_time: 630 }];
    expect(getSlotAction(slot(), rules, now, held, 1)).toMatchObject({
      state: "cantJoin",
      label: "You're in another game",
    });
  });

  it("CARD-32: a seat held leaves, until the roster locks", () => {
    const mine = slot({ players: [me] });
    expect(getSlotAction(mine, rules, now, [], 1)).toEqual({ state: "leave" });

    // Monday 2026-10-26 is "mo": 20 minutes before a 10:20 start, inside the
    // 30-minute window.
    const locked = slot({ players: [me], day: "mo", start_time: 620 });
    expect(getSlotAction(locked, rules, now, [], 1)).toMatchObject({
      state: "cantLeave",
      label: "You're locked in",
    });
  });

  it("CARD-32: a pending request waits and a denied one is declined", () => {
    const pending = slot({ requestStatusForCurrentUser: "pending" });
    const denied = slot({ requestStatusForCurrentUser: "denied" });
    expect(getSlotAction(pending, rules, now, [], 1).state).toBe("awaiting");
    expect(getSlotAction(denied, rules, now, [], 1).state).toBe("declined");
  });

  it("CARD-32: a seat held outranks a request status, and a request outranks the join gates", () => {
    const both = slot({
      players: [me],
      requestStatusForCurrentUser: "denied",
    });
    expect(getSlotAction(both, rules, now, [], 1).state).toBe("leave");

    const full = slot({
      requestStatusForCurrentUser: "pending",
      players: Array.from({ length: 10 }, (_, i) => ({ id: 100 + i })),
    });
    expect(getSlotAction(full, rules, now, [], 1).state).toBe("awaiting");
  });

  it("CARD-30: without a signed-in user nobody holds a seat", () => {
    const mine = slot({ players: [me] });
    expect(getSlotAction(mine, rules, now, [], undefined).state).toBe("join");
  });
});

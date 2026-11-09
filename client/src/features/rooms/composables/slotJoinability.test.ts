import { describe, expect, it } from "vitest";
import type { PlayableRoomResponse, SlotStatus } from "@football/shared";
import {
  getSlotJoinability,
  getSlotLeavability,
  type HeldSlot,
} from "./slotJoinability";

type Slot = PlayableRoomResponse["timeslots"][number];

// Monday 26 Oct 2026. The slot under test runs Mondays 18:00–19:00 with a
// 15-minute cutoff, so its lock window is [17:45, 19:00).
const MON = 26;
const TUE = 27;
const at = (h: number, m: number, date = MON) => new Date(2026, 9, date, h, m);
const START = 18 * 60;
const CUTOFF = 15;

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 100,
    name: `P${i}`,
    email: `p${i}@example.invalid`,
  }));

const slot = (over: Partial<Slot> = {}): Slot => ({
  id: 1,
  name: "18:00",
  message: null,
  price: null,
  label: "18:00",
  features: [],
  players: [],
  max_players: 10,
  status: "scheduled",
  day: "mo",
  start_time: START,
  requestStatusForCurrentUser: null,
  ...over,
});

const room = { lateJoinCutoff: CUTOFF, allowJoinOnLive: false };
const liveRoom = { lateJoinCutoff: CUTOFF, allowJoinOnLive: true };
const OPEN = at(12, 0);

const held = (over: Partial<HeldSlot> = {}): HeldSlot => ({
  timeslotId: 2,
  day: "mo",
  start_time: START,
  ...over,
});

describe("getSlotJoinability", () => {
  it("joins an open scheduled slot", () => {
    expect(getSlotJoinability(slot(), room, OPEN)).toEqual({ joinable: true });
  });

  it.each(["failed", "redistributed", "ended"] as SlotStatus[])(
    "MEM-03: a %s slot is no-game",
    (status) => {
      expect(getSlotJoinability(slot({ status }), room, OPEN).reason).toBe(
        "no-game",
      );
    },
  );

  it("MEM-04: a live slot is blocked when allowJoinOnLive is false", () => {
    const r = getSlotJoinability(slot({ status: "live" }), room, at(18, 10));
    expect(r).toMatchObject({ joinable: false, reason: "live" });
  });

  it("MEM-04: a live slot is joinable when allowJoinOnLive is true, lock window notwithstanding", () => {
    const r = getSlotJoinability(slot({ status: "live" }), liveRoom, at(18, 10));
    expect(r).toEqual({ joinable: true });
  });

  // The spec says a permitted live join "continues to the next gates" (clash,
  // policy, full), and the server does so. The client returns joinable as soon
  // as allowJoinOnLive is true. Flip to `it` once the client is fixed.
  it.fails("MEM-04: a permitted live join still hits the clash gate", () => {
    const r = getSlotJoinability(slot({ status: "live" }), liveRoom, at(18, 10), [
      held({ start_time: START + 30 }),
    ]);
    expect(r.reason).toBe("clash");
  });

  it.fails("MEM-04: a permitted live join still hits the full gate", () => {
    const r = getSlotJoinability(
      slot({ status: "live", players: players(10) }),
      liveRoom,
      at(18, 10),
    );
    expect(r.reason).toBe("full");
  });

  describe("lock window (MEM-05 / LIFE-01)", () => {
    const reasonAt = (now: Date, s = slot()) =>
      getSlotJoinability(s, room, now).reason;

    it("MEM-05: LIFE-01: one minute before start−cutoff is open", () => {
      expect(reasonAt(at(17, 44))).toBeUndefined();
    });

    it("MEM-05: LIFE-01: start−cutoff itself is closed (inclusive)", () => {
      expect(reasonAt(at(17, 45))).toBe("closed");
    });

    it("MEM-05: LIFE-01: the last minute of the occurrence is closed", () => {
      expect(reasonAt(at(18, 59))).toBe("closed");
    });

    it("MEM-05: LIFE-01: start+60 is open again (exclusive)", () => {
      expect(reasonAt(at(19, 0))).toBeUndefined();
    });

    it("MEM-05: LIFE-01: the same clock time on another weekday is open", () => {
      expect(reasonAt(at(17, 50, TUE))).toBeUndefined();
    });

    it("MEM-05: LIFE-01: a Sunday slot locks on Sunday and only Sunday", () => {
      const sunday = slot({ day: "su" });
      expect(reasonAt(new Date(2026, 10, 1, 17, 50), sunday)).toBe("closed");
      expect(reasonAt(at(17, 50), sunday)).toBeUndefined();
    });

    it("MEM-05: LIFE-01: the window follows the room's cutoff", () => {
      const r = getSlotJoinability(
        slot(),
        { ...room, lateJoinCutoff: 60 },
        at(17, 0),
      );
      expect(r.reason).toBe("closed");
    });
  });

  describe("one game per hour (MEM-06 / MEM-20)", () => {
    const reasonWith = (h: HeldSlot) =>
      getSlotJoinability(slot(), room, OPEN, [h]).reason;

    it("MEM-06: MEM-20: a seat at the same time on the same day clashes", () => {
      expect(reasonWith(held())).toBe("clash");
    });

    it("MEM-06: MEM-20: a seat 59 minutes either side clashes", () => {
      expect(reasonWith(held({ start_time: START + 59 }))).toBe("clash");
      expect(reasonWith(held({ start_time: START - 59 }))).toBe("clash");
    });

    it("MEM-06: MEM-20: a seat exactly 60 minutes apart does not clash", () => {
      expect(reasonWith(held({ start_time: START + 60 }))).toBeUndefined();
      expect(reasonWith(held({ start_time: START - 60 }))).toBeUndefined();
    });

    it("MEM-06: MEM-20: a seat at the same time on another day does not clash", () => {
      expect(reasonWith(held({ day: "tu" }))).toBeUndefined();
    });

    it("MEM-06: MEM-20: the slot's own seat is ignored", () => {
      expect(reasonWith(held({ timeslotId: 1 }))).toBeUndefined();
    });
  });

  it("MEM-08: a slot at max_players is full", () => {
    const r = getSlotJoinability(slot({ players: players(10) }), room, OPEN);
    expect(r).toMatchObject({ joinable: false, reason: "full" });
    expect(
      getSlotJoinability(slot({ players: players(9) }), room, OPEN).joinable,
    ).toBe(true);
  });

  describe("gate order", () => {
    const full = players(10);
    const clashing = [held()];

    it("MEM-03: no-game wins over the lock window, a clash and a full roster", () => {
      const s = slot({ status: "failed", players: full });
      expect(getSlotJoinability(s, room, at(18, 10), clashing).reason).toBe(
        "no-game",
      );
    });

    it("MEM-04: a blocked live join wins over a clash and a full roster", () => {
      const s = slot({ status: "live", players: full });
      expect(getSlotJoinability(s, room, at(18, 10), clashing).reason).toBe(
        "live",
      );
    });

    it("MEM-05: a full slot inside the lock window reports closed, not full", () => {
      const s = slot({ players: full });
      expect(getSlotJoinability(s, room, at(17, 50)).reason).toBe("closed");
    });

    it("MEM-05: a clash inside the lock window reports closed", () => {
      expect(getSlotJoinability(slot(), room, at(17, 50), clashing).reason).toBe(
        "closed",
      );
    });

    it("MEM-06: a clash on a full slot reports clash, not full", () => {
      const s = slot({ players: full });
      expect(getSlotJoinability(s, room, OPEN, clashing).reason).toBe("clash");
    });
  });
});

describe("getSlotLeavability", () => {
  const joined = (status: SlotStatus = "scheduled") => ({
    status,
    day: "mo",
    start_time: START,
  });

  it("MEM-12: leaving is open before start−cutoff", () => {
    expect(getSlotLeavability(joined(), CUTOFF, at(17, 44))).toEqual({
      canLeave: true,
    });
  });

  it("MEM-12: leaving is closed from start−cutoff (inclusive)", () => {
    expect(getSlotLeavability(joined(), CUTOFF, at(17, 45))).toMatchObject({
      canLeave: false,
      label: "You're locked in",
    });
  });

  it("MEM-12: leaving stays closed through a live game", () => {
    expect(getSlotLeavability(joined("live"), CUTOFF, at(18, 30))).toMatchObject(
      { canLeave: false, label: "Game in progress" },
    );
  });

  it.each(["failed", "redistributed"] as SlotStatus[])(
    "MEM-12: leaving stays closed after a %s verdict",
    (status) => {
      expect(getSlotLeavability(joined(status), CUTOFF, at(17, 50)).canLeave).toBe(
        false,
      );
      expect(getSlotLeavability(joined(status), CUTOFF, at(18, 30)).canLeave).toBe(
        false,
      );
    },
  );

  it("MEM-12: a failed slot during its hour says there is no game", () => {
    expect(getSlotLeavability(joined("failed"), CUTOFF, at(18, 30)).label).toBe(
      "No game this round",
    );
  });

  it("MEM-12: leaving reopens at start+60 (exclusive)", () => {
    expect(getSlotLeavability(joined("live"), CUTOFF, at(19, 0)).canLeave).toBe(
      true,
    );
  });

  it("MEM-12: the same clock time on another weekday is open", () => {
    expect(getSlotLeavability(joined(), CUTOFF, at(17, 50, TUE)).canLeave).toBe(
      true,
    );
  });
});

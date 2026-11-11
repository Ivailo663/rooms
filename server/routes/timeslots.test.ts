import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    account: { findUnique: vi.fn() },
    roomTimeslot: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../prisma.js", () => ({ default: prisma }));
vi.mock("../scheduler.js", () => ({ syncSlot: vi.fn() }));

import { registerTimeslotRoutes } from "./timeslots.js";

const handlers = new Map<string, RequestHandler>();
registerTimeslotRoutes({
  get: (path: string, h: RequestHandler) => handlers.set(`GET ${path}`, h),
  post: (path: string, h: RequestHandler) => handlers.set(`POST ${path}`, h),
  put: (path: string, h: RequestHandler) => handlers.set(`PUT ${path}`, h),
  delete: (path: string, h: RequestHandler) =>
    handlers.set(`DELETE ${path}`, h),
} as unknown as Application);

const update = async (body: object) => {
  const next = vi.fn();
  await handlers.get("PUT /timeslots")!(
    { body: { id: 5, ...body } } as never,
    { locals: { user: { email: "a@b.c" } }, send: vi.fn() } as never,
    next
  );
  return next.mock.calls[0]?.[0];
};

describe("PUT /timeslots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.account.findUnique.mockResolvedValue({ id: 7 });
    prisma.roomTimeslot.findFirst.mockResolvedValue({
      id: 5,
      min_players: 8,
      max_players: 10,
    });
  });

  it("SLOT-17: lowering max below the stored min is 400 and changes nothing", async () => {
    const error = await update({ max_players: 6 });
    expect(error).toMatchObject({ status: 400 });
    expect(prisma.roomTimeslot.update).not.toHaveBeenCalled();
  });

  it("SLOT-17: a change that keeps 1 ≤ min ≤ max is saved", async () => {
    const error = await update({ min_players: 6, max_players: 6 });
    expect(error).toBeUndefined();
    expect(prisma.roomTimeslot.update).toHaveBeenCalled();
  });
});

describe("GET /timeslots/enabled/days", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.account.findUnique.mockResolvedValue({ id: 7 });
  });

  it("SLOT-20: each day's first slot carries its roster (id and name only), counted from the same list", async () => {
    prisma.roomTimeslot.findMany.mockResolvedValue([
      {
        id: 4,
        day: "Monday",
        label: "18:00",
        min_players: 6,
        max_players: 10,
        timeslot_players: [
          { accounts: { id: 11, name: "Ann" } },
          { accounts: { id: 12, name: "Bob" } },
        ],
      },
      {
        id: 9,
        day: "Tuesday",
        label: "19:00",
        min_players: null,
        max_players: 10,
        timeslot_players: [],
      },
    ]);
    const send = vi.fn();
    const next = vi.fn();

    await handlers.get("GET /timeslots/enabled/days")!(
      { query: { room_id: "1" } } as never,
      { locals: { user: { email: "a@b.c" } }, send } as never,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(send.mock.calls[0][0]).toEqual([
      {
        day: "Monday",
        label: "18:00",
        timeslotId: 4,
        players_count: 2,
        players: [
          { id: 11, name: "Ann" },
          { id: 12, name: "Bob" },
        ],
        min_players: 6,
        max_players: 10,
      },
      {
        day: "Tuesday",
        label: "19:00",
        timeslotId: 9,
        players_count: 0,
        players: [],
        min_players: null,
        max_players: 10,
      },
    ]);
    // One query, still scoped to the caller's room, roster from the same
    // membership rows the count used to come from.
    expect(prisma.roomTimeslot.findMany).toHaveBeenCalledTimes(1);
    const query = prisma.roomTimeslot.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ roomId: 1, room: { creatorId: 7 } });
    expect(query.select.timeslot_players).toEqual({
      select: { accounts: { select: { id: true, name: true } } },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    account: { findUnique: vi.fn() },
    room: { findFirst: vi.fn() },
    roomTimeslot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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
    { locals: { user: { uid: "uid-1" } }, send: vi.fn() } as never,
    next
  );
  return next.mock.calls[0]?.[0];
};

describe("PUT /timeslots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.account.findUnique.mockResolvedValue({ id: 7, role: "clientAdmin" });
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
    prisma.account.findUnique.mockResolvedValue({ id: 7, role: "player" });
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
      { locals: { user: { uid: "uid-1" } }, send } as never,
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

// Ownership is the `creatorId` filter inside findFirst, so "owns the room" is a
// findFirst that resolves a row and "doesn't" is one that resolves null.
describe("ROLE-11: slot writes need clientAdmin and owning the room", () => {
  const slotBody = {
    room_id: 1,
    order: 18,
    day: "mo",
    name: "Evening",
    label: "18:00",
    min_players: 6,
    max_players: 10,
    message: "",
    features: [],
  };

  const writes = {
    create: () => send("POST /timeslots", { body: slotBody }),
    update: () => send("PUT /timeslots", { body: { id: 5, max_players: 10 } }),
    delete: () => send("DELETE /timeslots/:id", { params: { id: "5" } }),
  };

  const send = async (route: string, req: object) => {
    const next = vi.fn();
    await handlers.get(route)!(
      req as never,
      { locals: { user: { uid: "uid-1" } }, send: vi.fn() } as never,
      next
    );
    return next.mock.calls[0]?.[0];
  };

  const ownsRoom = (owns: boolean) => {
    prisma.room.findFirst.mockResolvedValue(owns ? { id: 1 } : null);
    prisma.roomTimeslot.findFirst.mockResolvedValue(
      owns ? { id: 5, min_players: 6, max_players: 10 } : null
    );
  };

  const nothingWritten = () => {
    expect(prisma.roomTimeslot.create).not.toHaveBeenCalled();
    expect(prisma.roomTimeslot.update).not.toHaveBeenCalled();
    expect(prisma.roomTimeslot.delete).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.roomTimeslot.create.mockResolvedValue({ id: 5 });
  });

  for (const [name, write] of Object.entries(writes)) {
    it(`ROLE-11: a player who owns the room gets 403 on ${name}, before the ownership lookup`, async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 7, role: "player" });
      ownsRoom(true);

      expect(await write()).toMatchObject({
        status: 403,
        message: "Your role can't do this",
      });
      expect(prisma.room.findFirst).not.toHaveBeenCalled();
      expect(prisma.roomTimeslot.findFirst).not.toHaveBeenCalled();
      nothingWritten();
    });

    it(`ROLE-11: a clientAdmin who owns the room can ${name}`, async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 7,
        role: "clientAdmin",
      });
      ownsRoom(true);

      expect(await write()).toBeUndefined();
    });

    it(`ROLE-11: a clientAdmin who doesn't own the room still gets 404 on ${name}`, async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 9,
        role: "clientAdmin",
      });
      ownsRoom(false);

      expect(await write()).toMatchObject({ status: 404 });
      nothingWritten();
    });
  }

  it("ROLE-11: the owner check is scoped to the caller's account", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 7, role: "superAdmin" });
    ownsRoom(true);

    await writes.create();
    await writes.update();

    expect(prisma.room.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 1,
      creatorId: 7,
    });
    expect(prisma.roomTimeslot.findFirst.mock.calls[0][0].where).toMatchObject({
      room: { creatorId: 7 },
    });
  });
});

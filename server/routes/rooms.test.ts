import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    account: { findUnique: vi.fn() },
    room: { create: vi.fn(), findMany: vi.fn() },
    timeslotJoinRequest: { findMany: vi.fn() },
  },
}));

vi.mock("../prisma.js", () => ({ default: prisma }));

import { registerRoomRoutes } from "./rooms.js";

const handlers = new Map<string, RequestHandler>();
registerRoomRoutes({
  get: (path: string, h: RequestHandler) => handlers.set(`GET ${path}`, h),
  post: (path: string, h: RequestHandler) => handlers.set(`POST ${path}`, h),
} as unknown as Application);

const createRoom = async (role: string) => {
  prisma.account.findUnique.mockResolvedValue({ id: 7, role });
  prisma.room.create.mockResolvedValue({ id: 1 });
  const next = vi.fn();
  await handlers.get("POST /rooms")!(
    { body: { name: "Pitch", description: "", price: 10 } } as never,
    { locals: { user: { uid: "uid-1" } }, send: vi.fn() } as never,
    next
  );
  return next.mock.calls[0]?.[0];
};

describe("POST /rooms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ROLE-10: a player gets 403 and no room is created", async () => {
    const error = await createRoom("player");
    expect(error).toMatchObject({
      status: 403,
      message: "Your role can't do this",
    });
    expect(prisma.room.create).not.toHaveBeenCalled();
  });

  it("AUTH-01: the caller is looked up by Firebase uid", async () => {
    await createRoom("clientAdmin");
    expect(prisma.account.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firebase_uid: "uid-1" } }),
    );
  });

  it("ROLE-10: a clientAdmin can create a room", async () => {
    expect(await createRoom("clientAdmin")).toBeUndefined();
    expect(prisma.room.create).toHaveBeenCalledTimes(1);
  });

  it("ROLE-10: a superAdmin can create a room", async () => {
    expect(await createRoom("superAdmin")).toBeUndefined();
    expect(prisma.room.create).toHaveBeenCalledTimes(1);
  });

  it("SLOT-02: the caller owns the new room, whatever the body says", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 7, role: "clientAdmin" });
    prisma.room.create.mockResolvedValue({ id: 1 });
    const next = vi.fn();

    await handlers.get("POST /rooms")!(
      {
        body: { name: "Pitch", description: "", price: 10, creator_id: 99 },
      } as never,
      { locals: { user: { uid: "uid-1" } }, send: vi.fn() } as never,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(prisma.room.create.mock.calls[0][0].data).toMatchObject({
      creatorId: 7,
    });
    expect(prisma.room.create.mock.calls[0][0].data).not.toHaveProperty(
      "creator_id"
    );
  });
});

describe("GET /rooms/hosted", () => {
  const getHosted = async () => {
    const send = vi.fn();
    const next = vi.fn();
    await handlers.get("GET /rooms/hosted")!(
      { query: {} } as never,
      { locals: { user: { uid: "uid-1" } }, send } as never,
      next
    );
    expect(next).not.toHaveBeenCalled();
    return send.mock.calls[0][0];
  };

  const room = (timeslots: object[]) => ({
    id: 1,
    name: "Pitch",
    description: null,
    price: 10,
    address: "",
    timeslots,
  });

  it("SLOT-20: the live slot carries its roster (id and name only), counted from the same list", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 7 });
    prisma.timeslotJoinRequest.findMany.mockResolvedValue([]);
    prisma.room.findMany.mockResolvedValue([
      room([
        {
          id: 3,
          label: "18:00",
          start_time: 1080,
          max_players: 10,
          day: "Monday",
          timeslot_players: [
            { accounts: { id: 11, name: "Ann" } },
            { accounts: { id: 12, name: "Bob" } },
          ],
        },
      ]),
    ]);

    const [hosted] = await getHosted();

    expect(hosted.liveSlot).toMatchObject({
      id: 3,
      players_count: 2,
      players: [
        { id: 11, name: "Ann" },
        { id: 12, name: "Bob" },
      ],
    });
    // Same membership source as the count, and no email on the wire.
    const query = prisma.room.findMany.mock.calls[0][0];
    expect(query.select.timeslots.select.timeslot_players).toEqual({
      select: { accounts: { select: { id: true, name: true } } },
    });
    expect(query.select.timeslots.select).not.toHaveProperty("_count");
    expect(prisma.room.findMany).toHaveBeenCalledTimes(1);
  });

  it("SLOT-20: a live slot with nobody in it has an empty roster", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 7 });
    prisma.timeslotJoinRequest.findMany.mockResolvedValue([]);
    prisma.room.findMany.mockResolvedValue([
      room([
        {
          id: 3,
          label: "18:00",
          start_time: 1080,
          max_players: 10,
          day: "Monday",
          timeslot_players: [],
        },
      ]),
    ]);

    const [hosted] = await getHosted();

    expect(hosted.liveSlot).toMatchObject({ players_count: 0, players: [] });
  });
});

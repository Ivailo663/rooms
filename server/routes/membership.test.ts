import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";
import type { Server } from "socket.io";

const { prisma, redistributeSlot } = vi.hoisted(() => {
  const prisma = {
    account: { findUnique: vi.fn() },
    roomTimeslot: { findUnique: vi.fn() },
    timeslotPlayer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    timeslotJoinRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    // The join runs inside a transaction; the mock hands it the same client.
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  return { prisma, redistributeSlot: vi.fn() };
});

vi.mock("../prisma.js", () => ({ default: prisma }));
vi.mock("../redistribution.js", () => ({
  TIMESLOT_MEMBERSHIP_CHANGED_EVENT: "timeslot-membership-changed",
  getUpdatedPlayers: vi.fn(),
  redistributeSlot,
}));

import { registerMembershipRoutes } from "./membership.js";

// Collects the registered handlers so a route can be called without a server.
const handlers = new Map<string, RequestHandler>();
const app = {
  get: (path: string, h: RequestHandler) => handlers.set(`GET ${path}`, h),
  post: (path: string, h: RequestHandler) => handlers.set(`POST ${path}`, h),
  delete: (path: string, h: RequestHandler) =>
    handlers.set(`DELETE ${path}`, h),
} as unknown as Application;
const io = { emit: vi.fn() } as unknown as Server;
registerMembershipRoutes(app, io);

const call = async (
  route: string,
  callerId: number,
  role: string = "clientAdmin"
) => {
  prisma.account.findUnique.mockResolvedValue({ id: callerId, name: "x", role });
  const res = { locals: { user: { uid: "uid-1" } }, send: vi.fn() };
  const next = vi.fn();
  await handlers.get(route)!(
    { params: { id: "5", accountId: "11" }, body: {} } as never,
    res as never,
    next
  );
  return { res, error: next.mock.calls[0]?.[0] };
};

const redistribute = (callerId: number) =>
  call("POST /timeslots/:id/redistribute", callerId);

const slot = (room: { creatorId: number }) => ({
  day: "mo",
  start_time: 1080,
  max_players: 10,
  _count: { timeslot_players: 3 },
  room: { id: 1, ...room },
});

beforeEach(() => vi.clearAllMocks());

describe("POST /timeslots/:id/redistribute", () => {
  it("RED-08: the room owner can redistribute", async () => {
    prisma.roomTimeslot.findUnique.mockResolvedValue(slot({ creatorId: 7 }));
    const { res, error } = await redistribute(7);
    expect(error).toBeUndefined();
    expect(redistributeSlot).toHaveBeenCalledWith(5, io);
    expect(res.send).toHaveBeenCalled();
  });

  it("RED-08: anyone else gets 403 and nothing runs", async () => {
    prisma.roomTimeslot.findUnique.mockResolvedValue(slot({ creatorId: 7 }));
    const { error } = await redistribute(9);
    expect(error).toMatchObject({
      status: 403,
      message: "You do not manage this room",
    });
    expect(redistributeSlot).not.toHaveBeenCalled();
  });

  it("RED-08: an unknown slot gets 404 and nothing runs", async () => {
    prisma.roomTimeslot.findUnique.mockResolvedValue(null);
    const { error } = await redistribute(7);
    expect(error).toMatchObject({ status: 404 });
    expect(redistributeSlot).not.toHaveBeenCalled();
  });
});

describe("POST /timeslots/:id/join", () => {
  it("MEM-10: a disabled slot answers 404 and nothing is created", async () => {
    prisma.roomTimeslot.findUnique.mockResolvedValue({
      ...slot({ creatorId: 7 }),
      status: "scheduled",
      enabled: false,
    });
    const { error } = await call("POST /timeslots/:id/join", 9, "player");
    expect(error).toMatchObject({ status: 404, message: "Timeslot not found" });
    expect(prisma.timeslotPlayer.create).not.toHaveBeenCalled();
    expect(prisma.timeslotJoinRequest.create).not.toHaveBeenCalled();
    expect(prisma.timeslotJoinRequest.upsert).not.toHaveBeenCalled();
  });
});

// The owner-side request and redistribution routes. A player who created the
// room is the case the role check exists for: ownership alone would let them in.
describe("ROLE-11: owner-side slot routes need clientAdmin and owning the room", () => {
  const routes = [
    "POST /timeslots/:id/redistribute",
    "POST /timeslots/:id/requests/:accountId/approve",
    "POST /timeslots/:id/requests/:accountId/deny",
    "DELETE /timeslots/:id/requests/:accountId",
  ];

  for (const route of routes) {
    it(`ROLE-11: a player who owns the room gets 403 on ${route}, before the ownership lookup`, async () => {
      prisma.roomTimeslot.findUnique.mockResolvedValue(slot({ creatorId: 7 }));
      const { error } = await call(route, 7, "player");
      expect(error).toMatchObject({
        status: 403,
        message: "Your role can't do this",
      });
      expect(prisma.roomTimeslot.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.timeslotJoinRequest.updateMany).not.toHaveBeenCalled();
      expect(prisma.timeslotJoinRequest.deleteMany).not.toHaveBeenCalled();
      expect(redistributeSlot).not.toHaveBeenCalled();
    });

    it(`ROLE-11: a clientAdmin who doesn't own the room still gets "You do not manage this room" on ${route}`, async () => {
      prisma.roomTimeslot.findUnique.mockResolvedValue(slot({ creatorId: 7 }));
      const { error } = await call(route, 9, "clientAdmin");
      expect(error).toMatchObject({
        status: 403,
        message: "You do not manage this room",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.timeslotJoinRequest.updateMany).not.toHaveBeenCalled();
      expect(prisma.timeslotJoinRequest.deleteMany).not.toHaveBeenCalled();
      expect(redistributeSlot).not.toHaveBeenCalled();
    });
  }

  it("ROLE-11: a clientAdmin owner gets past both checks on approve", async () => {
    prisma.roomTimeslot.findUnique.mockResolvedValue(slot({ creatorId: 7 }));
    // No such request: the 404 can only come from inside the transaction, so
    // the role and ownership checks both passed.
    prisma.timeslotJoinRequest.findUnique.mockResolvedValue(null);
    const { error } = await call(
      "POST /timeslots/:id/requests/:accountId/approve",
      7,
      "clientAdmin"
    );
    expect(error).toMatchObject({ status: 404, message: "Request not found" });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("ROLE-11: a clientAdmin owner can deny", async () => {
    prisma.roomTimeslot.findUnique.mockResolvedValue(slot({ creatorId: 7 }));
    prisma.timeslotJoinRequest.updateMany.mockResolvedValue({ count: 1 });
    const { error, res } = await call(
      "POST /timeslots/:id/requests/:accountId/deny",
      7,
      "clientAdmin"
    );
    expect(error).toBeUndefined();
    expect(prisma.timeslotJoinRequest.updateMany).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });
});

describe("ROLE-12: joining needs only a sign-in", () => {
  it("ROLE-12: a player can join a slot", async () => {
    // A live slot that allows walk-ins, so the lock window (which depends on
    // today's date) never comes into it.
    prisma.roomTimeslot.findUnique.mockResolvedValue({
      ...slot({ creatorId: 7 }),
      status: "live",
      enabled: true,
      room: {
        id: 1,
        tenantid: null,
        tenant: { settings: { allowJoinOnLive: true } },
      },
    });
    prisma.timeslotPlayer.findUnique.mockResolvedValue(null);
    prisma.timeslotPlayer.findFirst.mockResolvedValue(null);
    prisma.timeslotJoinRequest.findMany.mockResolvedValue([]);

    const { error, res } = await call("POST /timeslots/:id/join", 9, "player");

    expect(error).toBeUndefined();
    expect(prisma.timeslotPlayer.create).toHaveBeenCalled();
    expect(res.send.mock.calls[0][0]).toMatchObject({ status: "joined" });
  });
});

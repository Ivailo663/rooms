import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";
import type { Server } from "socket.io";

const { prisma, redistributeSlot } = vi.hoisted(() => {
  const prisma = {
    account: { findUnique: vi.fn() },
    roomTimeslot: { findUnique: vi.fn() },
    timeslotPlayer: { findUnique: vi.fn(), create: vi.fn() },
    timeslotJoinRequest: { create: vi.fn(), upsert: vi.fn() },
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

const call = async (route: string, callerId: number) => {
  prisma.account.findUnique.mockResolvedValue({ id: callerId, name: "x" });
  const res = { locals: { user: { email: "a@b.c" } }, send: vi.fn() };
  const next = vi.fn();
  await handlers.get(route)!(
    { params: { id: "5" }, body: {} } as never,
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
    const { error } = await call("POST /timeslots/:id/join", 9);
    expect(error).toMatchObject({ status: 404, message: "Timeslot not found" });
    expect(prisma.timeslotPlayer.create).not.toHaveBeenCalled();
    expect(prisma.timeslotJoinRequest.create).not.toHaveBeenCalled();
    expect(prisma.timeslotJoinRequest.upsert).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    account: { findUnique: vi.fn() },
    roomTimeslot: { findFirst: vi.fn(), update: vi.fn() },
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

import { describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    account: { findUnique: vi.fn() },
    room: { create: vi.fn() },
  },
}));

vi.mock("../prisma.js", () => ({ default: prisma }));

import { registerRoomRoutes } from "./rooms.js";

const handlers = new Map<string, RequestHandler>();
registerRoomRoutes({
  get: (path: string, h: RequestHandler) => handlers.set(`GET ${path}`, h),
  post: (path: string, h: RequestHandler) => handlers.set(`POST ${path}`, h),
} as unknown as Application);

describe("POST /rooms", () => {
  it("SLOT-02: the caller owns the new room, whatever the body says", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 7 });
    prisma.room.create.mockResolvedValue({ id: 1 });
    const next = vi.fn();

    await handlers.get("POST /rooms")!(
      {
        body: { name: "Pitch", description: "", price: 10, creator_id: 99 },
      } as never,
      { locals: { user: { email: "a@b.c" } }, send: vi.fn() } as never,
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

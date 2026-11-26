import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    account: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("../prisma.js", () => ({ default: prisma }));

import { Role, type AccountRole } from "../../packages/shared/index.js";
import { createFakeApp } from "../testing/fakeApp.js";
import { registerAccountRoutes } from "./accounts.js";

const { app, handlers } = createFakeApp();
registerAccountRoutes(app);

const search = async (role: AccountRole, term: string) => {
  prisma.account.findUnique.mockResolvedValue({ id: 7, name: "x", role });
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const next = vi.fn();

  await handlers.get("GET /accounts")!(
    { query: { search: term } } as never,
    { locals: { user: { uid: "uid-1" } }, status } as never,
    next,
  );

  return { error: next.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
};

describe("GET /accounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("API-04: a player gets 403 and no search runs", async () => {
    const { error, body } = await search(Role.player, "ann");

    expect(error).toMatchObject({
      status: 403,
      message: "Your role can't do this",
    });
    expect(body).toBeUndefined();
    expect(prisma.account.findMany).not.toHaveBeenCalled();
  });

  it("API-04: a clientAdmin gets the matching accounts", async () => {
    const found = [{ id: 3, name: "Ann", email: "ann@example.com" }];
    prisma.account.findMany.mockResolvedValue(found);

    const { error, body } = await search(Role.clientAdmin, "ann");

    expect(error).toBeUndefined();
    expect(body).toEqual(found);
  });

  it("API-04: a superAdmin gets the matching accounts", async () => {
    prisma.account.findMany.mockResolvedValue([]);

    const { error, body } = await search(Role.superAdmin, "ann");

    expect(error).toBeUndefined();
    expect(body).toEqual([]);
  });
});

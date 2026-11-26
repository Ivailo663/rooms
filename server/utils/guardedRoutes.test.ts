import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Application } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { account: { findUnique: vi.fn() } },
}));

vi.mock("../prisma.js", () => ({ default: prisma }));

import { Role, type AccountRole } from "../../packages/shared/index.js";
import { createGuardedRoutes, requireRole } from "./guardedRoutes.js";

const run = async (minimum: AccountRole, locals: object) => {
  const next = vi.fn();
  await requireRole(minimum)({} as never, { locals } as never, next);
  return next;
};

const signedIn = { user: { uid: "uid-1" } };

describe("requireRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ROLE-15: a caller below the minimum gets 403 and the chain stops", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 1, role: Role.player });

    const next = await run(Role.clientAdmin, signedIn);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      status: 403,
      message: "Your role can't do this",
    });
  });

  it("ROLE-15: a clientAdmin is refused a superAdmin endpoint", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 1,
      role: Role.clientAdmin,
    });

    const next = await run(Role.superAdmin, signedIn);

    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 });
  });

  it("ROLE-15: a role the server doesn't know is refused", async () => {
    prisma.account.findUnique.mockResolvedValue({ id: 1, role: "host" });

    const next = await run(Role.clientAdmin, signedIn);

    expect(next.mock.calls[0][0]).toMatchObject({ status: 403 });
  });

  it("ROLE-15: a caller at or above the minimum passes, looked up by uid", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: 1,
      role: Role.superAdmin,
    });

    const next = await run(Role.clientAdmin, signedIn);

    expect(next).toHaveBeenCalledWith();
    expect(prisma.account.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { firebase_uid: "uid-1" } }),
    );
  });

  it("ROLE-15: a player endpoint passes without an account lookup", async () => {
    const next = await run(Role.player, signedIn);

    expect(next).toHaveBeenCalledWith();
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it("API-01: a route reached without a verified token is 401", async () => {
    const next = await run(Role.player, {});

    expect(next.mock.calls[0][0]).toMatchObject({
      status: 401,
      message: "No token",
    });
  });
});

describe("createGuardedRoutes", () => {
  it("ROLE-15: the role check is registered ahead of the handler", () => {
    const app = { get: vi.fn() };
    const handler = vi.fn();

    createGuardedRoutes(app as unknown as Application).get(
      "/x",
      Role.clientAdmin,
      handler,
    );

    const [path, guard, last] = app.get.mock.calls[0];
    expect(path).toBe("/x");
    expect(typeof guard).toBe("function");
    expect(guard).not.toBe(handler);
    expect(last).toBe(handler);
  });

  it("ROLE-15: no route file registers an endpoint around the role check", () => {
    const routesDir = fileURLToPath(new URL("../routes/", import.meta.url));
    const direct =
      /\bapp\s*(?:\.\s*|\[\s*["'`])(get|post|put|patch|delete|all|use|route)\b/;

    const offenders = readdirSync(routesDir)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .flatMap((file) =>
        readFileSync(routesDir + file, "utf8")
          .split("\n")
          .map((line, index) => ({ file, line: index + 1, text: line }))
          .filter(({ text }) => direct.test(text))
          .map(({ file, line, text }) => `${file}:${line} ${text.trim()}`),
      );

    expect(offenders).toEqual([]);
  });
});

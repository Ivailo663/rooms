import { describe, expect, it, vi } from "vitest";
import { assertRole, canManageTenant } from "./tenantAccess.js";
import {
  AUTHENTICATED_PATHS,
  verifyFirebaseToken,
} from "./middleware/verifyFirebaseToken.js";

// The middleware imports the Firebase admin app at module load; stub it so the
// test needs no service account. vi.mock is hoisted above the imports.
vi.mock("./firebase.js", () => ({
  default: { auth: () => ({ verifyIdToken: vi.fn() }) },
}));

describe("canManageTenant", () => {
  it("SET-09: a clientAdmin manages their own tenant", () => {
    expect(canManageTenant({ role: "clientAdmin", tenantid: 7 }, 7)).toBe(true);
  });

  it("SET-09: a clientAdmin does not manage another tenant", () => {
    expect(canManageTenant({ role: "clientAdmin", tenantid: 7 }, 8)).toBe(false);
  });

  it("SET-09: a clientAdmin with no tenant manages none", () => {
    expect(canManageTenant({ role: "clientAdmin", tenantid: null }, 7)).toBe(
      false
    );
  });

  it("SET-09: a player manages no tenant, even their own", () => {
    expect(canManageTenant({ role: "player", tenantid: 7 }, 7)).toBe(false);
  });

  it("SET-09: a superAdmin manages any tenant", () => {
    expect(canManageTenant({ role: "superAdmin", tenantid: null }, 7)).toBe(
      true
    );
    expect(canManageTenant({ role: "superAdmin", tenantid: 3 }, 7)).toBe(true);
  });

  it("SET-09: an unknown caller manages no tenant", () => {
    expect(canManageTenant(null, 7)).toBe(false);
  });
});

describe("assertRole", () => {
  it("ROLE-06: a role below the minimum gets 403 \"Your role can't do this\"", () => {
    expect(() => assertRole({ role: "player" }, "clientAdmin")).toThrow(
      expect.objectContaining({ status: 403, message: "Your role can't do this" })
    );
    expect(() => assertRole({ role: "clientAdmin" }, "superAdmin")).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  it("ROLE-01: roles are cumulative, so the minimum and anything above pass", () => {
    expect(() => assertRole({ role: "player" }, "player")).not.toThrow();
    expect(() => assertRole({ role: "clientAdmin" }, "clientAdmin")).not.toThrow();
    expect(() => assertRole({ role: "superAdmin" }, "clientAdmin")).not.toThrow();
  });

  it("ROLE-01: a role outside the hierarchy (the DB still has host) is refused", () => {
    expect(() =>
      assertRole({ role: "host" } as never, "clientAdmin")
    ).toThrow(expect.objectContaining({ status: 403 }));
  });
});

describe("auth on /tenants", () => {
  it("SET-06: /tenants is behind verifyFirebaseToken", () => {
    expect(AUTHENTICATED_PATHS).toContain("/tenants");
  });

  it("SET-06: a request without a token is rejected 401 \"No token\"", async () => {
    const next = vi.fn();
    await verifyFirebaseToken(
      { headers: {} } as never,
      { locals: {} } as never,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({
      status: 401,
      message: "No token",
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { canManageTenant } from "./tenantAccess.js";
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

  it("SET-09: a player or host manages no tenant, even their own", () => {
    expect(canManageTenant({ role: "player", tenantid: 7 }, 7)).toBe(false);
    expect(canManageTenant({ role: "host", tenantid: 7 }, 7)).toBe(false);
    expect(canManageTenant({ role: "owner", tenantid: 7 }, 7)).toBe(false);
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

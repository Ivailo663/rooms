import { describe, it, expect } from "vitest";
import { canManageVenue } from "./role";

// Mirrors the server's canManageTenant (server/tenantAccess.test.ts) for the
// caller's own tenant: Settings shows exactly when the server would allow it.
describe("canManageVenue", () => {
  it("SET-10: a clientAdmin with a tenant gets Settings", () => {
    expect(canManageVenue({ role: "clientAdmin", tenantid: 1 })).toBe(true);
  });

  it("SET-10: a clientAdmin without a tenant doesn't", () => {
    expect(canManageVenue({ role: "clientAdmin", tenantid: null })).toBe(false);
  });

  it("SET-10: a superAdmin gets Settings, with or without a tenant", () => {
    expect(canManageVenue({ role: "superAdmin", tenantid: 1 })).toBe(true);
    expect(canManageVenue({ role: "superAdmin", tenantid: null })).toBe(true);
  });

  it("SET-10: players and hosts don't, even with a tenant", () => {
    expect(canManageVenue({ role: "player", tenantid: 1 })).toBe(false);
    expect(canManageVenue({ role: "host", tenantid: 1 })).toBe(false);
  });

  it("SET-10: no account yet means no Settings", () => {
    expect(canManageVenue(null)).toBe(false);
    expect(canManageVenue({})).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { Cap, canManageVenue, getCapabilitiesForRole } from "./role";

// Mirrors the server's role checks (ROLE-06/10/11): what the UI offers is what
// the server will accept.
describe("getCapabilitiesForRole", () => {
  it("ROLE-02: a player can join and leave but not create or edit rooms", () => {
    const caps = getCapabilitiesForRole("player");
    expect(caps.has(Cap.timeslots.join)).toBe(true);
    expect(caps.has(Cap.rooms.create)).toBe(false);
    expect(caps.has(Cap.timeslots.edit)).toBe(false);
  });

  it("ROLE-02: a clientAdmin runs rooms and slots, plus everything a player can", () => {
    const caps = getCapabilitiesForRole("clientAdmin");
    expect(caps.has(Cap.rooms.create)).toBe(true);
    expect(caps.has(Cap.timeslots.toggle)).toBe(true);
    expect(caps.has(Cap.timeslots.join)).toBe(true);
    expect(caps.has(Cap.admin.assignRoles)).toBe(false);
  });

  it("ROLE-01: a superAdmin has every capability", () => {
    const caps = getCapabilitiesForRole("superAdmin");
    expect(caps.has(Cap.rooms.create)).toBe(true);
    expect(caps.has(Cap.admin.assignRoles)).toBe(true);
  });
});

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

  it("SET-10: players don't, even with a tenant", () => {
    expect(canManageVenue({ role: "player", tenantid: 1 })).toBe(false);
  });

  it("SET-10: no account yet means no Settings", () => {
    expect(canManageVenue(null)).toBe(false);
    expect(canManageVenue({})).toBe(false);
  });
});

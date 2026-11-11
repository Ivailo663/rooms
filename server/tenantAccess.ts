// Pure on purpose: imports nothing but types and the error helper, so the unit
// tests run without a database or Firebase.
import type { AccountRole } from "../packages/shared/index.js";
import { createHttpError } from "./utils/http.js";

// Roles are cumulative (ROLE-01), so a capability check is a rank comparison.
// Mirrors the hierarchy in client/src/stores/role.ts.
const ROLE_RANK: Record<AccountRole, number> = {
  player: 0,
  clientAdmin: 1,
  superAdmin: 2,
};

// Runs before any ownership lookup (ROLE-06), so a player learns nothing about
// which rooms or slots exist from the answer. Written as `!(>=)` so a role the
// map doesn't know (the DB enum still carries `host`) is refused, not let in.
export const assertRole = (
  account: { role: AccountRole },
  minimum: AccountRole
): void => {
  if (!(ROLE_RANK[account.role] >= ROLE_RANK[minimum])) {
    throw createHttpError(403, "Your role can't do this");
  }
};

export type TenantManagerCandidate = {
  role: string;
  tenantid: number | null;
};

// A clientAdmin manages exactly the tenant their account points at; a
// superAdmin manages every tenant. Nobody else manages any (ROLE-05, SET-09).
export const canManageTenant = (
  account: TenantManagerCandidate | null,
  tenantId: number
): boolean => {
  if (!account) return false;
  if (account.role === "superAdmin") return true;
  return account.role === "clientAdmin" && account.tenantid === tenantId;
};

// Pure on purpose: imports nothing but types, so the unit tests run without a
// database or Firebase.

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

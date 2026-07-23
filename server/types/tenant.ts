import { Prisma } from "@prisma/client";

export interface UpdateTenantSettings {
  tenantId: number;
  settings: Prisma.JsonValue;
}

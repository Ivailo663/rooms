import type { JsonValue } from "@prisma/client/runtime/library";

export interface UpdateTenantSettings {
  tenantId: number;
  settings: JsonValue;
}

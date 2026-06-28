import { api } from "@/axios";
import type {
  TenantSettingsResponse,
  UpdateTenantSettingsRequest,
} from "@football/shared";

export const getTenantSettings = async (
  tenantId: number,
): Promise<TenantSettingsResponse> => {
  const { data } = await api.get<TenantSettingsResponse>(
    `/tenants/${tenantId}`,
  );

  return data;
};

export const updateTenantSettings = async (
  data: UpdateTenantSettingsRequest,
): Promise<{ message: string }> => {
  const { data: response } = await api.post<{ message: string }>(
    "/tenants",
    data,
  );

  return response;
};

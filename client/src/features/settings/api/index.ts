import { api } from "@/axios";
import type {
  AccountSearchResult,
  TenantSettingsResponse,
  UpdateTenantAccountRequest,
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

export const updateTenantAccount = async (
  data: UpdateTenantAccountRequest,
): Promise<{ message: string }> => {
  const { data: response } = await api.post<{ message: string }>(
    "/tenants/accounts",
    data,
  );

  return response;
};

export const searchAccounts = async (
  search: string,
): Promise<AccountSearchResult[]> => {
  const { data } = await api.get<AccountSearchResult[]>("/accounts", {
    params: { search },
  });

  return data;
};

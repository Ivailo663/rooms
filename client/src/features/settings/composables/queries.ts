import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type {
  TenantSettingsResponse,
  UpdateTenantSettingsRequest,
} from "@football/shared";
import { getTenantSettings, updateTenantSettings } from "../api";

export const useGetTenantSettings = (tenantId: number) => {
  return useQuery<TenantSettingsResponse>({
    queryKey: ["tenant-settings", tenantId],
    queryFn: () => getTenantSettings(tenantId),
  });
};

export const useUpdateTenantSettings = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, UpdateTenantSettingsRequest>({
    mutationFn: updateTenantSettings,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenant-settings", variables.tenantId],
      });
    },
  });
};

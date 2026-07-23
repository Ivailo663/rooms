import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type {
  AccountSearchResult,
  TenantSettingsResponse,
  UpdateTenantAccountRequest,
  UpdateTenantSettingsRequest,
} from "@football/shared";
import {
  getTenantSettings,
  searchAccounts,
  updateTenantAccount,
  updateTenantSettings,
} from "../api";

// Keep the client guard in lockstep with the server's MIN_SEARCH_LENGTH.
const MIN_SEARCH_LENGTH = 3;

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

export const useSearchAccounts = (search: MaybeRefOrGetter<string>) => {
  const term = computed(() => toValue(search).trim());

  return useQuery<AccountSearchResult[]>({
    queryKey: ["account-search", term],
    queryFn: () => searchAccounts(term.value),
    enabled: computed(() => term.value.length >= MIN_SEARCH_LENGTH),
    // Show the last results while the next query resolves — avoids the dropdown
    // flickering empty between keystrokes.
    placeholderData: keepPreviousData,
  });
};

export const useUpdateTenantAccount = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, UpdateTenantAccountRequest>({
    mutationFn: updateTenantAccount,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenant-settings", variables.tenantId],
      });
    },
  });
};

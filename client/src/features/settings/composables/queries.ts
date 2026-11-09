import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { isAxiosError } from "axios";
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

export const isForbidden = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 403;

// A caller without a tenant never asks; a 403 means they don't manage this
// venue, and retrying won't change that.
export const useGetTenantSettings = (
  tenantId: MaybeRefOrGetter<number | null>,
) => {
  const id = computed(() => toValue(tenantId));

  return useQuery<TenantSettingsResponse>({
    queryKey: ["tenant-settings", id],
    queryFn: () => getTenantSettings(id.value as number),
    enabled: computed(() => id.value !== null),
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 3,
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

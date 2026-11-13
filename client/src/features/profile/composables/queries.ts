import { useQuery, type UseQueryOptions } from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { isAxiosError } from "axios";
import type { PlayerProfile } from "@football/shared";
import { getCities, getPlayer } from "../api";

// PROF-29: the server's answer for an id with no player behind it.
export const isNotFound = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 404;

// PROF-11: fetched when a player's details card opens and cached per id, so
// opening the same player again is instant.
export const useGetPlayer = (
  id: MaybeRefOrGetter<number>,
  options?: Omit<UseQueryOptions<PlayerProfile>, "queryKey" | "queryFn">
) => {
  const playerId = computed(() => toValue(id));

  return useQuery<PlayerProfile>({
    queryKey: ["players", playerId],
    queryFn: () => getPlayer(playerId.value),
    ...options,
  });
};

// PROF-24: the server's fixed list. It changes with a deploy, not during a
// session, so one fetch is enough.
export const useGetCities = (
  options?: Omit<UseQueryOptions<string[]>, "queryKey" | "queryFn">
) =>
  useQuery<string[]>({
    queryKey: ["cities"],
    queryFn: getCities,
    staleTime: Infinity,
    ...options,
  });

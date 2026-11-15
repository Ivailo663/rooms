import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/vue-query";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { isAxiosError } from "axios";
import type { MediaItem, PlayerProfile } from "@football/shared";
import { deleteMedia, getCities, getPlayer, getPlayerMedia } from "../api";
import { getMediaUrl } from "../api/storage";

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

// PROF-72: newest first, as the server sends it. Under ["players", id], so a
// profile refresh brings the grid along.
export const useGetPlayerMedia = (
  id: MaybeRefOrGetter<number>,
  options?: Omit<UseQueryOptions<MediaItem[]>, "queryKey" | "queryFn">
) => {
  const playerId = computed(() => toValue(id));

  return useQuery<MediaItem[]>({
    queryKey: ["players", playerId, "media"],
    queryFn: () => getPlayerMedia(playerId.value),
    ...options,
  });
};

// PROF-63: a stored file's download URL never changes while the file exists,
// so each path is resolved once per session.
export const useMediaUrl = (
  path: MaybeRefOrGetter<string>,
  options?: Omit<UseQueryOptions<string>, "queryKey" | "queryFn">
) => {
  const mediaPath = computed(() => toValue(path));

  return useQuery<string>({
    queryKey: ["media-url", mediaPath],
    queryFn: () => getMediaUrl(mediaPath.value),
    staleTime: Infinity,
    ...options,
  });
};

// PROF-64.
export const useDeleteMedia = (playerId: MaybeRefOrGetter<number>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMedia,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["players", toValue(playerId), "media"],
      }),
  });
};

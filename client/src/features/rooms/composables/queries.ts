import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/vue-query";
import { type MaybeRefOrGetter, unref } from "vue";

import {
  getHostedRooms,
  getTimeslots,
  getJoinableRooms,
  createTimeslot,
  updateTimeslot,
  deleteTimeslot,
} from "../api";

import type {
  GetTimeslotsParams,
  RoomWithPlayersResponse,
  TimeslotResponse,
  JoinableRoomResponse,
  CreateTimeslotRequest,
  UpdateTimeslotRequest,
  CreateTimeslotResponse,
} from "@football/shared";

import { useAuthStore } from "@/stores/auth";

export const useGetHostedRooms = (
  options?: Omit<
    UseQueryOptions<RoomWithPlayersResponse[]>,
    "queryKey" | "queryFn"
  >,
) => {
  const authStore = useAuthStore();

  return useQuery<RoomWithPlayersResponse[]>({
    queryKey: ["hosted-rooms"],
    queryFn: () => getHostedRooms(),
    enabled: !!authStore.user?.id,
    ...options,
  });
};

export const useGetJoinableRooms = (
  options?: Omit<
    UseQueryOptions<RoomWithPlayersResponse[]>,
    "queryKey" | "queryFn"
  >,
) => {
  const authStore = useAuthStore();

  return useQuery<JoinableRoomResponse[]>({
    queryKey: ["joinable-rooms"],
    queryFn: () => getJoinableRooms(),
    enabled: !!authStore.user?.id,
    ...options,
  });
};

type ReactiveParams<T> = {
  [K in keyof T]: MaybeRefOrGetter<T[K]>;
};

export const useGetTimeslots = (
  params: ReactiveParams<Omit<GetTimeslotsParams, "user_id">>,
  options?: Omit<UseQueryOptions<TimeslotResponse[]>, "queryKey" | "queryFn">,
) => {
  const authStore = useAuthStore();

  console.log(params.day, "PARAMS DAY");

  return useQuery<TimeslotResponse[]>({
    queryKey: ["timeslots", params.room_id, params.day],
    queryFn: () =>
      getTimeslots({
        ...params,
        user_id: authStore.user!.id,
      }),
    enabled: !!authStore.user?.id,
    ...options,
  });
};

export const useCreateTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateTimeslotResponse, Error, CreateTimeslotRequest>({
    mutationFn: createTimeslot,
    onSuccess: (data, variables) => {
      // Invalidate and refetch timeslots for the room
      queryClient.invalidateQueries({
        queryKey: ["timeslots", variables.room_id, variables.day],
      });
    },
  });
};

export const useUpdateTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, UpdateTimeslotRequest>({
    mutationFn: updateTimeslot,
    onSuccess: () => {
      // Invalidate all timeslots queries
      queryClient.invalidateQueries({ queryKey: ["timeslots"] });
    },
  });
};

export const useDeleteTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, number>({
    mutationFn: deleteTimeslot,
    onSuccess: () => {
      // Invalidate all timeslots queries
      queryClient.invalidateQueries({ queryKey: ["timeslots"] });
    },
  });
};

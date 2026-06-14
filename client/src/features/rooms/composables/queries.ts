import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";

import {
  getHostedRooms,
  getTimeslots,
  getEnabledTimeslots,
  getEnabledTimeslotDays,
  getJoinableRooms,
  createTimeslot,
  updateTimeslot,
  deleteTimeslot,
  joinTimeslot,
  leaveTimeslot,
} from "../api";

import type {
  GetTimeslotsParams,
  GetEnabledTimeslotsParams,
  HostedRoomResponse,
  TimeslotResponse,
  JoinableRoomResponse,
  CreateTimeslotRequest,
  UpdateTimeslotRequest,
  CreateTimeslotResponse,
  MutationMessageResponse,
  RoomWithPlayersResponse,
} from "@football/shared";

import { useAuthStore } from "@/stores/auth";

export const useGetHostedRooms = (
  options?: Omit<UseQueryOptions<HostedRoomResponse[]>, "queryKey" | "queryFn">
) => {
  const authStore = useAuthStore();

  return useQuery<HostedRoomResponse[]>({
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
  >
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
  options?: Omit<UseQueryOptions<TimeslotResponse[]>, "queryKey" | "queryFn">
) => {
  const authStore = useAuthStore();

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

export const useGetEnabledTimeslots = (
  params: ReactiveParams<GetEnabledTimeslotsParams>,
  options?: Omit<UseQueryOptions<TimeslotResponse[]>, "queryKey" | "queryFn">
) => {
  const authStore = useAuthStore();

  return useQuery<TimeslotResponse[]>({
    queryKey: ["timeslots", "enabled", params.room_id, params.day],
    queryFn: () => getEnabledTimeslots(params),
    enabled: !!authStore.user?.id,
    ...options,
  });
};

export const useGetEnabledDays = (
  roomId: MaybeRefOrGetter<number>,
  options?: Omit<UseQueryOptions<string[]>, "queryKey" | "queryFn">
) => {
  const authStore = useAuthStore();

  return useQuery<string[]>({
    queryKey: ["timeslots", "enabled-days", roomId],
    queryFn: () => getEnabledTimeslotDays(toValue(roomId)),
    enabled: !!authStore.user?.id,
    ...options,
  });
};

export const useCreateTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<CreateTimeslotResponse, Error, CreateTimeslotRequest>({
    mutationFn: createTimeslot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeslots"] });
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

export const useJoinTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<MutationMessageResponse, Error, number>({
    mutationFn: joinTimeslot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joinable-rooms"] });
    },
  });
};

export const useLeaveTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<MutationMessageResponse, Error, number>({
    mutationFn: leaveTimeslot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joinable-rooms"] });
    },
  });
};

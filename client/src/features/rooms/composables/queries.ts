import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/vue-query";
import { type MaybeRefOrGetter, toValue } from "vue";

import {
  getHostedRooms,
  getJoinedSlots,
  getTimeslots,
  getEnabledTimeslots,
  getEnabledTimeslotDaysAndFirstSlot,
  getPlayableRooms,
  createTimeslot,
  updateTimeslot,
  deleteTimeslot,
  joinTimeslot,
  leaveTimeslot,
  redistributeTimeslot,
  approveJoinRequest,
  denyJoinRequest,
} from "../api";

import type {
  GetTimeslotsParams,
  GetEnabledTimeslotsParams,
  EnabledDaySummary,
  HostedRoomResponse,
  TimeslotResponse,
  PlayableRoomResponse,
  CreateTimeslotRequest,
  UpdateTimeslotRequest,
  CreateTimeslotResponse,
  MutationMessageResponse,
  JoinTimeslotResponse,
  JoinedSlotSummary,
} from "@football/shared";

import { useAuthStore } from "@/stores/auth";

export const useGetHostedRooms = (
  day?: MaybeRefOrGetter<string>,
  options?: Omit<UseQueryOptions<HostedRoomResponse[]>, "queryKey" | "queryFn">
) => {
  const authStore = useAuthStore();

  return useQuery<HostedRoomResponse[]>({
    queryKey: ["hosted-rooms", day],
    queryFn: () => {
      const resolvedDay = day ? toValue(day) : undefined;
      return getHostedRooms(resolvedDay ? { day: resolvedDay } : undefined);
    },
    enabled: !!authStore.user?.id,
    ...options,
  });
};

export const useGetPlayableRooms = (
  day: MaybeRefOrGetter<string>,
  options?: Omit<
    UseQueryOptions<PlayableRoomResponse[]>,
    "queryKey" | "queryFn"
  >,
) => {
  const authStore = useAuthStore();

  return useQuery<PlayableRoomResponse[]>({
    queryKey: ["playable-rooms", day],
    queryFn: () => getPlayableRooms(toValue(day)),
    enabled: !!authStore.user?.id,
    ...options,
  });
};

export const useGetJoinedSlots = (
  options?: Omit<UseQueryOptions<JoinedSlotSummary[]>, "queryKey" | "queryFn">
) => {
  const authStore = useAuthStore();

  return useQuery<JoinedSlotSummary[]>({
    queryKey: ["joined-slots"],
    queryFn: getJoinedSlots,
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
        room_id: toValue(params.room_id),
        day: toValue(params.day),
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
    queryFn: () =>
      getEnabledTimeslots({
        room_id: toValue(params.room_id),
        day: toValue(params.day),
      }),
    enabled: !!authStore.user?.id,
    ...options,
  });
};

export const useGetEnabledDays = (
  roomId: MaybeRefOrGetter<number>,
  options?: Omit<UseQueryOptions<EnabledDaySummary[]>, "queryKey" | "queryFn">
) => {
  const authStore = useAuthStore();

  return useQuery<EnabledDaySummary[]>({
    queryKey: ["timeslots", "enabled-days", roomId],
    queryFn: () => getEnabledTimeslotDaysAndFirstSlot(toValue(roomId)),
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

  return useMutation<JoinTimeslotResponse, Error, number>({
    mutationFn: joinTimeslot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playable-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["joined-slots"] });
    },
  });
};

export const useApproveJoinRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<
    MutationMessageResponse,
    Error,
    { timeslotId: number; accountId: number }
  >({
    mutationFn: approveJoinRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeslots"] });
      queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
    },
  });
};

export const useDenyJoinRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<
    MutationMessageResponse,
    Error,
    { timeslotId: number; accountId: number }
  >({
    mutationFn: denyJoinRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeslots"] });
      queryClient.invalidateQueries({ queryKey: ["hosted-rooms"] });
    },
  });
};

export const useLeaveTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<MutationMessageResponse, Error, number>({
    mutationFn: leaveTimeslot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playable-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["joined-slots"] });
    },
  });
};

export const useRedistributeTimeslot = () => {
  const queryClient = useQueryClient();

  return useMutation<MutationMessageResponse, Error, number>({
    mutationFn: redistributeTimeslot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeslots"] });
    },
  });
};

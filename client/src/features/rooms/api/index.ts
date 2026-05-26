import { api } from "@/axios";
import {
  type GetTimeslotsParams,
  type GetEnabledTimeslotsParams,
  type JoinableRoomResponse,
  type CreateTimeslotRequest,
  type UpdateTimeslotRequest,
  type CreateTimeslotResponse,
  type MutationMessageResponse,
} from "@football/shared";
import { type MaybeRefOrGetter, toValue } from "vue";

export const getHostedRooms = async () => {
  const { data } = await api.get("/rooms/hosted", {});

  return data;
};

export const getJoinableRooms = async (): Promise<JoinableRoomResponse[]> => {
  const { data } = await api.get<JoinableRoomResponse[]>("/rooms/joinable");

  return data;
};

type ReactiveParams<T> = {
  [K in keyof T]: MaybeRefOrGetter<T[K]>;
};

export const getTimeslots = async (
  params: ReactiveParams<GetTimeslotsParams>
) => {
  const { room_id, day } = params;

  const { data } = await api.get("/timeslots", {
    params: {
      room_id: toValue(room_id),
      day: toValue(day),
    },
  });

  return data;
};

export const getEnabledTimeslots = async (
  params: ReactiveParams<GetEnabledTimeslotsParams>
) => {
  const { room_id, day } = params;

  const { data } = await api.get("/timeslots/enabled", {
    params: {
      room_id: toValue(room_id),
      day: toValue(day),
    },
  });

  return data;
};

export const getEnabledTimeslotDays = async (
  room_id: number
): Promise<string[]> => {
  const { data } = await api.get<string[]>("/timeslots/enabled/days", {
    params: { room_id },
  });

  return data;
};

export const createTimeslot = async (
  data: CreateTimeslotRequest
): Promise<CreateTimeslotResponse> => {
  const { data: response } = await api.post<CreateTimeslotResponse>(
    "/timeslots",
    data
  );

  return response;
};

export const updateTimeslot = async (
  data: UpdateTimeslotRequest
): Promise<{ message: string }> => {
  const { data: response } = await api.put<{ message: string }>(
    "/timeslots",
    data
  );

  return response;
};

export const deleteTimeslot = async (
  id: number
): Promise<{ message: string }> => {
  const { data } = await api.delete<{ message: string }>(`/timeslots/${id}`);

  return data;
};

export const joinTimeslot = async (
  id: number
): Promise<MutationMessageResponse> => {
  const { data } = await api.post<MutationMessageResponse>(
    `/timeslots/${id}/join`,
    { joined_at: new Date().toISOString() }
  );

  return data;
};

export const leaveTimeslot = async (
  id: number
): Promise<MutationMessageResponse> => {
  const { data } = await api.post<MutationMessageResponse>(
    `/timeslots/${id}/leave`
  );

  return data;
};

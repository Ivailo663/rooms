import { api } from "@/axios";
import {
  type GetRoomsParams,
  type GetTimeslotsParams,
  type JoinableRoomResponse,
  type CreateTimeslotRequest,
  type UpdateTimeslotRequest,
  type CreateTimeslotResponse,
} from "@football/shared";
import { type MaybeRefOrGetter, unref } from "vue";

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
  params: ReactiveParams<GetTimeslotsParams>,
) => {
  const { room_id, day } = params;

  const { data } = await api.get("/timeslots", {
    params: {
      room_id,
      day: unref(day),
    },
  });

  return data;
};

export const createTimeslot = async (
  data: CreateTimeslotRequest,
): Promise<CreateTimeslotResponse> => {
  const { data: response } = await api.post<CreateTimeslotResponse>(
    "/timeslots",
    data,
  );

  return response;
};

export const updateTimeslot = async (
  data: UpdateTimeslotRequest,
): Promise<{ message: string }> => {
  const { data: response } = await api.put<{ message: string }>(
    "/timeslots",
    data,
  );

  return response;
};

export const deleteTimeslot = async (
  id: number,
): Promise<{ message: string }> => {
  const { data } = await api.delete<{ message: string }>(`/timeslots/${id}`);

  return data;
};

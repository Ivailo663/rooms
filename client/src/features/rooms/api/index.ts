import { api } from "@/axios";
import {
  type GetTimeslotsParams,
  type GetEnabledTimeslotsParams,
  type GetHostedRoomsParams,
  type EnabledDaySummary,
  type HostedRoomResponse,
  type PlayableRoomResponse,
  type CreateTimeslotRequest,
  type UpdateTimeslotRequest,
  type CreateTimeslotResponse,
  type MutationMessageResponse,
  type JoinTimeslotResponse,
  type JoinedSlotSummary,
} from "@football/shared";
export const getHostedRooms = async (
  params?: Partial<GetHostedRoomsParams>,
): Promise<HostedRoomResponse[]> => {
  const { data } = await api.get<HostedRoomResponse[]>("/rooms/hosted", {
    params,
  });

  return data;
};

export const getPlayableRooms = async (
  day?: string,
): Promise<PlayableRoomResponse[]> => {
  const { data } = await api.get<PlayableRoomResponse[]>("/rooms/playable", {
    params: day ? { day } : undefined,
  });

  return data;
};

export const getJoinedSlots = async (): Promise<JoinedSlotSummary[]> => {
  const { data } = await api.get<JoinedSlotSummary[]>("/timeslots/joined");

  return data;
};

export const getTimeslots = async (params: GetTimeslotsParams) => {
  const { data } = await api.get("/timeslots", { params });
  return data;
};

export const getEnabledTimeslots = async (
  params: GetEnabledTimeslotsParams,
) => {
  const { data } = await api.get("/timeslots/enabled", { params });
  return data;
};

export const getEnabledTimeslotDaysAndFirstSlot = async (
  room_id: number
): Promise<EnabledDaySummary[]> => {
  const { data } = await api.get<EnabledDaySummary[]>(
    "/timeslots/enabled/days",
    { params: { room_id } }
  );

  return data;
};

export const getPendingRequestDays = async (
  room_id: number
): Promise<string[]> => {
  const { data } = await api.get<string[]>("/timeslots/pending-days", {
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
): Promise<JoinTimeslotResponse> => {
  const { data } = await api.post<JoinTimeslotResponse>(
    `/timeslots/${id}/join`,
    { joined_at: new Date().toISOString() }
  );

  return data;
};

export const approveJoinRequest = async (params: {
  timeslotId: number;
  accountId: number;
}): Promise<MutationMessageResponse> => {
  const { data } = await api.post<MutationMessageResponse>(
    `/timeslots/${params.timeslotId}/requests/${params.accountId}/approve`
  );

  return data;
};

export const denyJoinRequest = async (params: {
  timeslotId: number;
  accountId: number;
}): Promise<MutationMessageResponse> => {
  const { data } = await api.post<MutationMessageResponse>(
    `/timeslots/${params.timeslotId}/requests/${params.accountId}/deny`
  );

  return data;
};

// Clears a request the requester made un-approvable by joining another game in
// the same hour. Not a denial — nothing is recorded against them.
export const acknowledgeJoinRequest = async (params: {
  timeslotId: number;
  accountId: number;
}): Promise<MutationMessageResponse> => {
  const { data } = await api.delete<MutationMessageResponse>(
    `/timeslots/${params.timeslotId}/requests/${params.accountId}`
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

export const redistributeTimeslot = async (
  id: number
): Promise<MutationMessageResponse> => {
  const { data } = await api.post<MutationMessageResponse>(
    `/timeslots/${id}/redistribute`
  );

  return data;
};

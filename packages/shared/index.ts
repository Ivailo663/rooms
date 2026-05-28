import { Prisma } from "@prisma/client";

export interface GetRoomsParams {
  hosted: boolean;
  user_id: number;
}

export interface GetTimeslotsParams {
  room_id: number;
  user_id: number;
  day: string;
}

export interface GetEnabledTimeslotsParams {
  room_id: number;
  day: string;
}

export interface AccountEntity {
  id: number;
  email: string;
  name: string;
}

export interface PlayerSummary {
  id: number;
  name: string;
}

export interface RoomEntity {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  creatorId: number;
  hostId: number;
  address: string;
}

export interface RoomSummaryResponse {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  address: string;
}

// TODO: revisit after slots are implemented
export interface RoomWithPlayersResponse extends RoomSummaryResponse {
  players: PlayerSummary[];
}

export type SlotStatus = "scheduled" | "live" | "ended";

export interface TimeslotResponse {
  id: number;
  name: string;
  message: string | null;
  price: string | number | null;
  label: string;
  features: unknown;
  players: PlayerSummary[];
  max_players: number;
  day: string;
  enabled: boolean;
  status: SlotStatus;
  start_time: number;
}

export interface TimeslotPlayer {
  id: number;
  email: string;
  name: string;
}

export interface TimeslotEntity {
  id: number;
  roomId: number;
  name: string;
  message: string | null;
  price: string | number;
  label: string;
  features: unknown;
}

export interface CreateTimeslotRequest {
  day: string;
  order: number;
  room_id: number;
  name: string;
  label: string;
  available_date?: string;
  max_players: number;
  price?: string | number | null;
  message?: string | null;
  features?: Prisma.InputJsonValue;
  enabled?: boolean;
}

export interface UpdateTimeslotRequest {
  id: number;
  name?: string;
  label?: string;
  available_date?: string;
  max_players?: number;
  price?: string | number | null;
  message?: string | null;
  features?: Prisma.InputJsonValue;
  enabled?: boolean;
}

export interface CreateTimeslotResponse {
  id: number;
  message: string;
}

export interface JoinableRoomResponse extends RoomSummaryResponse {
  timeslots: Array<{
    id: number;
    name: string;
    message: string | null;
    price: string | number | null;
    label: string;
    features: unknown;
    players: TimeslotPlayer[];
    max_players: number;
  }>;
}

export interface CreateRoomRequest {
  name: string;
  description?: string | null;
  creator_id: number;
  host_id: number;
  price: string | number;
}

export interface CreateRoomResponse {
  id: number;
  message: string;
}

export interface JoinTimeslotRequest {
  joined_at?: string | null;
}

export interface MutationMessageResponse {
  message: string;
}

export interface TimeslotMembershipChangedPayload {
  timeslotId: number;
  players: TimeslotPlayer[];
}

export interface TimeslotStatusChangedPayload {
  timeslotId: number;
  roomId: number;
  status: SlotStatus;
}

export interface LiveSlotSummary {
  id: number;
  label: string;
  start_time: number;
  players_count: number;
  max_players: number;
}

export interface HostedRoomResponse extends RoomSummaryResponse {
  liveSlot: LiveSlotSummary | null;
}

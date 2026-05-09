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
  room_id: number;
  name: string;
  label: string;
  available_date?: string;
  max_players: number;
  price?: string | number | null;
  message?: string | null;
  features?: Prisma.InputJsonValue;
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

export interface JoinRoomRequest {
  room_id: number;
  account_id: number;
  joined_at?: string | null;
}

export interface LeaveRoomRequest {
  room_id: number;
  account_id: number;
}

export interface MutationMessageResponse {
  message: string;
}

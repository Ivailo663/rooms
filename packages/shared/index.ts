import { Prisma } from "@prisma/client";

export type {
  Account,
  Room,
  RoomTimeslot,
  AccountRole,
} from "@prisma/client";

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

export interface PlayerSummary {
  id: number;
  name: string;
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

export interface TimeslotPlayerSummary {
  id: number;
  email: string;
  name: string;
}

export interface CreateTimeslotRequest {
  day: string;
  order: number;
  room_id: number;
  name: string;
  label: string;
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

export interface PlayableRoomResponse extends RoomSummaryResponse {
  timeslots: Array<{
    id: number;
    name: string;
    message: string | null;
    price: string | number | null;
    label: string;
    features: unknown;
    players: TimeslotPlayerSummary[];
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

export interface TenantSettings {
  lateJoinCutoff: number;
  allowJoinOnLive: boolean;
  joinPolicy: number[];
  defaultMaxPlayers: number;
  minPlayers: number;
  defaultPrice: number;
  defaultFeatures: string[];
  autoRedistribute: boolean;
  redistributionWindow: number;
}

export interface TenantSettingsResponse {
  id: number;
  name: string | null;
  settings: TenantSettings | null;
}

export interface UpdateTenantSettingsRequest {
  tenantId: number;
  settings: Prisma.InputJsonValue;
}

export interface TimeslotMembershipChangedPayload {
  timeslotId: number;
  players: TimeslotPlayerSummary[];
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

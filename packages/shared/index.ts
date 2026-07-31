import { Prisma } from "@prisma/client";

export type { Account, Room, RoomTimeslot, AccountRole } from "@prisma/client";

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

export type SlotStatus =
  | "scheduled"
  | "live"
  | "ended"
  | "failed"
  | "redistributed";

export type JoinRequestStatus = "pending" | "denied";

export interface JoinRequestSummary {
  accountId: number;
  name: string;
  created_at: string | null;
  // False once the requester has taken a confirmed seat in another game in the
  // same hour: the request can no longer be approved (the server would 409), so
  // all the host can do is acknowledge it away.
  valid: boolean;
}

export interface TimeslotResponse {
  id: number;
  name: string;
  message: string | null;
  price: string | number | null;
  label: string;
  features: unknown;
  players: PlayerSummary[];
  pendingRequests: JoinRequestSummary[];
  min_players: number | null;
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
  min_players?: number | null;
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
  min_players?: number | null;
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
  // Tenant's custom message shown to players whose join request was declined.
  deniedMessage: string | null;
  // Tenant join-window policy, needed to compute joinability on the client so
  // the Join button matches what the server would accept. Falls back to the
  // server defaults when the tenant hasn't set them.
  lateJoinCutoff: number;
  allowJoinOnLive: boolean;
  timeslots: Array<{
    id: number;
    name: string;
    message: string | null;
    price: string | number | null;
    label: string;
    features: unknown;
    players: TimeslotPlayerSummary[];
    max_players: number;
    // Fields the client needs to tell whether joining is still open.
    status: SlotStatus;
    day: string;
    start_time: number;
    // Current user's outstanding request for this slot, if any.
    requestStatusForCurrentUser: JoinRequestStatus | null;
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

export type JoinOutcome = "joined" | "pending" | "already" | "denied";

export interface JoinTimeslotResponse extends MutationMessageResponse {
  status: JoinOutcome;
}

export interface JoinRequestCreatedPayload {
  timeslotId: number;
  roomId: number;
  accountId: number;
  name: string;
}

// A pending request became un-approvable (the requester took a seat elsewhere
// in the same hour) or approvable again (they gave that seat up). The change
// originates in a different room than the one holding the request, so it can't
// ride on that room's own membership event.
export interface JoinRequestValidityChangedPayload {
  timeslotId: number;
  roomId: number;
  accountId: number;
  valid: boolean;
}

export interface JoinRequestResolvedPayload {
  timeslotId: number;
  roomId: number;
  accountId: number;
  approved: boolean;
}

export type JoinMode = "free" | "required" | "required-list";

export interface TenantSettings {
  // Minutes before start when the roster locks: no new joins are accepted, and
  // the scheduler runs the redistribute-or-fail verdict on under-filled slots.
  lateJoinCutoff: number;
  allowJoinOnLive: boolean;
  joinMode: JoinMode;
  includeBlacklisted: boolean;
  defaultMaxPlayers: number;
  defaultMinPlayers: number;
  defaultPrice: number;
  defaultFeatures: string[];
  autoRedistribute: boolean;
  // Shown to players whose join request the host declines. Empty = generic.
  deniedMessage?: string;
}

export interface TenantAccountSummary {
  accountId: number;
  name: string;
  requiresApproval: boolean;
  blacklisted: boolean;
}

export interface AccountSearchResult {
  id: number;
  name: string;
  email: string;
}

export interface TenantSettingsResponse {
  id: number;
  name: string | null;
  settings: TenantSettings | null;
  flaggedAccounts: TenantAccountSummary[];
}

export interface UpdateTenantSettingsRequest {
  tenantId: number;
  settings: Prisma.InputJsonValue;
}

export interface UpdateTenantAccountRequest {
  tenantId: number;
  accountId: number;
  requiresApproval?: boolean;
  blacklisted?: boolean;
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

export interface RedistributionDestination {
  timeslotId: number;
  roomId: number;
  roomName: string;
  label: string;
  playerCount: number;
}

export interface TimeslotRedistributedPayload {
  timeslotId: number;
  roomId: number;
  destinations: RedistributionDestination[];
}

// A slot the current user is confirmed in, or awaiting approval for.
export type JoinedMembership = "joined" | "pending";

export interface JoinedSlotSummary {
  timeslotId: number;
  roomId: number;
  roomName: string;
  address: string;
  label: string;
  day: string;
  start_time: number;
  status: SlotStatus;
  price: string | number | null;
  features: unknown;
  players: PlayerSummary[];
  max_players: number;
  membership: JoinedMembership;
  // Minutes before start at which the roster freezes — no more joining, and
  // no more leaving. Resolved per slot since it comes from the owning tenant.
  lateJoinCutoff: number;
}

export interface EnabledDaySummary {
  day: string;
  label: string;
}

export interface GetHostedRoomsParams {
  day: string;
}

export interface LiveSlotSummary {
  id: number;
  label: string;
  start_time: number;
  players_count: number;
  max_players: number;
  day: string;
}

export interface HostedRoomResponse extends RoomSummaryResponse {
  liveSlot: LiveSlotSummary | null;
  pendingRequestCount: number;
}

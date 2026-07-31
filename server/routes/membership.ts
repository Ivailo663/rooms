import type { Application, RequestHandler } from "express";
import type { Server } from "socket.io";
import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import type {
  JoinedSlotSummary,
  JoinRequestCreatedPayload,
  JoinRequestResolvedPayload,
  JoinRequestValidityChangedPayload,
  JoinTimeslotRequest,
  JoinTimeslotResponse,
  MutationMessageResponse,
  TenantSettings,
  TimeslotMembershipChangedPayload,
} from "../../packages/shared/index.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import { toInteger, toOptionalDate } from "../utils/validation.js";
import {
  TIMESLOT_MEMBERSHIP_CHANGED_EVENT,
  getUpdatedPlayers,
  redistributeSlot,
} from "../redistribution.js";

export const JOIN_REQUEST_CREATED_EVENT = "join-request:created";
export const JOIN_REQUEST_RESOLVED_EVENT = "join-request:resolved";
export const JOIN_REQUEST_VALIDITY_CHANGED_EVENT =
  "join-request:validity-changed";

// Kept in sync with the scheduler's fallback so an untenanted room (or a
// tenant with no setting) locks and redistributes on the same 15-minute lead.
const DEFAULT_LATE_JOIN_CUTOFF = 15;
const SLOT_DURATION_MINUTES = 60;
const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

const resolveCutoff = (settings: Partial<TenantSettings> | null): number => {
  const value = settings?.lateJoinCutoff;
  return typeof value === "number" && value > 0
    ? value
    : DEFAULT_LATE_JOIN_CUTOFF;
};

// The roster freezes from `cutoff` minutes before start until the end of the
// occurrence window — the span over which the scheduler runs its verdict and
// the game plays out. Joins into a still-"scheduled" slot are rejected here,
// and so are departures: the headcount the cutoff verdict is about to judge
// (and the one the host is staffing for) must not move under it.
//
// Deliberately clock-derived rather than status-derived: a stale status left
// behind by a missed transition would otherwise lock a roster forever.
const isRosterLocked = (
  day: string,
  startTime: number,
  cutoff: number,
  now: Date
): boolean => {
  if (now.getDay() !== DAY_INDEX[day]) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return (
    minutesNow >= startTime - cutoff &&
    minutesNow < startTime + SLOT_DURATION_MINUTES
  );
};

// One seat per hour. Every occurrence window is SLOT_DURATION_MINUTES long, so
// any confirmed membership on the same day whose window overlaps this one would
// put the player in two places at once. Deliberately not scoped to a room or a
// tenant — it is the player's own calendar being protected.
//
// Only confirmed seats clash; a pending request is not a commitment, so a
// player may request several slots in the same hour. The approval path runs the
// same check, so whichever request lands first wins.
const findClashingSlot = async (
  tx: Prisma.TransactionClient,
  accountId: number,
  day: string,
  startTime: number
) =>
  tx.timeslotPlayer.findFirst({
    where: {
      accountId,
      room_timeslots: {
        enabled: true,
        day,
        start_time: {
          gt: startTime - SLOT_DURATION_MINUTES,
          lt: startTime + SLOT_DURATION_MINUTES,
        },
      },
    },
    select: {
      room_timeslots: {
        select: { label: true, room: { select: { name: true } } },
      },
    },
  });

// Taking (or giving up) a seat flips the validity of every pending request the
// same player holds in an overlapping hour. Those requests belong to other
// rooms — often other tenants — whose hosts see nothing of this room's
// membership event, so this is the only signal that reaches them.
const emitRequestValidityChanged = async (
  io: Server,
  accountId: number,
  day: string,
  startTime: number,
  exceptTimeslotId: number,
  valid: boolean
) => {
  const requests = await prisma.timeslotJoinRequest.findMany({
    where: {
      accountId,
      status: "pending",
      timeslotId: { not: exceptTimeslotId },
      room_timeslot: {
        enabled: true,
        day,
        start_time: {
          gt: startTime - SLOT_DURATION_MINUTES,
          lt: startTime + SLOT_DURATION_MINUTES,
        },
      },
    },
    select: { timeslotId: true, room_timeslot: { select: { roomId: true } } },
  });

  for (const request of requests) {
    const payload: JoinRequestValidityChangedPayload = {
      timeslotId: request.timeslotId,
      roomId: request.room_timeslot.roomId,
      accountId,
      valid,
    };
    io.emit(JOIN_REQUEST_VALIDITY_CHANGED_EVENT, payload);
  }
};

const getCurrentAccount = async (email: string) => {
  const account = await prisma.account.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (!account) {
    throw createHttpError(404, "Account not found");
  }

  return account;
};

// Fixed week order for a stable API ordering; the client re-sorts relative to
// "now" (next upcoming first) since that is a moving target.
const DAY_ORDER = ["mo", "tu", "we", "th", "fr", "sa", "su"];

// Every enabled slot the current user is confirmed in or has a pending
// approval request for — cross-room and cross-day, unlike the day-scoped
// playable-rooms feed. Powers the player's "my game" hub, so the full roster
// rides along.
const getJoinedSlots: RequestHandler = asyncHandler(async (_req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);

  const slots = await prisma.roomTimeslot.findMany({
    where: {
      enabled: true,
      OR: [
        { timeslot_players: { some: { accountId: account.id } } },
        {
          join_requests: {
            some: { accountId: account.id, status: "pending" },
          },
        },
      ],
    },
    select: {
      id: true,
      label: true,
      day: true,
      start_time: true,
      status: true,
      price: true,
      features: true,
      max_players: true,
      room: {
        select: {
          id: true,
          name: true,
          address: true,
          tenant: { select: { settings: true } },
        },
      },
      timeslot_players: {
        select: { accounts: { select: { id: true, name: true } } },
      },
    },
  });

  const response: JoinedSlotSummary[] = slots
    .map((slot) => {
      const players = slot.timeslot_players.map(({ accounts }) => ({
        id: accounts.id,
        name: accounts.name,
      }));

      return {
        timeslotId: slot.id,
        roomId: slot.room.id,
        roomName: slot.room.name,
        address: slot.room.address,
        label: slot.label,
        day: slot.day,
        start_time: slot.start_time,
        status: slot.status,
        price: slot.price?.toString() ?? null,
        features: slot.features,
        players,
        max_players: slot.max_players,
        lateJoinCutoff: resolveCutoff(
          (slot.room.tenant?.settings ?? null) as Partial<TenantSettings> | null
        ),
        membership: (players.some((player) => player.id === account.id)
          ? "joined"
          : "pending") as JoinedSlotSummary["membership"],
      };
    })
    .sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
        a.start_time - b.start_time
    );

  res.send(response);
});

type JoinResult =
  | { outcome: "joined"; day: string; startTime: number }
  | { outcome: "already" }
  | { outcome: "pending"; roomId: number }
  | { outcome: "denied"; deniedMessage: string | null };

const createJoinTimeslotHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const timeslotId = toInteger(req.params.id, "id");
    const { joined_at } = (req.body ?? {}) as JoinTimeslotRequest;
    const joinedAt = toOptionalDate(joined_at, "joined_at");

    const result = await prisma.$transaction<JoinResult>(
      async (tx) => {
        const timeslot = await tx.roomTimeslot.findUnique({
          where: { id: timeslotId },
          select: {
            day: true,
            start_time: true,
            status: true,
            max_players: true,
            _count: { select: { timeslot_players: true } },
            room: {
              select: {
                id: true,
                tenantid: true,
                tenant: { select: { settings: true } },
              },
            },
          },
        });

        if (!timeslot) {
          throw createHttpError(404, "Timeslot not found");
        }

        const alreadyJoined = await tx.timeslotPlayer.findUnique({
          where: {
            timeslotId_accountId: { timeslotId, accountId: account.id },
          },
          select: { accountId: true },
        });

        if (alreadyJoined) {
          return { outcome: "already" };
        }

        // Occurrence-state gates. Once the cutoff verdict has landed the slot
        // is closed; a live game is joinable only if the tenant allows
        // walk-ins; and a still-"scheduled" slot inside the lock window is
        // frozen for the redistribution pass.
        const lockSettings = (timeslot.room?.tenant?.settings ??
          null) as Partial<TenantSettings> | null;

        if (
          timeslot.status === "failed" ||
          timeslot.status === "redistributed" ||
          timeslot.status === "ended"
        ) {
          throw createHttpError(409, "This game is closed");
        }

        if (timeslot.status === "live") {
          if (!(lockSettings?.allowJoinOnLive ?? false)) {
            throw createHttpError(409, "This game has already started");
          }
        } else if (
          isRosterLocked(
            timeslot.day,
            timeslot.start_time,
            resolveCutoff(lockSettings),
            new Date()
          )
        ) {
          throw createHttpError(409, "Joining has closed for this game");
        }

        // Checked before the tenant policy branch so a clash blocks raising an
        // approval request too, not just a direct join.
        const clash = await findClashingSlot(
          tx,
          account.id,
          timeslot.day,
          timeslot.start_time
        );

        if (clash) {
          const room = clash.room_timeslots.room?.name;
          throw createHttpError(
            409,
            room
              ? `You're already in the ${clash.room_timeslots.label} game at ${room}`
              : "You're already in another game at this hour"
          );
        }

        // Tenant join policy. Only enforced for rooms that belong to a tenant;
        // untenanted rooms are unaffected. An approval-required join is
        // enqueued as a pending request instead. Blacklisted alone does not
        // gate joining — it only routes through approval when the tenant has
        // opted in via includeBlacklisted under the required-list policy.
        const tenantId = timeslot.room?.tenantid;
        if (tenantId != null) {
          const flags = await tx.tenantAccount.findUnique({
            where: {
              tenantId_accountId: { tenantId, accountId: account.id },
            },
            select: { requiresApproval: true, blacklisted: true },
          });

          const settings = (timeslot.room?.tenant?.settings ??
            {}) as Partial<TenantSettings>;
          const joinMode = settings.joinMode ?? "free";
          const needsApproval =
            joinMode === "required" ||
            (joinMode === "required-list" &&
              (!!flags?.requiresApproval ||
                (!!flags?.blacklisted && !!settings.includeBlacklisted)));

          if (needsApproval) {
            // A denial stands for the remainder of this occurrence — denied
            // rows persist until the worker wipes them when the slot ends, so
            // re-clicking Join must surface the denial, not re-request.
            const existing = await tx.timeslotJoinRequest.findUnique({
              where: {
                timeslotId_accountId: { timeslotId, accountId: account.id },
              },
              select: { status: true },
            });

            if (existing?.status === "denied") {
              return {
                outcome: "denied",
                deniedMessage: settings.deniedMessage?.trim() || null,
              };
            }

            // Idempotent — re-clicking Join keeps a single pending request.
            await tx.timeslotJoinRequest.upsert({
              where: {
                timeslotId_accountId: { timeslotId, accountId: account.id },
              },
              create: { timeslotId, accountId: account.id },
              update: {},
            });
            return { outcome: "pending", roomId: timeslot.room!.id };
          }
        }

        if (timeslot._count.timeslot_players >= timeslot.max_players) {
          throw createHttpError(409, "Timeslot is full");
        }

        await tx.timeslotPlayer.create({
          data: { timeslotId, accountId: account.id, joined_at: joinedAt },
        });

        return {
          outcome: "joined",
          day: timeslot.day,
          startTime: timeslot.start_time,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (result.outcome === "joined") {
      const players = await getUpdatedPlayers(timeslotId);
      const payload: TimeslotMembershipChangedPayload = { timeslotId, players };
      io.emit(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, payload);

      // Any request this player left pending elsewhere in the hour is now void.
      await emitRequestValidityChanged(
        io,
        account.id,
        result.day,
        result.startTime,
        timeslotId,
        false
      );

      const response: JoinTimeslotResponse = {
        message: "joined timeslot",
        status: "joined",
      };
      return res.send(response);
    }

    if (result.outcome === "denied") {
      const response: JoinTimeslotResponse = {
        message:
          result.deniedMessage ?? "Your request was not accepted for this slot",
        status: "denied",
      };
      return res.send(response);
    }

    if (result.outcome === "pending") {
      const payload: JoinRequestCreatedPayload = {
        timeslotId,
        roomId: result.roomId,
        accountId: account.id,
        name: account.name,
      };
      io.emit(JOIN_REQUEST_CREATED_EVENT, payload);

      const response: JoinTimeslotResponse = {
        message: "approval requested",
        status: "pending",
      };
      return res.send(response);
    }

    const response: JoinTimeslotResponse = {
      message: "already joined",
      status: "already",
    };
    res.send(response);
  });

const createLeaveTimeslotHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const timeslotId = toInteger(req.params.id, "id");

    const timeslot = await prisma.roomTimeslot.findUnique({
      where: { id: timeslotId },
      select: {
        day: true,
        start_time: true,
        room: { select: { tenant: { select: { settings: true } } } },
      },
    });

    if (!timeslot) {
      throw createHttpError(404, "Timeslot not found");
    }

    // Once the roster is locked the seat is committed for this occurrence —
    // through the cutoff verdict, the game itself, and a "no game" outcome
    // alike. The membership rows are cleared wholesale when the occurrence
    // ends, so there is nothing for the player to leave afterwards either.
    if (
      isRosterLocked(
        timeslot.day,
        timeslot.start_time,
        resolveCutoff(
          (timeslot.room?.tenant?.settings ??
            null) as Partial<TenantSettings> | null
        ),
        new Date()
      )
    ) {
      throw createHttpError(409, "Leaving has closed for this game");
    }

    // Leaving also cancels any outstanding pending request for this slot.
    // Denied rows are deliberately kept — otherwise leave+rejoin would let a
    // player wipe their own denial and re-request within the same occurrence.
    await prisma.timeslotJoinRequest.deleteMany({
      where: { timeslotId, accountId: account.id, status: "pending" },
    });

    const result = await prisma.timeslotPlayer.deleteMany({
      where: { timeslotId, accountId: account.id },
    });

    if (result.count > 0) {
      const players = await getUpdatedPlayers(timeslotId);
      const payload: TimeslotMembershipChangedPayload = { timeslotId, players };
      io.emit(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, payload);

      // The hour is free again, so requests this player has pending elsewhere
      // in it become approvable — the mirror of the join path.
      await emitRequestValidityChanged(
        io,
        account.id,
        timeslot.day,
        timeslot.start_time,
        timeslotId,
        true
      );
    }

    const response: MutationMessageResponse = { message: "left timeslot" };
    res.send(response);
  });

// Ensures the caller owns (created or hosts) the room the slot belongs to.
const assertSlotOwner = async (timeslotId: number, accountId: number) => {
  const timeslot = await prisma.roomTimeslot.findUnique({
    where: { id: timeslotId },
    select: {
      day: true,
      start_time: true,
      max_players: true,
      _count: { select: { timeslot_players: true } },
      room: { select: { id: true, creatorId: true, hostId: true } },
    },
  });

  if (!timeslot) {
    throw createHttpError(404, "Timeslot not found");
  }

  const owns =
    timeslot.room?.creatorId === accountId ||
    timeslot.room?.hostId === accountId;

  if (!owns) {
    throw createHttpError(403, "You do not manage this room");
  }

  return timeslot;
};

const createApproveRequestHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const timeslotId = toInteger(req.params.id, "id");
    const accountId = toInteger(req.params.accountId, "accountId");

    const timeslot = await assertSlotOwner(timeslotId, account.id);
    const roomId = timeslot.room!.id;

    let approved = false;

    await prisma.$transaction(
      async (tx) => {
        const request = await tx.timeslotJoinRequest.findUnique({
          where: { timeslotId_accountId: { timeslotId, accountId } },
          select: { accountId: true },
        });

        if (!request) {
          throw createHttpError(404, "Request not found");
        }

        // The player may have taken a seat elsewhere in this hour while the
        // request sat in the queue — approving would double-book them.
        const clash = await findClashingSlot(
          tx,
          accountId,
          timeslot.day,
          timeslot.start_time
        );

        if (clash) {
          throw createHttpError(
            409,
            "This player is already in another game at this hour"
          );
        }

        const count = await tx.timeslotPlayer.count({ where: { timeslotId } });
        if (count >= timeslot.max_players) {
          throw createHttpError(409, "Timeslot is full");
        }

        await tx.timeslotPlayer.create({
          data: { timeslotId, accountId },
        });
        await tx.timeslotJoinRequest.delete({
          where: { timeslotId_accountId: { timeslotId, accountId } },
        });

        approved = true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (approved) {
      const players = await getUpdatedPlayers(timeslotId);
      const membership: TimeslotMembershipChangedPayload = {
        timeslotId,
        players,
      };
      io.emit(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, membership);

      const resolved: JoinRequestResolvedPayload = {
        timeslotId,
        roomId,
        accountId,
        approved: true,
      };
      io.emit(JOIN_REQUEST_RESOLVED_EVENT, resolved);

      // An approval seats the player, so their requests elsewhere in this hour
      // are now void — the other hosts need to see that without a refresh.
      await emitRequestValidityChanged(
        io,
        accountId,
        timeslot.day,
        timeslot.start_time,
        timeslotId,
        false
      );
    }

    const response: MutationMessageResponse = { message: "request approved" };
    res.send(response);
  });

const createDenyRequestHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const timeslotId = toInteger(req.params.id, "id");
    const accountId = toInteger(req.params.accountId, "accountId");

    const timeslot = await assertSlotOwner(timeslotId, account.id);

    // Deny keeps the row (status: denied) so the player can't immediately
    // re-request; the worker clears it when this occurrence ends.
    const result = await prisma.timeslotJoinRequest.updateMany({
      where: { timeslotId, accountId, status: "pending" },
      data: { status: "denied", resolved_at: new Date() },
    });

    if (result.count > 0) {
      const resolved: JoinRequestResolvedPayload = {
        timeslotId,
        roomId: timeslot.room!.id,
        accountId,
        approved: false,
      };
      io.emit(JOIN_REQUEST_RESOLVED_EVENT, resolved);
    }

    const response: MutationMessageResponse = { message: "request denied" };
    res.send(response);
  });

// Acknowledges a request that can no longer be approved because the player has
// committed to another game this hour. The row is deleted rather than denied:
// the host is clearing something already void, not passing judgement, so no
// denial follows the player around — if they free the hour up they may ask
// again.
//
// Guarded on the clash still existing so a stale queue can't drop a request
// that became approvable again between render and click.
const createAcknowledgeRequestHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const timeslotId = toInteger(req.params.id, "id");
    const accountId = toInteger(req.params.accountId, "accountId");

    const timeslot = await assertSlotOwner(timeslotId, account.id);

    const clash = await findClashingSlot(
      prisma,
      accountId,
      timeslot.day,
      timeslot.start_time
    );

    if (!clash) {
      throw createHttpError(
        409,
        "This request is still open — approve or decline it"
      );
    }

    const result = await prisma.timeslotJoinRequest.deleteMany({
      where: { timeslotId, accountId, status: "pending" },
    });

    if (result.count > 0) {
      const resolved: JoinRequestResolvedPayload = {
        timeslotId,
        roomId: timeslot.room!.id,
        accountId,
        approved: false,
      };
      io.emit(JOIN_REQUEST_RESOLVED_EVENT, resolved);
    }

    const response: MutationMessageResponse = { message: "request dismissed" };
    res.send(response);
  });

const createRedestributePlayersBetweenTimeslotHandler = (
  io: Server
): RequestHandler =>
  asyncHandler(async (req, res) => {
    const timeslotId = toInteger(req.params.id, "id");

    await redistributeSlot(timeslotId, io);

    const response: MutationMessageResponse = {
      message: "redistributed timeslot",
    };
    res.send(response);
  });

export const registerMembershipRoutes = (app: Application, io: Server) => {
  app.get("/timeslots/joined", getJoinedSlots);
  app.post("/timeslots/:id/join", createJoinTimeslotHandler(io));
  app.post("/timeslots/:id/leave", createLeaveTimeslotHandler(io));
  app.post(
    "/timeslots/:id/requests/:accountId/approve",
    createApproveRequestHandler(io)
  );
  app.post(
    "/timeslots/:id/requests/:accountId/deny",
    createDenyRequestHandler(io)
  );
  app.delete(
    "/timeslots/:id/requests/:accountId",
    createAcknowledgeRequestHandler(io)
  );
  app.post(
    "/timeslots/:id/redistribute",
    createRedestributePlayersBetweenTimeslotHandler(io)
  );
};

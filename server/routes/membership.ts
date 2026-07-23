import type { Application, RequestHandler } from "express";
import type { Server } from "socket.io";
import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import type {
  JoinRequestCreatedPayload,
  JoinRequestResolvedPayload,
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

type JoinResult =
  | { outcome: "joined" | "already" }
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

        return { outcome: "joined" };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (result.outcome === "joined") {
      const players = await getUpdatedPlayers(timeslotId);
      const payload: TimeslotMembershipChangedPayload = { timeslotId, players };
      io.emit(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, payload);

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
    }

    const response: MutationMessageResponse = { message: "left timeslot" };
    res.send(response);
  });

// Ensures the caller owns (created or hosts) the room the slot belongs to.
const assertSlotOwner = async (timeslotId: number, accountId: number) => {
  const timeslot = await prisma.roomTimeslot.findUnique({
    where: { id: timeslotId },
    select: {
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
  app.post(
    "/timeslots/:id/redistribute",
    createRedestributePlayersBetweenTimeslotHandler(io)
  );
};

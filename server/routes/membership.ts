import type { Application, RequestHandler } from "express";
import type { Server } from "socket.io";
import { Prisma } from "@prisma/client";
import prisma from "../prisma.js";
import type {
  JoinTimeslotRequest,
  MutationMessageResponse,
  TimeslotMembershipChangedPayload,
} from "../../packages/shared/index.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import { toInteger, toOptionalDate } from "../utils/validation.js";

export const TIMESLOT_MEMBERSHIP_CHANGED_EVENT = "timeslot-membership:changed";

const getCurrentAccount = async (email: string) => {
  const account = await prisma.account.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!account) {
    throw createHttpError(404, "Account not found");
  }

  return account;
};

const getUpdatedPlayers = async (
  timeslotId: number
): Promise<TimeslotMembershipChangedPayload["players"]> => {
  const rows = await prisma.timeslotPlayer.findMany({
    where: { timeslotId },
    select: { accounts: { select: { id: true, name: true, email: true } } },
  });
  return rows.map(({ accounts }) => accounts);
};

const createJoinTimeslotHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const timeslotId = toInteger(req.params.id, "id");
    const { joined_at } = (req.body ?? {}) as JoinTimeslotRequest;
    const joinedAt = toOptionalDate(joined_at, "joined_at");

    let changed = false;

    await prisma.$transaction(
      async (tx) => {
        const timeslot = await tx.roomTimeslot.findUnique({
          where: { id: timeslotId },
          select: {
            max_players: true,
            _count: { select: { timeslot_players: true } },
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
          return;
        }

        if (timeslot._count.timeslot_players >= timeslot.max_players) {
          throw createHttpError(409, "Timeslot is full");
        }

        await tx.timeslotPlayer.create({
          data: { timeslotId, accountId: account.id, joined_at: joinedAt },
        });

        changed = true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (changed) {
      console.log("here");
      const players = await getUpdatedPlayers(timeslotId);
      const payload: TimeslotMembershipChangedPayload = { timeslotId, players };
      io.emit(TIMESLOT_MEMBERSHIP_CHANGED_EVENT, payload);
    }

    const response: MutationMessageResponse = { message: "joined timeslot" };
    res.send(response);
  });

const createLeaveTimeslotHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const timeslotId = toInteger(req.params.id, "id");

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

export const registerMembershipRoutes = (app: Application, io: Server) => {
  app.post("/timeslots/:id/join", createJoinTimeslotHandler(io));
  app.post("/timeslots/:id/leave", createLeaveTimeslotHandler(io));
};

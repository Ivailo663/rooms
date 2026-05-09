import type { Application, RequestHandler } from "express";
import type { Server } from "socket.io";
import prisma from "../prisma.js";
import type {
  JoinRoomRequest,
  LeaveRoomRequest,
  MutationMessageResponse,
  RoomWithPlayersResponse,
} from "../../packages/shared/index.js";
import { getRoomsWithPlayers } from "../services/rooms.js";
import { asyncHandler } from "../utils/http.js";
import { toInteger, toOptionalDate } from "../utils/validation.js";

const createJoinRoomHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const { room_id, account_id, joined_at } = req.body as JoinRoomRequest;
    const roomId = toInteger(room_id, "room_id");
    const accountId = toInteger(account_id, "account_id");
    const joinedAt = toOptionalDate(joined_at, "joined_at");

    await prisma.$transaction(async (tx) => {
      await tx.roomPlayer.deleteMany({
        where: {
          roomId,
          accountId,
        },
      });

      await tx.roomPlayer.create({
        data: {
          roomId,
          accountId,
          joinedAt,
        },
      });
    });

    const rooms: RoomWithPlayersResponse[] = await getRoomsWithPlayers();
    io.emit("rooms:updated", rooms);

    const response: MutationMessageResponse = {
      message: "joined room",
    };

    res.send(response);
  });

const createLeaveRoomHandler = (io: Server): RequestHandler =>
  asyncHandler(async (req, res) => {
    const { room_id, account_id } = req.body as LeaveRoomRequest;
    const roomId = toInteger(room_id, "room_id");
    const accountId = toInteger(account_id, "account_id");

    await prisma.roomPlayer.deleteMany({
      where: {
        roomId,
        accountId,
      },
    });

    const rooms: RoomWithPlayersResponse[] = await getRoomsWithPlayers();
    io.emit("rooms:updated", rooms);

    const response: MutationMessageResponse = {
      message: "left room",
    };

    res.send(response);
  });

export const registerMembershipRoutes = (app: Application, io: Server) => {
  app.post("/join", createJoinRoomHandler(io));
  app.post("/leave", createLeaveRoomHandler(io));
};

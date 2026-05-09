import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  RoomSummaryResponse,
  JoinableRoomResponse,
} from "../../packages/shared/index.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import { toInteger } from "../utils/validation.js";

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

const createRoom: RequestHandler = asyncHandler(async (req, res) => {
  const { name, description, creator_id, price, host_id } =
    req.body as CreateRoomRequest;

  const creatorId = toInteger(creator_id, "creator_id");
  const hostId = toInteger(host_id, "host_id");

  const room = await prisma.room.create({
    data: {
      name,
      description,
      creatorId,
      hostId,
      price,
      address: "",
    },
    select: {
      id: true,
    },
  });

  const response: CreateRoomResponse = {
    id: room.id,
    message: "room created!",
  };

  res.send(response);
});

const getHostedRooms: RequestHandler = asyncHandler(async (_req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);

  const rooms = await prisma.room.findMany({
    where: {
      hostId: account.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      address: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const response: RoomSummaryResponse[] = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    address: room.address,
    price: room.price?.toString() ?? null,
  }));

  res.send(response);
});

const getJoinableRooms: RequestHandler = asyncHandler(async (_req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);

  const rooms = await prisma.room.findMany({
    where: {
      hostId: {
        not: account.id,
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      address: true,
      timeslots: {
        select: {
          id: true,
          name: true,
          message: true,
          price: true,
          label: true,
          features: true,
          max_players: true,
          timeslot_players: {
            select: {
              accounts: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          id: "asc",
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  const response: JoinableRoomResponse[] = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    price: room.price?.toString() ?? null,
    address: room.address,
    timeslots: room.timeslots.map((timeslot) => {
      const players = timeslot.timeslot_players.map(({ accounts }) => ({
        id: accounts.id,
        email: accounts.email,
        name: accounts.name,
      }));

      return {
        id: timeslot.id,
        name: timeslot.name,
        message: timeslot.message,
        price: timeslot.price?.toString() ?? null,
        label: timeslot.label,
        features: timeslot.features,
        playersCount: players.length,
        max_players: timeslot.max_players,
        players,
      };
    }),
  }));

  res.send(response);
});

export const registerRoomRoutes = (app: Application) => {
  app.post("/rooms", createRoom);
  app.get("/rooms/hosted", getHostedRooms);
  app.get("/rooms/joinable", getJoinableRooms);
};

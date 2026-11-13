import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  HostedRoomResponse,
  PlayableRoomResponse,
  TenantSettings,
} from "../../packages/shared/index.js";
import { asyncHandler } from "../utils/http.js";
import { resolveCutoff } from "../slotRules.js";
import { assertRole } from "../tenantAccess.js";
import { getCurrentAccount } from "../currentAccount.js";

const createRoom: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.uid);
  assertRole(account, "clientAdmin");
  const { name, description, price } = req.body as CreateRoomRequest;

  const room = await prisma.room.create({
    data: {
      name,
      description,
      creatorId: account.id,
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

const getHostedRooms: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.uid);
  const day = typeof req.query.day === "string" ? req.query.day : undefined;

  const rooms = await prisma.room.findMany({
    where: {
      creatorId: account.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      address: true,
      timeslots: {
        where: day
          ? { enabled: true, status: "live", day }
          : { enabled: true, status: "live" },
        select: {
          id: true,
          label: true,
          start_time: true,
          max_players: true,
          day: true,
          timeslot_players: {
            select: { accounts: { select: { id: true, name: true } } },
          },
        },
        take: 1,
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  // Pending join-request counts per room, in one aggregate query. Backed by
  // the DB so the card badge survives reloads and missed socket events.
  const roomIds = rooms.map((room) => room.id);
  const pendingRequests = roomIds.length
    ? await prisma.timeslotJoinRequest.findMany({
        where: {
          status: "pending",
          room_timeslot: { roomId: { in: roomIds } },
        },
        select: { room_timeslot: { select: { roomId: true } } },
      })
    : [];
  const pendingByRoom = new Map<number, number>();
  for (const request of pendingRequests) {
    const roomId = request.room_timeslot.roomId;
    pendingByRoom.set(roomId, (pendingByRoom.get(roomId) ?? 0) + 1);
  }

  const response: HostedRoomResponse[] = rooms.map((room) => {
    const live = room.timeslots[0] ?? null;
    const players =
      live?.timeslot_players.map(({ accounts }) => ({
        id: accounts.id,
        name: accounts.name,
      })) ?? [];
    return {
      id: room.id,
      name: room.name,
      description: room.description,
      address: room.address,
      price: room.price?.toString() ?? null,
      pendingRequestCount: pendingByRoom.get(room.id) ?? 0,
      liveSlot: live
        ? {
            id: live.id,
            label: live.label,
            start_time: live.start_time,
            players_count: players.length,
            players,
            max_players: live.max_players,
            day: live.day,
          }
        : null,
    };
  });

  res.send(response);
});

const getPlayableRooms: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.uid);
  const day = typeof req.query.day === "string" ? req.query.day : undefined;

  const rooms = await prisma.room.findMany({
    where: {
      creatorId: {
        not: account.id,
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      address: true,
      tenant: { select: { settings: true } },
      timeslots: {
        where: day ? { day, enabled: true } : { enabled: true },
        select: {
          id: true,
          name: true,
          message: true,
          price: true,
          label: true,
          features: true,
          max_players: true,
          status: true,
          day: true,
          start_time: true,
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
          join_requests: {
            where: { accountId: account.id },
            select: { status: true },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  const response: PlayableRoomResponse[] = rooms.map((room) => {
    const settings = (room.tenant?.settings ?? {}) as Partial<TenantSettings>;

    return {
      id: room.id,
      name: room.name,
      description: room.description,
      price: room.price?.toString() ?? null,
      address: room.address,
      deniedMessage: settings.deniedMessage?.trim() || null,
      lateJoinCutoff: resolveCutoff(settings),
      allowJoinOnLive: settings.allowJoinOnLive ?? false,
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
          status: timeslot.status,
          day: timeslot.day,
          start_time: timeslot.start_time,
          players,
          requestStatusForCurrentUser: timeslot.join_requests[0]?.status ?? null,
        };
      }),
    };
  });

  res.send(response);
});

export const registerRoomRoutes = (app: Application) => {
  app.post("/rooms", createRoom);
  app.get("/rooms/hosted", getHostedRooms);
  app.get("/rooms/playable", getPlayableRooms);
};

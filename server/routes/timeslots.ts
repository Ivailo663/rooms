import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import type {
  TimeslotResponse,
  CreateTimeslotRequest,
  UpdateTimeslotRequest,
  CreateTimeslotResponse,
} from "../../packages/shared/index.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import { toInteger } from "../utils/validation.js";
import { Prisma } from "@prisma/client";
import { syncSlot } from "../scheduler.js";

const labelToStartTime = (label: string): number => {
  const [h, m] = label.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const SLOT_DURATION_MINUTES = 60;

type SlotWithRequests = {
  id: number;
  day: string;
  start_time: number;
  join_requests: Array<{ accountId: number }>;
};

// Requests the host can no longer approve, keyed "timeslotId:accountId": the
// requester has since taken a confirmed seat in another game whose hour
// overlaps, so approving would 409 on the server's one-game-per-hour rule.
//
// Resolved in a single query for the whole view rather than per request — the
// seats can live in any room or tenant, so there is nothing narrower to scope
// it to than the requesting accounts themselves.
const findInvalidRequests = async (
  timeslots: SlotWithRequests[]
): Promise<Set<string>> => {
  const accountIds = Array.from(
    new Set(
      timeslots.flatMap((slot) => slot.join_requests.map((r) => r.accountId))
    )
  );

  if (!accountIds.length) {
    return new Set();
  }

  const seats = await prisma.timeslotPlayer.findMany({
    where: {
      accountId: { in: accountIds },
      room_timeslots: {
        enabled: true,
        day: { in: Array.from(new Set(timeslots.map((slot) => slot.day))) },
      },
    },
    select: {
      accountId: true,
      timeslotId: true,
      room_timeslots: { select: { day: true, start_time: true } },
    },
  });

  const invalid = new Set<string>();

  for (const slot of timeslots) {
    for (const request of slot.join_requests) {
      const clashes = seats.some(
        (seat) =>
          seat.accountId === request.accountId &&
          seat.timeslotId !== slot.id &&
          seat.room_timeslots.day === slot.day &&
          Math.abs(seat.room_timeslots.start_time - slot.start_time) <
            SLOT_DURATION_MINUTES
      );

      if (clashes) {
        invalid.add(`${slot.id}:${request.accountId}`);
      }
    }
  }

  return invalid;
};

const getQueryValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const getCurrentAccount = async (email: string) => {
  const account = await prisma.account.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (!account) {
    throw createHttpError(404, "Account not found");
  }

  return account;
};

const getTimeslots: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);
  const roomId = toInteger(getQueryValue(req.query.room_id), "room_id");

  const timeslots = await prisma.roomTimeslot.findMany({
    where: {
      roomId,
      day: req.query.day as string,
      room: {
        creatorId: account.id,
      },
    },
    include: {
      timeslot_players: {
        include: {
          accounts: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      join_requests: {
        where: { status: "pending" },
        include: {
          account: { select: { name: true } },
        },
      },
    },
    orderBy: { start_time: "asc" },
  });

  const invalidRequests = await findInvalidRequests(timeslots);

  const response: TimeslotResponse[] = timeslots.map((timeslot) => ({
    id: timeslot.id,
    name: timeslot.name,
    message: timeslot.message,
    price: timeslot.price?.toString() ?? null,
    label: timeslot.label,
    min_players: timeslot.min_players,
    max_players: timeslot.max_players,
    features: timeslot.features as TimeslotResponse["features"],
    day: timeslot.day,
    enabled: timeslot.enabled,
    status: timeslot.status,
    start_time: timeslot.start_time,
    players: timeslot.timeslot_players.map(({ accounts }) => ({
      id: accounts.id,
      name: accounts.name,
    })),
    pendingRequests: timeslot.join_requests.map((request) => ({
      accountId: request.accountId,
      name: request.account.name,
      created_at: request.created_at ? request.created_at.toISOString() : null,
      valid: !invalidRequests.has(`${timeslot.id}:${request.accountId}`),
    })),
  }));

  res.send(response);
});

const getEnabledTimeslots: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);
  const roomId = toInteger(getQueryValue(req.query.room_id), "room_id");

  const timeslots = await prisma.roomTimeslot.findMany({
    where: {
      roomId,
      enabled: true,
      status: { not: "ended" },
      day: req.query.day as string,
      room: {
        creatorId: account.id,
      },
    },
    include: {
      timeslot_players: {
        include: {
          accounts: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      join_requests: {
        where: { status: "pending" },
        include: {
          account: { select: { name: true } },
        },
      },
    },
    orderBy: { start_time: "asc" },
  });

  const invalidRequests = await findInvalidRequests(timeslots);

  const response: TimeslotResponse[] = timeslots.map((timeslot) => ({
    id: timeslot.id,
    name: timeslot.name,
    message: timeslot.message,
    price: timeslot.price?.toString() ?? null,
    label: timeslot.label,
    min_players: timeslot.min_players,
    max_players: timeslot.max_players,
    features: timeslot.features as TimeslotResponse["features"],
    day: timeslot.day,
    enabled: timeslot.enabled,
    status: timeslot.status,
    start_time: timeslot.start_time,
    players: timeslot.timeslot_players.map(({ accounts }) => ({
      id: accounts.id,
      name: accounts.name,
    })),
    pendingRequests: timeslot.join_requests.map((request) => ({
      accountId: request.accountId,
      name: request.account.name,
      created_at: request.created_at ? request.created_at.toISOString() : null,
      valid: !invalidRequests.has(`${timeslot.id}:${request.accountId}`),
    })),
  }));

  res.send(response);
});

const getEnabledTimeslotDaysAndFirstSlot: RequestHandler = asyncHandler(
  async (req, res) => {
    const account = await getCurrentAccount(res.locals.user.email);
    const roomId = toInteger(getQueryValue(req.query.room_id), "room_id");

    const rows = await prisma.roomTimeslot.findMany({
      where: {
        roomId,
        enabled: true,
        room: {
          creatorId: account.id,
        },
      },
      select: { day: true, label: true },
      orderBy: { start_time: "asc" },
      distinct: ["day"],
    });

    res.send(rows.map((r) => ({ day: r.day, label: r.label })));
  }
);

// Which days of the room hold at least one pending join request. The slot list
// only ever loads the selected day, so this is what lets the day switcher hint
// that another day is waiting on the host.
const getPendingRequestDays: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);
  const roomId = toInteger(getQueryValue(req.query.room_id), "room_id");

  const rows = await prisma.roomTimeslot.findMany({
    where: {
      roomId,
      room: {
        creatorId: account.id,
      },
      join_requests: {
        some: { status: "pending" },
      },
    },
    select: { day: true },
    distinct: ["day"],
  });

  res.send(rows.map((row) => row.day));
});

const createTimeslot: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);
  const body: CreateTimeslotRequest = req.body;

  // Validate room belongs to account
  const room = await prisma.room.findFirst({
    where: { id: body.room_id, creatorId: account.id },
  });

  if (!room) {
    throw createHttpError(404, "Room not found or not owned by user");
  }

  const timeslot = await prisma.roomTimeslot.create({
    data: {
      roomId: body.room_id,
      order: body.order,
      day: body.day,
      name: body.name,
      label: body.label,
      start_time: labelToStartTime(body.label),
      min_players: body.min_players ?? null,
      max_players: body.max_players,
      price: body.price
        ? typeof body.price === "string"
          ? parseFloat(body.price)
          : body.price
        : null,
      message: body.message,
      features: body.features,
      enabled: body.enabled ?? false,
    },
  });

  await syncSlot(timeslot.id);

  const response: CreateTimeslotResponse = {
    id: timeslot.id,
    message: "Timeslot created successfully",
  };

  res.send(response);
});

const updateTimeslot: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);
  const body: UpdateTimeslotRequest = req.body;

  // Validate timeslot exists and belongs to user's room
  const existingTimeslot = await prisma.roomTimeslot.findFirst({
    where: {
      id: body.id,
      room: {
        creatorId: account.id,
      },
    },
  });

  if (!existingTimeslot) {
    throw createHttpError(404, "Timeslot not found or not owned by user");
  }

  const updateData: Partial<Prisma.RoomTimeslotUpdateInput> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.label !== undefined) {
    updateData.label = body.label;
    updateData.start_time = labelToStartTime(body.label);
    // keep `order` aligned with the hour so it never drifts from the label
    updateData.order = Math.floor(labelToStartTime(body.label) / 60);
  }
  if (body.min_players !== undefined) updateData.min_players = body.min_players;
  if (body.max_players !== undefined) updateData.max_players = body.max_players;
  if (body.price !== undefined) {
    updateData.price = body.price
      ? typeof body.price === "string"
        ? parseFloat(body.price)
        : body.price
      : null;
  }
  if (body.message !== undefined) updateData.message = body.message;
  if (body.features !== undefined) updateData.features = body.features;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;

  await prisma.roomTimeslot.update({
    where: { id: body.id },
    data: updateData,
  });

  await syncSlot(body.id);

  res.send({ message: "Timeslot updated successfully" });
});

const deleteTimeslot: RequestHandler = asyncHandler(async (req, res) => {
  const account = await getCurrentAccount(res.locals.user.email);
  const timeslotId = toInteger(getQueryValue(req.params.id), "id");

  // Validate timeslot exists and belongs to user's room
  const existingTimeslot = await prisma.roomTimeslot.findFirst({
    where: {
      id: timeslotId,
      room: {
        creatorId: account.id,
      },
    },
  });

  if (!existingTimeslot) {
    throw createHttpError(404, "Timeslot not found or not owned by user");
  }

  await prisma.roomTimeslot.delete({
    where: { id: timeslotId },
  });

  await syncSlot(timeslotId);

  res.send({ message: "Timeslot deleted successfully" });
});

export const registerTimeslotRoutes = (app: Application) => {
  app.get("/timeslots", getTimeslots);
  app.get("/timeslots/enabled", getEnabledTimeslots);
  app.get("/timeslots/enabled/days", getEnabledTimeslotDaysAndFirstSlot);
  app.get("/timeslots/pending-days", getPendingRequestDays);
  app.post("/timeslots", createTimeslot);
  app.put("/timeslots", updateTimeslot);
  app.delete("/timeslots/:id", deleteTimeslot);
};

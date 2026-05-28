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

const labelToStartTime = (label: string): number => {
  const [h, m] = label.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
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
    },
    orderBy: {
      order: "asc",
    },
  });

  const response: TimeslotResponse[] = timeslots.map((timeslot) => ({
    id: timeslot.id,
    name: timeslot.name,
    message: timeslot.message,
    price: timeslot.price?.toString() ?? null,
    label: timeslot.label,
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
    },
    orderBy: { start_time: "asc" },
  });

  const response: TimeslotResponse[] = timeslots.map((timeslot) => ({
    id: timeslot.id,
    name: timeslot.name,
    message: timeslot.message,
    price: timeslot.price?.toString() ?? null,
    label: timeslot.label,
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
  }));

  res.send(response);
});

const getEnabledTimeslotDays: RequestHandler = asyncHandler(
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
      select: { day: true },
      distinct: ["day"],
    });

    res.send(rows.map((r) => r.day));
  }
);

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
      available_date: body.available_date ? new Date(body.available_date) : "", //TODO: Handle optional date properly
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
  }
  if (body.available_date !== undefined)
    updateData.available_date = new Date(body.available_date);
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

  const updatedTimeslot = await prisma.roomTimeslot.update({
    where: { id: body.id },
    data: updateData,
  });

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

  res.send({ message: "Timeslot deleted successfully" });
});

export const registerTimeslotRoutes = (app: Application) => {
  app.get("/timeslots", getTimeslots);
  app.get("/timeslots/enabled", getEnabledTimeslots);
  app.get("/timeslots/enabled/days", getEnabledTimeslotDays);
  app.post("/timeslots", createTimeslot);
  app.put("/timeslots", updateTimeslot);
  app.delete("/timeslots/:id", deleteTimeslot);
};

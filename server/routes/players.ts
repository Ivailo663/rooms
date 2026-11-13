import type { Application, RequestHandler } from "express";
import prisma from "../prisma.js";
import type { PlayerProfile } from "../../packages/shared/index.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import { toInteger } from "../utils/validation.js";

// PROF-31/32: any signed-in user may read any profile, so the select is the
// whole guard — email, uid, role and tenant must never be added to it.
const getPlayer: RequestHandler = asyncHandler(async (req, res) => {
  const id = toInteger(req.params.id, "id");

  const player = await prisma.account.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      picture_url: true,
      position: true,
      city: true,
      bio: true,
      created_at: true,
    },
  });

  if (!player) {
    throw createHttpError(404, "Player not found");
  }

  res.send({
    ...player,
    created_at: player.created_at.toISOString(),
  } satisfies PlayerProfile);
});

export const registerPlayerRoutes = (app: Application) => {
  app.get("/players/:id", getPlayer);
};

import type { Application, RequestHandler } from "express";
import { CITIES } from "../cities.js";
import { createGuardedRoutes } from "../utils/guardedRoutes.js";
import { Role } from "../../packages/shared/index.js";

// PROF-24
const getCities: RequestHandler = (_req, res) => {
  res.send(CITIES);
};

export const registerCityRoutes = (app: Application) => {
  const routes = createGuardedRoutes(app);

  routes.get("/cities", Role.player, getCities);
};

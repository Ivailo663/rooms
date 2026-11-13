import type { Application, RequestHandler } from "express";
import { CITIES } from "../cities.js";

// PROF-24
const getCities: RequestHandler = (_req, res) => {
  res.send(CITIES);
};

export const registerCityRoutes = (app: Application) => {
  app.get("/cities", getCities);
};

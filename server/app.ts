import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { Server } from "socket.io";
import {
  AUTHENTICATED_PATHS,
  verifyFirebaseToken,
} from "./middleware/verifyFirebaseToken.js";
import { requireTermsAccepted } from "./middleware/requireTermsAccepted.js";
import { registerMembershipRoutes } from "./routes/membership.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerTimeslotRoutes } from "./routes/timeslots.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { registerAccountRoutes } from "./routes/accounts.js";
import { registerPlayerRoutes } from "./routes/players.js";
import { registerCityRoutes } from "./routes/cities.js";
import { registerMediaRoutes } from "./routes/media.js";
import type { AppError } from "./utils/http.js";
import { startScheduler } from "./scheduler.js";
import { createTimeslotWorker } from "./workers/timeslotWorker.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

const httpServer = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// APP-03: the web app's addresses, comma-separated (CLIENT_ORIGINS on Render);
// locally the Vite dev server.
const clientOrigins = process.env.CLIENT_ORIGINS?.split(",").map((o) =>
  o.trim()
) ?? ["http://localhost:5173"];

const io = new Server(httpServer, {
  cors: {
    origin: clientOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(AUTHENTICATED_PATHS, verifyFirebaseToken, requireTermsAccepted);

registerUserRoutes(app);
registerRoomRoutes(app);
registerTimeslotRoutes(app);
registerMembershipRoutes(app, io);
registerTenantRoutes(app);
registerAccountRoutes(app);
registerPlayerRoutes(app);
registerCityRoutes(app);
registerMediaRoutes(app);

createTimeslotWorker(io);

startScheduler(io).catch((err) =>
  console.error("Scheduler: startup failed:", err)
);

app.use(
  (error: AppError, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res
      .status(error.status ?? 500)
      .send(error.message ?? "Internal server error");
  }
);

io.on("connection", () => {
  console.log("a user connected");
});

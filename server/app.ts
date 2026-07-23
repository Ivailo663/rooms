import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import { Server } from "socket.io";
import { verifyFirebaseToken } from "./middleware/verifyFirebaseToken.js";
import { registerMembershipRoutes } from "./routes/membership.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerTimeslotRoutes } from "./routes/timeslots.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { registerAccountRoutes } from "./routes/accounts.js";
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

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Apply auth only to API routes — socket.io transport requests must be excluded
app.use(["/rooms", "/timeslots", "/user", "/accounts"], verifyFirebaseToken);

registerUserRoutes(app);
registerRoomRoutes(app);
registerTimeslotRoutes(app);
registerMembershipRoutes(app, io);
registerTenantRoutes(app);
registerAccountRoutes(app);

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

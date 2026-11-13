import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("../prisma.js", () => ({ default: { account: { findUnique } } }));
vi.mock("../firebase.js", () => ({
  default: {
    auth: () => ({ verifyIdToken: vi.fn().mockResolvedValue({ uid: "u1" }) }),
  },
}));

import { AUTHENTICATED_PATHS, verifyFirebaseToken } from "./verifyFirebaseToken.js";
import { requireTermsAccepted } from "./requireTermsAccepted.js";
import type { AppError } from "../utils/http.js";

// Mounted exactly as app.ts mounts it, with a stub at every real route, so the
// test covers Express's prefix matching rather than a hand-built req.
const ROUTES: [string, string][] = [
  ["get", "/user"],
  ["post", "/user"],
  ["patch", "/user"],
  ["get", "/rooms/playable"],
  ["post", "/rooms"],
  ["get", "/timeslots"],
  ["post", "/timeslots/:id/join"],
  ["delete", "/timeslots/:id"],
  ["get", "/accounts"],
  ["get", "/tenants/:tenantId"],
  ["post", "/tenants"],
  ["get", "/players/:id"],
  ["get", "/cities"],
];

const reached = vi.fn();
const app = express();
app.use(express.json());
app.use(AUTHENTICATED_PATHS, verifyFirebaseToken, requireTermsAccepted);
for (const [method, path] of ROUTES) {
  (app as unknown as Record<string, (p: string, h: express.Handler) => void>)[
    method
  ](path, (req, res) => {
    reached(`${req.method} ${req.path}`);
    res.send("ok");
  });
}
app.use((error: AppError, _req: Request, res: Response, _next: NextFunction) => {
  res.status(error.status ?? 500).send(error.message);
});

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const call = async (method: string, path: string) => {
  const res = await fetch(base + path, {
    method,
    headers: { authorization: "Bearer t" },
  });
  return { status: res.status, text: await res.text() };
};

const GATED: [string, string][] = [
  ["PATCH", "/user"],
  ["GET", "/rooms/playable"],
  ["POST", "/rooms"],
  ["GET", "/timeslots"],
  ["POST", "/timeslots/4/join"],
  ["DELETE", "/timeslots/4"],
  ["GET", "/accounts"],
  ["GET", "/tenants/1"],
  ["POST", "/tenants"],
  ["GET", "/players/2"],
  ["GET", "/cities"],
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("terms gate", () => {
  it.each(GATED)(
    "AUTH-25: %s %s is 403 for an account that hasn't ticked the box",
    async (method, path) => {
      findUnique.mockResolvedValue({ terms_accepted_at: null });

      const { status, text } = await call(method, path);

      expect(status).toBe(403);
      expect(text).toBe("Tick the box to continue");
      expect(reached).not.toHaveBeenCalled();
      expect(findUnique).toHaveBeenCalledWith({
        where: { firebase_uid: "u1" },
        select: { terms_accepted_at: true },
      });
    },
  );

  it.each(GATED)(
    "AUTH-25: %s %s is 403 for a Firebase user with no account",
    async (method, path) => {
      findUnique.mockResolvedValue(null);

      const { status, text } = await call(method, path);

      expect(status).toBe(403);
      expect(text).toBe("Tick the box to continue");
      expect(reached).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["GET", "/user"],
    ["POST", "/user"],
    ["GET", "/user/"],
    ["POST", "/USER"],
  ])(
    "AUTH-25: %s %s goes through without an account or a tick",
    async (method, path) => {
      findUnique.mockResolvedValue(null);

      const { status } = await call(method, path);

      expect(status).toBe(200);
      expect(reached).toHaveBeenCalledTimes(1);
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it.each(GATED)(
    "AUTH-25: %s %s goes through once the box is ticked",
    async (method, path) => {
      findUnique.mockResolvedValue({ terms_accepted_at: new Date() });

      const { status } = await call(method, path);

      expect(status).toBe(200);
      expect(reached).toHaveBeenCalledTimes(1);
    },
  );
});

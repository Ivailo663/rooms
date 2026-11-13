import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";

const { prisma, getUser } = vi.hoisted(() => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
  getUser: vi.fn(),
}));

vi.mock("../prisma.js", () => ({ default: prisma }));
vi.mock("../firebase.js", () => ({
  default: { auth: () => ({ getUser, verifyIdToken: vi.fn() }) },
}));

import { registerUserRoutes } from "./users.js";
import { registerPlayerRoutes } from "./players.js";
import { registerCityRoutes } from "./cities.js";
import { AUTHENTICATED_PATHS } from "../middleware/verifyFirebaseToken.js";

const handlers = new Map<string, RequestHandler>();
const app = {
  get: (path: string, h: RequestHandler) => handlers.set(`GET ${path}`, h),
  post: (path: string, h: RequestHandler) => handlers.set(`POST ${path}`, h),
  patch: (path: string, h: RequestHandler) => handlers.set(`PATCH ${path}`, h),
} as unknown as Application;
registerUserRoutes(app);
registerPlayerRoutes(app);
registerCityRoutes(app);

const CREATED = "Tue, 01 Mar 2022 10:00:00 GMT";

const call = async (
  route: string,
  token: Record<string, unknown>,
  req: Record<string, unknown> = {},
) => {
  const send = vi.fn();
  const next = vi.fn();
  await handlers.get(route)!(
    { params: {}, body: {}, ...req } as never,
    { locals: { user: token }, send } as never,
    next,
  );
  return { sent: send.mock.calls[0]?.[0], error: next.mock.calls[0]?.[0] };
};

const uniqueViolation = Object.assign(new Error("unique"), { code: "P2002" });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.account.findUnique.mockResolvedValue(null);
  prisma.account.findFirst.mockResolvedValue(null);
  prisma.account.create.mockImplementation(({ data }) =>
    Promise.resolve({ id: 9, ...data }),
  );
  getUser.mockResolvedValue({ metadata: { creationTime: CREATED } });
});

describe("POST /user", () => {
  it("AUTH-01: finds the caller by Firebase uid, never by email", async () => {
    const account = { id: 3, firebase_uid: "u1", email: "old@x.bg" };
    prisma.account.findUnique.mockResolvedValue(account);

    const { sent } = await call("POST /user", {
      uid: "u1",
      email: "new@x.bg",
      email_verified: true,
    });

    expect(sent).toBe(account);
    expect(prisma.account.findUnique).toHaveBeenCalledWith({
      where: { firebase_uid: "u1" },
    });
    expect(prisma.account.findFirst).not.toHaveBeenCalled();
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("AUTH-02: an account with the verified email and no uid gets the uid", async () => {
    prisma.account.findFirst.mockResolvedValue({ id: 4 });
    prisma.account.updateMany.mockResolvedValue({ count: 1 });
    prisma.account.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 4, firebase_uid: "u1" });

    const { sent } = await call("POST /user", {
      uid: "u1",
      email: "Ann@X.bg",
      email_verified: true,
    });

    expect(prisma.account.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: { equals: "Ann@X.bg", mode: "insensitive" },
          firebase_uid: null,
        },
      }),
    );
    // Conditional on the uid still being empty: two users can't both claim it.
    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { id: 4, firebase_uid: null },
      data: { firebase_uid: "u1" },
    });
    expect(sent).toEqual({ id: 4, firebase_uid: "u1" });
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it("AUTH-02: an unverified email claims nothing", async () => {
    await call("POST /user", {
      uid: "u1",
      email: "ann@x.bg",
      email_verified: false,
    });

    expect(prisma.account.findFirst).not.toHaveBeenCalled();
    expect(prisma.account.updateMany).not.toHaveBeenCalled();
    expect(prisma.account.create).toHaveBeenCalledTimes(1);
  });

  it("AUTH-02: an email whose account is linked to someone else is 409, not a second account", async () => {
    prisma.account.create.mockRejectedValue(uniqueViolation);

    const { error } = await call("POST /user", {
      uid: "u2",
      email: "ann@x.bg",
      email_verified: true,
    });

    expect(error).toMatchObject({ status: 409 });
  });

  it("ROLE-07: a parallel first sign-in returns the account the other request created", async () => {
    const other = { id: 9, firebase_uid: "u1" };
    prisma.account.create.mockRejectedValue(uniqueViolation);
    prisma.account.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(other);

    const { sent, error } = await call("POST /user", { uid: "u1" });

    expect(error).toBeUndefined();
    expect(sent).toBe(other);
  });

  it("ROLE-07: a new account is a player named after the email's local part", async () => {
    const { sent } = await call("POST /user", {
      uid: "u1",
      email: "ivan.petrov@x.bg",
      email_verified: false,
    });

    const data = prisma.account.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("role"); // the column defaults to player
    expect(data).toMatchObject({
      firebase_uid: "u1",
      name: "ivan.petrov",
      email: "ivan.petrov@x.bg",
      picture_url: null,
    });
    expect(sent.id).toBe(9);
  });

  it("AUTH-11: a Facebook sign-in takes the name and picture from the token", async () => {
    await call("POST /user", {
      uid: "fb1",
      name: "Ivan Petrov",
      picture: "https://graph.facebook.com/1/picture",
      email: "ivan@x.bg",
      email_verified: true,
    });

    expect(prisma.account.create.mock.calls[0][0].data).toMatchObject({
      name: "Ivan Petrov",
      picture_url: "https://graph.facebook.com/1/picture",
      email: "ivan@x.bg",
    });
  });

  it("AUTH-03: a sign-in without an email still gets an account", async () => {
    const { sent, error } = await call("POST /user", {
      uid: "fb2",
      name: "Maria",
    });

    expect(error).toBeUndefined();
    expect(prisma.account.findFirst).not.toHaveBeenCalled();
    expect(prisma.account.create.mock.calls[0][0].data).toMatchObject({
      name: "Maria",
      email: null,
    });
    expect(sent.firebase_uid).toBe("fb2");
  });

  it("PROF-20: member since is the Firebase account's creation time", async () => {
    await call("POST /user", { uid: "u1", email: "a@x.bg" });

    expect(getUser).toHaveBeenCalledWith("u1");
    expect(prisma.account.create.mock.calls[0][0].data.created_at).toEqual(
      new Date(CREATED),
    );
  });
});

describe("GET /user", () => {
  it("AUTH-01: reads the caller's account by uid", async () => {
    await call("GET /user", { uid: "u1", email: "a@x.bg" });

    expect(prisma.account.findUnique).toHaveBeenCalledWith({
      where: { firebase_uid: "u1" },
    });
  });
});

describe("PATCH /user", () => {
  it("PROF-21: updates only the caller's own row, ignoring unknown fields", async () => {
    prisma.account.updateMany.mockResolvedValue({ count: 1 });

    const { error } = await call(
      "PATCH /user",
      { uid: "u1" },
      {
        params: { id: "77" },
        body: {
          id: 77,
          firebase_uid: "someone-else",
          role: "superAdmin",
          name: " Ivan ",
          city: "Varna",
        },
      },
    );

    expect(error).toBeUndefined();
    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { firebase_uid: "u1" },
      data: { name: "Ivan", city: "Varna" },
    });
  });

  it("PROF-25: the picture can't be set through the profile edit", async () => {
    prisma.account.updateMany.mockResolvedValue({ count: 1 });

    await call(
      "PATCH /user",
      { uid: "u1" },
      { body: { name: "Ivan", picture_url: "https://evil.example/x.png" } },
    );

    expect(prisma.account.updateMany.mock.calls[0][0].data).toEqual({
      name: "Ivan",
    });
  });

  it("PROF-23: an invalid body is 400 and writes nothing", async () => {
    const { error } = await call(
      "PATCH /user",
      { uid: "u1" },
      { body: { name: "" } },
    );

    expect(error).toMatchObject({ status: 400, message: "Name is required" });
    expect(prisma.account.updateMany).not.toHaveBeenCalled();
  });

  it("PROF-21: a caller with no account is 404", async () => {
    prisma.account.updateMany.mockResolvedValue({ count: 0 });

    const { error } = await call(
      "PATCH /user",
      { uid: "ghost" },
      { body: { name: "Ivan" } },
    );

    expect(error).toMatchObject({ status: 404 });
  });
});

describe("GET /players/:id", () => {
  const row = {
    id: 5,
    name: "Ivan",
    picture_url: null,
    position: "defender",
    city: "Varna",
    bio: null,
    created_at: new Date("2022-03-01T10:00:00Z"),
  };

  it("PROF-32: the profile never selects or sends the email", async () => {
    prisma.account.findUnique.mockResolvedValue(row);

    const { sent } = await call(
      "GET /players/:id",
      { uid: "u1" },
      { params: { id: "5" } },
    );

    const select = prisma.account.findUnique.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(
      [
        "bio",
        "city",
        "created_at",
        "id",
        "name",
        "picture_url",
        "position",
      ].sort(),
    );
    expect(sent).toEqual({ ...row, created_at: "2022-03-01T10:00:00.000Z" });
    expect(sent).not.toHaveProperty("email");
  });

  it("PROF-31: an unknown id is 404", async () => {
    const { error } = await call(
      "GET /players/:id",
      { uid: "u1" },
      { params: { id: "404" } },
    );
    expect(error).toMatchObject({ status: 404, message: "Player not found" });
  });

  it("API-05: a non-integer id is 400", async () => {
    const { error } = await call(
      "GET /players/:id",
      { uid: "u1" },
      { params: { id: "abc" } },
    );
    expect(error).toMatchObject({
      status: 400,
      message: "id must be an integer",
    });
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it("PROF-31: profiles and the city list sit behind the auth middleware", () => {
    expect(AUTHENTICATED_PATHS).toEqual(
      expect.arrayContaining(["/players", "/cities", "/user"]),
    );
  });
});

describe("GET /cities", () => {
  it("PROF-24: returns the fixed city list", async () => {
    const { sent } = await call("GET /cities", { uid: "u1" });
    expect(sent).toEqual(expect.arrayContaining(["Sofia", "Varna"]));
  });
});

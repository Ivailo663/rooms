import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application, RequestHandler } from "express";

const { prisma, files, fileDelete } = vi.hoisted(() => ({
  prisma: {
    account: { findUnique: vi.fn() },
    media: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  // path -> content type of the files "in the bucket"
  files: new Map<string, string>(),
  fileDelete: vi.fn(),
}));

vi.mock("../prisma.js", () => ({ default: prisma }));
vi.mock("../firebase.js", () => ({
  default: {
    storage: () => ({
      bucket: () => ({
        file: (path: string) => ({
          exists: async () => [files.has(path)],
          getMetadata: async () => [{ contentType: files.get(path) }],
          delete: (options: unknown) => fileDelete(path, options),
        }),
      }),
    }),
  },
}));

import { registerMediaRoutes } from "./media.js";
import { AUTHENTICATED_PATHS } from "../middleware/verifyFirebaseToken.js";

const handlers = new Map<string, RequestHandler>();
const app = {
  get: (path: string, h: RequestHandler) => handlers.set(`GET ${path}`, h),
  post: (path: string, h: RequestHandler) => handlers.set(`POST ${path}`, h),
  delete: (path: string, h: RequestHandler) =>
    handlers.set(`DELETE ${path}`, h),
} as unknown as Application;
registerMediaRoutes(app);

const OWNER = { uid: "u1" };
const CREATED = new Date("2026-11-15T10:00:00Z");

const call = async (route: string, req: Record<string, unknown> = {}) => {
  const send = vi.fn();
  const end = vi.fn();
  const status = vi.fn();
  const next = vi.fn();
  const res = { locals: { user: OWNER }, send, end, status };
  status.mockReturnValue(res);
  await handlers.get(route)!(
    { params: {}, body: {}, ...req } as never,
    res as never,
    next,
  );
  return {
    sent: send.mock.calls[0]?.[0],
    status: status.mock.calls[0]?.[0],
    error: next.mock.calls[0]?.[0],
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  files.clear();
  prisma.account.findUnique.mockResolvedValue({
    id: 7,
    name: "A",
    role: "player",
  });
  prisma.media.create.mockImplementation(({ data }) =>
    Promise.resolve({
      id: 1,
      kind: data.kind,
      path: data.path,
      poster_path: data.poster_path,
      created_at: CREATED,
    }),
  );
  prisma.media.deleteMany.mockResolvedValue({ count: 1 });
  fileDelete.mockResolvedValue([]);
});

describe("POST /media", () => {
  it("PROF-63: /media is behind sign-in", () => {
    expect(AUTHENTICATED_PATHS).toContain("/media");
  });

  it("PROF-67: adds a file that is in the caller's own folder", async () => {
    files.set("players/u1/a.jpg", "image/jpeg");

    const { sent, error } = await call("POST /media", {
      body: { kind: "photo", path: "players/u1/a.jpg" },
    });

    expect(error).toBeUndefined();
    expect(sent).toEqual({
      id: 1,
      kind: "photo",
      path: "players/u1/a.jpg",
      poster_path: null,
      created_at: CREATED.toISOString(),
    });
    expect(prisma.media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          accountId: 7,
          kind: "photo",
          path: "players/u1/a.jpg",
          poster_path: null,
        },
      }),
    );
  });

  it("PROF-67: a video with a poster frame stores both paths", async () => {
    files.set("players/u1/v.mp4", "video/mp4");
    files.set("players/u1/v.jpg", "image/jpeg");

    const { sent } = await call("POST /media", {
      body: {
        kind: "video",
        path: "players/u1/v.mp4",
        posterPath: "players/u1/v.jpg",
      },
    });

    expect(sent).toMatchObject({
      kind: "video",
      poster_path: "players/u1/v.jpg",
    });
  });

  it("PROF-72: a photo with its small grid copy stores both paths", async () => {
    files.set("players/u1/a.jpg", "image/jpeg");
    files.set("players/u1/a_400.jpg", "image/jpeg");

    const { sent, error } = await call("POST /media", {
      body: {
        kind: "photo",
        path: "players/u1/a.jpg",
        posterPath: "players/u1/a_400.jpg",
      },
    });

    expect(error).toBeUndefined();
    expect(sent).toMatchObject({
      kind: "photo",
      path: "players/u1/a.jpg",
      poster_path: "players/u1/a_400.jpg",
    });
  });

  it("PROF-62: a photo's small copy in someone else's folder is 403", async () => {
    files.set("players/u1/a.jpg", "image/jpeg");
    files.set("players/u2/a_400.jpg", "image/jpeg");

    const { error } = await call("POST /media", {
      body: {
        kind: "photo",
        path: "players/u1/a.jpg",
        posterPath: "players/u2/a_400.jpg",
      },
    });

    expect(error.status).toBe(403);
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it("PROF-67: a photo's missing small copy is 400 'Upload the file first'", async () => {
    files.set("players/u1/a.jpg", "image/jpeg");

    const { error } = await call("POST /media", {
      body: {
        kind: "photo",
        path: "players/u1/a.jpg",
        posterPath: "players/u1/a_400.jpg",
      },
    });

    expect(error.status).toBe(400);
    expect(error.message).toBe("Upload the file first");
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it.each(["photo", "video"])(
    "PROF-60: a %s whose small picture isn't an image is 400",
    async (kind) => {
      files.set("players/u1/f", kind === "photo" ? "image/jpeg" : "video/mp4");
      files.set("players/u1/small", "video/mp4");

      const { error } = await call("POST /media", {
        body: { kind, path: "players/u1/f", posterPath: "players/u1/small" },
      });

      expect(error.status).toBe(400);
      expect(error.message).toBe(
        "The small picture must be JPEG, PNG, WebP or HEIC",
      );
      expect(prisma.media.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["another player's folder", "players/u2/a.jpg"],
    ["a uid that only starts the same", "players/u10/a.jpg"],
    ["outside players/", "other/u1/a.jpg"],
    ["the bare folder", "players/u1/"],
  ])("PROF-62: a path in %s is 403 and nothing is added", async (_, path) => {
    files.set(path, "image/jpeg");

    const { error } = await call("POST /media", {
      body: { kind: "photo", path },
    });

    expect(error.status).toBe(403);
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it("PROF-62: a poster in someone else's folder is 403", async () => {
    files.set("players/u1/v.mp4", "video/mp4");
    files.set("players/u2/v.jpg", "image/jpeg");

    const { error } = await call("POST /media", {
      body: {
        kind: "video",
        path: "players/u1/v.mp4",
        posterPath: "players/u2/v.jpg",
      },
    });

    expect(error.status).toBe(403);
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it("PROF-67: a file that isn't in storage is 400 'Upload the file first'", async () => {
    const { error } = await call("POST /media", {
      body: { kind: "photo", path: "players/u1/missing.jpg" },
    });

    expect(error.status).toBe(400);
    expect(error.message).toBe("Upload the file first");
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it("PROF-67: a missing poster is 400 'Upload the file first'", async () => {
    files.set("players/u1/v.mp4", "video/mp4");

    const { error } = await call("POST /media", {
      body: {
        kind: "video",
        path: "players/u1/v.mp4",
        posterPath: "players/u1/v.jpg",
      },
    });

    expect(error.message).toBe("Upload the file first");
  });

  it.each([
    ["photo", "video/mp4", "A photo must be JPEG, PNG, WebP or HEIC"],
    ["photo", "image/gif", "A photo must be JPEG, PNG, WebP or HEIC"],
    ["video", "image/png", "A video must be MP4 or MOV"],
    ["video", "video/webm", "A video must be MP4 or MOV"],
  ])(
    "PROF-60: kind %s with a %s file is refused with why",
    async (kind, type, message) => {
      files.set("players/u1/f", type);

      const { error } = await call("POST /media", {
        body: { kind, path: "players/u1/f" },
      });

      expect(error.status).toBe(400);
      expect(error.message).toBe(message);
      expect(prisma.media.create).not.toHaveBeenCalled();
    },
  );

  it.each(["image/jpeg", "image/png", "image/webp", "image/heic"])(
    "PROF-60: a %s photo is accepted",
    async (type) => {
      files.set("players/u1/f", type);
      const { error } = await call("POST /media", {
        body: { kind: "photo", path: "players/u1/f" },
      });
      expect(error).toBeUndefined();
    },
  );

  it.each(["video/mp4", "video/quicktime"])(
    "PROF-60: a %s video is accepted",
    async (type) => {
      files.set("players/u1/f", type);
      const { error } = await call("POST /media", {
        body: { kind: "video", path: "players/u1/f" },
      });
      expect(error).toBeUndefined();
    },
  );

  it.each([
    [{ kind: "gif", path: "players/u1/a.jpg" }],
    [{ kind: "photo" }],
    [{ kind: "photo", path: 5 }],
    [{ kind: "photo", path: "players/u1/a.jpg", posterPath: 5 }],
    [
      {
        kind: "photo",
        path: "players/u1/a.jpg",
        posterPath: "players/u1/a.jpg",
      },
    ],
  ])("PROF-60: a malformed body is 400 (%o)", async (body) => {
    files.set("players/u1/a.jpg", "image/jpeg");
    files.set("players/u1/b.jpg", "image/jpeg");

    const { error } = await call("POST /media", { body });

    expect(error.status).toBe(400);
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it("PROF-67: the same file added twice is 409, not a second grid entry", async () => {
    files.set("players/u1/a.jpg", "image/jpeg");
    prisma.media.create.mockRejectedValue(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );

    const { error } = await call("POST /media", {
      body: { kind: "photo", path: "players/u1/a.jpg" },
    });

    expect(error.status).toBe(409);
  });
});

describe("GET /players/:id/media", () => {
  it("PROF-72: lists one player's media newest first", async () => {
    prisma.media.findMany.mockResolvedValue([
      {
        id: 2,
        kind: "video",
        path: "players/u1/v.mp4",
        poster_path: "players/u1/v.jpg",
        created_at: CREATED,
      },
    ]);

    const { sent } = await call("GET /players/:id/media", {
      params: { id: "7" },
    });

    expect(prisma.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId: 7 },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
      }),
    );
    expect(sent).toEqual([
      {
        id: 2,
        kind: "video",
        path: "players/u1/v.mp4",
        poster_path: "players/u1/v.jpg",
        created_at: CREATED.toISOString(),
      },
    ]);
  });

  it("PROF-63: /players (and so its media) is behind sign-in", () => {
    expect(AUTHENTICATED_PATHS).toContain("/players");
  });

  it("PROF-72: a non-numeric id is 400", async () => {
    const { error } = await call("GET /players/:id/media", {
      params: { id: "x" },
    });
    expect(error.status).toBe(400);
  });
});

describe("DELETE /media/:id", () => {
  it("PROF-64: the owner's delete removes the file, the poster and the row", async () => {
    prisma.media.findUnique.mockResolvedValue({
      accountId: 7,
      path: "players/u1/v.mp4",
      poster_path: "players/u1/v.jpg",
    });

    const { status, error } = await call("DELETE /media/:id", {
      params: { id: "3" },
    });

    expect(error).toBeUndefined();
    expect(status).toBe(204);
    expect(fileDelete).toHaveBeenCalledWith("players/u1/v.mp4", {
      ignoreNotFound: true,
    });
    expect(fileDelete).toHaveBeenCalledWith("players/u1/v.jpg", {
      ignoreNotFound: true,
    });
    expect(prisma.media.deleteMany).toHaveBeenCalledWith({ where: { id: 3 } });
  });

  it("PROF-64: deleting a photo removes the original and its small copy", async () => {
    prisma.media.findUnique.mockResolvedValue({
      accountId: 7,
      path: "players/u1/a.jpg",
      poster_path: "players/u1/a_400.jpg",
    });

    const { status } = await call("DELETE /media/:id", { params: { id: "4" } });

    expect(status).toBe(204);
    expect(fileDelete.mock.calls.map(([p]) => p).sort()).toEqual([
      "players/u1/a.jpg",
      "players/u1/a_400.jpg",
    ]);
  });

  it("PROF-62: someone else's item is 403 and nothing changes", async () => {
    prisma.media.findUnique.mockResolvedValue({
      accountId: 8,
      path: "players/u2/a.jpg",
      poster_path: null,
    });

    const { error } = await call("DELETE /media/:id", { params: { id: "3" } });

    expect(error.status).toBe(403);
    expect(fileDelete).not.toHaveBeenCalled();
    expect(prisma.media.deleteMany).not.toHaveBeenCalled();
  });

  it("PROF-64: a missing item is 404", async () => {
    prisma.media.findUnique.mockResolvedValue(null);

    const { error } = await call("DELETE /media/:id", { params: { id: "3" } });

    expect(error.status).toBe(404);
    expect(fileDelete).not.toHaveBeenCalled();
  });

  it("PROF-64: if the file can't be deleted, the row stays so the delete can be retried", async () => {
    prisma.media.findUnique.mockResolvedValue({
      accountId: 7,
      path: "players/u1/a.jpg",
      poster_path: null,
    });
    fileDelete.mockRejectedValue(new Error("storage down"));

    const { error } = await call("DELETE /media/:id", { params: { id: "3" } });

    expect(error).toBeDefined();
    expect(prisma.media.deleteMany).not.toHaveBeenCalled();
  });
});

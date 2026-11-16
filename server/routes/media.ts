import type { Application, RequestHandler } from "express";
import type { Media, MediaKind } from "@prisma/client";
import prisma from "../prisma.js";
import admin from "../firebase.js";
import { getCurrentAccount } from "../currentAccount.js";
import { asyncHandler, createHttpError } from "../utils/http.js";
import { toInteger } from "../utils/validation.js";
import type { AuthenticatedLocals } from "../types/auth.js";
import type { MediaItem } from "../../packages/shared/index.js";

// PROF-60. storage.rules already refuses other types at upload; this is the
// server's own check that the declared kind matches what was actually stored.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const KIND_TYPES: Record<MediaKind, { types: string[]; refusal: string }> = {
  photo: {
    types: PHOTO_TYPES,
    refusal: "A photo must be JPEG, PNG, WebP or HEIC",
  },
  video: { types: VIDEO_TYPES, refusal: "A video must be MP4 or MOV" },
};

const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "P2002";

const toMediaItem = (
  media: Pick<Media, "id" | "kind" | "path" | "poster_path" | "created_at">,
): MediaItem => ({
  id: media.id,
  kind: media.kind,
  path: media.path,
  poster_path: media.poster_path,
  created_at: media.created_at.toISOString(),
});

const MEDIA_SELECT = {
  id: true,
  kind: true,
  path: true,
  poster_path: true,
  created_at: true,
} as const;

const parseOptionalPath = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || !value) {
    throw createHttpError(400, `${field} must be a file path`);
  }
  return value;
};

// PROF-62/67: the folder is the caller's uid, so the prefix check is the whole
// ownership proof; storage.rules guarantee nobody else could have written there.
const assertOwnFolder = (path: string, uid: string): void => {
  const folder = `players/${uid}/`;
  if (!path.startsWith(folder) || path.length === folder.length) {
    throw createHttpError(403, "You can only add files from your own folder");
  }
};

const assertStored = async (
  path: string,
  allowed: string[],
  refusal: string,
) => {
  const file = admin.storage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) {
    throw createHttpError(400, "Upload the file first");
  }

  const [metadata] = await file.getMetadata();
  if (!allowed.includes(metadata.contentType ?? "")) {
    throw createHttpError(400, refusal);
  }
};

// PROF-72, PROF-63: any signed-in user. Newest first, served by the
// (account_id, created_at) index.
const listMedia: RequestHandler = asyncHandler(async (req, res) => {
  const accountId = toInteger(req.params.id, "id");

  const media = await prisma.media.findMany({
    where: { accountId },
    select: MEDIA_SELECT,
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });

  res.send(media.map(toMediaItem));
});

// PROF-60, PROF-62, PROF-67.
const createMedia: RequestHandler = asyncHandler(async (req, res) => {
  const { uid } = (res.locals as AuthenticatedLocals).user;
  const account = await getCurrentAccount(uid);

  const kind = req.body?.kind as unknown;
  if (kind !== "photo" && kind !== "video") {
    throw createHttpError(400, "kind must be photo or video");
  }
  const path = parseOptionalPath(req.body?.path, "path");
  if (!path) {
    throw createHttpError(400, "path must be a file path");
  }
  // PROF-60/72: poster_path is the small picture the grid loads, for a photo
  // (its 400 px copy) and a video (a still frame) alike. Optional, since older
  // rows and clients have none. It must be its own file, or deleting the item
  // would try to remove the same object twice and the grid would load the
  // full-size original.
  const posterPath = parseOptionalPath(req.body?.posterPath, "posterPath");
  if (posterPath === path) {
    throw createHttpError(400, "posterPath must be a different file");
  }

  assertOwnFolder(path, uid);
  if (posterPath) {
    assertOwnFolder(posterPath, uid);
  }

  await assertStored(path, KIND_TYPES[kind].types, KIND_TYPES[kind].refusal);
  if (posterPath) {
    await assertStored(
      posterPath,
      PHOTO_TYPES,
      "The small picture must be JPEG, PNG, WebP or HEIC",
    );
  }

  try {
    const media = await prisma.media.create({
      data: { accountId: account.id, kind, path, poster_path: posterPath },
      select: MEDIA_SELECT,
    });
    res.send(toMediaItem(media));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createHttpError(409, "This file is already on your profile");
    }
    throw error;
  }
});

// PROF-62, PROF-64. Files go first, then the row: a failure in between leaves
// a grid entry the owner can delete again (missing files are ignored), never
// an orphaned file with no row pointing at it.
const deleteMedia: RequestHandler = asyncHandler(async (req, res) => {
  const { uid } = (res.locals as AuthenticatedLocals).user;
  const account = await getCurrentAccount(uid);
  const id = toInteger(req.params.id, "id");

  const media = await prisma.media.findUnique({
    where: { id },
    select: { accountId: true, path: true, poster_path: true },
  });
  if (!media) {
    throw createHttpError(404, "Media not found");
  }
  if (media.accountId !== account.id) {
    throw createHttpError(403, "You can only delete your own media");
  }

  const bucket = admin.storage().bucket();
  const paths = [media.path, media.poster_path].filter((p): p is string => !!p);
  await Promise.all(
    paths.map((p) => bucket.file(p).delete({ ignoreNotFound: true })),
  );

  // deleteMany so a parallel DELETE of the same item is a no-op, not a P2025.
  await prisma.media.deleteMany({ where: { id } });
  res.status(204).end();
});

export const registerMediaRoutes = (app: Application): void => {
  app.get("/players/:id/media", listMedia);
  app.post("/media", createMedia);
  app.delete("/media/:id", deleteMedia);
};

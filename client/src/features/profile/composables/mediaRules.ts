import { isAxiosError } from "axios";
import type { MediaKind } from "@football/shared";

// PROF-60: the photo types a player can pick. Whatever they pick is
// re-encoded as JPEG before upload (shrinkPhoto.ts).
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

// Browsers outside Apple's often report an iPhone's HEIC file with no type at
// all, or as image/heif, so the name decides there.
const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

// PROF-60: clips go up as they are, so their type is what storage.rules and
// the server check. A browser that doesn't know a .mov (Chrome on Windows
// gives no type) is answered by the name.
const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
};

// PROF-60: 60 seconds once the native app compresses clips; until then a
// clip is uploaded at full camera quality, so it's kept short.
export const MAX_CLIP_SECONDS = 30;

// For the file picker; the extensions let a HEIC or MOV file be picked where
// the browser doesn't know its type.
export const MEDIA_ACCEPT = [
  ...PHOTO_TYPES,
  ".heic",
  ".heif",
  ...Object.values(VIDEO_TYPES),
  ".mp4",
  ".mov",
].join(",");

const extensionOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

// PROF-60: whether a picked file is a photo the app takes.
export const isPhoto = (file: Pick<File, "name" | "type">): boolean => {
  if (PHOTO_TYPES.includes(file.type)) return true;
  if (file.type && file.type !== "image/heif") return false;
  return PHOTO_EXTENSIONS.includes(extensionOf(file.name));
};

// PROF-60: the content type a clip is stored with, or null when it isn't an
// MP4 or MOV.
export const clipType = (file: Pick<File, "name" | "type">): string | null => {
  const types = Object.values(VIDEO_TYPES);
  if (types.includes(file.type)) return file.type;
  if (file.type) return null;
  return VIDEO_TYPES[extensionOf(file.name)] ?? null;
};

// PROF-60: phones show a clip's length rounded to the second, so one the
// phone calls 0:30 is taken even if it runs a few frames over.
export const isTooLong = (seconds: number): boolean =>
  Math.round(seconds) > MAX_CLIP_SECONDS;

// PROF-60: the reason a file is refused, said before anything is uploaded.
export const mediaRefusal = (file: Pick<File, "name">): string =>
  `"${file.name}" isn't a file the app takes. Use a JPEG, PNG, WebP or HEIC photo, or an MP4 or MOV clip.`;

export const clipTooLong = (file: Pick<File, "name">): string =>
  `"${file.name}" is longer than ${MAX_CLIP_SECONDS} seconds. Trim it and try again.`;

// PROF-60: a file of an accepted type that this browser can't decode (HEIC
// outside Safari, a MOV codec it lacks) is refused rather than sent as it is.
export const unreadablePhoto = (file: Pick<File, "name">): string =>
  `"${file.name}" can't be opened on this device. Try a JPEG or PNG.`;

export const unreadableClip = (file: Pick<File, "name">): string =>
  `"${file.name}" can't be played on this device. Try an MP4.`;

// PROF-67/72: always the caller's own folder; a random name, so two uploads
// never collide and nobody can guess the next one. The small picture (a
// photo's 400px copy or a clip's still frame) sits next to the full file,
// which keeps a clip's own extension.
export const mediaPaths = (
  uid: string,
  id: string,
  contentType = "image/jpeg"
) => {
  const extension =
    Object.entries(VIDEO_TYPES).find(([, type]) => type === contentType)?.[0] ??
    "jpg";
  return {
    path: `players/${uid}/${id}.${extension}`,
    posterPath: `players/${uid}/${id}-small.jpg`,
  };
};

export const mediaNoun = (kind: MediaKind) =>
  kind === "video" ? "clip" : "photo";

// The server answers with its reason as plain text (PROF-60/67); storage and
// network failures have nothing a player can act on beyond trying again.
export const uploadErrorMessage = (error: unknown): string => {
  if (isAxiosError(error) && typeof error.response?.data === "string") {
    return error.response.data;
  }
  return "Upload failed. Try again.";
};

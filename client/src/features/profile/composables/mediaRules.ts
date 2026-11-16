import { isAxiosError } from "axios";

// PROF-60: the photo types a player can pick. Whatever they pick is
// re-encoded as JPEG before upload (shrinkPhoto.ts).
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

// Browsers outside Apple's often report an iPhone's HEIC file with no type at
// all, or as image/heif, so the name decides there.
const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

// For the file picker; the extensions let a HEIC file be picked where the
// browser doesn't know its type.
export const PHOTO_ACCEPT = [...PHOTO_TYPES, ".heic", ".heif"].join(",");

const extensionOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

// PROF-60: whether a picked file is a photo the app takes.
export const isPhoto = (file: Pick<File, "name" | "type">): boolean => {
  if (PHOTO_TYPES.includes(file.type)) return true;
  if (file.type && file.type !== "image/heif") return false;
  return PHOTO_EXTENSIONS.includes(extensionOf(file.name));
};

// PROF-60: the reason a file is refused, said before anything is uploaded.
export const photoRefusal = (file: Pick<File, "name" | "type">): string =>
  file.type.startsWith("video/")
    ? "Clips are coming soon. For now, pick a photo."
    : `"${file.name}" isn't a photo the app takes. Use JPEG, PNG, WebP or HEIC.`;

// PROF-60: a photo of an accepted type that this browser can't decode (HEIC
// outside Safari) is refused rather than sent as it is.
export const unreadablePhoto = (file: Pick<File, "name">): string =>
  `"${file.name}" can't be opened on this device. Try a JPEG or PNG.`;

// PROF-67/72: always the caller's own folder; a random name, so two uploads
// never collide and nobody can guess the next one. The small copy sits next
// to the full one.
export const mediaPaths = (uid: string, id: string) => ({
  path: `players/${uid}/${id}.jpg`,
  posterPath: `players/${uid}/${id}-small.jpg`,
});

// The server answers with its reason as plain text (PROF-60/67); storage and
// network failures have nothing a player can act on beyond trying again.
export const uploadErrorMessage = (error: unknown): string => {
  if (isAxiosError(error) && typeof error.response?.data === "string") {
    return error.response.data;
  }
  return "Upload failed. Try again.";
};

import { onScopeDispose, ref, toValue, type MaybeRefOrGetter } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import type { MediaKind } from "@football/shared";
import { auth } from "@/firebase";
import { createMedia } from "../api";
import { uploadFile } from "../api/storage";
import {
  clipTooBig,
  clipTooLong,
  isTooBig,
  clipType,
  isPhoto,
  isTooLong,
  mediaPaths,
  mediaRefusal,
  unreadableClip,
  unreadablePhoto,
  uploadErrorMessage,
} from "./mediaRules";
import { shrinkPhoto } from "./shrinkPhoto";
import { openClip } from "./readClip";

export interface PendingUpload {
  key: string;
  kind: MediaKind;
  // Null while the file is being prepared; then the small picture, so a HEIC
  // previews in any browser that could decode it.
  previewUrl: string | null;
  progress: number;
  error: string | null;
}

// What goes to storage for one picked file: the file itself (a photo
// re-encoded, a clip as it is) and the small picture the grid loads.
type Prepared = { file: Blob; contentType: string; small: Blob };

// PROF-60: a photo is shrunk; a clip is checked for length and gets a still.
// A string is the reason it's refused.
const preparePhoto = async (file: File): Promise<Prepared | string> => {
  const shrunk = await shrinkPhoto(file);
  if (!shrunk) return unreadablePhoto(file);
  return { file: shrunk.full, contentType: "image/jpeg", small: shrunk.small };
};

const prepareClip = async (
  file: File,
  contentType: string
): Promise<Prepared | string> => {
  if (isTooBig(file)) return clipTooBig(file);
  const clip = await openClip(file);
  if (!clip) return unreadableClip(file);
  try {
    if (isTooLong(clip.duration)) return clipTooLong(file);
    const poster = await clip.poster();
    if (!poster) return unreadableClip(file);
    return { file, contentType, small: poster };
  } finally {
    clip.close();
  }
};

// PROF-60/67: photos and clips picked on the player's own page. Each one
// shows in the grid from the moment it's picked (local preview, progress,
// then the error if any) and leaves only once the refreshed grid holds the
// real item, so nothing blinks out in between. An upload isn't cancelled when
// the page is left: the player picked it, so it still lands on their profile.
export const useMediaUploads = (playerId: MaybeRefOrGetter<number>) => {
  const queryClient = useQueryClient();
  const uploads = ref<PendingUpload[]>([]);
  const refusal = ref<string | null>(null);

  const find = (key: string) => uploads.value.find((u) => u.key === key);

  const dismiss = (key: string) => {
    const index = uploads.value.findIndex((u) => u.key === key);
    if (index < 0) return;
    const { previewUrl } = uploads.value[index]!;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    uploads.value.splice(index, 1);
  };

  const upload = async (
    kind: MediaKind,
    prepare: () => Promise<Prepared | string>
  ) => {
    const key = crypto.randomUUID();
    uploads.value.unshift({
      key,
      kind,
      previewUrl: null,
      progress: 0,
      error: null,
    });

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not signed in");

      const prepared = await prepare();
      if (typeof prepared === "string") {
        dismiss(key);
        refusal.value = prepared;
        return;
      }
      const pending = find(key);
      if (pending) pending.previewUrl = URL.createObjectURL(prepared.small);

      // One bar for both files, weighted by size: the small picture is a few
      // percent of the whole.
      const { file, small, contentType } = prepared;
      const sent = { file: 0, small: 0 };
      const report = (part: keyof typeof sent) => (fraction: number) => {
        sent[part] = fraction;
        const pending = find(key);
        if (pending) {
          pending.progress =
            (sent.file * file.size + sent.small * small.size) /
            (file.size + small.size || 1);
        }
      };

      const { path, posterPath } = mediaPaths(uid, key, contentType);
      await Promise.all([
        uploadFile(path, file, contentType, report("file")),
        uploadFile(posterPath, small, "image/jpeg", report("small")),
      ]);
      await createMedia({ kind, path, posterPath });
      await queryClient.invalidateQueries({
        queryKey: ["players", toValue(playerId), "media"],
      });
      dismiss(key);
    } catch (error) {
      const pending = find(key);
      if (pending) pending.error = uploadErrorMessage(error);
    }
  };

  // A refused file is named in one message and nothing of it is sent; the
  // other files in the same pick still go.
  const add = (files: Iterable<File>) => {
    refusal.value = null;
    for (const file of files) {
      const videoType = clipType(file);
      if (videoType) void upload("video", () => prepareClip(file, videoType));
      else if (isPhoto(file)) void upload("photo", () => preparePhoto(file));
      else refusal.value = mediaRefusal(file);
    }
  };

  onScopeDispose(() =>
    uploads.value.forEach(
      ({ previewUrl }) => previewUrl && URL.revokeObjectURL(previewUrl)
    )
  );

  return { uploads, refusal, add, dismiss };
};

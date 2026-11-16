import { onScopeDispose, ref, toValue, type MaybeRefOrGetter } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { auth } from "@/firebase";
import { createMedia } from "../api";
import { uploadFile } from "../api/storage";
import {
  isPhoto,
  mediaPaths,
  photoRefusal,
  unreadablePhoto,
  uploadErrorMessage,
} from "./mediaRules";
import { shrinkPhoto } from "./shrinkPhoto";

export interface PendingUpload {
  key: string;
  // Null while the photo is being shrunk; then the small copy, so a HEIC
  // previews in any browser that could decode it.
  previewUrl: string | null;
  progress: number;
  error: string | null;
}

// PROF-60/67: photos picked on the player's own page. Each one shows in the
// grid from the moment it's picked (local preview, progress, then the error if
// any) and leaves only once the refreshed grid holds the real item, so nothing
// blinks out in between. An upload isn't cancelled when the page is left: the
// player picked it, so it still lands on their profile.
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

  const upload = async (file: File) => {
    const key = crypto.randomUUID();
    uploads.value.unshift({ key, previewUrl: null, progress: 0, error: null });

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not signed in");

      const shrunk = await shrinkPhoto(file);
      if (!shrunk) {
        dismiss(key);
        refusal.value = unreadablePhoto(file);
        return;
      }
      const pending = find(key);
      if (pending) pending.previewUrl = URL.createObjectURL(shrunk.small);

      // One bar for both files, weighted by size: the small copy is a few
      // percent of the whole.
      const { full, small } = shrunk;
      const sent = { full: 0, small: 0 };
      const report = (part: keyof typeof sent) => (fraction: number) => {
        sent[part] = fraction;
        const pending = find(key);
        if (pending) {
          pending.progress =
            (sent.full * full.size + sent.small * small.size) /
            (full.size + small.size || 1);
        }
      };

      const { path, posterPath } = mediaPaths(uid, key);
      await Promise.all([
        uploadFile(path, full, "image/jpeg", report("full")),
        uploadFile(posterPath, small, "image/jpeg", report("small")),
      ]);
      await createMedia({ kind: "photo", path, posterPath });
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
      if (isPhoto(file)) void upload(file);
      else refusal.value = photoRefusal(file);
    }
  };

  onScopeDispose(() =>
    uploads.value.forEach(
      ({ previewUrl }) => previewUrl && URL.revokeObjectURL(previewUrl)
    )
  );

  return { uploads, refusal, add, dismiss };
};

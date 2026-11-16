import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "@/firebase";

// PROF-67: straight to storage, never through our server. Progress is a
// fraction from 0 to 1.
export const uploadFile = (
  path: string,
  file: Blob,
  contentType: string,
  onProgress: (fraction: number) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef(storage, path), file, {
      contentType,
    });
    task.on(
      "state_changed",
      ({ bytesTransferred, totalBytes }) =>
        onProgress(totalBytes ? bytesTransferred / totalBytes : 0),
      reject,
      () => resolve()
    );
  });

// PROF-63: an unguessable download URL for a stored path.
export const getMediaUrl = (path: string): Promise<string> =>
  getDownloadURL(storageRef(storage, path));

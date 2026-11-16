import { smallJpeg } from "./shrinkPhoto";

// PROF-72: the still frame is taken just in, as a phone clip's very first
// frame is sometimes black; any later and the viewer would jump from the
// still to the clip's real start (PROF-73 shows the still until it plays).
const FRAME_AT = 0.1;

// A file the browser can't handle sometimes never answers rather than
// failing, so a wait has an end.
const GIVE_UP_MS = 15_000;

export interface OpenedClip {
  duration: number;
  // The 400px JPEG still for the grid, or null when no frame could be drawn.
  poster: () => Promise<Blob | null>;
  close: () => void;
}

const settles = (video: HTMLVideoElement, event: string) =>
  new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => () => {
      clearTimeout(timer);
      video.removeEventListener(event, succeed);
      video.removeEventListener("error", fail);
      resolve(ok);
    };
    const succeed = done(true);
    const fail = done(false);
    const timer = setTimeout(fail, GIVE_UP_MS);
    video.addEventListener(event, succeed);
    video.addEventListener("error", fail);
  });

// PROF-60: a picked clip, read on the phone through a <video> that never
// joins the page. Its length decides whether it's taken (the server doesn't
// know it), and the still is drawn only for a clip that is. Null means this
// browser can't read the file at all.
export const openClip = async (file: Blob): Promise<OpenedClip | null> => {
  const url = URL.createObjectURL(file);
  const close = () => URL.revokeObjectURL(url);

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const metadata = settles(video, "loadedmetadata");
  video.src = url;

  if (
    !(await metadata) ||
    !Number.isFinite(video.duration) ||
    !video.videoWidth
  ) {
    close();
    return null;
  }

  const poster = async () => {
    const seeked = settles(video, "seeked");
    video.currentTime = Math.min(FRAME_AT, video.duration / 2);
    if (!(await seeked)) return null;
    try {
      return await smallJpeg(video, video.videoWidth, video.videoHeight);
    } catch {
      return null;
    }
  };

  return { duration: video.duration, poster, close };
};

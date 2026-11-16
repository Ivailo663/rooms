import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import {
  MEDIA_ACCEPT,
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

const file = (name: string, type: string) => ({ name, type });

describe("media rules", () => {
  it("PROF-60: JPEG, PNG, WebP and HEIC photos are taken", () => {
    expect(isPhoto(file("a.jpg", "image/jpeg"))).toBe(true);
    expect(isPhoto(file("a.png", "image/png"))).toBe(true);
    expect(isPhoto(file("a.webp", "image/webp"))).toBe(true);
    expect(isPhoto(file("a.heic", "image/heic"))).toBe(true);
  });

  it("PROF-60: a HEIC file the browser gives no type, or calls HEIF, is still taken", () => {
    expect(isPhoto(file("IMG_1.HEIC", ""))).toBe(true);
    expect(isPhoto(file("IMG_1.heif", "image/heif"))).toBe(true);
  });

  it("PROF-60: any other type is refused, whatever its name says", () => {
    expect(isPhoto(file("a.gif", "image/gif"))).toBe(false);
    expect(isPhoto(file("a.jpg", "application/pdf"))).toBe(false);
    expect(isPhoto(file("notes", ""))).toBe(false);
    expect(isPhoto(file("clip.mp4", "video/mp4"))).toBe(false);
  });

  it("PROF-60: MP4 and MOV clips are taken, stored with their own type", () => {
    expect(clipType(file("a.mp4", "video/mp4"))).toBe("video/mp4");
    expect(clipType(file("IMG_1.MOV", "video/quicktime"))).toBe(
      "video/quicktime"
    );
  });

  it("PROF-60: a clip the browser gives no type is known by its name", () => {
    expect(clipType(file("IMG_1.MOV", ""))).toBe("video/quicktime");
    expect(clipType(file("clip.mp4", ""))).toBe("video/mp4");
  });

  it("PROF-60: other video types aren't clips the app takes", () => {
    expect(clipType(file("a.webm", "video/webm"))).toBeNull();
    expect(clipType(file("a.mov", "video/x-matroska"))).toBeNull();
    expect(clipType(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(clipType(file("notes", ""))).toBeNull();
  });

  it("PROF-60: a clip runs up to 30 seconds, as the phone rounds it", () => {
    expect(isTooLong(12)).toBe(false);
    expect(isTooLong(30)).toBe(false);
    expect(isTooLong(30.4)).toBe(false);
    expect(isTooLong(30.6)).toBe(true);
    expect(isTooLong(61)).toBe(true);
  });

  it("PROF-60: a clip is at most 100 MB", () => {
    const mb = 1024 * 1024;
    expect(isTooBig({ size: 100 * mb })).toBe(false);
    expect(isTooBig({ size: 100 * mb + 1 })).toBe(true);
    expect(clipTooBig({ name: "match.mov" })).toBe(
      '"match.mov" is bigger than 100 MB. Record at a lower quality (1080p) and try again.'
    );
  });

  it("PROF-60: a refusal says why", () => {
    expect(mediaRefusal({ name: "a.gif" })).toBe(
      '"a.gif" isn\'t a file the app takes. Use a JPEG, PNG, WebP or HEIC photo, or an MP4 or MOV clip.'
    );
    expect(clipTooLong({ name: "match.mov" })).toBe(
      '"match.mov" is longer than 30 seconds. Trim it and try again.'
    );
    expect(unreadablePhoto({ name: "IMG_1.heic" })).toBe(
      '"IMG_1.heic" can\'t be opened on this device. Try a JPEG or PNG.'
    );
    expect(unreadableClip({ name: "IMG_2.mov" })).toBe(
      '"IMG_2.mov" can\'t be played on this device. Try an MP4.'
    );
  });

  it("PROF-60: the picker offers the photo and clip types, plus HEIC and MOV by name", () => {
    expect(MEDIA_ACCEPT.split(",")).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      ".heic",
      ".heif",
      "video/mp4",
      "video/quicktime",
      ".mp4",
      ".mov",
    ]);
  });

  it("PROF-67/72: both JPEGs go into the player's own folder, the small one beside the full one", () => {
    expect(mediaPaths("fb-uid", "abc")).toEqual({
      path: "players/fb-uid/abc.jpg",
      posterPath: "players/fb-uid/abc-small.jpg",
    });
  });

  it("PROF-67/72: a clip keeps its own extension, with its still beside it", () => {
    expect(mediaPaths("fb-uid", "abc", "video/quicktime")).toEqual({
      path: "players/fb-uid/abc.mov",
      posterPath: "players/fb-uid/abc-small.jpg",
    });
    expect(mediaPaths("fb-uid", "abc", "video/mp4").path).toBe(
      "players/fb-uid/abc.mp4"
    );
  });

  it("PROF-67: the server's reason is shown as it is; anything else asks to try again", () => {
    const refused = new AxiosError(
      "Bad Request",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 400,
        statusText: "Bad Request",
        data: "Upload the file first",
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    );
    expect(uploadErrorMessage(refused)).toBe("Upload the file first");
    expect(uploadErrorMessage(new Error("storage/unknown"))).toBe(
      "Upload failed. Try again."
    );
  });
});

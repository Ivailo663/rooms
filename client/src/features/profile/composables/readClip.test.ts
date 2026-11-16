import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openClip } from "./readClip";

// jsdom plays no video and has no 2D canvas. The <video> the module makes is
// caught on creation and told what a browser would report; the canvas
// records what was drawn and encoded. What's under test is what the module
// decides: when it gives up, where the still comes from, and its size.
let video: HTMLVideoElement;
let drawn: unknown[];
let encoded: { width: number; height: number; type: string }[];
const revoke = vi.fn();

const report = (meta: { duration: number; width: number; height: number }) => {
  Object.defineProperty(video, "duration", { value: meta.duration });
  Object.defineProperty(video, "videoWidth", { value: meta.width });
  Object.defineProperty(video, "videoHeight", { value: meta.height });
  video.dispatchEvent(new Event("loadedmetadata"));
};

beforeEach(() => {
  drawn = [];
  encoded = [];
  revoke.mockReset();
  URL.createObjectURL = () => "blob:clip";
  URL.revokeObjectURL = revoke;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      const el = create(tag, options);
      if (tag === "video") video = el as HTMLVideoElement;
      return el;
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    (() => ({
      fillStyle: "",
      imageSmoothingQuality: "low",
      fillRect: () => {},
      drawImage: (source: unknown) => drawn.push(source),
    })) as unknown as HTMLCanvasElement["getContext"]
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    done,
    type
  ) {
    encoded.push({ width: this.width, height: this.height, type: type! });
    done(new Blob(["jpeg"], { type }));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("openClip", () => {
  it("PROF-60: reads the clip's length on the phone, muted and inline", async () => {
    const opening = openClip(new Blob(["mov"]));
    expect(video.src).toBe("blob:clip");
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    report({ duration: 12.5, width: 1920, height: 1080 });

    const clip = await opening;
    expect(clip?.duration).toBe(12.5);
    clip!.close();
    expect(revoke).toHaveBeenCalledWith("blob:clip");
  });

  it("PROF-72: the still is a 400px JPEG of a frame just in", async () => {
    const opening = openClip(new Blob(["mov"]));
    report({ duration: 12.5, width: 1080, height: 1920 });
    const clip = (await opening)!;

    const still = clip.poster();
    expect(video.currentTime).toBeCloseTo(0.1);
    video.dispatchEvent(new Event("seeked"));

    expect(await still).toBeInstanceOf(Blob);
    expect(drawn[0]).toBe(video);
    expect(encoded).toEqual([{ width: 225, height: 400, type: "image/jpeg" }]);
  });

  it("PROF-60: a file the browser can't read gives nothing, and lets go of it", async () => {
    const opening = openClip(new Blob(["???"]));
    video.dispatchEvent(new Event("error"));

    expect(await opening).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:clip");
  });

  it("PROF-60: a file the browser never answers about is given up on", async () => {
    const opening = openClip(new Blob(["???"]));
    await vi.advanceTimersByTimeAsync(15_000);

    expect(await opening).toBeNull();
  });

  it("PROF-60: a clip with no picture (sound only) gives nothing", async () => {
    const opening = openClip(new Blob(["m4a"]));
    report({ duration: 12.5, width: 0, height: 0 });

    expect(await opening).toBeNull();
  });

  it("PROF-72: a frame that can't be reached gives no still", async () => {
    const opening = openClip(new Blob(["mov"]));
    report({ duration: 12.5, width: 1920, height: 1080 });
    const still = (await opening)!.poster();
    video.dispatchEvent(new Event("error"));

    expect(await still).toBeNull();
    expect(encoded).toEqual([]);
  });
});

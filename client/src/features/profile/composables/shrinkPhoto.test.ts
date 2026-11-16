import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fitWithin, shrinkPhoto } from "./shrinkPhoto";

// jsdom decodes no images and has no 2D canvas, so the browser's half is
// stood in for: a decoder that reports the photo's upright size, and a
// canvas that records what was drawn into it and what it encoded.
// What's under test is everything this module decides: which decoder, which
// sizes, which source each copy is drawn from, and the JPEG settings.
type Drawn = { canvas: HTMLCanvasElement; source: unknown; fill: string };

let drawn: Drawn[];
let encoded: { width: number; height: number; type: string; quality: number }[];
let blobs: Blob[];
const close = vi.fn();
const originalDecode = HTMLImageElement.prototype.decode;

beforeEach(() => {
  drawn = [];
  encoded = [];
  blobs = [];
  close.mockReset();
  URL.createObjectURL = () => "blob:photo";
  URL.revokeObjectURL = () => {};

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      const context = {
        fillStyle: "",
        imageSmoothingQuality: "low",
        fillRect: () => {},
        drawImage: (source: unknown) =>
          drawn.push({ canvas: this, source, fill: context.fillStyle }),
      };
      return context as unknown as CanvasRenderingContext2D;
    } as unknown as HTMLCanvasElement["getContext"]
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    done,
    type,
    quality
  ) {
    encoded.push({
      width: this.width,
      height: this.height,
      type: type!,
      quality: quality as number,
    });
    blobs.push(new Blob(["jpeg"], { type }));
    done(blobs.at(-1)!);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  HTMLImageElement.prototype.decode = originalDecode;
});

describe("fitWithin", () => {
  it("PROF-60: the longest side is capped, the shape is kept", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4032, 3024, 400)).toEqual({ width: 400, height: 300 });
  });

  it("PROF-60: a photo already smaller than the cap is never upscaled", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(400, 400, 400)).toEqual({ width: 400, height: 400 });
  });
});

describe("shrinkPhoto", () => {
  it("PROF-60: a photo becomes a 1600px JPEG and a 400px JPEG drawn from it", async () => {
    const bitmap = { width: 4032, height: 3024, close };
    const decode = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", decode);

    const result = await shrinkPhoto(new Blob(["raw"]));

    // The decoder is told to apply EXIF rotation, so portraits stay upright.
    expect(decode).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: "from-image",
    });
    expect(encoded).toEqual([
      { width: 1600, height: 1200, type: "image/jpeg", quality: 0.8 },
      { width: 400, height: 300, type: "image/jpeg", quality: 0.8 },
    ]);
    expect(drawn[0]!.source).toBe(bitmap);
    expect(drawn[1]!.source).toBe(drawn[0]!.canvas);
    // JPEG has no transparency: a transparent PNG lands on white, not black.
    expect(drawn.every(({ fill }) => fill === "#fff")).toBe(true);
    expect(close).toHaveBeenCalled();
    expect(result).toEqual({ full: blobs[0], small: blobs[1] });
  });

  it("PROF-60: where the bitmap decoder refuses (old browser, some HEIC), an <img> decodes it upright", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new TypeError("imageOrientation");
      })
    );
    HTMLImageElement.prototype.decode = async () => {};
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
      3024
    );
    vi.spyOn(
      HTMLImageElement.prototype,
      "naturalHeight",
      "get"
    ).mockReturnValue(4032);

    const result = await shrinkPhoto(new Blob(["raw"]));

    expect(drawn[0]!.source).toBeInstanceOf(HTMLImageElement);
    expect(encoded.map(({ width, height }) => [width, height])).toEqual([
      [1200, 1600],
      [300, 400],
    ]);
    expect(result).not.toBeNull();
  });

  it("PROF-60: a photo this browser can't decode (HEIC outside Safari) gives nothing to upload", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new DOMException("unsupported", "InvalidStateError");
      })
    );
    HTMLImageElement.prototype.decode = async () => {
      throw new DOMException("unsupported", "EncodingError");
    };

    expect(await shrinkPhoto(new Blob(["heic"]))).toBeNull();
    expect(encoded).toEqual([]);
  });
});

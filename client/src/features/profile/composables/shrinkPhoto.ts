// PROF-60/72: the full photo is capped at 1600px on its longest side, the
// grid copy at 400px, both JPEG. Phone cameras shoot around 4000px, so the
// full copy is a fraction of the original and a tile downloads a fraction of
// that.
export const FULL_SIDE = 1600;
export const SMALL_SIDE = 400;
const JPEG_QUALITY = 0.8;

export interface ShrunkPhoto {
  full: Blob;
  small: Blob;
}

// The size that fits within `max` on the longest side, keeping the shape.
// Never upscales: a small photo stays as it is.
export const fitWithin = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

// createImageBitmap decodes off the main thread and applies the EXIF
// rotation, so a phone portrait comes out upright. Browsers that predate the
// `imageOrientation: "from-image"` option throw on it, and some Safari
// versions decode HEIC in an <img> but not here; an <img> also honours EXIF
// by default, so it's the fallback. Null means this browser can't read the
// file at all (HEIC outside Safari, or a damaged file).
const decode = async (file: Blob): Promise<Decoded | null> => {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const { width, height } = bitmap;
    return { source: bitmap, width, height, release: () => bitmap.close() };
  } catch {
    // fall through to <img>
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { naturalWidth: width, naturalHeight: height } = img;
    return { source: img, width, height, release: () => {} };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const draw = (source: CanvasImageSource, width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas");
  // JPEG has no transparency; a transparent PNG would otherwise turn black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return canvas;
};

const toJpeg = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  );

// PROF-60: the two JPEGs uploaded for a picked photo, or null when the
// browser can't decode it. The small copy is drawn from the full one: a
// 4000px original squeezed straight to 400px drops pixels and shimmers,
// two steps don't, and it's less work.
export const shrinkPhoto = async (file: Blob): Promise<ShrunkPhoto | null> => {
  const decoded = await decode(file);
  if (!decoded) return null;
  const { width, height } = decoded;
  try {
    const fullSize = fitWithin(width, height, FULL_SIDE);
    const full = draw(decoded.source, fullSize.width, fullSize.height);
    const smallSize = fitWithin(width, height, SMALL_SIDE);
    const small = draw(full, smallSize.width, smallSize.height);
    return { full: await toJpeg(full), small: await toJpeg(small) };
  } finally {
    decoded.release();
  }
};

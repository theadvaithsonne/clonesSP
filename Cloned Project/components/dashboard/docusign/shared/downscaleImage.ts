// Shrinks a signature image before it leaves the browser. Every source goes through it — drawn,
// typed and uploaded — because a phone photo of a signature can be several MB, and the public
// signing page sends images inline in the sign request: the backend rejects an image over 1 MB
// (decoded) or 2000x2000 px, and the whole public request body is capped at 4 MB.
//
// A signature printed into a PDF field never needs more than about 800x400 px, so that is the
// default bound. The result is a PNG (keeps transparency, which typed signatures with a colour rely
// on) unless the PNG is still large — which in practice means a photo — in which case it is a JPEG.

const DEFAULT_MAX_WIDTH = 800;
const DEFAULT_MAX_HEIGHT = 400;
const DEFAULT_MAX_BYTES = 200 * 1024;
const JPEG_QUALITY = 0.85;

interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Some browsers can't decode every image this way — fall back to <img> below.
    }
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read the signature image"));
      el.src = objectUrl;
    });
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(objectUrl) };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process the signature image"))), type, quality)
  );

export async function downscaleImage(
  blob: Blob,
  opts: { maxWidth?: number; maxHeight?: number; maxBytes?: number } = {}
): Promise<Blob> {
  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = opts.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  const source = await decode(blob);
  try {
    if (!source.width || !source.height) throw new Error("Could not read the signature image");
    // Only ever shrinks, never enlarges; the aspect ratio is kept.
    const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process the signature image");
    ctx.drawImage(source.image, 0, 0, width, height);

    const png = await canvasToBlob(canvas, "image/png");
    if (png.size <= maxBytes) return png;

    // JPEG has no transparency (it would turn black), so paint white underneath what's drawn first.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    return await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  } finally {
    source.release();
  }
}

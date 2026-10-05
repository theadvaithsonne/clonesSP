// Link-preview images that every scraper actually renders.
//
// WhatsApp, Facebook, LinkedIn, X and Slack each fetch `og:image` themselves,
// with their own limits. What works everywhere is a JPEG (or PNG) at 1200×630
// under ~300 KB. AVIF, HEIC and — on several of them — WebP don't render at
// all, and WhatsApp silently drops any preview image over roughly 300 KB. Both
// failures look the same to the sharer: a link that unfurls with no picture.

export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;
export const SHARE_IMAGE_MAX_BYTES = 300 * 1024;

const SAFE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const UNSAFE_EXTENSIONS = ["avif", "heic", "heif", "webp", "tif", "tiff", "bmp", "svg"];

export type ShareImageIssue =
  | { kind: "format"; format: string }
  | { kind: "size"; bytes: number };

const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

/**
 * Re-encodes any image the browser can decode as a preview-safe JPEG: at most
 * 1200px wide and under SHARE_IMAGE_MAX_BYTES, stepping quality and then size
 * down until it fits. Transparency is flattened onto white — a JPEG would
 * otherwise paint it black.
 */
export async function toShareJpeg(source: Blob): Promise<File> {
  const bitmap = await createImageBitmap(source);
  try {
    let width = Math.min(SHARE_IMAGE_WIDTH, bitmap.width);
    let height = Math.round((bitmap.height * width) / bitmap.width);
    let best: Blob | null = null;

    for (let pass = 0; pass < 4; pass++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.86, 0.78, 0.7, 0.6]) {
        const blob = await encode(canvas, quality);
        if (!blob) continue;
        best = blob;
        if (blob.size <= SHARE_IMAGE_MAX_BYTES) {
          return new File([blob], "share-image.jpg", { type: "image/jpeg" });
        }
      }
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }

    if (!best) throw new Error("Couldn't prepare that image");
    return new File([best], "share-image.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

/**
 * Why a saved image won't show in link previews, or null when it's fine — or
 * when it couldn't be checked, which is not the same as broken and is never
 * reported as such. Reads through our image proxy when the host sends no CORS
 * headers.
 */
export async function checkShareImage(url: string): Promise<ShareImageIssue | null> {
  const ext = (url.split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
  if (UNSAFE_EXTENSIONS.includes(ext)) return { kind: "format", format: ext.toUpperCase() };

  for (const candidate of [url, `/api/image-proxy?url=${encodeURIComponent(url)}`]) {
    try {
      const res = await fetch(candidate, { credentials: "omit" });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.size) continue;
      const type = (blob.type || "").toLowerCase();
      if (type.startsWith("image/") && !SAFE_TYPES.includes(type)) {
        return { kind: "format", format: type.slice("image/".length).toUpperCase() };
      }
      if (blob.size > SHARE_IMAGE_MAX_BYTES) return { kind: "size", bytes: blob.size };
      return null;
    } catch {
      // CORS or network — try the proxy next.
    }
  }
  return null;
}

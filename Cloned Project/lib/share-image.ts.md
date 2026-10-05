# `lib/share-image.ts`

> Browser utilities that re-encode an image into a link-preview-safe JPEG (at most 1200px wide, under 300 KB) and check whether an existing image URL will render in social link previews.

**Kind:** frontend library · **Lines:** 94

## Purpose
WhatsApp, Facebook, LinkedIn, X and Slack each fetch a page's `og:image` themselves, with different limits. What works everywhere is a JPEG or PNG around 1200x630 and under about 300 KB. AVIF, HEIC and often WebP do not render, and WhatsApp silently drops images over roughly 300 KB. Either way the sharer sees a link preview with no picture. The event website settings use this file to fix images on upload and to warn about images already saved.

## How it works
- **Constants:** `SHARE_IMAGE_WIDTH = 1200`, `SHARE_IMAGE_HEIGHT = 630`, `SHARE_IMAGE_MAX_BYTES = 300 * 1024`. Internal lists: `SAFE_TYPES` (jpeg, png, gif) and `UNSAFE_EXTENSIONS` (avif, heic, heif, webp, tif, tiff, bmp, svg).
- **`toShareJpeg(source)`:** decodes the image with `createImageBitmap`, scales it to at most 1200px wide while keeping the aspect ratio, and draws it onto a canvas filled white first. The white fill keeps transparent areas from turning black in the JPEG. It then tries JPEG qualities 0.86, 0.78, 0.7 and 0.6, and returns the first result at or under the byte limit. If none fits, it shrinks the dimensions to 80% and repeats, for up to 4 passes. After that it returns the last (smallest) blob even if it is still too large. It throws `"Couldn't prepare that image"` only if no blob could be produced at all. The bitmap is always released (`bitmap.close()`).
- **`checkShareImage(url)`:**
  1. Reports `{ kind: "format" }` straight away if the URL's file extension is in `UNSAFE_EXTENSIONS`.
  2. Otherwise fetches the URL directly with `credentials: "omit"`. If that fails (CORS or network), it retries through the Next.js route `/api/image-proxy?url=...`.
  3. From the downloaded blob, it reports a `format` issue for a non-safe `image/*` MIME type and a `size` issue above 300 KB.
  4. Returns `null` when the image is fine **or** could not be checked. "Unknown" is deliberately never reported as broken.

## Exports
- `SHARE_IMAGE_WIDTH`, `SHARE_IMAGE_HEIGHT`, `SHARE_IMAGE_MAX_BYTES` - the preview-image limits.
- `type ShareImageIssue` - `{ kind: "format"; format: string } | { kind: "size"; bytes: number }`.
- `toShareJpeg(source: Blob): Promise<File>` - re-encodes to `share-image.jpg` (`image/jpeg`).
- `checkShareImage(url: string): Promise<ShareImageIssue | null>` - diagnoses an existing image URL.

## Interfaces
- **Backend endpoints called:** `GET /api/image-proxy?url=...` - a Next.js route handler (`app/api/image-proxy/route.ts`) used as a CORS fallback.

## Dependencies
- **Internal:** none imported. It calls the `app/api/image-proxy` route at runtime.
- **Packages:** none (browser Canvas, `createImageBitmap` and `fetch` APIs).

## Used by
- `components/dashboard/inlineApps/events/sections/WebsiteSettings.tsx` - the event website share-image setting.

## Notes
- Browser-only: it uses `document`, the canvas API and `createImageBitmap`.
- `SHARE_IMAGE_HEIGHT` is exported but `toShareJpeg` does not crop to 630px. It keeps the source aspect ratio.

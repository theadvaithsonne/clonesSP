# `app/(dashboard)/thoughts/components/NoteCoverPicker.tsx`

> Notion-style popover for choosing a note's cover: preset gradients and photos, file upload via UploadThing, a pasted image link, or a curated "Unsplash" grid.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 260

## Purpose
Thoughts pages can have a banner cover image like Notion. `NotePageHeader.tsx` shows a "Change cover" button and mounts this picker anchored to it. The picker only produces a cover value (an image URL or a `gradient:<css>` string) and hands it back through `onSelect`; saving it on the note is done by the header's parent.

## How it works
- **Mounting and position.** Renders nothing until mounted on the client and `open` is true, then portals a fixed 420x400 px panel into `document.body` at `z-[100000]`. Position is computed from `anchorRef`'s bounding box: 8 px below the anchor, right-aligned to it, clamped to stay inside the viewport (falls back to 80/80 if there is no anchor).
- **Outside click.** While open, a document `mousedown` listener calls `onClose()` unless the click is inside the panel or the anchor.
- **Tabs** (local `tab` state):
  - **Gallery** - "Color & Gradient" grid of `COVER_GRADIENTS` (painted with `gradientCss(value)`, i.e. the value without its `gradient:` prefix) and a "Photos" grid of `COVER_PHOTOS`. Clicking selects the preset's `value` and closes.
  - **Upload** - hidden `<input type="file" accept="image/*">`. `handleUpload` ignores non-image files, calls `uploadFiles("postImages", { files: [file] })`, and uses `ufsUrl` (or `url`) of the first result. It shows a spinner while uploading, logs failures to the console, and resets the input.
  - **Link** - text input; Enter or "Submit" selects the trimmed URL. There is no URL validation.
  - **Unsplash** - the same `COVER_PHOTOS` list in a larger 3-column grid. It is not a live Unsplash search.
- **Remove** button calls `onRemove()` then `onClose()`.

## Exports
- `default NoteCoverPicker({ open, onClose, onSelect, onRemove, anchorRef })`
  - `onSelect(coverUrl: string)` - image URL or `gradient:...` value; `onRemove()` - clear the cover; `anchorRef: React.RefObject<HTMLElement | null>` - element to position against.

## Interfaces
- **External services:** UploadThing (via the `postImages` route defined in `app/api/uploadthing/core.ts`: images only, up to 8MB, up to 10 files, anonymous middleware); Unsplash image CDN (`images.unsplash.com`) for the hardcoded preset photos.

## Dependencies
- **Internal:** `utils/uploadthing.ts` (`uploadFiles`, re-exported from `lib/uploadthing`) - client upload helper; `../lib/noteCoverGallery.ts` (`COVER_GRADIENTS`, `COVER_PHOTOS`, `gradientCss`) - preset data.
- **Packages:** `react`; `react-dom` (`createPortal`); `lucide-react` (`Loader2`).

## Used by
- `app/(dashboard)/thoughts/components/NotePageHeader.tsx` - passes `onSelect={(url) => onCoverChange(url)}` and `onRemove={() => onCoverChange(null)}`.

## Notes
- The UI says "Images up to ~5MB" but the UploadThing route allows 8MB.
- Upload errors are only logged; the user gets no toast.
- The position is computed once per render, so the panel does not follow the anchor on scroll or resize until something re-renders it.

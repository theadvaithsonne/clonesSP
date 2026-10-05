# `app/(dashboard)/flowboard/[symbol]/components/card-attachments.tsx`

> Attachment manager for a Flowboard card: lists the card's files with infinite scroll, uploads new files (click, drag and drop or paste) to S3, adds video links, deletes attachments and previews images, PDFs, Word documents and videos in a dialog.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 630

## Purpose
Flowboard cards can carry files and links. `card-modal.tsx` renders this component in its "Attachments" area. The attachment list is a controlled prop owned by the modal; this component handles fetching, uploading, deleting and previewing. All network calls go to the external Garage UAT services at `https://uatapi.garage.app` and `https://uatapi.garage.app/flowboard`, not to this repo's backend.

## How it works

### Data model
`Attachment = { _id?, fileLink, fileName, fileType: "document" | "image" | "video", comment }`. When server rows are fetched they are normalised to this shape. The link is taken from `fileLink` or `fileUrl`, and `fileType` defaults to `"document"`.

### Fetching (paged)
- **First page:** an effect fetches `GET {FLOWBOARD_API_URL}/v1/files?boardId&cardId&page=1&size=50` once per mount, while `hasFetchedFiles` is false. It replaces the list through `onAttachmentsChange(mappedFiles)` and sets `hasNextPage` from `result.metadata.nextPage`. This fetch does not wait for `showAttachments`; existing files load as soon as the modal opens.
- **Next pages:** `lastElementRef` is a callback ref on the last row. It sets up an `IntersectionObserver` with a 200px `rootMargin` that increments `currentPage`. A second effect then fetches that page and appends it to `attachments`.
- **Reset:** when `showAttachments` becomes false, the paging flags reset so the next open re-fetches.

### Uploading
1. Files can arrive from the hidden `<input type="file" multiple>` (accepting `image/*,.pdf,.doc,.docx,.txt`), from drag and drop (`handleDrag` / `handleDrop`), or from pasting into the "Quick Paste Zone" input (`handlePaste` collects clipboard items of kind `file`).
2. `processFiles` ignores the files when the view is read-only, an upload is already running, or the list is empty. Otherwise it calls `uploadFilesToS3`.
3. `uploadFilesToS3` sends a `multipart/form-data` `POST {API_URL}/api/s3upload/multiple` with the `files[]` and `folder=task-attachments`, plus a Bearer token. It expects `{ success: true, data: [{ url, fileName }] }`.
4. Each result becomes an `Attachment`. `normalizeFileType` returns `image` for `image/*` MIME types, `video` for `video/link`, and `document` for everything else.
5. The new list (old plus uploaded) is pushed to the parent with `onAttachmentsChange`, and then to `onSave` if one was given. In `card-modal.tsx`, `onSave` posts the whole list to the Flowboard `files/bulk` endpoint.

### Video links
`addVideoLink` (the Plus button or Enter) rejects duplicate URLs. It names the link after the last URL path segment (default "Video Link"), appends a `fileType: "video"` attachment, and calls `onAttachmentsChange` and `onSave` the same way uploads do.

### Deleting
`removeAttachment(fileLink)` is blocked with a toast for observers.
- If the attachment has an `_id`, it calls `DELETE {FLOWBOARD_API_URL}/v1/files/:id` and drops the item locally on success. It deliberately does not call `onSave`.
- Items without an `_id` (freshly uploaded and not yet re-fetched) are only removed from local state.

### Preview dialog
`handlePreview` chooses how to show the file:
- images go in an `<img>`;
- videos go in an `<iframe>`;
- `.pdf` goes in an `<iframe>` pointing straight at the file;
- `.doc` / `.docx` go in an `<iframe>` through the Google Docs viewer (`googleViewerUrl`);
- anything else shows a "Preview not available" panel with a download button.

The header's download button opens the URL in a new tab.

### Read-only mode
With `isReadOnly`, the inputs are disabled and clicks on the drop zone and delete actions show an "Observers can only view attachments" toast. The list and the previews still work.

## Exports
- `CardAttachments(props: CardAttachmentsProps)` - the component. Props:
  - `cardId`, `boardId`
  - `attachments` and `onAttachmentsChange` - the controlled list
  - `onSave?(attachments)` - persist hook, called after uploads and link adds
  - `showAttachments?` - shows the upload, paste and link controls; defaults to false
  - `isReadOnly?`
- `interface Attachment` - the attachment shape described above. `card-modal.tsx` imports it.

## Interfaces
- **External services** (each request carries `Authorization: Bearer <garage_tok>`):
  - `GET https://uatapi.garage.app/flowboard/v1/files?boardId=…&cardId=…&page=…&size=50` - list a card's files
  - `DELETE https://uatapi.garage.app/flowboard/v1/files/:id` - delete one file
  - `POST https://uatapi.garage.app/api/s3upload/multiple` - multipart upload to S3 (folder `task-attachments`)
  - Google Docs viewer (`https://docs.google.com/viewer?url=…&embedded=true`) for Word previews. This sends the file URL to Google.
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/dialog.tsx` - UI primitives.
- **Packages:** `react` - state, refs and effects; `lucide-react` - icons; `sonner` - toasts; `js-cookie` - imported but unused.

## Used by
- `app/(dashboard)/flowboard/[symbol]/components/card-modal.tsx`, which is shown on the board page `/flowboard/[symbol]`.

## Notes
- The next-page effect builds its result from the `attachments` prop captured when the effect ran. If the parent changes the list while a page is loading, those changes are overwritten.
- `onAttachmentsChange` is in both fetch effects' dependency lists. The modal passes a stable `setAttachments`, so this is safe there; an inline callback would re-run the fetches.
- MIME types such as `video/mp4` are classed as `document`; only the synthetic `video/link` becomes `video`. In practice the file input does not accept video files anyway.
- Image tiles use `FileText` icons in `getFileIcon`. That branch is only reached for non-image types, so it never shows.
- The upload comment `"Uploaded via CardAttachments"` is stored on each new attachment, but `card-modal.tsx`'s `onSave` sends only `fileLink`, `fileName` and `fileType` to the server.

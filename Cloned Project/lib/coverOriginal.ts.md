# `lib/coverOriginal.ts`

> Pure helpers that remember, per browser, which fuller image a saved community or organisation cover was cropped from, so "Reposition" can reopen the full picture instead of the banner-shaped crop.

**Kind:** frontend library · **Lines:** 115

## Purpose
Covers are uploaded already cropped to the banner shape. To reframe one later you need the original image it came from, but the channel schema has no field for that. This module stores the link in `localStorage`, keyed by the saved cover URL. The decision logic is kept in pure functions that take an injectable store: deciding which image the crop dialog opens and what to remember after a save is where the branching lives, and the injectable store means it can be tested without a browser.

## How it works
**Storage:** each record is saved under the key `garage:coverOriginal:<coverUrl>` with the value `{ url, state }`. Here `url` is the fuller image and `state` is the `CropState` from `components/shared/ImageCropDialog.tsx`, in that image's coordinates. When no store is passed, `defaultStore()` uses `window.localStorage`, or `null` during SSR.

- `readCoverOriginal(coverUrl, store?)` - returns the record, or `null` when the URL or store is missing, the JSON is invalid, or the record has no `url`. It never throws.
- `writeCoverOriginal(coverUrl, record, store?)` - saves the record. If the store throws because it is full or blocked, the error is swallowed and reframing falls back to the saved cover.
- `resolveCropSource({ pickedFile, pickedFileUrl, pickedFileState, coverUrl, store? })` - picks what the crop dialog should load, in this order:
  1. the file picked in this session, with its state and URL;
  2. the remembered original for `coverUrl`, with its saved framing;
  3. the saved cover URL itself, with `initialState: null` because there are no matching coordinates to restore.
  It returns `null` when there is no cover at all. If `store` is explicitly `null`, the remembered lookup is skipped. If it is `undefined`, the default store is used.
- `resolveOriginalToRemember({ croppedFrom, uploadedOriginalUrl, knownOriginalUrl })` - picks what to save behind a newly saved cover. It prefers the URL of an original just uploaded in this save, then the URL of an already-hosted original. If the dialog edited the saved cover itself (a string), it returns that URL. This means the remembered image is always at least as full as the crop, so repeated reframing never shrinks to a thin sliver of the banner.

## Exports
- `interface CoverOriginalRecord` - `{ url: string; state: CropState }`.
- `interface KeyValueStore` - the `getItem` and `setItem` subset of `Storage`.
- `interface ResolvedCropSource` - `{ source: File | string; initialState: CropState | null; originalUrl: string | null }`.
- `readCoverOriginal(coverUrl, store?)`, `writeCoverOriginal(coverUrl, record, store?)`, `resolveCropSource(args)`, `resolveOriginalToRemember(args)` - described above.

## Interfaces
- **Browser storage / cookies:** `localStorage` keys prefixed `garage:coverOriginal:`.

## Dependencies
- **Internal:** `components/shared/ImageCropDialog.tsx` - the `CropState` type (type-only import).

## Used by
- `components/dashboard/ChannelsPage.tsx` - uses `resolveCropSource`, `resolveOriginalToRemember` and `writeCoverOriginal` when cropping a community cover.
- `components/shared/ManageOrgPopover.tsx` - uses the same flow for organisation covers.
- `components/dashboard/RightPanel.tsx` - calls `readCoverOriginal(coverImage)?.url` to show the fuller image where one is available.

## Notes
- The link exists only in the browser that did the crop. On another device or after site data is cleared, "Reposition" opens the cropped cover.

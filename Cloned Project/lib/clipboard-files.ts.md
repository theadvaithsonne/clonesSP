# `lib/clipboard-files.ts`

> Shared plumbing for "paste or drop a file anywhere" Cabinet uploads: extracts files from paste and drop `DataTransfer`s (walking dropped folders), names pasted screenshots, ignores pastes in text fields, and renames staged files while keeping their extension.

**Kind:** frontend library · **Lines:** 297

## Purpose
The Cabinet pages let users paste a screenshot or drop files and whole folders anywhere on the page, review them in a dialog (optionally renaming them), and upload them, recreating the folder structure. Paste and drop both deliver a `DataTransfer` but need different handling: a paste is usually a single nameless image blob, while a drop is a file list that may include directories which must be walked. This module holds that browser-API logic so the cabinet pages and the upload-gesture hook share it.

## How it works
### Staged files
`PickedFile` = `{ file, relativePath }`. `relativePath` is `""` for a loose file and, for example, `"Design/Logos"` for a file two levels inside a dropped folder; callers use it to show the hierarchy and recreate folders on upload. `toPickedFiles(files)` wraps loose files.

### Renaming
- `withPreservedExtension(originalName, next)` strips `/` and `\` (unsafe in cabinet paths) and trims. Empty input keeps the original name. If the original has an extension and the typed name does not, the original extension (lower-cased) is re-appended, trailing dots removed. A typed extension wins. A leading dot (dotfile) is treated as part of the name, not an extension.
- `renamePickedFile(entry, next)` builds a new `File` with the new name (since `File.name` is read-only), sharing the bytes and keeping `type` and `lastModified`. Returns the same entry if the name is unchanged.

### Paste
- `isTypingTarget(target)` is true when the event target (or, failing that, `document.activeElement`) is an `INPUT`, `TEXTAREA`, `SELECT` or contenteditable element. Callers must let such pastes behave normally so search boxes, rename fields and comment editors keep working.
- `filesFromClipboard(data)` collects file items from `data.items` (needed because Safari never puts screenshot blobs in `files`), falling back to `data.files`. Generic names (`image.png`/`.jpg`/`.jpeg`/`.gif`/`.webp`, or no name) are replaced with `pasted-<YYYY-MM-DDTHH-MM-SS>[-n].<ext>` so several screenshots are distinguishable.

### Drop (folders)
- `filesFromDrop(data)` captures `data.items` and each item's `webkitGetAsEntry()` **synchronously** before any `await`, because the browser empties the item list as soon as the drop handler returns; callers must await the result before touching `dataTransfer` again.
- With the entry API, each entry is walked recursively (`walkEntry`): files are read via `entry.file()`, directories via `createReader().readEntries()`, drained in a loop because each call returns at most about 100 entries and an empty batch signals the end (`readAllEntries`). Unreadable files are skipped.
- Limits keep the browser and review dialog responsive if someone drops a huge tree: `MAX_DEPTH = 8` directory levels and `MAX_FILES = 500` files. Hitting either sets `truncated: true` so the UI can say not everything was included, instead of silently uploading a subset.
- Without the entry API, plain files are kept and anything with size 0 and no MIME type (how a dropped folder appears there) is counted in `unreadableDirectories` instead of being uploaded as a bogus empty file.
- `dragHasFiles(data)` checks `data.types` for `"Files"`, so drag-over UI only reacts to file drags, not text or DOM drags.

## Exports
- `PickedFile` (interface), `DropResult` (interface: `files`, `truncated`, `unreadableDirectories`).
- `toPickedFiles(files: File[]): PickedFile[]`
- `withPreservedExtension(originalName: string, next: string): string`
- `renamePickedFile(entry: PickedFile, next: string): PickedFile`
- `isTypingTarget(target: EventTarget | null): boolean`
- `filesFromClipboard(data: DataTransfer | null): File[]`
- `filesFromDrop(data: DataTransfer | null): Promise<DropResult>`
- `dragHasFiles(data: DataTransfer | null): boolean`

## Dependencies
None (browser DOM APIs only: `DataTransfer`, `File`, the non-standard `webkitGetAsEntry` file-system entry API).

## Used by
- `lib/hooks/useCabinetUploadGestures.ts` - wires page-level paste/drag/drop listeners.
- `components/dashboard/cabinet-upload-ui.tsx` - the review dialog.
- `components/dashboard/CabinetPage.tsx`, `FloorCabinetPage.tsx`, `FounderCabinetPage.tsx`.

## Notes
- Folder walking is sequential (one `await` per file), which is simple and bounded by `MAX_FILES` but slow for very large folders.
- The 500-file cap counts across all dropped entries combined, not per folder.
- Generated paste names use UTC time from `toISOString()`, not local time.

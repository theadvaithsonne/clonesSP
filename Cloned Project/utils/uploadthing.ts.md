# `utils/uploadthing.ts`

> Module exporting `UploadButton`, `UploadDropzone`, `validateFile`.

**Kind:** frontend utility · **Lines:** 75

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useUploadThing` | export |  | 5 |
| `uploadFiles` | export |  | 5 |
| `UploadButton` | function | `UploadButton()` | 8 |
| `UploadDropzone` | function | `UploadDropzone()` | 9 |
| `validateFile` | function | `validateFile(file: File, options: { maxSize?: number; allowedTypes?: string[]; allow…)` | 12 |
| `uploadConfig` | const | `= { image: { maxSize: 8 * 1024 * 1024, // 8MB allowedTypes: ['image/'], allowedExtensions…` | 50 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/uploadthing.ts` — `useUploadThing`, `uploadFiles`
- **Packages:**
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/deals/products/page.tsx`
- `app/(dashboard)/thoughts/components/NoteCoverPicker.tsx`
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/components/blocks/AudioBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/DocumentListBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/FileBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/GalleryViewBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/ImageBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/VideoBlock.tsx`
- `app/(dashboard)/thoughts/page.tsx`
- `components/deals/NewLeadFlow.tsx`
- `components/deals/ProductOnboardingFlow.tsx`

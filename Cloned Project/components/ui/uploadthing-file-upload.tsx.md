# `components/ui/uploadthing-file-upload.tsx`

> components/ui/uploadthing-file-upload.tsx

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 191 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
components/ui/uploadthing-file-upload.tsx

Direct-to-S3 file upload wrapper (public route). Component name kept
as `UploadThingFileUpload` for API compatibility — ManageOrgPopover
has 8 call sites, all with the same prop shape as when this really
was an UploadThing wrapper. Internals now POST to the backend's
public upload endpoint (`/uploads/public`, no auth) which streams
the file into our own S3 bucket and returns the public URL.

The `endpoint` prop is now decorative — the backend accepts any
image regardless of intended use — but kept in the interface so the
migration is a drop-in swap with no changes to call sites.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Loader2` (lucide-react), `X` (lucide-react), `Upload` (lucide-react)

### Props

- **`UploadThingFileUpload`**: `onUploadComplete: (url: string) => void`, `onRemove?: () => void`, `currentUrl?: string`, `accept?: string`, `maxSize?: number`, `className?: string`, `placeholder?: string`, `description?: string`, `endpoint: "organizationIcon" | "organizationCover" | "profilePicture"`, `fieldName?: string`

**Hooks used:** `useState`×2, `useId`, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UploadThingFileUpload` | component | `UploadThingFileUpload({ onUploadComplete, onRemove, currentUrl, accept = "image/*…)` | 34 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/uploads/public` (L82)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useState`, `useId`, `useRef`
  - `lucide-react` — `Upload`, `X`, `Loader2`

## Used by

- `components/shared/ManageOrgPopover.tsx`

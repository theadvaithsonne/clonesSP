# `components/ui/file-attachment.tsx`

> React components `FilePreview`, `FileAttachment`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 133 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FileText`×5 (lucide-react), `Button`×2 (components/ui/button.tsx), `Image` (lucide-react), `File` (lucide-react), `X` (lucide-react), `Paperclip` (lucide-react)

### Props

- **`FilePreview`**: `file: File`, `onRemove: () => void`
- **`FileAttachment`**: `onFileSelect: (file: File) => void`, `className?: string`

**Hooks used:** `useState`, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FilePreview` | component | `FilePreview({ file, onRemove }: FilePreviewProps)` | 18 |
| `FileAttachment` | component | `FileAttachment({ onFileSelect, className, }: FileAttachmentProps)` | 61 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useRef`
  - `lucide-react` — `Paperclip`, `X`, `FileText`, `Image`, `File`, `Download`

## Used by

- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

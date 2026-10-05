# `components/ui/media-preview-modal.tsx`

> React component `MediaPreviewModal`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 107 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×3 (components/ui/button.tsx), `X` (lucide-react), `Download` (lucide-react), `ExternalLink` (lucide-react)

### Props

- **`MediaPreviewModal`**: `media: { url: string; type: string; name: string; } | null`, `onClose: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MediaPreviewModal` | component | `MediaPreviewModal({ media, onClose }: MediaPreviewModalProps)` | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
- **Packages:**
  - `react-dom` — `createPortal`
  - `lucide-react` — `X`, `Download`, `ExternalLink`

## Used by

- `components/dashboard/CabinetPage.tsx`
- `components/dashboard/DMPage.tsx`
- `components/dashboard/FloorCabinetPage.tsx`
- `components/dashboard/FounderCabinetPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`
- `components/dashboard/OrganizationCabinetPage.tsx`

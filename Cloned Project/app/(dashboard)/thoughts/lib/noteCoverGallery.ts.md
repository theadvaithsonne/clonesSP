# `app/(dashboard)/thoughts/lib/noteCoverGallery.ts`

> Module exporting `isGradientCover`, `gradientCss`, `pickRandomCover`, `renderCoverStyle`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 149

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CoverPreset` | type | Curated Notion-style cover presets (gradients + photos). | 5 |
| `COVER_GRADIENTS` | const | `= [ { id: "g1", label: "Red", value: "gradient:linear-gradient(90deg,#ff6b6b,#ee5a24)", c…` | 13 |
| `COVER_PHOTOS` | const | `= [ { id: "p1", label: "Sailboats", value: "https://images.unsplash.com/photo-15051424686…` — Stable Unsplash photo URLs (no API key required). | 33 |
| `ALL_COVERS` | const | `= [...COVER_GRADIENTS, ...COVER_PHOTOS]` | 120 |
| `isGradientCover` | function | `isGradientCover(value: string \| null \| undefined): boolean` | 122 |
| `gradientCss` | function | `gradientCss(value: string): string` | 126 |
| `pickRandomCover` | function | `pickRandomCover(): string` | 130 |
| `renderCoverStyle` | function | `renderCoverStyle(coverUrl: string \| null \| undefined, position = 50): CSSProperties` | 135 |

## Interfaces

- **External hosts mentioned in the code:** `images.unsplash.com`

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `CSSProperties`

## Used by

- `app/(dashboard)/thoughts/components/NoteCoverPicker.tsx`
- `app/(dashboard)/thoughts/components/NotePageHeader.tsx`

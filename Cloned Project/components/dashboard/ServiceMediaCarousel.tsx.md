# `components/dashboard/ServiceMediaCarousel.tsx`

> React component `ServiceMediaCarousel`.

**Kind:** React component · **Lines:** 215 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Briefcase` (lucide-react), `Play` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`ServiceMediaCarousel`**: `items: MediaItem[]`, `fallbackIcon?: string`, `fallbackIconBg?: string`, `className?: string`

**Hooks used:** `useState`×2, `useRef`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatFileSize` | function | `formatFileSize(bytes?: number): string` — Byte count as a short human string — KB under a megabyte, else MB. | 8 |
| `youtubeId` | function | `youtubeId(url?: string): string \| null` — Pull the video id out of any common YouTube URL shape. | 16 |
| `youtubeThumb` | function | `youtubeThumb(url?: string): string \| null` | 24 |
| `MediaItem` | interface |  | 29 |
| `buildServiceMedia` | function | `buildServiceMedia(service: { images?: string[]; videos?: string[]; youtubeUrl…): MediaItem[]` — Images, uploaded videos and a YouTube demo, in one swipeable frame. | 35 |
| `ServiceMediaCarousel` | component | `ServiceMediaCarousel({ items, fallbackIcon, fallbackIconBg, className, }: { item…)` | 56 |

## Interfaces

- **External hosts mentioned in the code:** `img.youtube.com`, `www.youtube.com`

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `lucide-react` — `Briefcase`, `ChevronLeft`, `ChevronRight`, `Play`

## Used by

- `components/dashboard/ServiceEngagementView.tsx`
- `components/dashboard/ServiceFormModal.tsx`
- `components/dashboard/ServicesPage.tsx`
- `components/dashboard/service-taskroom/EngagementFilesTab.tsx`

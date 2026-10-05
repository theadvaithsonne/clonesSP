# `lib/youtube.ts`

> Parse a YouTube video id from any common URL form (or a bare 11-char id).

**Kind:** frontend library · **Lines:** 46

<!-- docgen:auto -->

## Purpose
Parse a YouTube video id from any common URL form (or a bare 11-char id).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `parseYouTubeId` | function | `parseYouTubeId(input: string): string \| null` | 4 |
| `youTubeThumb` | function | `youTubeThumb(id: string): string` | 23 |
| `loadYouTubeIframeApi` | function | `loadYouTubeIframeApi(): Promise<any>` | 29 |

## Interfaces

- **External hosts mentioned in the code:** `i.ytimg.com`, `www.youtube.com`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/funnel-studio/node-inspector.tsx`
- `components/funnel-studio/preview-canvas.tsx`

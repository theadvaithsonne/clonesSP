# `app/f/[token]/page.tsx`

> Next.js page rendered at `/f/[token]`.

**Kind:** Next.js page · **Lines:** 125 · **Route:** `/f/[token]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `Suspense` (react), `ShareableLinkViewer` (app/f/[token]/ShareableLinkViewer.tsx)

### Props

- **`ShareableLinkPage`**: `params: Promise<{ token: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, }: { params: Promise<{ token: string }>; }): Promise<Metadata>` | 64 |
| `default (ShareableLinkPage)` | component | `async ShareableLinkPage({ params, }: { params: Promise<{ token: string }>; })` | 110 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/f/${token}/meta` (L49)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`

## Dependencies

- **Internal:**
  - `app/f/[token]/ShareableLinkViewer.tsx` — `ShareableLinkViewer (default)`
- **Packages:**
  - `react` — `Suspense`
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/f/[token]` (page).

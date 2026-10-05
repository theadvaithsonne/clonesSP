# `app/events/[id]/page.tsx`

> Next.js page rendered at `/events/[id]`.

**Kind:** Next.js page · **Lines:** 122 · **Route:** `/events/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `EventLandingClient` (app/events/[id]/EventLandingClient.tsx)

### Props

- **`PublicEventPage`**: `params: Promise<{ id: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params }: PageProps): Promise<Metadata>` — Link-preview metadata. | 41 |
| `default (PublicEventPage)` | component | `async PublicEventPage({ params }: PageProps)` | 118 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/event-management/${id}` (L44)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`
- **External hosts mentioned in the code:** `api.my.garage.app`, `my.garage.app`

## Dependencies

- **Internal:**
  - `app/events/[id]/EventLandingClient.tsx` — `EventLandingClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/events/[id]` (page).

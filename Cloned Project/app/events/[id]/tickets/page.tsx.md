# `app/events/[id]/tickets/page.tsx`

> Next.js page rendered at `/events/[id]/tickets`.

**Kind:** Next.js page · **Lines:** 22 · **Route:** `/events/[id]/tickets` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `metadata`

### Composition

**Renders:** `MyTicketsClient` (app/events/[id]/tickets/MyTicketsClient.tsx)

### Props

- **`MyTicketsPage`**: `params: Promise<{ id: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `metadata` | const | `= { title: "My tickets", // Nothing here is worth indexing, and the page only ever render…` | 7 |
| `default (MyTicketsPage)` | component | `async MyTicketsPage({ params, }: { params: Promise<{ id: string }>; })` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/events/[id]/tickets/MyTicketsClient.tsx` — `MyTicketsClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/events/[id]/tickets` (page).

# `app/events/[id]/registered/[token]/page.tsx`

> Next.js page rendered at `/events/[id]/registered/[token]`.

**Kind:** Next.js page · **Lines:** 17 · **Route:** `/events/[id]/registered/[token]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `metadata`

### Composition

**Renders:** `ConfirmationClient` (app/events/[id]/registered/[token]/ConfirmationClient.tsx)

### Props

- **`EventConfirmationPage`**: `params: Promise<{ id: string; token: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `metadata` | const | `= { title: "Registration confirmed", robots: { index: false, follow: false }, }` | 4 |
| `default (EventConfirmationPage)` | component | `async EventConfirmationPage({ params, }: { params: Promise<{ id: string; token: string …)` | 9 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/events/[id]/registered/[token]/ConfirmationClient.tsx` — `ConfirmationClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/events/[id]/registered/[token]` (page).

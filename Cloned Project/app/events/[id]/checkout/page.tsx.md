# `app/events/[id]/checkout/page.tsx`

> Next.js page rendered at `/events/[id]/checkout`.

**Kind:** Next.js page · **Lines:** 36 · **Route:** `/events/[id]/checkout` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `metadata`

### Composition

**Renders:** `CheckoutClient` (app/events/[id]/checkout/CheckoutClient.tsx)

### Props

- **`EventCheckoutPage`**: `params: Promise<{ id: string }>`, `searchParams: Promise<{ tier?: string; ref?: string; referCode?: stri…`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `metadata` | const | `= { title: "Checkout", // A checkout URL carries a buyer's selection, not content worth i…` | 14 |
| `default (EventCheckoutPage)` | component | `async EventCheckoutPage({ params, searchParams, }: PageProps)` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/events/[id]/checkout/CheckoutClient.tsx` — `CheckoutClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/events/[id]/checkout` (page).

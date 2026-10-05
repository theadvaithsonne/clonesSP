# `app/invoice/[invoiceId]/page.tsx`

> Next.js page rendered at `/invoice/[invoiceId]`.

**Kind:** Next.js page · **Lines:** 145 · **Route:** `/invoice/[invoiceId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `InvoicePayPage` (app/invoice/[invoiceId]/InvoicePayPage.tsx)

### Props

- **`Page`**: `params: Promise<{ invoiceId: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, }: PageProps): Promise<Metadata>` | 56 |
| `default (Page)` | component | `async Page({ params }: PageProps)` | 141 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/api/invoices/${invoiceId}` (L63)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **External hosts mentioned in the code:** `api.my.garage.app`

## Dependencies

- **Internal:**
  - `app/invoice/[invoiceId]/InvoicePayPage.tsx` — `InvoicePayPage`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/invoice/[invoiceId]` (page).

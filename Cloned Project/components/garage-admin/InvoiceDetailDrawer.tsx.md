# `components/garage-admin/InvoiceDetailDrawer.tsx`

> Invoice detail drawer for the garage-admin tables.

**Kind:** React component · **Lines:** 405 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Invoice detail drawer for the garage-admin tables. Opens IN-PAGE (a
right-side sheet over a dimmed backdrop) so clicking an invoice number
never navigates away from the list. Fetches the public invoice endpoint
`GET /api/invoices/:idOrNumber` — getInvoice() accepts the invoice NUMBER
directly, so the tables (which only carry invoiceNumber) can open it
without a backend change. Same shell as NetworkChainSubsFilterDrawer.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×6 (local), `TotalRow`×5 (local), `ExternalLink`×2 (lucide-react), `AnimatePresence` (framer-motion), `X` (lucide-react), `Loader2` (lucide-react)

### Props

- **`InvoiceDetailDrawer`**: `invoiceNumber: string | null`, `onClose: () => void`

**Hooks used:** `useState`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InvoiceDetailDrawer` | component | `InvoiceDetailDrawer({ invoiceNumber, onClose }: Props)` | 95 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET api/invoices/${encodeURIComponent(invoiceNumber)}` (L107)

## Dependencies

- **Internal:**
  - `lib/admin-domain.ts` — `invoiceUrl`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `react-dom` — `createPortal`
  - `framer-motion` — `AnimatePresence`, `motion`
  - `lucide-react` — `X`, `ExternalLink`, `Loader2`

## Used by

- `app/garage-admin/(admin-dashboard)/companies/page.tsx`
- `app/garage-admin/(admin-dashboard)/networkchain-subs/page.tsx`
- `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`

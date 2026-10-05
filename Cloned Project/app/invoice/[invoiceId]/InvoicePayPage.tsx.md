# `app/invoice/[invoiceId]/InvoicePayPage.tsx`

> React component `InvoicePayPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 663 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×4 (components/ui/button.tsx), `AlertCircle`×3 (lucide-react), `CheckCircle2`×3 (lucide-react), `Loader2`×2 (lucide-react), `ArrowRight`×2 (lucide-react), `ArrowLeft` (lucide-react), `InvoiceDocument` (components/checkout/InvoiceDocument.tsx), `Shield` (lucide-react), `ExternalLink` (lucide-react), `Mail` (lucide-react), `KeyRound` (lucide-react), `Input` (components/ui/input.tsx), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `ProductThankYouCard` (components/checkout/ProductThankYouCard.tsx)

### Props

- **`InvoicePayPage`**: `invoiceId: string`

**Hooks used:** `useState`×9, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InvoicePayPage` | component | `InvoicePayPage({ invoiceId }: InvoicePayPageProps)` | 68 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/api/invoices/${invoiceId}` (L121)
  - `POST /backend/api/invoices/${invoiceId}/handoff-exchange` (L180)
  - `POST /backend/api/invoices/${invoiceId}/request-otp` (L274)
  - `POST /backend/api/invoices/${invoiceId}/verify-otp` (L303)
- **Timers / queues:** `setTimeout` at L357

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/api.ts` — `API_URL`
  - `lib/safe-redirect.ts` — `safeRedirectPath`, `safeAbsoluteRedirectUrl`
  - `lib/auth.ts` — `saveToken`, `saveOrgId`, `getToken`, `getUserIdFromToken`, `clearToken`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `components/checkout/InvoiceDocument.tsx` — `InvoiceDocument`, `InvoiceDocumentData`, `FromOrganization`
  - `components/checkout/ProductThankYouCard.tsx` — `ProductThankYouCard (default)`
  - `lib/feed-api.ts` — `ThankYouPage`, `(types only)`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `next` — `useRouter`, `useSearchParams`
  - `lucide-react` — `Loader2`, `AlertCircle`, `CheckCircle2`, `ArrowRight`, `ArrowLeft`, `KeyRound`, …
  - `sonner` — `toast`

## Used by

- `app/invoice/[invoiceId]/page.tsx`

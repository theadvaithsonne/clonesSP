# `components/webinar/WebinarCheckoutDialog.tsx`

> React component `WebinarCheckoutDialog`.

**Kind:** React component · **Lines:** 81 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `UserCircle2` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx)

### Props

- **`WebinarCheckoutDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `invoiceId: string | null`, `organizationName: string`, `userEmail: string`, `userName?: string`, `referrer: InvoiceReferrerInfo | null`, `onPaid: (paymentId?: string) => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebinarCheckoutDialog)` | component | `WebinarCheckoutDialog({ open, onOpenChange, invoiceId, organizationName, userEmai…)` | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `lib/feed-api.ts` — `InvoiceReferrerInfo`, `(types only)`
- **Packages:**
  - `lucide-react` — `UserCircle2`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`

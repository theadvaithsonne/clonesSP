# `components/dashboard/ChannelPaymentModal.tsx`

> React component `ChannelPaymentModal`.

**Kind:** React component · **Lines:** 549 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `Rss` (lucide-react), `Tag` (lucide-react), `Input` (components/ui/input.tsx), `ArrowLeft` (lucide-react), `PaymentMethodSelector` (components/checkout/PaymentMethodSelector.tsx), `Button` (components/ui/button.tsx), `Loader2` (lucide-react), `CreditCard` (lucide-react)

### Props

- **`ChannelPaymentModal`**: `isOpen: boolean`, `onClose: () => void`, `channel: Channel`, `storeId: string`, `customerData: { customerId?: string; customerName: string; customerEm…`, `onSuccess: () => void`

**Hooks used:** `useState`×6

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChannelPaymentModal` | component | `ChannelPaymentModal({ isOpen, onClose, channel, storeId, customerData, onSucces…)` | 73 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST ${CUSTOMER_APP_URL}/api/razorpay/create-subscription` (L288)
  - `POST ${CUSTOMER_APP_URL}/api/razorpay/create-channel-order` (L329)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_CUSTOMER_APP_URL`, `NEXT_PUBLIC_EXTERNAL_API_KEY`
- **Timers / queues:** `setTimeout` at L118
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
  - `lib/razorpayPrefill.ts` — `getRazorpayContactForCurrentUser`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `X`, `Loader2`, `CreditCard`, `Rss`, `Tag`, `ArrowLeft`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L426).

# `components/dashboard/PaymentMethodsPanel.tsx`

> Shared saved-cards panel — used inside the Vault page's "Payment Methods" tab AND on the standalone /settings/payment-methods page.

**Kind:** React component · **Lines:** 644 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared saved-cards panel — used inside the Vault page's "Payment
Methods" tab AND on the standalone /settings/payment-methods page.
Contains: Stripe card list (add via SetupIntent), Razorpay INR token
list (add via ₹1 auth + auto-refund), set-default / remove, and the
add-card dialog with Stripe Elements. All logic and layout was moved
verbatim from the settings page so both surfaces share behavior.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×7 (components/ui/button.tsx), `CreditCard`×5 (lucide-react), `Loader2`×5 (lucide-react), `Plus`×2 (lucide-react), `Star`×2 (lucide-react), `Trash2`×2 (lucide-react), `Smartphone` (lucide-react), `ShieldCheck` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Elements` (@stripe/react-stripe-js), `SetupIntentForm` (local), `PaymentElement` (@stripe/react-stripe-js), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`PaymentMethodsPanel`**: `showHeader?: boolean`

**Hooks used:** `useState`×9, `useCallback`, `useEffect`, `useStripe` (@stripe/react-stripe-js), `useElements` (@stripe/react-stripe-js)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PaymentMethodsPanel` | component | `PaymentMethodsPanel({ showHeader = true, }: { showHeader?: boolean; })` — `showHeader` toggles the "Payment Methods" title + subhead. | 85 |

## Interfaces

- **Timers / queues:** `setTimeout` at L64, L641
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `lib/payment-methods-api.ts` — `createRazorpaySaveCardOrder`, `createStripeSetupIntent`, `deleteRazorpayToken`, `deleteStripePaymentMethod`, `listPaymentMethods`, `setRazorpayDefaultToken`, `setStripeDefaultPaymentMethod`, `SavedRazorpayToken`, … +1
  - `lib/brand-color-context.tsx` — `getBrandHex`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `CreditCard`, `Loader2`, `Plus`, `ShieldCheck`, `Star`, `Trash2`, …
  - `sonner` — `toast`
  - `@stripe/stripe-js` — `loadStripe`, `Stripe`
  - `@stripe/react-stripe-js` — `Elements`, `PaymentElement`, `useElements`, `useStripe`

## Used by

- `app/(dashboard)/settings/payment-methods/page.tsx`
- `components/dashboard/WalletPageNew.tsx`

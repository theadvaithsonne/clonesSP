# `components/dashboard/WhitelabelPurchaseDialog.tsx`

> Purchase dialog for the whitelabel add-on.

**Kind:** React component · **Lines:** 148 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Purchase dialog for the whitelabel add-on. Mints an invoice on the
BE and hands the founder off to the standard invoice-pay page
(opened in a new tab) — same "external hosted checkout" pattern the
office subscription flow uses. No saved-card picker: the founder
picks whatever payment method they want (Razorpay, Stripe, crypto,
wallet) on the invoice pay page.

On payment, `fulfillInvoice`'s `whitelabel_addon` switch case
activates the add-on and pays 50% of the base to the direct
referrer. Nothing here needs to poll for status — the parent's
`onSuccess` re-fetches on close, and if the founder finishes payment
after closing, the next status refresh (or page reload) picks it up.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `ShieldCheck` (lucide-react), `Loader2` (lucide-react), `ExternalLink` (lucide-react)

### Props

- **`WhitelabelPurchaseDialog`**: `price: WhitelabelPriceResponse`, `onClose: () => void`, `onSuccess: () => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WhitelabelPurchaseDialog` | component | `WhitelabelPurchaseDialog({ price, onClose, onSuccess, }: Props)` | 45 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `lib/whitelabel-addon-api.ts` — `purchaseWhitelabelAddon`, `WhitelabelPriceResponse`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ExternalLink`, `Loader2`, `ShieldCheck`
  - `sonner` — `toast`

## Used by

- `components/dashboard/WhitelabelPage.tsx`

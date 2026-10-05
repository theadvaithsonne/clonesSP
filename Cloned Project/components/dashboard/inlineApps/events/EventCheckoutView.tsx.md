# `components/dashboard/inlineApps/events/EventCheckoutView.tsx`

> Buying tickets inside Garage: Tickets → Details → Payment, then the passes.

**Kind:** React component · **Lines:** 1446 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Buying tickets inside Garage: Tickets → Details → Payment, then the passes.

Same API as the public checkout page (/events/[slug]/checkout) — quote,
register for free orders, checkout + Garage Pay for paid ones — laid out for
the dashboard instead of the public site. The buyer never leaves the app:
payment runs through Garage Pay's own payment step inline, and the passes
show on this page the moment the order settles.

Billing is separate from the attendees, so a buyer can book for other people
without attending. The billing email is the signed-in account's: the paid
checkout bills whichever account owns that email, and that account is the
one whose Purchases list the order appears in.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Labeled`×5 (local), `Loader2`×4 (lucide-react), `Check`×4 (lucide-react), `SummaryLine`×4 (local), `EmptyPanel`×3 (components/dashboard/inlineApps/events/browse-ui.tsx), `ArrowLeft`×2 (lucide-react), `EventBar`×2 (components/dashboard/inlineApps/events/browse-ui.tsx), `PrimaryButton`×2 (local), `CheckBox`×2 (local), `ChevronDown`×2 (lucide-react), `ShieldCheck`×2 (lucide-react), `PassCard` (components/dashboard/inlineApps/events/EventPasses.tsx), `Stepper` (local), `TierRow` (local), `PromoResult` (local), `SwitchControl` (components/dashboard/inlineApps/events/ui.tsx), `ChevronRight` (lucide-react), `Field` (local), `Lock` (lucide-react), `CheckoutPaymentStep` (components/checkout/CheckoutPaymentStep.tsx), `React` (react), `Minus` (lucide-react), `Plus` (lucide-react)

### Props

- **`EventCheckoutView`**: `slug: string`, `initial?: PublicEventPayload | null`, `initialTierId?: string`, `onBack: () => void`, `onDone: () => void`, `onOpenPurchases?: () => void`

**Hooks used:** `useState`×19, `useEffect`×9, `useMemo`×9, `useRef`×4, `useCallback`×3, `useAuthStore` (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (EventCheckoutView)` | component | `EventCheckoutView({ slug, initial, initialTierId, onBack, onDone, onOpenPurch…)` | 108 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/auth/me` (L146)
- **Next.js API routes called (same origin):**
  - `POST /api/invoices/${checkoutRef.invoiceId}/cancel` (L531)
- **Timers / queues:** `setTimeout` at L574

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/utils.ts` — `cn`
  - `store/authStore.tsx` — `useAuthStore`
  - `components/checkout/CheckoutPaymentStep.tsx` — `CheckoutPaymentStep`
  - `components/events/checkout/FormFields.tsx` — `ATTENDEE_KEYS`, `CONSENT_TYPES`, `NAME_PART`, `fieldSpansRow`, `joinName`, `NameParts`
  - `components/dashboard/inlineApps/events/api.ts` — `getPublicEvent`, `getTicket`, `quoteTickets`, `registerFree`, `startCheckout`, `AttendeeInput`, `PublicEventPayload`, `PublicTierPayload`, … +1
  - `components/dashboard/inlineApps/events/types.ts` — `EventFormField`, `(types only)`
  - `components/dashboard/inlineApps/events/ui.tsx` — `SwitchControl`
  - `components/dashboard/inlineApps/events/browse-format.ts` — `dateRange`, `locationLabel`, `money`
  - `components/dashboard/inlineApps/events/browse-ui.tsx` — `EmptyPanel`, `EventBar`, `OUTLINE_BUTTON`, `PAGE`
  - `components/dashboard/inlineApps/events/EventPasses.tsx` — `PassCard`, `fetchPasses`, `Pass`
  - `components/dashboard/inlineApps/events/pass-store.ts` — `saveStoredOrder`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `ArrowLeft`, `Check`, `ChevronDown`, `ChevronRight`, `Loader2`, `Lock`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/events/EventFlowView.tsx`

# `app/events/[id]/checkout/CheckoutClient.tsx`

> The attendee checkout, as a page rather than a drawer.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1572 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The attendee checkout, as a page rather than a drawer.

Three steps on one route — tickets → details → payment — with the order
summary pinned alongside the whole way. Free and approval-gated tiers finish
at the end of step two and go straight to the confirmation page.

Paid tiers hand off to Garage Pay. The invoice is minted on "Proceed to
pay", opened in an overlay (`/invoice/:number?embed=1`, the same surface
every other paid checkout in the app uses), and when that surface posts
`invoice:paid` back we close it, confirm the ticket flipped to paid, and
send the buyer to the confirmation page. The buyer never leaves this route.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×4 (lucide-react), `SummaryRow`×4 (components/events/checkout/ui.tsx), `CheckoutShell`×3 (components/events/checkout/ui.tsx), `PrimaryButton`×3 (local), `Detail`×3 (local), `Badge`×2 (local), `QtyStepper`×2 (local), `FormFieldInput`×2 (components/events/checkout/FormFields.tsx), `StepButton`×2 (local), `OrderSummary` (local), `Stepper` (components/events/checkout/ui.tsx), `TicketStep` (local), `DetailsStep` (local), `PaymentStep` (local), `PayOverlay` (local), `ConfirmingDialog` (local), `CheckoutIdentity` (components/events/checkout/CheckoutIdentity.tsx), `ShieldCheck` (lucide-react), `ArrowLeft` (lucide-react), `Lock` (lucide-react), `Minus` (lucide-react), `Plus` (lucide-react)

### Props

- **`CheckoutClient`**: `slug: string`, `initialTierId?: string`, `initialRef?: string`

**Hooks used:** `useState`×17, `useEffect`×6, `useMemo`×6, `useCallback`×4, `useRouter` (next/navigation), `useAuthStore` (store/authStore.tsx), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CheckoutClient)` | component | `CheckoutClient({ slug, initialTierId, initialRef, }: { slug: string; initi…)` | 87 |

## Interfaces

- **Timers / queues:** `setTimeout` at L541

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/api.ts` — `getPublicEvent`, `getTicket`, `quoteTickets`, `registerFree`, `startCheckout`, `AttendeeInput`, `PublicEventPayload`, `PublicTierPayload`, … +1
  - `components/events/checkout/ui.tsx` — `C`, `CheckoutShell`, `DEFAULT_ACCENT`, `Stepper`, `SummaryRow`, `eventDateRange`, `eventLocation`, `money`
  - `components/events/checkout/FormFields.tsx` — `ATTENDEE_KEYS`, `CONSENT_TYPES`, `FormFieldInput`, `NAME_PART`, `fieldSpansRow`, `joinName`, `NameParts`
  - `components/events/checkout/orderCache.ts` — `saveOrder`
  - `components/events/checkout/CheckoutIdentity.tsx` — `CheckoutIdentity (default)`
  - `store/authStore.tsx` — `useAuthStore`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `Minus`, `Plus`, `ShieldCheck`, `Lock`, `ArrowLeft`

## Used by

- `app/events/[id]/checkout/page.tsx`

## Notes

- Large file (1572 lines) — read it by section; line numbers above point into it.

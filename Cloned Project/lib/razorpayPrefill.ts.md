# `lib/razorpayPrefill.ts`

> Helpers for prefilling the Razorpay Standard Checkout `prefill` block — specifically the `contact` (phone) field which the JWT doesn't carry.

**Kind:** frontend library · **Lines:** 143

<!-- docgen:auto -->

## Purpose
Helpers for prefilling the Razorpay Standard Checkout `prefill` block —
specifically the `contact` (phone) field which the JWT doesn't carry.

Razorpay's checkout SDK accepts `prefill: { name, email, contact }` on
every popup invocation. Without it, the user gets an extra "Contact
details" step on every payment. Razorpay accepts contact either as
`"+{country}{number}"` or as bare digits (defaults to +91). See:
https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/

NOTE: Razorpay's HOSTED subscription page (the `short_url` returned by
the Subscriptions API) does NOT support prefill — Razorpay documents
this as a government-guidelines limitation. This helper only affects
in-page SDK invocations.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `formatRazorpayContact` | function | `formatRazorpayContact(raw: string \| null \| undefined): string \| undefined` — Normalize a phone number into Razorpay's expected `+{country}{digits}` format. | 40 |
| `getRazorpayContactForCurrentUser` | function | `async getRazorpayContactForCurrentUser(): Promise<string \| undefined>` — Get the authenticated user's phone for Razorpay prefill. | 67 |
| `resetRazorpayContactCache` | function | `resetRazorpayContactCache(): void` — Imperatively reset the cache — call after the user updates their phone in profile settings so the next Razorpay popup picks up the new number. | 129 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/profile?userId=${user.userId}` (L98)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`
- **Packages:** none

## Used by

- `components/checkout/CheckoutPaymentStep.tsx`
- `components/dashboard/ChannelPaymentModal.tsx`
- `components/dashboard/ChannelPaymentModalNew.tsx`
- `components/dashboard/OpenClawAgentTabs.tsx`
- `components/dashboard/OpenClawBillingPage.tsx`
- `components/dashboard/ServicesPage.tsx`
- `components/dashboard/SubscriptionPaymentModal.tsx`
- `components/dashboard/TopUpStoreWalletSheet.tsx`
- `components/dashboard/WalletPageNew.tsx`
- `components/dashboard/WorkshopsPage.tsx`

# `server/services/paymentGating.ts`

> Shared predicate for "how do we charge a saved Stripe card off-session?"

**Kind:** backend service · **Lines:** 78

<!-- docgen:auto -->

## Purpose
Shared predicate for "how do we charge a saved Stripe card off-session?"

Two call sites today:
  - services/invoice.ts saved-card branch (a buyer clicked "Pay with
    saved card" during checkout).
  - routes/garageAdminSavedCards.ts (an admin triggered a one-time
    charge on behalf of the user).

Rules (mirror of what /billing docs say about RBI e-mandates):

  USD (or any non-INR) → off_session works out of the box. Foreign
    issuer or presentment-conversion path; no mandate needed.

  INR + Indian issuer WITHOUT mandate (or over cap) → CIT: OTP is
    required for every charge. Caller must set off_session:false and
    hand the returned clientSecret to the buyer for a 3DS challenge. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SavedCardChargeMode` | interface |  | 25 |
| `resolveSavedCardChargeMode` | function | `resolveSavedCardChargeMode(opts: { card: { country?: string \| null; mandateId?: string…): SavedCardChargeMode` — Given a saved card row + the invoice's amount/currency, decide how the off-session Stripe call should be shaped. | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/garageAdminSavedCards.ts`
- `server/services/invoice.ts`

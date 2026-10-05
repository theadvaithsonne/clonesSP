# `server/services/autoDebitInstrument.ts`

> Will anything actually auto-charge this buyer at their next cycle?

**Kind:** backend service · **Lines:** 33

<!-- docgen:auto -->

## Purpose
Will anything actually auto-charge this buyer at their next cycle?

Extracted from routes/garageAdminNetworkChainSubs.ts so the NetworkChain Subs
admin page and the "$25 + NetworkChain + autodebit" admin notification share
ONE definition. Two copies would drift, and then the page would say
"Auto-debit ON" for a buyer the notification says has none.

Auto-debit is on only when there is a usable stored instrument — an active,
unexpired UPI mandate, or a saved card with a Stripe customer. Coverage
alone is not enough: a buyer who paid once by card without saving it has
active coverage and no way to be charged again.

The UPI predicate matches services/invoice.ts's renewal check exactly,
expiry included: a mandate past `mandateExpiresAt` cannot be debited.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `autoDebitInstrument` | function | `autoDebitInstrument(buyer: any): "upi" \| "card" \| null` — Will anything actually auto-charge this buyer at their next cycle? | 17 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/garageAdminNetworkChainSubs.ts`
- `server/services/adminNotifications/paymentEvents.ts`

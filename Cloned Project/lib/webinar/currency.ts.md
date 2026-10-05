# `lib/webinar/currency.ts`

> Display-only FX rate for the webinar buy-flow toggles.

**Kind:** frontend library · **Lines:** 49

<!-- docgen:auto -->

## Purpose
Display-only FX rate for the webinar buy-flow toggles. The catalog
stores each item's native currency; this lets buyers (and the host
picker) eyeball USD/INR without re-pricing on the backend. The
invoice endpoint receives the chosen `displayCurrency` and does the
canonical conversion server-side — this constant is purely for the
preview number. Update when the rate drifts materially or wire to
a live feed if precision matters.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `USD_TO_INR` | const | `= 88` | 8 |
| `DisplayCurrency` | type |  | 10 |
| `CURRENCY_SYMBOL` | const | `= { USD: "$", INR: "₹", }` | 12 |
| `convertPrice` | function | `convertPrice(price: number, from: string \| undefined, to: DisplayCurrency): number` | 17 |
| `formatPrice` | function | `formatPrice(price: number): string` | 29 |
| `formatMoney` | function | `formatMoney(amount: number, currency?: string): string` — Money with its own symbol attached, for surfaces that render a currency the viewer didn't choose — an auction lot is priced in the seller's currency and bid in that same currency, so there is no display toggle to honour here. | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/webinar/BidsPanel.tsx`
- `components/webinar/LiveAuctionCard.tsx`
- `components/webinar/PinnedProductCard.tsx`
- `components/webinar/ProductPickerDialog.tsx`
- `components/webinar/StoreCheckoutDialog.tsx`

# `server/services/__tests__/counterBill.pricing.test.ts`

> Counter-bill pricing — the figures a seller shows a customer before they pay.

**Kind:** test · **Lines:** 238

<!-- docgen:auto -->

## Purpose
Counter-bill pricing — the figures a seller shows a customer before they pay.

These go straight onto an invoice someone pays, so the rules are asserted
rather than reasoned about: add-ons are priced from the product (never the
client), service charge is a share of the repriced items, charges are never
discounted or taxed, and an amount-only bill is exactly the typed amount.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (8)

- **counter bill pricing**
  - prices add-ons from the product and folds them into the unit price
  - ignores the client's add-on price and rejects add-ons the product doesn't offer
  - adds service charge on the items and packaging, untaxed, and reads the summary back
  - bills an amount-only bill for exactly the typed amount
  - refuses custom lines on a non-INR cart
  - keeps a plain line and an add-on line of the same product apart
- **attach codes**
  - are 7 unambiguous characters and survive a round trip
  - reject anything that isn't one

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/ecommerceInvoice.ts` — `createEcommerceInvoice`, `EcommerceError`
  - `server/services/counterBill.ts` — `makeAttachCode`, `normaliseAttachCode`, `toInvoiceInputs`, `totalsFromInvoice`
- **Packages:**
  - `mongoose` — `Types`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).

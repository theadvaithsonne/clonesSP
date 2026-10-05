# `server/services/comboWindow.ts`

> src/services/comboWindow.ts

**Kind:** backend service · **Lines:** 156

<!-- docgen:auto -->

## Purpose
src/services/comboWindow.ts

The 24-hour window in which the free-first-month offer is available.

A user has 24 hours from FIRST completing their profile to buy the $25
Unilevel Plus licence and get their first NetworkChain month free. After
that the offer is gone: they pay $25 + $36 (or $25 + a term price) with no
free month, and coverage starts immediately.

This is a pricing-eligibility rule, NOT a trial. Nothing is locked, revoked
or gated by the window — a user who lets it lapse simply has no NetworkChain
subscription until they buy one at full price.

Deliberately a leaf module: it imports nothing but types. The billing side of
this codebase already has a circular-import problem (thirdPartyTerms →
thirdPartyInvoice → invoice → razorpay), and this predicate is called from […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `COMBO_WINDOW_HOURS` | const | `= 24` — Window length in hours. | 25 |
| `ComboWindow` | interface |  | 27 |
| `comboWindowFor` | function | `comboWindowFor(user: \| { profileCompletedAt?: Date \| string \| null; offerE…, now: Date = new Date()): ComboWindow` — Resolve the offer window for a user. | 64 |
| `ComboWindowStatus` | type |  | 130 |
| `comboWindowStatus` | function | `comboWindowStatus(window: ComboWindow, opts: { upPurchasedAt?: Date \| string \| null } = {}): ComboWindowStatus` — The four-state status of a user's offer window, computed from an already- resolved ComboWindow plus (optionally) when the user activated Unilevel Plus. | 142 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/controllers/downlineOffer.controller.ts`
- `server/controllers/garageAdmin.controller.ts`
- `server/routes/downlineTable.ts`
- `server/routes/platformOffices.ts`
- `server/routes/unilevel-plus.ts`
- `server/scripts/backfill-combo-free-month.ts`
- `server/services/comboCheckout.ts`
- `server/services/invoice.ts`
- `server/services/magicLinkReminders.ts`
- `server/services/upiAutopay.ts`

# `components/events/checkout/orderCache.ts`

> What the buyer was charged, carried from the checkout page to the confirmation page.

**Kind:** React component · **Lines:** 58 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
What the buyer was charged, carried from the checkout page to the
confirmation page.

The public ticket endpoint returns the ticket and the event, not the order:
it has no line items, no promo, no tax and no invoice number. Rather than
widen a public endpoint to expose pricing to anyone holding a QR token, the
checkout writes its own summary to sessionStorage and the confirmation page
reads it back. Same tab, same buyer, gone when the tab closes.

Treat it as decoration, never as truth: a buyer who opens the ticket link on
another device gets no cache, and the confirmation page must still render.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CachedOrderLine` | interface |  | 15 |
| `CachedOrder` | interface |  | 20 |
| `saveOrder` | function | `saveOrder(token: string, order: CachedOrder)` | 42 |
| `loadOrder` | function | `loadOrder(token: string): CachedOrder \| null` | 50 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/events/[id]/checkout/CheckoutClient.tsx`
- `app/events/[id]/registered/[token]/ConfirmationClient.tsx`

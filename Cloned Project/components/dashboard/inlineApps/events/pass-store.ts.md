# `components/dashboard/inlineApps/events/pass-store.ts`

> Passes this browser checked out, kept so Purchases can always show them.

**Kind:** React component · **Lines:** 48

<!-- docgen:auto -->

## Purpose
Passes this browser checked out, kept so Purchases can always show them.

Purchases reads paid orders from the invoice feed and resolves their passes
through the public ticket lookup, which matches an invoice number against an
ATTENDEE's email. A buyer who booked only for other people is on no seat, so
that lookup can't find their order; and a free registration raises no
invoice at all. The in-app checkout records every order it completes here,
and Purchases falls back to it for exactly those two cases.

Only QR tokens and labels are stored — the same credential the ticket link
already carries — scoped per signed-in user.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StoredPass` | interface |  | 13 |
| `StoredOrder` | interface |  | 19 |
| `loadStoredOrders` | function | `loadStoredOrders(userId: string): StoredOrder[]` | 31 |
| `saveStoredOrder` | function | `saveStoredOrder(userId: string, order: StoredOrder)` | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`

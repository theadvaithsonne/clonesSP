# `lib/whitelabel-checkout.ts`

> Small shared helper for the whitelabel add-on flow.

**Kind:** frontend library · **Lines:** 20

<!-- docgen:auto -->

## Purpose
Small shared helper for the whitelabel add-on flow.

The purchase itself moved to the hosted invoice pay page (see
WhitelabelPurchaseDialog), so nothing here charges a card — this only
opens an invoice.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `openWhitelabelInvoice` | function | `openWhitelabelInvoice(invoiceNumberOrId?: string)` — Open a whitelabel invoice in a new tab. | 16 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).

# `server/services/invoicePayable.ts`

> Module exporting `checkInvoicePayable`, `refuseIfNotPayable`.

**Kind:** backend service · **Lines:** 150

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UnpayableReason` | type |  | 33 |
| `PayabilityResult` | interface |  | 40 |
| `checkInvoicePayable` | function | `checkInvoicePayable(invoice: { status?: string; expiresAt?: Date \| string \| nul…, now: Date = new Date()): PayabilityResult` | 49 |
| `refuseIfNotPayable` | function | `async refuseIfNotPayable(invoice: any, now: Date = new Date()): Promise<{ success: false; error: string; code: Un…` — Refuses payment on a stale invoice and lazily corrects its status. | 122 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/bat246/services/bat246Layaway.service.ts`
- `server/routes/invoice.ts`

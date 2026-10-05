# `server/services/invoiceEmail.ts`

> Module exporting `buildInvoiceEmail`, `sendInvoiceEmail`, `queueInvoiceEmail`.

**Kind:** backend service · **Lines:** 486

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `buildInvoiceEmail` | function | `buildInvoiceEmail(invoice: any, orgName: string): { subject: string; html: string; text: string }` | 223 |
| `sendInvoiceEmail` | function | `async sendInvoiceEmail(invoiceOrId: any): Promise<boolean>` — Sends the invoice email once per invoice. | 400 |
| `queueInvoiceEmail` | function | `queueInvoiceEmail(invoiceOrId: any): void` — Fire-and-forget wrapper for fulfilment paths: a mail failure must never fail the purchase it is documenting. | 481 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`
- **External hosts mentioned in the code:** `bscscan.com`, `polygonscan.com`, `etherscan.io`, `mempool.space`, `tronscan.org`

## Dependencies

- **Internal:**
  - `server/services/mailer.ts` — `sendMail`, `senderForOrg`, `EMAIL_FROM_NOTIFICATION`
  - `server/services/bulkEmail.ts` — `emailShell`, `ctaButton`, `fallbackLink`, `greeting`, `bodyText`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/services/freeInvoice.ts`
- `server/services/invoice.ts`

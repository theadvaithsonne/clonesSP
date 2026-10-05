# `server/services/orderEmail.ts`

> Module exporting `renderMergeTags`, `sendOrderEmail`, `queueOrderEmail`.

**Kind:** backend service · **Lines:** 394

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OrderEmailItemType` | type | Sellable items that can carry an `emailAlerts` config. | 16 |
| `renderMergeTags` | function | `renderMergeTags(template: string, vars: Record<string, string>): string` — Naive `{{key}}` substitution, mirroring `affiliateEmailTemplates.render`. | 26 |
| `SendOrderEmailParams` | interface |  | 249 |
| `sendOrderEmail` | function | `async sendOrderEmail({ invoice, itemType, itemId, order, quantity, }: SendOrderE…): Promise<void>` — Sends the order confirmation if the seller opted in. | 266 |
| `queueOrderEmail` | function | `queueOrderEmail(params: SendOrderEmailParams): void` — Fire-and-forget wrapper for fulfilment paths: a mail failure must never fail the purchase it is confirming. | 386 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/services/mailer.ts` — `EMAIL_FROM_NOTIFICATION`, `sendMail`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/courseCheckout.ts`
- `server/routes/productCheckout.ts`
- `server/services/freeInvoice.ts`
- `server/services/invoice.ts`

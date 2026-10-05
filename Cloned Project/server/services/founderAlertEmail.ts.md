# `server/services/founderAlertEmail.ts`

> src/services/founderAlertEmail.ts

**Kind:** backend service · **Lines:** 550

<!-- docgen:auto -->

## Purpose
src/services/founderAlertEmail.ts

"Someone joined" alerts for the person who owns the thing.

The seller-side twin of services/orderEmail.ts. That module mails the BUYER
a branded confirmation off a Network Mail template; this one mails the
FOUNDER a plain notice with who joined and what they joined, gated on the
per-item `founderAlerts.enabled` toggle set in the item's form.

Two properties make it safe to call from every acquisition path:
  - it no-ops unless the founder turned the toggle on for THAT item, so
    adding a call site can never start spamming an org that didn't ask;
  - when an invoice backs the acquisition, the send is claimed atomically on
    it, so the repeated `fulfillInvoice` calls a webhook/browser race
    produces still yield exactly one email.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderAlertItemType` | type | Sellable items that can carry a `founderAlerts` config. | 28 |
| `SendFounderAlertParams` | interface |  | 311 |
| `sendFounderAlert` | function | `async sendFounderAlert({ itemType, itemId, invoice, joiner, amount, currency, }: S…): Promise<void>` — Sends the "someone joined" alert if the founder opted in for this item. | 335 |
| `queueFounderAlert` | function | `queueFounderAlert(params: SendFounderAlertParams): void` — Fire-and-forget wrapper for fulfilment paths: a mail failure must never fail the join it is announcing. | 470 |
| `sendFounderAlertForInvoice` | function | `async sendFounderAlertForInvoice(invoice: any): Promise<void>` — Single entry point for the paid path: works out what was bought from the invoice and fires the alert if the owner opted in. | 503 |
| `queueFounderAlertForInvoice` | function | `queueFounderAlertForInvoice(invoice: any): void` — Fire-and-forget wrapper for `sendFounderAlertForInvoice`. | 545 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/services/mailer.ts` — `EMAIL_FROM_NOTIFICATION`, `sendMail`, `senderForOrg`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/publicEventManagement.ts`
- `server/services/freeInvoice.ts`
- `server/services/invoice.ts`

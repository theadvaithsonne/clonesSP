# `server/services/thirdPartyWebhook.ts`

> Module exporting `signWebhookPayload`, `deliverInvoiceWebhook`.

**Kind:** backend service · **Lines:** 205

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WebhookEvent` | type |  | 7 |
| `signWebhookPayload` | function | `signWebhookPayload(secret: string, timestamp: string, body: string): string` | 33 |
| `deliverInvoiceWebhook` | function | `async deliverInvoiceWebhook(invoice: any, client: IThirdPartyClient, event: WebhookEvent): Promise<void>` — Deliver a webhook to the third-party client. | 49 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — **writes:** `updateOne`
- **Timers / queues:** `setTimeout` at L192

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/thirdPartyClient.model.ts` — `IThirdPartyClient`
  - `server/utils/dateMath.ts` — `addMonthsClamped`
- **Packages:**
  - `crypto`
  - `axios`

## Used by

- `server/scripts/fix-hiren-nc-webhook-identity.ts`
- `server/scripts/redeliver-thirdparty-webhook.ts`
- `server/services/invoice.ts`
- `server/services/thirdPartyInvoice.ts`

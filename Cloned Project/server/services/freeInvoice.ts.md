# `server/services/freeInvoice.ts`

> Zero-value invoices for FREE grants of sellable items.

**Kind:** backend service · **Lines:** 309

<!-- docgen:auto -->

## Purpose
Zero-value invoices for FREE grants of sellable items.

A free purchase is supposed to leave the same paper trail a paid one does —
so free customers show up in member lists, "customers" analytics and exports
alongside paying ones. Historically the mint was written inline in each
`/checkout/*` route, which meant every OTHER way into the same service
function granted access silently: ~94% of free workshop registrations in
production have no invoice.

The fix is this helper plus calls from the SERVICE-level chokepoints
(registerForFreeWorkshop, enrollInCourse, addUserToChannel, …) rather than
from routes, so a future caller cannot bypass it by construction.

Generalised from the proven `mintFreeChannelJoinInvoice` in ./channel.ts,
keeping its four properties exactly:
  - idempotent per (userId, itemType, itemId, metadataType[, dedupeKey]) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FreeItemType` | type | Sellable item types that can be granted for free. | 26 |
| `FreeInvoiceSource` | type | Which entry point granted this. | 39 |
| `MintFreeItemInvoiceOptions` | interface |  | 48 |
| `mintFreeItemInvoiceInBackground` | function | `mintFreeItemInvoiceInBackground(opts: MintFreeItemInvoiceOptions): void` — Fire-and-forget wrapper. | 153 |
| `MintFreeItemInvoiceResult` | interface | What the mint did — lets callers act only on a genuinely new invoice. | 162 |
| `mintFreeItemInvoice` | function | `mintFreeItemInvoice(opts: MintFreeItemInvoiceOptions): Promise<MintFreeItemInvoiceResult>` — Mint a `$0 paid` invoice for a free grant. | 179 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/services/invoice.ts` — `createInvoice`
- **Packages:** none

## Used by

- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/scripts/backfill-channel-members.ts`
- `server/services/call.ts`
- `server/services/channel.ts`
- `server/services/course.ts`
- `server/services/feed.ts`
- `server/services/product.ts`
- `server/services/workshop.ts`

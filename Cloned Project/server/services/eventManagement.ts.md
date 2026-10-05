# `server/services/eventManagement.ts`

> src/services/eventManagement.ts

**Kind:** backend service · **Lines:** 739

<!-- docgen:auto -->

## Purpose
src/services/eventManagement.ts

Shared logic for the Event Management module. Both the founder router
(/event-management) and the public router (/public/event-management) import
from here so the two can never drift on inventory, slugs or block defaults.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `canManageEvents` | function | `async canManageEvents(userId: string, orgId: string): Promise<boolean>` — Events ride the existing "live_streams" RBAC module rather than adding a new one — an org member trusted to run webinars is the same person trusted to run the conference. | 28 |
| `slugify` | function | `slugify(input: string): string` | 37 |
| `generateUniqueSlug` | function | `async generateUniqueSlug(name: string, excludeId?: string): Promise<string>` — A slug free at the moment of the call. | 52 |
| `newQrCodeToken` | function | `newQrCodeToken(): string` — The QR payload. Unguessable by construction: it is NOT derived from the registration id, because /public/event-management/ticket/:token resolves it without any auth. | 75 |
| `claimTierSeats` | function | `async claimTierSeats(tierId: Types.ObjectId \| string, qty: number): Promise<boolean>` — Reserve `qty` seats on a tier, atomically. | 88 |
| `releaseTierSeats` | function | `async releaseTierSeats(tierId: Types.ObjectId \| string, qty: number): Promise<void>` — Give seats back after a failed checkout / cancelled registration. | 103 |
| `SEAT_HOLD_MINUTES` | const | `= 30` — How long a paid checkout may hold seats before they go back on sale. | 118 |
| `releaseExpiredHolds` | function | `async releaseExpiredHolds(eventId: Types.ObjectId \| string): Promise<number>` — Hands back seats held by checkouts that were never paid for. | 129 |
| `tierSalesStats` | function | `async tierSalesStats(eventId: Types.ObjectId \| string): Promise<Map<string, { sold: number; revenue: numb…` — Real sales per tier, keyed by tier id. | 216 |
| `tierSaleability` | function | `tierSaleability(tier: { isVisible?: boolean; isPaused?: boolean; archivedAt…, qty = 1, now = new Date()): { ok: boolean; reason?: string }` — Is this tier buyable right now? | 281 |
| `EventCouponResult` | interface |  | 308 |
| `resolveEventCoupon` | function | `async resolveEventCoupon(opts: { code?: string; eventId: Types.ObjectId \| string; or…): Promise<EventCouponResult>` — Validate a coupon against an event, using the SAME engine every other paid checkout uses (services/coupon.ts + utils/couponRouting.ts). | 330 |
| `EventMetrics` | interface |  | 377 |
| `computeEventMetrics` | function | `async computeEventMetrics(event: Pick<IEventProgram, "_id" \| "totalCapacity">): Promise<EventMetrics>` | 389 |
| `defaultWebsiteBlocks` | function | `defaultWebsiteBlocks(event: Pick< IEventProgram, \| "name" \| "shortDescription" \|…): IEventWebsiteBlock[]` — The starting canvas a founder sees the first time they open the builder. | 484 |
| `ensureWebsiteConfig` | function | `async ensureWebsiteConfig(event: IEventProgram)` — Fetch the config, creating it from defaults on first access. | 564 |
| `publishChecklist` | function | `async publishChecklist(event: IEventProgram)` — What is still missing before this event can go live. | 580 |
| `TICKET_ID_LENGTH` | const | `= 12` — How many characters of the QR token the attendee is asked to quote. | 643 |
| `ticketIdOf` | function | `ticketIdOf(qrCodeToken: string)` | 645 |
| `sendTicketEmail` | function | `async sendTicketEmail(event: any, registration: any, tier: any): Promise<void>` — "Here is your ticket" — the one email an attendee actually needs. | 661 |

## Interfaces

- **Database (Mongoose models used):**
  - `EventProgram` (server/models/eventProgram.model.ts) — reads: `exists`
  - `EventTicketTier` (server/models/eventTicketTier.model.ts) — reads: `aggregate`, `countDocuments`; **writes:** `updateOne`
  - `EventRegistration` (server/models/eventRegistration.model.ts) — reads: `find`, `aggregate`; **writes:** `updateOne`
  - `EventWebsiteConfig` (server/models/eventWebsiteConfig.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `APP_URL`, `RESEND_API_KEY`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `server/models/eventProgram.model.ts` — `EventProgram`, `IEventProgram`
  - `server/models/eventTicketTier.model.ts` — `EventTicketTier`
  - `server/models/eventRegistration.model.ts` — `EventRegistration`
  - `server/models/eventWebsiteConfig.model.ts` — `EventWebsiteConfig`, `IEventWebsiteBlock`, `EventBlockType`
  - `server/utils/rbac.ts` — `isFounderOrModuleAdmin`
- **Packages:**
  - `mongoose` — `Types`
  - `crypto`

## Used by

- `server/routes/eventManagement.ts`
- `server/routes/publicEventManagement.ts`
- `server/services/__tests__/eventHoldExpiry.test.ts`
- `server/services/invoice.ts`

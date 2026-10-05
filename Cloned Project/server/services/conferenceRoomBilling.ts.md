# `server/services/conferenceRoomBilling.ts`

> Conference-room billing helpers.

**Kind:** backend service · **Lines:** 568

<!-- docgen:auto -->

## Purpose
Conference-room billing helpers.

When a founder adds or cancels a conference room from the dashboard
(after their initial office checkout), two things have to happen in
concert:
  1. The recurring parent `Invoice` (itemType: "office_addon") has its
     quantity adjusted so the NEXT monthly cycle bills the correct
     number of rooms.
  2. For ADDS, a one-off prorated invoice is generated immediately for
     the remainder of the current cycle.
  3. For CANCELS, the room stays usable through the end of the cycle
     it was already paid for (no refund), and is deactivated lazily
     on the next listing call via `pruneExpiredRoomsForOrg`.

All math is in USD cents. We deliberately keep the parent invoice +
child cycles managed by the existing `generateDueRecurringInvoices` […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CONFERENCE_ROOM_PRICE_CENTS` | const | `= 500` | 31 |
| `findRoomsParentInvoice` | function | `async findRoomsParentInvoice(orgId: string): Promise<IInvoice \| null>` — Find the active parent recurring rooms invoice for an org, if any. | 44 |
| `bumpRoomsParentQuantity` | function | `async bumpRoomsParentQuantity(parent: IInvoice, delta: number): Promise<number>` — Bump (or decrement) the parent rooms invoice's line-item quantity by `delta`. | 159 |
| `generateProratedAddInvoice` | function | `async generateProratedAddInvoice(parent: IInvoice, founderUserId: string, roomsAdded: number): Promise<IInvoice>` — Generate a one-off prorated invoice for `roomsAdded` extra rooms covering the remainder of the parent's current cycle. | 229 |
| `applyAddRoomsBilling` | function | `async applyAddRoomsBilling(orgId: string, founderUserId: string, roomsAdded: number): Promise<{ parent: IInvoice; proratedInvoice: IInv…` — Find-or-create the parent rooms invoice, increment its quantity by N, and generate the prorated one-off invoice for the partial cycle. | 441 |
| `applyCancelRoomBilling` | function | `async applyCancelRoomBilling(orgId: string, roomId: string): Promise<{ activeUntil: Date \| null; parentCancell…` — Cancel a single room. | 498 |
| `pruneExpiredRoomsForOrg` | function | `async pruneExpiredRoomsForOrg(orgId: string): Promise<number>` — Lazy prune. Flips `isActive` to false on any room whose `scheduledDeactivationAt` has passed. | 556 |

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`, `find`; **writes:** `updateOne`, `updateMany`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `ConferenceRoom` (server/models/conferenceRoom.model.ts) — reads: `countDocuments`; **writes:** `updateOne`, `updateMany`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`, `IInvoice`
  - `server/models/conferenceRoom.model.ts` — `ConferenceRoom`
  - `server/models/user.model.ts` — `User`
  - `server/services/invoice.ts` — `createInvoice`, `getNextChargeDate`
  - `server/models/officePlan.model.ts` — `calculateTaxAmounts`, `GST_CONFIG`
  - `server/services/officeSubscription.ts` — `getOfficePlanBySlug`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/conferenceRoom.ts`

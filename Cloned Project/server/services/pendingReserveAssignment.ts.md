# `server/services/pendingReserveAssignment.ts`

> Module exporting `createPendingReserveAssignment`, `approvePendingReserveAssignment`, `rejectPendingReserveAssignment`, `cancelPendingReserveAssignment` and 2 more.

**Kind:** backend service · **Lines:** 553

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PendingReserveError` | class | `extends Error` — Paid reserve-assignment service. | 28 |
| `CreatePendingReserveInput` | interface |  | 45 |
| `createPendingReserveAssignment` | function | `async createPendingReserveAssignment(input: CreatePendingReserveInput): Promise<IPendingReserveAssignment>` | 55 |
| `approvePendingReserveAssignment` | function | `async approvePendingReserveAssignment(offerId: string, recipientId: string, sourceOrgId: string): Promise<IPendingReserveAssignment>` | 195 |
| `rejectPendingReserveAssignment` | function | `async rejectPendingReserveAssignment(offerId: string, recipientId: string): Promise<IPendingReserveAssignment>` | 415 |
| `cancelPendingReserveAssignment` | function | `async cancelPendingReserveAssignment(offerId: string, senderId: string): Promise<IPendingReserveAssignment>` | 422 |
| `listIncomingPendingReserves` | function | `async listIncomingPendingReserves(userId: string)` | 433 |
| `listOutgoingPendingReserves` | function | `async listOutgoingPendingReserves(userId: string)` | 444 |

## Interfaces

- **Database (Mongoose models used):**
  - `ItemReserveLicense` (server/models/itemReserveLicense.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `PendingReserveAssignment` (server/models/pendingReserveAssignment.model.ts) — reads: `findById`, `find`; **writes:** `create`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/pendingReserveAssignment.model.ts` — `PendingReserveAssignment`, `IPendingReserveAssignment`, `PendingReserveAssignmentStatus`
  - `server/models/itemReserveLicense.model.ts` — `ItemReserveLicense`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/user.model.ts` — `User`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/services/itemReserveLicense.ts` — `assignItemReserve`
  - `server/services/wallet.ts` — `transferStoreCreditsBetweenOrgs`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/itemReserves.ts`

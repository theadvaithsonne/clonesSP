# `server/models/franchiseReassignment.model.ts`

> Mongoose model for the durable ledger of franchise territory resales (buyer-to-buyer reassignments) in founder programmes.

**Kind:** Mongoose model · **Lines:** 109

## Purpose
A territory assignment's `pendingReassignment` sub-document only holds the current in-flight request and is cleared once the resale completes, so it cannot answer "show me every resale". This collection records each reassignment request as its own row so a founder can audit the chain of custody for a territory.

## How it works
Lifecycle (`status`, default `pending_approval`):

```
pending_approval -> approved -> completed
                 \-> rejected / cancelled
```

One row per request; a territory resold twice has two rows.

Fields:
- Scope: `programId` (ref `FranchiseProgram`), `officeId` (ref `Organization`), `assignmentId` (ref `FranchiseTerritoryAssignment`) - all required and indexed.
- Denormalised territory: `geoLevel`, `geoEntityId` (indexed), `geoEntityName`.
- Parties: `resellerUserId` / `resellerEmail` (the selling owner), `fromOwnerUserId` / `fromOwnerEmail` (owner at request time), `newOwnerUserId` / `newOwnerEmail`.
- `resalePriceUSD`.
- `invoiceId` - set at founder approval.
- `requestedAt` (required), `decidedAt` (approve/reject), `completedAt` (payment/transfer).

Indexes: `{ programId, createdAt: -1 }`, `{ programId, status, createdAt: -1 }` (programme history, optionally by status); `{ resellerUserId, createdAt: -1 }` and `{ newOwnerUserId, createdAt: -1 }` ("my resales" as seller or buyer); plus single-field indexes.

## Exports
- `FranchiseReassignment` - model `"FranchiseReassignment"`, collection `franchise_reassignments`.
- `IFranchiseReassignment` - document interface.
- `FranchiseReassignmentStatus` - status union.

## Interfaces
- **Database:** collection `franchise_reassignments` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/franchiseProgram.ts` (`/franchise-program`, browser `/backend/franchise-program`) and `server/services/invoice.ts` (marks a row `completed` when the resale invoice is paid).

## Notes
- `FranchiseGlobalAssignment` and `FranchiseTerritoryAssignment` both reference this model (`pendingReassignment.reassignmentId`, `acquiredReassignmentId`), but the required `programId`/`officeId` fields mean rows here are System B only.
- `geoLevel` is a free string here, unlike the enum on the assignment models.

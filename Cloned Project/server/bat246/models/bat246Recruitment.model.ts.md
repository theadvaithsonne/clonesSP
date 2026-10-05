# `server/bat246/models/bat246Recruitment.model.ts`

> Mongoose model for a BAT246 recruitment record, covering who recruited, who bought, who paid, and which payment scenario applied to an AT BAT entry.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 23

## Purpose
This model describes a board entry made through recruitment, where the recruiter, the buyer and the payer can be different players. It records the scenario and terms acceptance for that entry. No live service, route or controller writes or reads it today, so it is a reserved or legacy schema.

## How it works
Fields (`timestamps: true`):
- `boardId` (→ `bat246Boards`, required, indexed).
- `recruiterId`, `buyerId`, `payerId` (all → `bat246Players`, required).
- `scenario`: `"A" | "B" | "C" | "SelfEntry"`, required. The meaning of A, B and C is not defined in the code.
- `payerRelinquished` (Boolean, default `null`).
- `tncAcceptedAt` (Date): when the terms and conditions were accepted.
- `entryFeeAmount` (default 650).
- `atBatPosition` (String).

## Exports
- `Bat246Recruitment` - Mongoose model registered as `"bat246Recruitments"`.

## Interfaces
- **Database:** collection `bat246recruitments`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/scripts/backupAndWipeBat246.ts` only. That manual script backs up and wipes the BAT246 collections, including this one, against `MONGODB_URI` (the production database).

## Notes
- The running application does not use this model.

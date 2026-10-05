# `server/models/teamforce/teamforceBreakLog.model.ts`

> Mongoose model for one employee break, from start to stop, with how much of it fell inside or outside the daily break budget.

**Kind:** Mongoose model · **Lines:** 26

## Purpose
Employees clock in and out through the Betty attendance endpoints (`TimeTracking` sessions). While clocked in they can start and stop breaks, and each break is stored as one `TeamforceBreakLog`. The org's break policy (`TeamforceBreakSettings`) sets a daily budget in minutes. The log records how many seconds of each break were within that budget and how many were over it.

## How it works
Fields:
- `userId` (ref `User`), `orgId` (ref `Organization`): both required and indexed.
- `timeTrackingId` (ref `TimeTracking`): the clock-in session the break belongs to.
- `breakStartTime` (required), `breakStopTime`, `durationInSeconds`. An open break has `breakStopTime` unset or null.
- `withinBudgetSeconds`, `overBudgetSeconds` (both default 0).
- `isBreach`: true when any part of the break was over budget.
- `triggeredBreach`: true only on the break that first pushed the day over budget. Later breaches on the same day leave it false.
- `timestamps: true`.

Indexes: `{ userId, orgId }`, `{ timeTrackingId }`, plus the single-field indexes on `userId` and `orgId`.

Lifecycle (in `server/routes/betty.ts`):
- `POST /betty/break-start` needs an open `TimeTracking` session and an applicable activated break policy (`findApplicablePolicy` from `routes/teamforce/breakSettings.ts`). It refuses if a break is already open, then creates the log.
- `POST /betty/break-stop` closes the open log. It adds up today's closed breaks, then splits this break's duration into within-budget and over-budget seconds. If the policy budget is 0 or no policy applies, the whole break counts as within budget.
- `POST /betty/clock-out` automatically closes any open break. It sets only `breakStopTime` and `durationInSeconds`; the budget split is not computed.

## Exports
- `TeamforceBreakLog` - the Mongoose model `"TeamforceBreakLog"` (collection `teamforcebreaklogs`).

## Interfaces
- **Database:** `TeamforceBreakLog` (collection `teamforcebreaklogs`). Created and updated by the Betty break endpoints. Read by `GET /backend/betty/break-logs`, the team views in `betty.ts`, and `GET /backend/teamforce/break-settings/status` (today's usage).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
- `server/routes/betty.ts` (mounted at `/betty`).
- `server/routes/teamforce/breakSettings.ts` (mounted at `/teamforce/break-settings`).

## Notes
- A break that is auto-closed at clock-out keeps the default `withinBudgetSeconds`/`overBudgetSeconds` of 0 and `isBreach: false`, even if it ran past the budget.
- "Today" is the server's local midnight (`setHours(0,0,0,0)`), not the employee's time zone.

# `server/models/leaveRequest.model.ts`

> Mongoose model for a simple employee leave request (date range plus reason) handled by the Betty assistant routes.

**Kind:** Mongoose model · **Lines:** 20

## Purpose
Stores leave requests raised through Betty, the in-app assistant (`server/routes/betty.ts`). Users can file a request in chat or via the Betty endpoints, and approvers can approve or reject it. This is a separate, older model from the Teamforce HR module's `TeamforceLeaveRequest` (`server/models/teamforce/teamforceLeaveRequest.model.ts`).

## How it works
- Fields: `userId` (ref `User`, required, indexed), `orgId` (ref `Organization`, required, indexed), `startDate` and `endDate` (required), `reason` (required, trimmed, max 500), `status` (`pending` default | `approved` | `rejected`, indexed), `approverId` (ref `User`).
- Timestamps on.
- Compound indexes: `{ userId: 1, orgId: 1 }` (a user's requests in an org) and `{ orgId: 1, status: 1 }` (an org's pending queue).
- There is no validation that `endDate >= startDate`; callers must check.

## Exports
- `LeaveRequest` - Mongoose model `"LeaveRequest"`.

## Interfaces
- **Database:** `LeaveRequest` (collection `leaverequests`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/betty.ts` (mounted at `/betty`, browser `/backend/betty`) - creates, lists and approves/rejects requests (`LeaveRequest.create`, `find`, `findByIdAndUpdate`).

## Notes
- Betty also reads `TeamforceLeaveRequest` for approved leave, so the HR module and this model coexist. Do not assume one is the single source of truth for leave.

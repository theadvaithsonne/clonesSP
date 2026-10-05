# `server/models/teamforce/teamforceLeaveRequest.model.ts`

> Mongoose model for an employee's leave application: dates, type, reason, approval status, who decided it and how approval is routed.

**Kind:** Mongoose model · **Lines:** 67

## Purpose
Employees apply for leave through Teamforce. A designated approver approves or rejects the request, or the employee cancels it while it is pending. Approved leave matters in two other places:
- Betty clock-in refuses to start a session on a day with approved leave.
- The payroll attendance loader counts approved leave days as paid leave instead of loss of pay.

## How it works
Constants:
- `LEAVE_TYPES`: `Casual Leave`, `Sick Leave`, `Earned Leave`, `Official Duty`.
- `LEAVE_STATUSES`: `Pending`, `Approved`, `Rejected`, `Cancelled`.
- `APPROVER_SCOPES` (type `ApproverScope`):
  - `user`: only `assignedApproverUserId` may decide.
  - `admin_or_founder`: any Teamforce admin or founder.
  - `founder_only`: a founder only.

Fields:
- `userId`, `orgId` (required, indexed).
- `leaveType` (required enum), `startDate`, `endDate` (required), `isHalfDay`, `reason` (required), `attachmentUrl`.
- `status` (default `Pending`, indexed).
- Decision: `approverUserId`, `approverName`, `decisionNote`, `decidedAt`.
- Routing, fixed at submission time: `approverScope` (indexed) and `assignedApproverUserId` (indexed; meant only for scope `user`).
- `timestamps: true`.

Indexes: `{ orgId, status, createdAt: -1 }` for admin queues and `{ userId, orgId, createdAt: -1 }` for "my leaves".

Flow in `routes/teamforce/leaveRequests.ts`:
- **Submit:** start dates in the past are rejected. `computeLeaveRouting` gives founders `founder_only` and everyone else `admin_or_founder`.
- **Decide:** the assigned approver can always decide. Otherwise the decision follows the scope, and legacy rows with no scope can be decided by admins or founders. Approving a leave whose end date has already passed is blocked.
- **Cancel:** only the requester, and only while the request is pending.

## Exports
- `LEAVE_TYPES`, `LEAVE_STATUSES`, `APPROVER_SCOPES` - readonly tuples.
- `ApproverScope` - the type of a single scope value.
- `TeamforceLeaveRequest` - the Mongoose model `"TeamforceLeaveRequest"` (collection `teamforceleaverequests`).

## Interfaces
- **Database:** `TeamforceLeaveRequest` (collection `teamforceleaverequests`).
- **Endpoints served (through the router):**
  - `POST /backend/teamforce/leave-requests`
  - `GET .../leave-requests/mine`, `GET .../leave-requests`, `GET .../leave-requests/team`
  - `POST .../leave-requests/:id/approve`, `.../reject`, `.../cancel`

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
- `server/routes/teamforce/leaveRequests.ts` (mounted at `/teamforce/leave-requests`).
- `server/routes/betty.ts`: the clock-in guard against approved leave.
- `server/services/teamforce/payroll/attendanceLoader.ts`: reads approved leaves (`startDate`, `endDate`, `isHalfDay`) that overlap the payroll window.

## Notes
- The current submit code never sets the `user` scope or `assignedApproverUserId`, even though the model and the decide logic support them.
- Payroll ignores `leaveType`: every approved leave counts the same way. A half day weighs 0.5.
- Date comparisons use the server's local midnight.

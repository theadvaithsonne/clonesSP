# `server/models/teamforce/teamforceLeavePolicy.model.ts`

> Mongoose model for an organisation's leave policy: a named paid or unpaid leave type with an annual quota and carry-forward and encashment flags.

**Kind:** Mongoose model · **Lines:** 40

## Purpose
HR admins configure the leave types their organisation offers, such as "Privilege Leave" with 18 days a year. The policies are managed in Teamforce settings and listed to employees.

## How it works
- `LEAVE_POLICY_TYPES = ["Paid", "Unpaid"]`.
- `LEAVE_POLICY_APPLICABLE = ["All Employees", "Full-Time Only", "Contract Only"]`.
- Fields:
  - `orgId` (required, indexed), `name` (required)
  - `leaveType` (required, enum `LEAVE_POLICY_TYPES`)
  - `annualQuota`, `maxConsecutiveDays` (default 0)
  - `applicableFor` (default `"All Employees"`)
  - `allowCarryForward`, `allowEncashment`, `isActive` (default `true`)
- `timestamps: true`.
- Index: `{ orgId, isActive, name }`, which supports listing active policies sorted by name. Deletes are soft (`isActive: false`).

## Exports
- `LEAVE_POLICY_TYPES` - paid/unpaid tuple, used in the router's zod schema.
- `LEAVE_POLICY_APPLICABLE` - eligibility tuple, used in the router's zod schema.
- `TeamforceLeavePolicy` - the Mongoose model `"TeamforceLeavePolicy"` (collection `teamforceleavepolicies`).

## Interfaces
- **Database:** `TeamforceLeavePolicy` (collection `teamforceleavepolicies`).

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
- `server/routes/teamforce/leavePolicies.ts`, mounted at `/teamforce/leave-policies` (browser: `GET|POST /backend/teamforce/leave-policies`, `PATCH|DELETE /backend/teamforce/leave-policies/:id`).

## Notes
- Policies are not linked to leave requests. `TeamforceLeaveRequest.leaveType` uses its own fixed list (`Casual Leave`, `Sick Leave`, `Earned Leave`, `Official Duty`), and nothing in the codebase enforces `annualQuota`, `maxConsecutiveDays` or `applicableFor` against requests.
- There is no unique index on name.

# `server/models/approval.model.ts`

> Mongoose model `Approval`: an approval request inside an organisation, with each approver's decision stored as an embedded subdocument.

**Kind:** Mongoose model · **Lines:** 53

## Purpose
Backs the `/approvals` slash-command feature: a member asks one or more colleagues to approve something (title, description, optional deadline) and each approver approves or rejects. Embedding approvers keeps "did Alice decide?" a single-document read.

## How it works
- `orgId` (ref `Organization`, indexed) and `requesterId` (ref `User`) - required.
- `title` (required, max 200), `description` (max 1000), `deadline` (optional).
- `approvalType` - `parallel` (default) or `sequential`. Parallel means any rejection fails the request and all approvals pass it. **Sequential is not implemented**; the value exists for forward compatibility.
- `approvers[]` - subdocuments (no `_id`): `userId` (ref `User`), `status` (`pending` default, `approved`, `rejected`), `decidedAt`, `comment` (max 500).
- `overallStatus` - `pending` (default), `approved`, `rejected`; indexed.
- Compound index `{ "approvers.userId", overallStatus }` answers "what is still waiting on me?".
- Timestamps on; collection `approvals`.

The model stores state only; computing `overallStatus` from approver decisions is done by the route.

## Exports
- `Approval` - Mongoose model.

## Interfaces
- **Database:** `Approval` (collection `approvals`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/slashApprovals.ts`, mounted at `/slash/approvals` (browser `/backend/slash/approvals`): `POST /` (create), `POST /:id/decide`, `GET /:id` - all `requireAuth`.

# `server/models/invite.model.ts`

> Mongoose model for an email invitation to join an organisation (office), optionally pre-placed on a floor and department.

**Kind:** Mongoose model · **Lines:** 28

## Purpose
Founders and admins invite people to their office by email. Each invite is a row here until accepted or revoked. Used by the invite routes, join requests, floor management and the Teamforce HR employee flow (which pre-populates HR profiles from invites).

## How it works
- `orgId` (ref `Organization`, required).
- `email` (required, indexed). Not lowercased by the schema.
- `role` - `"admin" | "user" | "founder" | "stakeholder"`, default `"stakeholder"`.
- `name`, `floorId` (a `Floor` `_id`, no `ref`), `department` (department name from that floor).
- `status` - `"pending" | "accepted" | "revoked"` (default `pending`, indexed).
- Timestamps on.
- Unique index `{ orgId, email }` - one invite per email per org; re-inviting must update the existing row.

## Exports
- `Invite` - model `"Invite"` (default collection `invites`).

## Interfaces
- **Database:** collection `invites` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/invites.ts` (mounted at `/invites`; the frontend's `POST /backend/invites/create`), `server/routes/joinRequests.ts` (`/join-requests`), `server/routes/floor.ts`, `server/routes/teamforce/employees.ts`.

## Notes
- Because `email` is not normalised here, callers must lowercase it themselves or the unique index will treat case variants as different invites.
- The leading comment still says `src/models/invite.model.ts` (pre-merge path).

# `server/models/joinRequest.model.ts`

> Mongoose model for a guest user's request to join an organization, which an office member approves or rejects.

**Kind:** Mongoose model · **Lines:** 43

## Purpose
A guest (a user who is not yet a member of an office) can ask to join an organization, optionally explaining why. The request sits as `pending` until someone in the org responds. The model records the outcome and who responded.

## How it works
- Fields:
  - `guestUserId` (ref `User`, required, indexed), `orgId` (ref `Organization`, required, indexed).
  - `email` (required, indexed), `name`, `message` (why they want to join).
  - `status` - `pending` (default) | `approved` | `rejected`, indexed.
  - `respondedBy` (ref `User`), `respondedAt`.
- Timestamps on.
- Indexes:
  - `{ guestUserId: 1, orgId: 1 }` **unique** - a user can hold only one request per org. A second request is rejected by Mongo with a duplicate-key error unless the existing row is updated or removed.
  - `{ orgId: 1, status: 1, createdAt: -1 }` - the org's pending-requests inbox, newest first.
- The schema is untyped (no TypeScript interface), so `JoinRequest` documents are loosely typed.

## Exports
- `JoinRequest` - Mongoose model `"JoinRequest"`.

## Interfaces
- **Database:** `JoinRequest` (collection `joinrequests`) - read/write.

## Dependencies
- **Packages:** `mongoose` (`Types` is imported but unused).

## Used by
- `server/routes/joinRequests.ts` (mounted at `/join-requests`, browser `/backend/join-requests`) - list, approve and reject requests.
- `server/routes/guestAuth.ts` (mounted at `/guest-auth`) - guest sign-up/login flow that creates requests.

## Notes
- When `guestAuth.ts` creates a request (`JoinRequest.create`), it also writes `Notification` rows of type `join_request` to alert the org.

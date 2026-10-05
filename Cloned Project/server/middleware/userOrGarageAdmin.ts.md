# `server/middleware/userOrGarageAdmin.ts`

> Authentication middleware that accepts either a regular user JWT or a Garage admin JWT. It provides two variants: one that leaves `req.user` empty for admins, and one that maps an admin onto their own Garage `User` account.

**Kind:** Express middleware · **Lines:** 180

## Purpose
Some affiliate and member-profile endpoints are called from two places:
- the NetworkChains member app, using the user's JWT;
- the Garage admin panel, which has only an admin token and no user session.

A plain `requireAuth` returns 401 for admins; the comment calls this "the incognito bug". Both token types are signed with the same `JWT_SECRET` and are told apart by their claims: `userId` for users, `garageAdminId` for admins. This file accepts either kind.

## How it works
Both functions start the same way:
1. A missing `Authorization` header returns **401** `Missing auth`.
2. The token is `header.split(" ")[1]`, verified with `verifyJwt`. A failed check returns **401** `Invalid token`.
3. A payload with neither claim returns **401** `Invalid token`.

**User token path (both functions).** This is the same as `requireAuth` in `auth.ts`, minus the permissions map and `req.membership`:
- It loads `User` (`email role organization organizations`); a missing user returns 401.
- `orgId` is the token's org, or else the legacy `organization`.
- The effective role is `"founder"` when the membership for that org satisfies `hasFounderAccess`, otherwise the membership's role.
- It sets `req.user = { userId, role, orgId, email }`.

**`requireUserOrGarageAdmin`, admin token path:**
- It loads `GarageAdminModel.findById(garageAdminId)`; a missing admin returns 401.
- It sets `req.user = {}` and `req.garageAdmin = { id, role }`.
- Handlers behind it must treat `req.user.userId` and `req.user.orgId` as optional. They use them only for extras, such as the org's founder flag or a "You Earned" commission column.

**`requireUserOrGarageAdminAsUser`, admin token path.** Some handlers really scope data by `req.user.userId`, and `new Types.ObjectId(undefined)` would crash them. For those:
- It normalises the admin's email (trimmed, lower-case) and looks up `User.findOne({ email: /^<escaped email>$/i })`. `escapeRegex` escapes the email so it is matched literally.
- If no matching user exists, it returns **403** with a message telling the admin to sign in to Garage with a matching email. It never continues with a partial `req.user`.
- If a user is found, it sets `req.user = { userId: <that user's _id> }` and `req.garageAdmin = { id, role }`.

The two functions are kept separate on purpose. Existing endpoints (`/affiliate/user-info/:userId` and routes in `downlineProfile.ts`) rely on the empty-`req.user` behaviour of the first.

## Exports
- `requireUserOrGarageAdmin(req, res, next)` - accepts a user or an admin; admins get `req.user = {}`.
- `requireUserOrGarageAdminAsUser(req, res, next)` - accepts a user or an admin; admins are acted on as their own Garage user, or refused with 403.

## Interfaces
- **Database:** `User` - read (by id; by email for admins in the `AsUser` variant). `GarageAdminModel` - read by id.
- **Environment variables:** `JWT_SECRET`, used indirectly through `services/jwt.ts`.

## Dependencies
- **Internal:**
  - `server/services/jwt.ts` - `verifyJwt`.
  - `server/models/user.model.ts` - `User`.
  - `server/models/garageAdmin.model.ts` - `GarageAdminModel`.
  - `server/utils/accessCheck.ts` - `hasFounderAccess`.
- **Packages:** `express`.

## Used by
- `server/routes/affiliate.ts`, mounted at `/affiliate`:
  - `requireUserOrGarageAdminAsUser` on `GET /my-affiliate-id`, `GET`/`POST /links` and `GET /links/stats`;
  - `requireUserOrGarageAdmin` on `GET /offices`, `GET /catalog` and `GET /user-info/:userId`.
- `server/routes/downlineProfile.ts`, also mounted at `/affiliate`, for example `GET /affiliate/downline/:userId/purchases`.
- `server/routes/linkPreview.ts`, mounted at `/link-preview`, on `GET /`.

Browser paths are prefixed with `/backend`, for example `/backend/affiliate/links`.

## Notes
- **Security:** the admin path checks only that the admin document exists. Unlike `garageAdminAuth.ts`, it does not check `isActive` (even though the error text says "or inactive"), the `sessionsInvalidatedAt` sign-out cutoff, page permissions, or step-up verification. A deactivated or signed-out admin's token that has not yet expired still passes here.
- The `AsUser` variant gives any admin the identity of the Garage user who shares their email. Data created through those endpoints (for example, affiliate links) belongs to that user.

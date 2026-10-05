# `server/controllers/garageUniversityOnboarding.controller.ts`

> Express handlers that read, create and update the signed-in user's own Garage University onboarding profile, turning every outcome into a consistent JSON envelope.

**Kind:** Express controller · **Lines:** 87 · **Mounted at:** `/garage-university` (browser: `/backend/garage-university`)

## Purpose
Garage University (GU) is a separate client app that onboards learners through a multi-step questionnaire (interests, goals, topics, ID card, profile photo, resume and so on). This controller is the thin HTTP layer over `server/services/garageUniversityOnboarding.service.ts`, which holds all validation and database logic. A profile belongs to a person, not an office, so it is keyed only by the token's `userId`. No path id exists, so nobody can read or edit another user's profile. GU tokens may carry no `orgId`, and this controller never requires one.

## How it works
- `me(req)` reads the `AuthUser` that `requireAuth` attached to `req.user`.
- Each handler calls one service function and wraps the result as `{ success: true, data }`.
- `sendError(res, err, action)` maps failures to statuses, in this order:
  1. `OnboardingError` (thrown by the service): uses its own `status` and `code`, and spreads its `extra` fields into the body. Codes include `INVALID_BODY`, `UNKNOWN_FIELD`, `INVALID_FIELD`, `READ_ONLY_FIELD`, `EMPTY_UPDATE`, `ONBOARDING_NOT_FOUND` and `ONBOARDING_EXISTS`.
  2. Mongo duplicate key (`err.code === 11000`): two first saves raced into the unique `userId` index. Returns 409 `ONBOARDING_EXISTS`.
  3. Mongoose `ValidationError` / `CastError`: returns 400 `INVALID_FIELD`. This is a safety net behind the service's zod validation.
  4. Connectivity errors (`MongoServerSelectionError`, `MongoNetworkError`, `MongoNetworkTimeoutError`, `MongoNotConnectedError`, `MongoTopologyClosedError`, held in the `UNAVAILABLE` set): logged, then 503 `SERVICE_UNAVAILABLE`.
  5. Anything else: logged with a `[GU onboarding]` prefix, then 500 `INTERNAL_ERROR` with a generic message.
- Failure bodies always have the shape `{ success: false, error, code, ...extra }`.

## Exports
- `getMyOnboarding(req, res)` - `GET`: returns the caller's profile, or `data: null` if they have not started. Not starting is a normal state, not a 404.
- `createMyOnboarding(req, res)` - `POST`: creates the profile, optionally with initial answers (and `orgId`). Returns 201. A second create returns 409.
- `updateMyOnboarding(req, res)` - `PATCH`: changes any answers. `{ completed: true }` finishes onboarding. Sending `orgId` returns a 400 `READ_ONLY_FIELD` error from the service.

## Interfaces
- **Endpoints served** (each guarded by `requireAuth` in `server/routes/garageUniversity.ts`):
  - `GET /backend/garage-university/onboarding` - read own profile
  - `POST /backend/garage-university/onboarding` - create own profile
  - `PATCH /backend/garage-university/onboarding` - update own profile
- **Database** (through the service): `GarageUniversityOnboarding` (collection `garageuniversity_onboarding_profiles`) - read/write. `User` - reads `name`/`email` on create.

## Dependencies
- **Internal:** `server/middleware/auth.ts` - the `AuthUser` type only. `server/services/garageUniversityOnboarding.service.ts` - `OnboardingError`, `getOnboarding`, `createOnboarding`, `updateOnboarding`.
- **Packages:** `express` - `Request`/`Response` types.

## Used by
- `server/routes/garageUniversity.ts`, mounted in `server/app.ts` with `app.use("/garage-university", ...)` and followed by `garageUniversityErrorHandler`, which returns JSON for malformed or oversized bodies. That router also answers 405 for other methods on `/onboarding` and 404 for unknown paths.

## Notes
- The 503 branch lets the GU app show a "try again shortly" message instead of a generic failure when MongoDB is unreachable.

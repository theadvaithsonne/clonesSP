# `server/controllers/downlineOffer.controller.ts`

> Express handler that lets a signed-in user extend the 24-hour free-first-month offer window of someone in their own downline.

**Kind:** Express controller · **Lines:** 124 · **Mounted at:** `/downlines` (browser: `/backend/downlines`)

## Purpose
When a user first completes their profile, they get 24 hours to buy the Unilevel Plus licence and receive their first NetworkChain month free (see `server/services/comboWindow.ts`). Garage admins can already extend that window (`garageAdmin.controller.ts#extendUserOffer`). This file lets **uplines** do the same for the members beneath them. It makes the same database writes as the admin version, but records the extending user rather than an admin.

## How it works
`extendDownlineOffer` handles `POST /downlines/:userId/extend-offer`:
1. **Input checks:** `:userId` must be a valid ObjectId (otherwise 400). A caller cannot target themselves (400, `code: "SELF_TARGET"`). `body.hours` defaults to `24` and must be an integer from 1 to 720, i.e. up to 30 days (otherwise 400).
2. **Upline-ownership check (the whole security model):** `User.findOne({ _id: target, ancestors: callerId })`. The target must have the caller in its stored `ancestors` path, meaning the caller really is above them. `ancestors` is indexed on `User`, so this is one cheap query. If there is no match the handler returns 403 with `code: "NOT_YOUR_DOWNLINE"`. Only `_id`, `profileCompletedAt` and `offerExpiresAtOverride` are selected.
3. **Write:** `User.updateOne` sets `offerExpiresAtOverride = now + hours`, `offerExtendedAt = now` and `offerExtendedByUserId = caller`. As in the admin version, the new value is written unconditionally. It is **not** compared with an existing override, so it can shorten one that ran later.
4. **Response:** recalculates the window with `comboWindowFor({ profileCompletedAt, offerExpiresAtOverride: newExpiry }, now)` and returns it so the frontend can update the row in place:
   `{ userId, offerWindow: { status, startsAt, expiresAt, secondsRemaining, extendedByUpline: true } }`.
   `status` comes from `comboWindowStatus(w, {})`. No Unilevel Plus purchase date is passed in, so `"completed"` is never returned here; it only shows on the next table load. `comboWindowFor` uses the later of the natural expiry (profile completion + 24h) and the override.
5. Logs `[downlines][extend-offer] caller=... target=... hours=... newExpiry=...`. Any other error returns `500 fail("Failed to extend offer")`.

## Exports
- `extendDownlineOffer(req, res)` - the handler described above. Expects `req.user.userId` from `requireAuth`.

## Interfaces
- **Endpoints served:** `POST /backend/downlines/:userId/extend-offer` - `requireAuth`. Body `{ hours?: number }`, which defaults to 24 and is capped at 720.
- **Database:** `User` (collection `users`) - reads `ancestors`, `profileCompletedAt` and `offerExpiresAtOverride`; writes `offerExpiresAtOverride`, `offerExtendedAt` and `offerExtendedByUserId`.

## Dependencies
- **Internal:** `server/middleware/auth.ts` - `AuthRequest` type. `server/models/user.model.ts` - `User`. `server/services/comboWindow.ts` - `comboWindowFor`, `comboWindowStatus`. `server/utils/http.ts` - `ok`/`fail`.
- **Packages:** `express` (types), `mongoose` (`Types.ObjectId`).

## Used by
- `server/routes/downlines.ts` registers it as `router.post("/:userId/extend-offer", requireAuth, extendDownlineOffer)`. `server/app.ts` mounts that router at `/downlines`.
- No frontend caller in `app/`, `components/`, `lib/`, `hooks/` or `store/` references this path. The only `extend-offer` caller found is the garage-admin route `/garage-admin/users/:userId/extend-offer` in `lib/admin-api/users.ts`, which is a different endpoint.

## Notes
- Any upline at any depth can extend the window, repeatedly and with no rate limit. Each call can push the window up to 30 days ahead, so in practice an upline can keep a downline member's offer open indefinitely.
- Its error responses use their own shape (`{ success, code, message }`) for the self-target and not-your-downline cases, while the others use `fail()`.
- Keep the write logic in step with the admin `extendUserOffer` if either one changes.

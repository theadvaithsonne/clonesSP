# `server/services/jwt.ts`

> Module exporting `signJwt`, `verifyJwt`, `generateGuestSocketToken`.

**Kind:** backend service · **Lines:** 71

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `signJwt` | function | `signJwt(payload: T, options?: SignOptions): string` | 16 |
| `verifyJwt` | function | `verifyJwt(token: string, options?: VerifyOptions): T` | 27 |
| `generateGuestSocketToken` | function | `generateGuestSocketToken(eventId: string, guestId: string, displayName: string, email: string, eventEndTime: Date): string` — Generate a JWT token for event guests | 42 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.JWT_SECRET`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `jsonwebtoken` — `JwtPayload`, `SignOptions`, `VerifyOptions`

## Used by

- `server/bat246/routes/bat246.routes.ts`
- `server/controllers/garageAdmin.controller.ts`
- `server/middleware/auth.ts`
- `server/middleware/userOrGarageAdmin.ts`
- `server/realtime/openclawWs.ts`
- `server/realtime/socket.ts`
- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/invoice.ts`
- `server/routes/platformCouponValidation.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicEvents.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicSaveCard.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/serviceCheckout.ts`
- `server/routes/sso.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshopCheckout.ts`
- _…and 1 more_

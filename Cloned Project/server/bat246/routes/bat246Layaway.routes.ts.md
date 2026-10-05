# `server/bat246/routes/bat246Layaway.routes.ts`

> Express router for BAT246 "Layaway" / B2 Coins: giving power (eligibility), the B2 Coin wallet, giving coins, asking for coins, and paying an entry invoice with coins.

**Kind:** BAT246 game module (backend) — Express router · **Lines:** 159 · **Mounted at:** `/bat246/layaway` (browser: `/backend/bat246/layaway`)

## Purpose
B2 Coins are a BAT246-only currency that cannot yet be redeemed. Members in certain board positions or with certain status get a giving allowance and can hand coins to other BAT246-office members. A member who receives coins can spend them on the $650 Board Entry or the $160 POD Entry instead of paying real money. This router is a thin HTTP layer: every route calls one function in `bat246Layaway.service.ts`, and all business rules live there. Those rules include five stacking eligibility pools, giving tracked per pool, and check-then-write without transactions.

## How it works
Every route uses `requireAuth` and takes the acting user from `req.user.userId`. Successful responses are `{ ok: true, ... }`. Errors are `400 { error }`.

| Route | Service call | Notes |
|---|---|---|
| `GET /my-eligibility` | `computeLayawayEligibility(userId)` | The caller's giving power: the pools they qualify for and what is left in each. |
| `GET /my-wallet` | `getMyB2CoinWallet(userId)` | Coins actually received, plus history. Kept separate from eligibility on purpose. |
| `GET /recipients/search?q=` | `searchBat246OfficeUsers(q)` | Office members who can receive coins. |
| `GET /eligible-people?q=` | `searchEligiblePeople(q)` | People who currently have giving power, i.e. who can be asked. |
| `POST /give` `{recipientUserId, amount?, productId?}` | `giveB2Coins({fromUserId, ...})` | Direct gift. `recipientUserId` is required. With a `productId`, the service can work out the amount from the product. |
| `POST /request` `{eligibleUserId, recipientUserId, amount?, productId?, note?}` | `createLayawayRequest(...)` | Ask an eligible person to give coins to a recipient. The recipient can differ from the requester, which makes it a three-party request. |
| `POST /requests/:id/respond` `{approve, amount?}` | `respondToLayawayRequest(id, responder, !!approve, amount)` | The eligible person approves (optionally overriding the amount) or denies. |
| `POST /requests/:id/cancel` | `cancelLayawayRequest(id, requester)` | The requester withdraws a pending request. |
| `GET /my-requests` | `getMyLayawayRequests(userId)` | Requests the caller sent. |
| `GET /requests-for-me` | `getLayawayRequestsForMe(userId)` | Requests waiting on the caller as the eligible person, or already answered by them. |
| `POST /pay-entry` `{invoiceId}` | `payEntryProductWithB2Coins(invoiceId, userId)` | Pays an entry invoice from the caller's coin balance. On error it returns `{ error, code }`, so the frontend can detect `INSUFFICIENT_BALANCE` and show "request more" instead of a generic error. |

## Exports
- `default` — the Express `Router`.

## Interfaces
- **Endpoints served:** the eleven routes above under `/backend/bat246/layaway`. All require a Bearer JWT (`requireAuth`).
- **Database:** none directly. The service reads and writes B2 Coin wallets, transactions, layaway requests, placement notifications and invoices.

## Dependencies
- **Internal:** `server/bat246/services/bat246Layaway.service.ts` (all logic), `server/middleware/auth.ts` (`requireAuth`).
- **Packages:** `express` - Router and types.

## Used by
- Mounted in `server/app.ts` with `app.use("/bat246/layaway", bat246LayawayRoutes)`.
- Frontend: `components/bat246/modals/LayawayModal.tsx` (give and request), `app/(dashboard)/games/bat246/B2CoinWallet/page.tsx` (wallet and requests), `app/(dashboard)/games/bat246/boards/page.tsx` (`pay-entry`).

## Notes
- Authorisation, such as who may respond to or cancel a request, and balance checks happen in the service, not here.
- `pay-entry` is the only route that passes `err.code` through.

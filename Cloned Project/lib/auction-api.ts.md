# `lib/auction-api.ts`

> Typed client for the Auctions feature: lists ongoing auctions and the user's products, and creates, edits and cancels auctions through the backend `/auctions` router.

**Kind:** frontend library · **Lines:** 82

## Purpose
The Auction page (`app/(dashboard)/auction/`) lets a user put a product (one of their Garage store products, or an "outside" item described by hand) up for a timed auction with a minimum price. This file wraps every backend call that page makes and defines the TypeScript shapes shared by its components.

## How it works
Each function is a thin wrapper around `api()` from `lib/api.ts`, which prefixes `NEXT_PUBLIC_API_URL` (the app origin plus `/backend`), attaches the `garage_tok` bearer token, sends JSON and throws an `Error` carrying the server's `error`/`message` on a non-2xx response. Each wrapper unwraps the single key of the response envelope (`products`, `auctions` or `auction`).

Data shapes:
- `IAuction` - an auction document: creator info (`createdBy`, `creatorName`, `creatorAvatar`, `creatorOrgName`, `organizationId`), product info (`productSource: "garage" | "outside"`, optional `productId`, `productName`, `productImages`, `productDescription`, `productVideoUrl`), pricing (`minPrice`, `currency: "INR" | "USD"`), timing (`durationHours`, `startTime`, `endTime`), `status: "ongoing" | "ended" | "cancelled"`, timestamps.
- `CreateAuctionPayload` - what the client sends on create; `durationHours` is restricted to `1 | 6 | 24 | 48`.
- `AuctionProduct` - the minimal product row (`_id`, `name`, `images`, `organizationId`) used to pick a Garage product.

## Exports
- `getAuctionMyProducts(): Promise<AuctionProduct[]>` - products the user can auction.
- `getAuctions(): Promise<IAuction[]>` - all ongoing auctions.
- `createAuction(payload: CreateAuctionPayload): Promise<IAuction>` - start an auction.
- `updateAuction(id: string, payload: Partial<CreateAuctionPayload>): Promise<IAuction>` - edit an auction.
- `cancelAuction(id: string): Promise<IAuction>` - cancel an auction.
- Types: `IAuction`, `CreateAuctionPayload`, `AuctionProduct`.

## Interfaces
- **Backend endpoints called** (all served by `server/routes/auction.ts`, mounted at `/auctions`, every route behind `requireAuth`):
  - `GET /backend/auctions/my-products` - active products from every org the user belongs to.
  - `GET /backend/auctions` - all auctions with `status: "ongoing"`, newest first (global, not org-scoped).
  - `POST /backend/auctions` - create.
  - `PUT /backend/auctions/:id` - update.
  - `PATCH /backend/auctions/:id/cancel` - cancel.
- **Browser storage:** the bearer token is read from `localStorage.garage_tok` by `api()`.

## Dependencies
- **Internal:** `lib/api.ts` - authenticated fetch wrapper.

## Used by
- `app/(dashboard)/auction/page.tsx`
- `app/(dashboard)/auction/components/OngoingAuctions.tsx`
- `app/(dashboard)/auction/components/StartAuctionDialog.tsx`

## Notes
- The backend also pushes live auction changes over Socket.IO (`server/routes/auction.ts` imports `emitAuctionNew`, `emitAuctionUpdate`, `emitAuctionEnd` from `server/services/socket`); this file does not subscribe to them.

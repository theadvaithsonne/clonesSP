# `server/models/auction.model.ts`

> Mongoose model `Auction`: a timed auction listing created by a user for a Garage product or an outside product.

**Kind:** Mongoose model · **Lines:** 53

## Purpose
Stores auction listings created through the `/auctions` API: who created it (with denormalised name, avatar and org name), what is being sold, the minimum price, duration and status. This is a separate, simpler listing model from the storefront auction flow that uses `StoreProduct`, `AuctionEscrow`, `AuctionWallet` and `AuctionSettlement`.

## How it works
- Creator: `createdBy` (ref `User`), `creatorName`, `creatorOrgName` (required), `creatorAvatar`, `organizationId` (ref `Organization`, required).
- Product: `productSource` - `garage` (then `productId` refs `Product`) or `outside`; `productName` (required), `productImages[]`, `productDescription`, `productVideoUrl`.
- Pricing: `minPrice` (required, `min: 0`), `currency` - `INR` or `USD` (default `USD`).
- Timing: `durationHours` - required, restricted to `1`, `6`, `24` or `48`; `startTime`, `endTime` required.
- `status` - `ongoing` (default), `ended`, `cancelled`.
- Indexes: `{ status, createdAt -1 }` (browse feed) and `{ createdBy, status }` (my auctions).
- Timestamps on; collection `auctions`.

## Exports
- `Auction` - Mongoose model.
- `interface IAuction` - document shape.

## Interfaces
- **Database:** `Auction` (collection `auctions`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/auction.ts`, mounted at `/auctions` (browser `/backend/auctions`): `GET /my-products`, `GET /`, `POST /`, `PUT /:id`, `PATCH /:id/cancel`.

## Notes
- No bids are stored on this model and nothing here transitions `status` to `ended`; check the route for how expiry is handled.

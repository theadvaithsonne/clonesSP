# `server/models/affiliateClick.model.ts`

> Mongoose model `AffiliateClick`: one row per landing session on an affiliate link, used for click analytics.

**Kind:** Mongoose model · **Lines:** 107

## Purpose
Records affiliate-link clicks for the 1Network/affiliate analytics (Links page, "Clicks Today", per-item breakdowns). It is analytics data only; commissions are computed elsewhere.

## How it works
Clicks are recorded two ways (per the header comment):
1. **Server-side**, adblocker-proof, from `GET /affiliate/invite-details`, which fires on every landing and uses a synthetic `sessionId` to dedupe reloads.
2. **Client beacon** `POST /affiliate/click` with a real `sessionId` / `visitorId`.

Key rules:
- **Idempotent per session and item:** unique index `click_session_item_unique` on `{ sessionId, itemId }` collapses a landing session to one document.
- **Bots** are stored with `isBot: true` but excluded from stats.
- **Privacy:** no raw IP is stored; `ipHash` is `sha256(ip + IP_HASH_SALT)` (hashing done by the route).
- `converted` / `convertedAt` mark clicks later tied to a purchase.

Fields: `sessionId` (required), `affiliateId` (affiliate code, required, indexed), `affiliateUserId` (resolved `User`), `orgId`, `itemType` (`channel`, `product`, `office`, `store`, `course`, `workshop`, `service`, `call`, `unknown`; default `unknown`), `itemId` (string), `itemName`, `visitorId`, `userId` (logged-in visitor), `ipHash`, `userAgent`, `deviceType`, `referrerUrl`, `isBot`, `converted`, `convertedAt`, timestamps.

Indexes:
| Name | Keys | Purpose |
|---|---|---|
| `click_session_item_unique` | `sessionId, itemId` (unique) | dedupe |
| `affiliate_clicks_idx` | `affiliateUserId, createdAt -1` | per-affiliate listing / today |
| `affiliate_code_idx` | `affiliateId, createdAt -1` | before code-to-user resolution |
| `affiliate_item_idx` | `affiliateUserId, itemType, itemId, createdAt -1` | per-item breakdown |
| `org_clicks_idx` | `orgId, createdAt -1` (sparse) | org-scoped queries |

## Exports
- `AffiliateClick` - Mongoose model.
- `interface IAffiliateClick` - document shape.

## Interfaces
- **Database:** `AffiliateClick` (collection `affiliateclicks`).
- **Environment variables:** `IP_HASH_SALT` is mentioned as the salt used for `ipHash` (applied in the route, not here).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/affiliate.ts`, mounted at `/affiliate` (browser: `/backend/affiliate`) - `POST /affiliate/click`, `GET /affiliate/invite-details`, `GET /affiliate/links/stats` and related.

## Notes
- `itemType` here includes `"store"` and `"unknown"`, which `AffiliateConversion` and `AffiliateLink` do not.
- Because `itemId` may be `null`, all clicks in one session with no item collapse into a single row.

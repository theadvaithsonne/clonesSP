# `lib/affiliate/downline-profile-api.ts`

> Typed client and row types for the garage-admin "One Time Affiliate" member profile: header, Offices, and every purchase-backed tab.

**Kind:** frontend library · **Lines:** 213

## Purpose
This file supplies the data for the garage-admin member profile page (`/one-time-affiliates/[userId]`) and for the profile drawers that reuse it. Two backend calls feed it:
- the identity, upline, location and org-membership endpoint, which fills the header and the Offices list
- a paginated, server-sorted endpoint that serves every tab: Offices, Communities, Live Streams, Courses, Digital Products, Physical Products and All/Purchases

## How it works
### Auth model (header comment)
Both calls use `garageAdminApi` (the garage-admin token). Using the user `api()` returned 401 for admin-only logins, such as in an incognito window. The backend guards both routes with `requireUserOrGarageAdmin`, so any admin can view any member. Neither route checks that the member is in the caller's downline. The purchases route uses the caller's id only to compute the "You Earned" column, which is blank for an admin.

### Header and Offices (`GET /affiliate/user-info/:userId`)
`fetchMemberProfile(userId)` unwraps `res.user` into a `MemberProfile`, which includes:
- identity, `affiliateId`, `status` and `userType`
- `officesJoined` and `offices: MemberOffice[]`
- `referrer: MemberReferrer | null`. Its `country` is the **referrer's** own country.
- `location` (city, state, country)

The optional "As A Shopper" fields on `MemberOffice` are present on the Offices tab and missing or 0 in the header's office list:
- `founder`
- `consumedOfferings`, `freeOfferings`, `paidOfferings`
- `totalSpent`, `youEarned`
- `affiliateUrl`
- `rating` (the member's 1-5 rating) and `review`

Money fields are in cents.

### Tabs (`GET /affiliate/downline/:userId/purchases`)
`fetchMemberTab<T>({ userId, category, page = 1, limit = 20, sortBy?, sortOrder? })` builds a query string from `category`, `page` and `limit`, adding `sortBy` and `sortOrder` only when given. `sortBy` is the DataTable column id, and the backend maps it to a field so sorting happens on the server. The function returns `{ items, total, page, limit }`. The caller chooses `T`, depending on the category:
- **Offices:** `MemberOffice` rows.
- **Invoice-backed tabs:** `MemberPurchaseItem`. These are invoice lines with price, status, vendor, recurrence, the next due date and the live-session date. Optional fields include course progress and enrolment status, plus `rating`, `affiliateUrl`, `youEarned` (cents) and `category`.
- **Communities:** `MemberCommunityItem`, built from ChannelMembership:
  - `price` is in **whole units** (the channel list price), while `totalSpent` and `youEarned` are in cents.
  - It carries comp levels and engagement counts (posts, comments, liked posts and comments).
  - It carries subscription state. `endReason` (`unsubscribed | expired | payment_defaulted`) comes from an append-only event log, because `subscriptionStatus` reads "expired" for both voluntary and involuntary exits. `activeUntil` is when access actually ended.
- **Physical Products:** `MemberPhysicalOrderItem`, built from ProductOrder. It holds order and variant data, fulfilment status (pending through refunded), tracking number and URL, store, and ship-to city and country.

## Exports
- `MemberOffice`, `MemberReferrer`, `MemberProfile` - header and Offices shapes.
- `fetchMemberProfile(userId: string): Promise<MemberProfile>`
- `MemberTabCategory` - `"all" | "offices" | "communities" | "live_streams" | "courses" | "digital_products" | "physical_products"`.
- `MemberPurchaseItem`, `MemberCommunityItem`, `MemberPhysicalOrderItem` - tab row shapes.
- `SortOrder` - `"asc" | "desc"`.
- `MemberTabResult<T>` - `{ items: T[]; total; page; limit }`.
- `fetchMemberTab<T>(params): Promise<MemberTabResult<T>>`

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/affiliate/user-info/:userId` - header and offices. Served by `server/routes/affiliate.ts`, guarded by `requireUserOrGarageAdmin`.
  - `GET /backend/affiliate/downline/:userId/purchases?category=&page=&limit=&sortBy=&sortOrder=` - tab rows. Served by `server/routes/downlineProfile.ts`.

  Both routers are mounted at `/affiliate`.
- **Browser storage / cookies:** `garage_admin_token` (via `garageAdminApi`).

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `components/admin/AdminSavedCardsPanel.tsx`
- `components/downline/community-detail-drawer.tsx`
- `components/garage-admin/member-profile-view.tsx`

## Notes
- Live Streams rows have their own richer client in `lib/affiliate/downline-livestreams-api.ts`. `MemberTabCategory` still includes `live_streams` for the shared purchases route.
- Money units are not the same on every tab (whole units vs cents). Check the type comment before formatting a value.

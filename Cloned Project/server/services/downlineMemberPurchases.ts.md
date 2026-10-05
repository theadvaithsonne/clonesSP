# `server/services/downlineMemberPurchases.ts`

> ─────────────────────────────────────────────────────────────────────── Downline member profile — "what this member bought / joined" per tab, with server-side sorting + pagination on every column.

**Kind:** backend service · **Lines:** 953

<!-- docgen:auto -->

## Purpose
───────────────────────────────────────────────────────────────────────
Downline member profile — "what this member bought / joined" per tab,
with server-side sorting + pagination on every column.

  · Offices          → User.organizations[] joined to Organization.
  · Communities      → paid invoice lines, itemType "channel".
  · Live Streams     → paid invoice lines, itemType "workshop".
  · Courses          → paid invoice lines, itemType "course", joined to
                       CourseEnrollment (progress % + status) IN the
                       aggregation so those columns are server-sortable.
  · Digital Products → paid invoice lines, itemType product/ecommerce_item
                       filtered to digital via Product.
  · Purchases (all)  → every paid invoice line (course lines carry progress).

Line items are denormalized at purchase time (itemName/itemImage/price/…),
so the invoice tabs need no catalog join beyond the two above. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MemberTabCategory` | type |  | 39 |
| `SortOrder` | type |  | 50 |
| `MemberTabResult` | interface |  | 107 |
| `MemberOfficeItem` | interface |  | 114 |
| `MemberPurchaseItem` | interface |  | 136 |
| `listMemberOffices` | function | `async listMemberOffices(params: { userId: string; /** The logged-in upline viewing …): Promise<MemberTabResult<MemberOfficeItem>>` | 205 |
| `MemberCommunityItem` | interface |  | 393 |
| `listMemberCommunities` | function | `async listMemberCommunities(params: { userId: string; viewerId?: string; page: number; …): Promise<MemberTabResult<MemberCommunityItem>>` | 439 |
| `MemberPhysicalOrderItem` | interface |  | 653 |
| `listMemberPhysicalOrders` | function | `async listMemberPhysicalOrders(params: { userId: string; page: number; limit: number; sort…): Promise<MemberTabResult<MemberPhysicalOrderItem>>` | 674 |
| `listMemberPurchases` | function | `async listMemberPurchases(params: { userId: string; viewerId?: string; category: Excl…): Promise<MemberTabResult<MemberPurchaseItem>>` | 752 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `aggregate`, `find`, `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `aggregate`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `aggregate`
  - `Review` (server/models/review.model.ts) — reads: `find`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `aggregate`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `find`
  - `Post` (server/models/post.model.ts) — reads: `aggregate`
  - `PostComment` (server/models/postComment.model.ts) — reads: `aggregate`
  - `PostLike` (server/models/postLike.model.ts) — reads: `aggregate`
  - `PostCommentLike` (server/models/postCommentLike.model.ts) — reads: `aggregate`
  - `ChannelMembershipEvent` (server/models/channelMembershipEvent.model.ts) — reads: `aggregate`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `aggregate`
  - `Product` (server/models/product.model.ts) — reads: `find`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/product.model.ts` — `Product`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/models/productVariant.model.ts` — `ProductVariant`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/channelMembershipEvent.model.ts` — `ChannelMembershipEvent`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/combPlan.model.ts` — `CombPlan`
  - `server/models/post.model.ts` — `Post`
  - `server/models/postComment.model.ts` — `PostComment`
  - `server/models/postLike.model.ts` — `PostLike`
  - `server/models/postCommentLike.model.ts` — `PostCommentLike`
  - `server/models/review.model.ts` — `Review`
  - `server/services/affiliateItemUrl.ts` — `buildAffiliateItemUrl`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/downlineProfile.ts`

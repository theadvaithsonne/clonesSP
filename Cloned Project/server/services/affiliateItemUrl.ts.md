# `server/services/affiliateItemUrl.ts`

> Canonical affiliate destination for a catalog item.

**Kind:** backend service · **Lines:** 94

<!-- docgen:auto -->

## Purpose
Canonical affiliate destination for a catalog item.

This is a server-side port of the NetworkChains web app's
`lib/affiliate/links-api.ts` → `buildAffiliateUrl`, which is the up-to-date
routing used by the Links page. Keep the two in step: a product kind added
there needs a case here.

WHY THIS EXISTS
The member-profile tabs used to serve `AffiliateLink.affiliateUrl` — a value
persisted at link-creation time by routes/affiliate.ts as

    `${AFFILIATE_BASE_URL}/${orgSlug}/${itemId}?ref=${affiliateId}`

That shape has no notion of item kind (it takes an itemType and ignores it),
and points at the Office app rather than the storefront. Every kind of item
therefore got the same wrong URL, and because the value is STORED it never […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AffiliateItemRef` | interface |  | 36 |
| `buildAffiliateItemUrl` | function | `buildAffiliateItemUrl(item: AffiliateItemRef, affiliateId: string \| null \| undefined): string \| null` — Build the member's affiliate link for one item, or null when the item has no shareable destination (or the member has no affiliate id yet). | 79 |

## Interfaces

- **Environment variables (`process.env`):** `GARAGE_STOREFRONT_URL`, `GARAGE_OFFICE_URL`
- **External hosts mentioned in the code:** `www.garage.app`, `my.garage.app`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/downlineMemberLiveStreams.ts`
- `server/services/downlineMemberPurchases.ts`

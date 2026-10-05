# `lib/affiliate/links-api.ts`

> Data layer for the 1Network "Links" feature: it merges the affiliate-eligible catalog, offices and fixed platform links into one `LinkItem[]`, builds each item's public affiliate URL, and records generated links.

**Kind:** frontend library · **Lines:** 386

## Purpose
This file is part of the affiliate feature ported from NetworkChains. It lets an affiliate browse everything they can promote, copy a `?ref=` link or an embed snippet, and pick a product for a funnel CTA. Every item, from any category, is normalised to one `LinkItem` shape, so pickers and cards treat physical products, digital items, offices, stores and hardcoded platform links the same way. Requests go through `api()` in `lib/affiliate/base.ts`.

## How it works
### Types (L10-L64)
- `LinkCategory` is the display category: `general | physical | digital | office | ecommerce | offline`.
- `BackendItemType` is the real item type the backend persists: `channel | product | office | store | course | service | workshop | call`. A course, for example, appears under "digital" but keeps `backendItemType: "course"`.
- `LinkItem` contains:
  - pricing: `price`, `currency`, and optional `compareAtPrice` and `hasVariants`
  - images: `image`, plus `logo` and `coverPhoto` for offices
  - `category`, rating, and `period` (for recurring items)
  - `href` (general links only)
  - the selling org: `orgId`, `orgSlug`, `sellerName`
  - `backendItemType` and `commissionPct` (the direct, level-1 rate)
  - office stats: `memberCount`, `offerCount`, `industry`, `country`

### General platform links (L66-L153)
- `GENERAL_APPS` is the single source of truth for three apps, each with Web, iOS and Android URLs: Garage Shop, Network Chains and Garage. Network Chains has `webIsRegister: true`.
- `generalLinkId(appKey, platform)` builds a stable id such as `network-chains::web`.
- `resolveGeneralHref(id, affiliateId)` turns an id back into a URL. For Network Chains Web with a known affiliate id, it returns `https://networkchains.com/register/<affiliateId>`. An unknown app or platform returns `""`.
- `getGeneralLinkItems(affiliateId)` returns 9 `LinkItem`s (3 apps x 3 platforms), each priced at 0 USD with category `general`, a name like `"Garage · iOS"`, and a resolved `href`.

### Affiliate URL building (L155-L231)
- `AFFILIATE_BASE_URL` is `NEXT_PUBLIC_GARAGE_AFFILIATE_BASE_URL`, default `https://www.garage.app`. This is the public storefront, whose item pages capture `?ref`.
- `WEBINAR_BASE_URL` is `NEXT_PUBLIC_GARAGE_OFFICE_URL`, default `https://my.garage.app`.
- The private `affiliatePath(item, ctx)` maps `backendItemType` to a storefront path:

  | Item type | Path |
  | --- | --- |
  | channel | `/digital/channel/:id` |
  | course | `/digital/course/:id` |
  | workshop | `/digital/workshop/:id` (fallback only, never reached) |
  | service | `/digital/service/:id` |
  | call | `/digital/call/:id` |
  | product | `/product/:id` if physical, else `/digital/product/:id` |
  | office | `/hq/:slug` |
  | store | `/store/:slug` |

  For office and store, the slug is `item.orgSlug`, then `ctx.orgSlug`. Without either, the path is `null`.
- `buildAffiliateUrl(item, { orgSlug, affiliateId })` works through these rules in order:
  1. A general item returns its `href`, or resolves one from its id (used when the item was rebuilt from a stored funnel link).
  2. With no `affiliateId`, it returns `""`.
  3. A workshop returns `${WEBINAR_BASE_URL}/webinar/:id?ref=...`, because webinars enrol on the Office app, not the store page.
  4. Anything else returns `${AFFILIATE_BASE_URL}${path}?ref=...`, or `""` when there is no path.
- `buildEmbedHtml(item, url)` returns an `<a target="_blank" rel="noopener noreferrer">` tag with the item name as its text, or `""` when there is no URL.

### Fetchers (L233-L356)
- `getAffiliateCatalog()` calls `GET /affiliate/catalog`. The response covers every active sellable item across all orgs; a commission plan is optional.
  - It drops any row with `category === "store"`. The comment says this is defensive, since the backend never sends that category.
  - It maps each raw row to a `LinkItem`, defaulting `price` to 0, `currency` to "USD" and `commissionPct` to 0.
- `getOfficeItems()` calls `GET /affiliate/offices`.
  - The raw `kind` (`office`, `ecommerce` or `offline`, default office) sets the category.
  - `backendItemType` is `office` for offices and `store` for both store kinds. For stores, `orgSlug` carries the store slug.
  - Every item has price 0 USD.
- `getLinkStats(orgId)` calls `GET /affiliate/links/stats?orgId=` for the stat cards (total links, clicks today, top converting product). It swallows any error and returns zeros and `null` instead.

### Persisting links (L358-L385)
`persistLink(fallbackOrgId, item)` posts `{ orgId, itemType, itemId }` to `POST /affiliate/links`. The backend is idempotent, so posting the same link twice is harmless. Persisting is what makes "Total Links Generated" a real count.
- `itemType` is `backendItemType`, or else comes from the private `ITEM_TYPE_BY_CATEGORY` fallback (physical and digital map to product, office to office, ecommerce and offline to store, general to `null`).
- `orgId` is the item's own org, or else `fallbackOrgId`.
- If `itemType` or `orgId` is missing, the function returns without a request. General links are never persisted.

## Exports
- `LinkCategory`, `BackendItemType`, `LinkItem`, `GeneralApp`, `LinkStats` - types.
- `GENERAL_APPS: GeneralApp[]` - the fixed platform app list.
- `generalLinkId(appKey: string, platform: string): string`
- `resolveGeneralHref(id: string, affiliateId: string | null): string`
- `getGeneralLinkItems(affiliateId: string | null): LinkItem[]`
- `buildAffiliateUrl(item: LinkItem, ctx: { orgSlug: string | null; affiliateId: string | null }): string`
- `buildEmbedHtml(item: LinkItem, url: string): string`
- `getAffiliateCatalog(): Promise<LinkItem[]>`
- `getOfficeItems(): Promise<LinkItem[]>`
- `getLinkStats(orgId: string): Promise<LinkStats>`
- `persistLink(fallbackOrgId: string, item: LinkItem): Promise<void>`

## Interfaces
- **Backend endpoints called:** all go to `GARAGE_API_URL` from `base.ts` (see Notes). All are served by `server/routes/affiliate.ts`, mounted at `/affiliate`, and reached in this project as `/backend/affiliate/...`.
  - `GET /backend/affiliate/catalog` - `requireUserOrGarageAdmin`. The affiliate-eligible catalog.
  - `GET /backend/affiliate/offices` - `requireUserOrGarageAdmin`. Offices and stores.
  - `GET /backend/affiliate/links/stats?orgId=` - `requireUserOrGarageAdminAsUser`. Links-page stats.
  - `POST /backend/affiliate/links` - `requireUserOrGarageAdminAsUser`. Idempotent create of an affiliate link.
- **Environment variables:**
  - `NEXT_PUBLIC_GARAGE_AFFILIATE_BASE_URL` - storefront host for affiliate URLs.
  - `NEXT_PUBLIC_GARAGE_OFFICE_URL` - Office app host for webinar URLs.
- **External services:** the URLs it builds point at `www.garage.app`, `my.garage.app`, `networkchains.com`, the Apple App Store and Google Play.

## Dependencies
- **Internal:** `lib/affiliate/base.ts` - `api()` request helper.

## Used by
- `components/garage/attach-product-drawer.tsx`
- `components/garage/link-picker.tsx`
- `lib/affiliate/link-card-adapters.ts` (type import of `LinkItem`)

## Notes
- **Request host:** requests use `NEXT_PUBLIC_GARAGE_API_URL` (default `https://test.garage.app`), not `NEXT_PUBLIC_API_URL`. Unless that variable points at this app's `/backend`, the calls go to a remote server.
- **Possible mismatch:** `persistLink` can send `itemType: "store"` for ecommerce and offline store items. The zod schema on `POST /affiliate/links` only allows `channel`, `product`, `office`, `course`, `service`, `workshop` and `call`, so persisting a store link is likely rejected.
- `buildEmbedHtml` interpolates `item.name` and `url` into HTML without escaping.

# `lib/affiliate/link-card-adapters.ts`

> Pure functions that convert an affiliate-catalog `LinkItem` into shared card shapes and funnel link snapshots, and convert a stored funnel link back.

**Kind:** frontend library · **Lines:** 96

## Purpose
The Links catalog (`lib/affiliate/links-api.ts`) returns one unified `LinkItem` shape. Other parts of the app need different shapes:
- the shared product and office cards
- the `FunnelLink` snapshot a funnel stores
- a `LinkItem` again, so `buildAffiliateUrl` can rebuild a public URL from a saved funnel link

This module holds those conversions so the pickers and drawers that use them stay consistent.

## How it works
- `currencySym(currency)` returns `"$"` for USD and `"<CODE> "` for any other currency.
- `priceLabel(it)` returns `"Free"` when the price is 0 or missing. Otherwise it returns the symbol plus the price to 2 decimals, prefixed with `"from "` when `hasVariants` is true.
- `linkToProductCardItem(it)` builds a `ProductCardItem`:
  - `badge` is "Digital" for the digital category and "Physical" for everything else.
  - `sellerName` falls back to `orgSlug`, then `null`.
  - The commission amount and percentage are filled in only when the price and `commissionPct` are both above 0. The amount is `price * pct / 100`.
- `linkToOfficeCardItem(it)` copies the office fields (logo, cover photo, country, member and offer counts, industry) into an `OfficeCardItem`.
- `linkItemToFunnelLink(it)`:
  - For a `general` item, it stores only identity (`itemType: "general"`, id, name, image) plus the pre-built `href`, because a general item can't be resolved from type and id.
  - For any other item, it stores `itemType` (`backendItemType`, default `"product"`), id, category, `orgSlug`, name, image, price, currency and `commissionPct`.
- `funnelLinkToLinkItem(link)` reverses that. It defaults price to 0, currency to "USD" and category to `"physical"`, and maps `itemType` back to `backendItemType`. It does not copy `href`, so `buildAffiliateUrl` rebuilds general links from the stable id.

## Exports
- `currencySym(currency: string): string`
- `priceLabel(it: LinkItem): string`
- `linkToProductCardItem(it: LinkItem): ProductCardItem`
- `linkToOfficeCardItem(it: LinkItem): OfficeCardItem`
- `linkItemToFunnelLink(it: LinkItem): FunnelLink`
- `funnelLinkToLinkItem(link: FunnelLink): LinkItem`

## Dependencies
All internal imports are type-only:
- `lib/affiliate/links-api.ts` - `LinkItem`
- `components/shared/product-card.tsx` - `ProductCardItem`
- `components/shared/office-card.tsx` - `OfficeCardItem`
- `lib/api/funnels.ts` - `FunnelLink`

## Used by
- `components/garage/attach-product-drawer.tsx`
- `components/garage/link-picker.tsx`

## Notes
- No network calls and no side effects.

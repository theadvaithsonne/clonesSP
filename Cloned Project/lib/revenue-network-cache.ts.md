# `lib/revenue-network-cache.ts`

> Revenue Network Data Cache Stores storeId and customerId to avoid repeated API calls

**Kind:** frontend library · **Lines:** 203

<!-- docgen:auto -->

## Purpose
Revenue Network Data Cache
Stores storeId and customerId to avoid repeated API calls

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getPageCache` | function | `getPageCache(key: string): T \| null` | 11 |
| `setPageCache` | function | `setPageCache(key: string, data: T): void` | 17 |
| `invalidatePageCache` | function | `invalidatePageCache(prefix: string): void` — Remove all cache entries whose key starts with the given prefix | 22 |
| `RevenueNetworkCache` | interface |  | 32 |
| `getRevenueNetworkCache` | function | `getRevenueNetworkCache(): RevenueNetworkCache \| null` | 44 |
| `setRevenueNetworkCache` | function | `setRevenueNetworkCache(data: Omit<RevenueNetworkCache, "timestamp">): void` | 65 |
| `clearRevenueNetworkCache` | function | `clearRevenueNetworkCache(): void` | 80 |
| `fetchAndCacheRevenueNetworkData` | function | `async fetchAndCacheRevenueNetworkData(): Promise<RevenueNetworkCache \| null>` | 87 |
| `getRevenueNetworkData` | function | `async getRevenueNetworkData(): Promise<RevenueNetworkCache \| null>` | 168 |
| `getEcommerceStoreSlug` | function | `async getEcommerceStoreSlug(): Promise<string \| null>` | 185 |

## Interfaces

- **External HTTP calls:**
  - `GET ecommerce.networkchains.com/store` (L191)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/org/${orgId}` (L121)
  - `GET ${apiUrl}/profile?userId=${userId}` (L124)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ECOMMERCE_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `ecommerce.networkchains.com`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
- `components/dashboard/AffiliateLeaderboardPage.tsx`
- `components/dashboard/AffiliatePageNew.tsx`
- `components/dashboard/AffiliateSettingsPage.tsx`
- `components/dashboard/CallsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/DropsPage.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`
- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/MobileActionSidebar.tsx`
- `components/dashboard/OfficeSubscriptionLock.tsx`
- `components/dashboard/OrdersPage.tsx`
- `components/dashboard/OrganizationSidebar.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/ServicesPage.tsx`
- `components/dashboard/WalletPageNew.tsx`
- `components/dashboard/WorkshopsPage.tsx`

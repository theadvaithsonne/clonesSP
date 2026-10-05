# `components/icons/platform-logos.tsx`

> React components `PlatformMark`, `NetworkChainsLogo`, `GarageShopLogo`, `GarageLogo` and 1 more.

**Kind:** React component · **Lines:** 110

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GarageLogo` (local), `GarageShopLogo` (local), `NetworkChainsLogo` (local)

### Props

- **`PlatformMark`**: `itemId: string`, `className?: string`
- **`NetworkChainsLogo`**: `className?: string`
- **`GarageShopLogo`**: `className?: string`
- **`GarageLogo`**: `className?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `isPlatformProductType` | function | `isPlatformProductType(itemType?: string \| null): boolean` — True for the synthetic platform products (itemType "platform"). | 17 |
| `PlatformMark` | component | `PlatformMark({ itemId, className, }: { itemId: string; className?: strin…)` | 21 |
| `NetworkChainsLogo` | component | `NetworkChainsLogo({ className }: { className?: string })` | 45 |
| `GarageShopLogo` | component | `GarageShopLogo({ className }: { className?: string })` | 56 |
| `GarageLogo` | component | `GarageLogo({ className }: { className?: string })` | 78 |
| `PlatformLogo` | component | `PlatformLogo({ itemId, className, }: { itemId: string; className?: strin…)` — The right wordmark logo for a platform product itemId. | 99 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:** none

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx`
- `components/shared/product-card.tsx`

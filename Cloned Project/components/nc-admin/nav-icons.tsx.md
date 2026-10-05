# `components/nc-admin/nav-icons.tsx`

> Nav icons ported verbatim from NetworkChains' components/layout/nav-icons.tsx (client/networkchains-web-app-nextjs-v1-invite-clone, a separate live repo — read-only source, never edited).

**Kind:** React component · **Lines:** 87

<!-- docgen:auto -->

## Purpose
Nav icons ported verbatim from NetworkChains'
components/layout/nav-icons.tsx (client/networkchains-web-app-nextjs-v1-invite-clone,
a separate live repo — read-only source, never edited). Each renders a
single-color SVG driven by `currentColor`, so the sidebar's text-color
classes recolor them per state, exactly like the lucide icons they sit
alongside.

Only the six icons NC's admin-shell.tsx ADMIN_NAV actually uses are ported
here (Users, EarnGPT, Aixons, Catch Up, Revenue, Funnels) — NC's source
file has 17 icons total; the other eleven (LogoWordmark, FunnelStudioIcon,
OneNetworkIcon, BookMeIcon, MoneyStreamIcon, SocialRewardsIcon,
CashbackIcon, VaultsIcon, BillingIcon, OpportunitiesIcon, SettingsIcon) are
not used by this port and are intentionally left out.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`ContactsIcon`**: `className?: string`
- **`EarnGptIcon`**: `className?: string`
- **`CatchUpIcon`**: `className?: string`
- **`RevenueIcon`**: `className?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ContactsIcon` | component | `ContactsIcon({ className }: IconProps)` | 17 |
| `EarnGptIcon` | component | `EarnGptIcon({ className }: IconProps)` | 31 |
| `CatchUpIcon` | component | `CatchUpIcon({ className }: IconProps)` | 41 |
| `RevenueIcon` | component | `RevenueIcon({ className }: IconProps)` | 52 |
| `FunnelsIcon` | component | `FunnelsIcon({ className }: IconProps)` | 60 |
| `AixonsIcon` | component | `AixonsIcon({ className }: IconProps)` — Aixons — the radial "axon" burst (design SVG). | 71 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/garage-admin/(admin-dashboard)/layout.tsx`

# `app/garage-admin/(admin-dashboard)/layout.tsx`

> Super-admin dashboard shell — matches Shorupan's Garage-Dashboard Figma: • flat black chrome (no glass, no blobs) • flush-left full-height sidebar, accordion groups (one open at a time), text-only leaves with a thin left connector line, su…

**Kind:** Next.js layout · **Lines:** 1873 · **Directive:** `"use client"` · **Route:** `/garage-admin` (layout)

<!-- docgen:auto -->

## Purpose
Super-admin dashboard shell — matches Shorupan's Garage-Dashboard Figma:
  • flat black chrome (no glass, no blobs)
  • flush-left full-height sidebar, accordion groups (one open at a time),
    text-only leaves with a thin left connector line, subtle rounded
    "Users"-style active pill
  • collapsed sidebar rail (60px) with hover flyout showing that group's
    leaves — mirrors the NC sidebar-nav pattern
  • dashboard-type switcher opens as a wide right-side sheet (not a
    popup) with 4 cards (Admin / Support Agent / Garage Fulfillment /
    NetworkChains), green-check on the selected one
Non-super-admin viewers still get the legacy flat sidebar until their
own translated design ships.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Icon`×7 (local), `Link`×5 (next/link), `DropdownMenuItem`×3 (components/ui/dropdown-menu.tsx), `X`×2 (lucide-react), `InviteAdminDialog`×2 (components/garage-admin/InviteAdminDialog.tsx), `ChevronDown`×2 (lucide-react), `DropdownMenuSeparator`×2 (components/ui/dropdown-menu.tsx), `Menu` (lucide-react), `BrandDot` (local), `PanelLeftClose` (lucide-react), `Search` (lucide-react), `Button` (components/ui/button.tsx), `UserPlus` (lucide-react), `RolePill` (local), `CollapsedGroupRail` (local), `CollapsedLinkRail` (local), `ExpandedGroup` (local), `ExpandedLink` (local), `FulfillmentNav` (local), `FulfillmentEmbed` (local), `DashboardComingSoon` (local), `AdminVerifySkeleton` (components/garage-admin/AdminVerifyGate.tsx), `NoAccessPanel` (local), `TypeSheet` (local), `AdminVerifyGate` (components/garage-admin/AdminVerifyGate.tsx), `LeafRow` (local), `Avatar` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx), `SelectedIcon` (local), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `MoreVertical` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `User` (lucide-react), `Settings` (lucide-react), `LogOut` (lucide-react), `Check` (lucide-react), `ShieldCheck` (lucide-react)

### Props

- **`AdminDashboardLayout`**: `children: React.ReactNode`

**Hooks used:** `useState`×12, `useEffect`×6, `useRef`×2, `useRouter` (next/navigation), `usePathname` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminDashboardLayout)` | component | `AdminDashboardLayout({ children, }: AdminDashboardLayoutProps)` | 389 |

## Interfaces

- **garage-admin API called (`my.revenue.network`):**
  - `GET /garage-admin/profile` (L543)
- **Browser storage / cookies:** `garage_admin_token` (localStorage: get/remove), `garage_admin_info` (localStorage: get/set/remove)
- **External hosts mentioned in the code:** `fulfillment.garage.app`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `components/garage-admin/InviteAdminDialog.tsx` — `InviteAdminDialog (default)`
  - `components/garage-admin/AdminVerifyGate.tsx` — `AdminVerifyGate`, `AdminVerifySkeleton`
  - `lib/admin-api/admin-verify.ts` — `getAdminVerifyChallenge`, `AdminVerifyChallenge`
  - `components/garage-admin/sidebar-icons.tsx` — `CitizensIcon`, `VaultsIcon`, `GaragePayIcon`, `PermissionsIcon`, `OthersIcon`, `MyCryptoOfficesIcon`
  - `lib/api.ts` — `garageAdminApi`
  - `lib/admin-api/permissions.ts` — `levelSatisfies`, `LEGACY_ADMIN_PERMISSIONS`, `landingPathForAdmin`, `SUPER_ADMIN_LANDING`, `AdminPageLevel`
  - `lib/nc-admin-first-route.ts` — `NC_FIRST_HREF`
  - `components/nc-admin/nav-icons.tsx` — `ContactsIcon`, `EarnGptIcon`, `AixonsIcon`, `CatchUpIcon`, `RevenueIcon`, `FunnelsIcon`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useLayoutEffect`, `useRef`, `useState`, `ComponentType`
  - `next` — `useRouter`, `usePathname`
  - `lucide-react` — `Users`, `UserPlus`, `LogOut`, `User`, `ChevronLeft`, `ChevronRight`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin` (layout).

## Notes

- Large file (1873 lines) — read it by section; line numbers above point into it.

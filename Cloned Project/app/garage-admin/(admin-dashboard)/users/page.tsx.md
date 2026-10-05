# `app/garage-admin/(admin-dashboard)/users/page.tsx`

> Users — Admin → Users.

**Kind:** Next.js page · **Lines:** 1393 · **Directive:** `"use client"` · **Route:** `/garage-admin/users` (page)

<!-- docgen:auto -->

## Purpose
Users — Admin → Users.

Every Garage user, rendered through the same reusable Bigin-style
DataTable (components/data-table/*) as One Time Affiliates / NetworkChain
Subs, so column resize, reorder, and layout persistence come for free.
Row click opens the user's detail page.

Backend: GET /garage-admin/users (garagenew-backend controller
listAllUsers). Defaults to a prospecting view (hides users who already
activated the $25 UP sub); the "Show activated" toggle here passes
`includeActivated=true` to widen it to everyone.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CopyBtn`×3 (local), `ChevronRight`×3 (lucide-react), `DangerConfirmDialog`×2 (components/garage-admin/DangerConfirmDialog.tsx), `UserCheck`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `UserCell`×2 (local), `UplineCell`×2 (local), `AffiliateMemberDrawer` (components/garage-admin/AffiliateMemberDrawer.tsx), `DataTable` (components/data-table/DataTable.tsx), `BulkActionBar` (local), `TopBar` (local), `CompleteProfileDialog` (components/garage-admin/CompleteProfileDialog.tsx), `PhoneOff` (lucide-react), `PhoneCall` (lucide-react), `MailCheck` (lucide-react), `Trash2` (lucide-react), `MoreHorizontal` (lucide-react), `X` (lucide-react), `Filter` (lucide-react), `MoreVertical` (lucide-react), `LocationCell` (local), `JoiningCell` (local), `ProfileStatusCell` (local), `OfferCell` (local), `PurchaseVolumeCell` (local), `CommissionsCell` (local), `CheckIcon` (lucide-react), `Copy` (lucide-react), `Avatar` (local), `Building2` (lucide-react), `OfficeLogo` (local), `CheckCircle2` (lucide-react), `OfferCountdown` (local)

**Hooks used:** `useState`×29, `useMemo`×4, `useEffect`×4, `useAdminAccess`×2 (components/garage-admin/use-admin-access.ts), `useRouter` (next/navigation), `useAdminSearch` (components/garage-admin/admin-search.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminUsersListPage)` | component | `AdminUsersListPage()` | 61 |

## Interfaces

- **Browser storage / cookies:** `garage_admin_token` (localStorage: remove), `garage_admin_info` (localStorage: remove)
- **Timers / queues:** `setTimeout` at L323, L1038; `setInterval` at L1359

## Dependencies

- **Internal:**
  - `lib/admin-api/users.ts` — `listUsers`, `extendUserOffer`, `AdminUserListItem`, `AdminUserUpline`
  - `lib/admin-api/danger-zone.ts` — `getUserDeletePreview`, `deleteAdminUser`, `removeUserPhone`, `setUserEmailVerified`, `setUserPhoneVerified`, `UserDeletePreview`
  - `components/garage-admin/DangerConfirmDialog.tsx` — `DangerConfirmDialog (default)`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `lib/admin-api/demo.ts` — `isDemoAdmin`, `demoUsers`
  - `components/garage-admin/CompleteProfileDialog.tsx` — `CompleteProfileDialog (default)`
  - `components/garage-admin/AffiliateMemberDrawer.tsx` — `AffiliateMemberDrawer`
  - `components/garage-admin/admin-search.tsx` — `useAdminSearch`
  - `lib/country-flag.ts` — `getCountryFlag`
  - `components/data-table/DataTable.tsx` — `DataTable`
  - `components/data-table/types.ts` — `ColumnDef`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `ReactNode`
  - `next` — `useRouter`
  - `sonner` — `toast`
  - `lucide-react` — `ChevronDown`, `ChevronRight`, `Filter`, `CheckCircle2`, `Check as CheckIcon`, `Copy`, …

## Used by

Entry: reached by the Next.js router at `/garage-admin/users` (page).

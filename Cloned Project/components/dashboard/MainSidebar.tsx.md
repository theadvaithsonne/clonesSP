# `components/dashboard/MainSidebar.tsx`

> React component `MainSidebar`.

**Kind:** React component · **Lines:** 6537 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×53 (next/link), `ChevronDown`×28 (lucide-react), `SidebarItem`×25 (local), `CollapsibleSection`×16 (local), `DropdownMenuItem`×9 (components/ui/dropdown-menu.tsx), `Button`×9 (components/ui/button.tsx), `Users`×8 (lucide-react), `ShoppingBag`×8 (lucide-react), `Briefcase`×7 (lucide-react), `Video`×6 (lucide-react), `Compass`×5 (lucide-react), `Gift`×5 (lucide-react), `RefreshCw`×4 (lucide-react), `Rss`×4 (lucide-react), `FileText`×4 (lucide-react), `Tv`×4 (lucide-react), `Ticket`×4 (lucide-react), `BriefcaseBusiness`×4 (lucide-react), `Receipt`×4 (lucide-react), `Settings`×4 (lucide-react), `PendingCountPill`×3 (local), `TrendingUp`×3 (lucide-react), `Folder`×3 (lucide-react), `Play`×3 (lucide-react), `ListVideo`×3 (lucide-react), `History`×3 (lucide-react), `Search`×3 (lucide-react), `ChevronRight`×3 (lucide-react), `Avatar`×3 (components/ui/avatar.tsx), `AvatarImage`×3 (components/ui/avatar.tsx), `AvatarFallback`×3 (components/ui/avatar.tsx), `AnimatePresence`×2 (framer-motion), `CreditCard`×2 (lucide-react), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `UserPlus`×2 (lucide-react), `Globe`×2 (lucide-react), `IconComponent`×2 (local), `Zap`×2 (lucide-react), … +52 more

### Props

- **`MainSidebar`**: `collapsed: boolean`, `setCollapsed: (collapsed: boolean) => void`, `activePopover: string | null`, `setActivePopover: (popover: string | null) => void`, `activeContainer: string | null`, `setActiveContainer: (container: string | null) => void`, `teamforceSection?: string`, `setTeamforceSection?: (section: string) => void`, `dealsSection?: | "dashboard" | "leads" | "funnel" | "contacts" | "com…`, `setDealsSection?: ( section: | "dashboard" | "leads" | "funnel" | "co…`, `networkMailSection?: "template-library" | "campaigns" | "reports" | "…`, `setNetworkMailSection?: ( section: "template-library" | "campaigns" |…`, `thoughtsSection?: "all-notes" | "starred" | "templates" | "archive" |…`, `setThoughtsSection?: ( section: "all-notes" | "starred" | "templates"…`, `activeChatId: { type: "dm" | "group" | "global-dm"; id: string }`, `setActiveChatId: (chatId: { type: "dm" | "group" | "global-dm"; id: s…`, `setIsProfileOpen: (open: boolean) => void`, `setIsFirstTimeUser: (firstTime: boolean) => void`, `isActivityOpen: boolean`, `setIsActivityOpen: (open: boolean) => void`, `setIsAskCabinetOpen?: (open: boolean) => void`, `onMobileClose?: () => void`

**Hooks used:** `useState`×82, `useEffect`×21, `useCallback`×16, `useMemo`×8, `useChat`×3 (lib/chat-context.tsx), `useRouter`×2 (next/navigation), `useWhitelabelContext` (lib/whitelabel-context.tsx), `useSearchParams` (next/navigation), `usePathname` (next/navigation), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useModuleAccess` (lib/hooks/useModuleAccess.ts), `useIsBat246Office` (lib/bat246Office.ts), `useCanUpgrade` (components/dashboard/UpgradeToProModal.tsx), `useIsAdmin` (lib/hooks/useIsAdmin.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Member` | type |  | 170 |
| `Group` | type |  | 182 |
| `default (MainSidebar)` | component | `MainSidebar({ collapsed, setCollapsed, activePopover, setActivePopover,…)` | 462 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/my-affiliate-id` (L1290)
  - `GET /backend/org/${orgId}` (L1320)
  - `GET /backend/groups?orgId=${orgId}` (L1398)
  - `GET /backend/global-dm/conversations` (L1427)
  - `GET /backend/users/discover?search=${encodeURIComponent(search)}&limit=20` (L1448)
  - `GET /backend/apps/my?orgId=${orgId}` (L1509)
  - `POST /backend/auth/logout` (L6512)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/api/invoices/my/pending-count` (L1673)
  - `GET ${apiUrl}/api/invoices/my/list?invoiceType=recurring&status=${status}&limit=1` (L1688)
- **Socket.IO events:**
  - listens for: `invoice:pending`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `garage_org_slug` (localStorage: set)
- **Timers / queues:** `setTimeout` at L1418, L1489, L1502; `setInterval` at L1712, L1744

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `clearToken`, `getOrgId`, `getToken`, `getUserIdFromToken`, `getUserDataFromToken`
  - `components/shared/AccountSwitcher.tsx` — `AccountSwitcher (default)`
  - `lib/accounts.ts` — `setAccountPicture`
  - `lib/account-session.ts` — `signOutActiveAccount`
  - `lib/revenue-network-cache.ts` — `clearRevenueNetworkCache`, `getRevenueNetworkData`, `getEcommerceStoreSlug`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `lib/utils.ts` — `cn`
  - `lib/conv.ts` — `dmConvId`, `groupConvId`, `globalDmConvId`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
  - `components/dashboard/InviteMemberDialog.tsx` — `InviteMemberDialog (default)`
  - `components/dashboard/CreateGroupDialog.tsx` — `CreateGroupDialog (default)`
  - `components/dashboard/UpgradeToProModal.tsx` — `useCanUpgrade`
  - `components/dashboard/AppIcon.tsx` — `AppIcon (default)`
  - `components/dashboard/Marketplace.tsx` — `MarketplacePage (default)`, `CATALOG`
  - `lib/chat-context.tsx` — `useChat`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/hooks/useModuleAccess.ts` — `useModuleAccess`
  - `lib/founderPages.ts` — `isFounderPage`
  - `components/dashboard/SidebarContextMenu.tsx` — `navGroup`, `OFFICE_PAGE`, `NavNode`
  - `components/dashboard/teamAccess/AccessInboxModal.tsx` — `openAccessInbox`
  - `lib/hooks/useIsAdmin.ts` — `useIsAdmin`
  - `components/shared/ManageOrgPopover.tsx` — `ManageOrgPopover`
  - `components/shared/ReferFounderDialog.tsx` — `ReferFounderDialog`
  - `components/shared/GuestFunnelDialog.tsx` — `GuestFunnelDialog`
  - `components/dashboard/EnrollDownlineSheet.tsx` — `EnrollDownlineSheet`
  - `components/reviews/index.ts` — `RatingsReviewsDialog`
  - `components/shared/LastSeen.tsx` — `LastSeen`
  - `lib/socket.ts` — `connectSocket`
  - `lib/whitelabel-context.tsx` — `useWhitelabelContext`
  - `lib/bat246Office.ts` — `BAT246_DISPLAY_NAME`, `BAT246_HOME_PATH`, `BAT246_LOGO_SRC`, `useIsBat246Office`
  - `lib/feed-api.ts` — `getAffiliateWalletBalance`
  - `app/(dashboard)/layout.tsx` — `DashboardLayout (default)`
  - `components/dashboard/backOfficeAppSideBar.tsx` — `BackOfficeAppSideBar (default)`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`
  - `lib/aiOfficeConfig.ts` — `ALLOWED_AI_OFFICE_EMAILS`
  - `lib/jobsConfig.ts` — `isJobsAllowed`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `next` — `usePathname`, `useRouter`, `useSearchParams`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `LogOut`, `Plus`, `ChevronLeft`, `Bell`, `TrendingUp`, `UserPlus`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MobileSidebarOverlay.tsx`

## Notes

- `MainSidebar.tsx`:2219 — TODO re-enable rooms billing — office-creation entry
- Large file (6537 lines) — read it by section; line numbers above point into it.

# `components/crm/DealsNavbar.tsx`

> React component `DealsNavbar`.

**Kind:** React component · **Lines:** 3206 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×37 (components/ui/label.tsx), `SelectItem`×25 (components/ui/select.tsx), `Input`×25 (components/ui/input.tsx), `Button`×21 (components/ui/button.tsx), `Select`×13 (components/ui/select.tsx), `SelectTrigger`×13 (components/ui/select.tsx), `SelectValue`×13 (components/ui/select.tsx), `SelectContent`×13 (components/ui/select.tsx), `Dialog`×6 (components/ui/dialog.tsx), `DialogContent`×6 (components/ui/dialog.tsx), `DialogHeader`×6 (components/ui/dialog.tsx), `DialogTitle`×6 (components/ui/dialog.tsx), `DialogDescription`×6 (components/ui/dialog.tsx), `CommandEmpty`×6 (components/ui/command.tsx), `CommandGroup`×5 (components/ui/command.tsx), `CommandItem`×5 (components/ui/command.tsx), `Loader2`×4 (lucide-react), `DialogFooter`×4 (components/ui/dialog.tsx), `RefreshCw`×3 (lucide-react), `Popover`×3 (components/ui/popover.tsx), `PopoverTrigger`×3 (components/ui/popover.tsx), `ChevronsUpDown`×3 (lucide-react), `PopoverContent`×3 (components/ui/popover.tsx), `Command`×3 (components/ui/command.tsx), `CommandInput`×3 (components/ui/command.tsx), `CommandList`×3 (components/ui/command.tsx), `Check`×3 (lucide-react), `ArrowLeft`×2 (lucide-react), `Search`×2 (lucide-react), `Download`×2 (lucide-react), `Moon`×2 (lucide-react), `Plus`×2 (lucide-react), `Textarea`×2 (components/ui/textarea.tsx), `Star` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `Bell` (lucide-react), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `RotateCcw` (lucide-react), `Facebook` (lucide-react), … +3 more

### Props

- **`DealsNavbar`**: `forceStandardOnFacebook?: boolean`

**Hooks used:** `useState`×62, `useEffect`×19, `useCallback`×6, `useRouter` (next/navigation), `usePathname` (next/navigation), `useSearchParams` (next/navigation), `useTheme` (next-themes)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DealsNavbar)` | component | `DealsNavbar({ forceStandardOnFacebook = false, }: { forceStandardOnFace…)` | 3182 |

## Interfaces

- **Browser storage / cookies:** `deals` (sessionStorage: inline-section), `facebook_leads_integration` (localStorage: get), `garage_tok` (localStorage: get)
- **Timers / queues:** `setTimeout` at L1057, L1077, L1127

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuSeparator`
  - `utils/api.ts` — `getUserData`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/command.tsx` — `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `lib/deals-events.ts` — `dispatchDealsInlineNavigate`
  - `utils/leadNotifications.ts` — `getLeadNotifications`, `markNotificationsAsRead`, `getUnreadNotificationCount`, `LeadNotification`
  - `lib/auth.ts` — `getOrgId`, `getUserDataFromToken`
  - `lib/feed-api.ts` — `getTeamMembers`
- **Packages:**
  - `lucide-react` — `Search`, `Plus`, `ChevronDown`, `ChevronsUpDown`, `Bell`, `RefreshCw`, …
  - `react` — `useState`, `useEffect`, `useCallback`, `Suspense`
  - `sonner` — `toast`
  - `js-cookie`
  - `next` — `useRouter`, `usePathname`, `useSearchParams`
  - `next-themes` — `useTheme`
  - `jwt-decode` — `jwtDecode`

## Used by

- `app/(dashboard)/deals/cms/[id]/page.tsx`
- `app/(dashboard)/deals/cms/page.tsx`
- `app/(dashboard)/deals/funnel/page.tsx`
- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/deals/products/page.tsx`
- `components/crm/CRMPageLayout.tsx`

## Notes

- Large file (3206 lines) — read it by section; line numbers above point into it.

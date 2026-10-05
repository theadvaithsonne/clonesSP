# `app/garage-admin/(admin-dashboard)/networkchains/users/[userId]/page.tsx`

> Next.js page rendered at `/garage-admin/networkchains/users/[userId]`.

**Kind:** Next.js page · **Lines:** 1550 · **Directive:** `"use client"` · **Route:** `/garage-admin/networkchains/users/[userId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×8 (lucide-react), `CountCard`×4 (local), `Avatar`×3 (local), `Button`×3 (components/ui/button.tsx), `ArrowLeft`×2 (lucide-react), `Icon`×2 (local), `Wallet`×2 (lucide-react), `Search`×2 (lucide-react), `Pager`×2 (local), `ExternalLink`×2 (lucide-react), `UserX` (lucide-react), `OverviewTab` (local), `NetworkTab` (local), `ContactsTab` (local), `EarnGPTTab` (local), `MeetingsTab` (local), `WalletTab` (local), `ActivityTab` (local), `ErrorsTab` (local), `Plus` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Input` (components/ui/input.tsx), `DialogFooter` (components/ui/dialog.tsx), `Network` (lucide-react), `EarnGPTChatViewer` (components/nc-admin/users/earngpt-chat-viewer.tsx), `MeetingDetail` (components/nc-admin/users/meeting-detail.tsx), `Activity` (lucide-react), `ActivityRow` (local), `AlertOctagon` (lucide-react), `SentryIssueRow` (local)

### Props

- **`AdminUserDetailPage`**: `params: Promise<{ userId: string }>`

**Hooks used:** `useState`×50, `useEffect`×10, `useRef`×9, `useCallback`×8, `useRouter` (next/navigation), `useAdminAccess` (components/garage-admin/use-admin-access.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AdminUserDetailPage)` | component | `AdminUserDetailPage({ params, }: { params: Promise<{ userId: string }>; })` | 115 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_POSTHOG_PROJECT_URL`
- **Timers / queues:** `setTimeout` at L646, L768

## Dependencies

- **Internal:**
  - `lib/nc-admin-api/admin.ts` — `getAdminUserOverview`, `getAdminUserContacts`, `getAdminUserConversations`, `getAdminUserMeetings`, `getAdminUserNoteSessions`, `getAdminUserRecordings`, `getAdminUserWallet`, `creditAdminUserWallet`, … +13
  - `lib/nc-admin-api/auth.ts` — `ensureNcAdminToken`
  - `components/garage-admin/use-admin-access.ts` — `useAdminAccess`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/nc-admin/users/earngpt-chat-viewer.tsx` — `EarnGPTChatViewer`
  - `components/nc-admin/users/meeting-detail.tsx` — `MeetingDetail`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`, `useMemo`, `useRef`, `use`
  - `next` — `useRouter`
  - `lucide-react` — `Loader2`, `ArrowLeft`, `Search`, `Users`, `MessageSquare`, `Video`, …
  - `sonner` — `toast`

## Used by

Entry: reached by the Next.js router at `/garage-admin/networkchains/users/[userId]` (page).

## Notes

- Large file (1550 lines) — read it by section; line numbers above point into it.

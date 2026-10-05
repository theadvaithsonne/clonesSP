# `components/dashboard/RightPanel.tsx`

> React components `CommunityImageGallery`, `RightPanel`.

**Kind:** React component · **Lines:** 6989 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×17 (lucide-react), `Check`×8 (lucide-react), `Avatar`×8 (components/ui/avatar.tsx), `AvatarImage`×8 (components/ui/avatar.tsx), `AvatarFallback`×8 (components/ui/avatar.tsx), `Search`×8 (lucide-react), `Copy`×6 (lucide-react), `ChevronDown`×6 (lucide-react), `X`×4 (lucide-react), `MessageSquare`×4 (lucide-react), `AffiliateQrShare`×4 (local), `Video`×4 (lucide-react), `ChatPreviewText`×4 (components/chat/ChatPreviewText.tsx), `AnimatePresence`×3 (framer-motion), `CreateGroupDialog`×3 (components/dashboard/CreateGroupDialog.tsx), `ChevronLeft`×3 (lucide-react), `Play`×3 (lucide-react), `ChevronUp`×3 (lucide-react), `Star`×3 (lucide-react), `EmptyChatState`×3 (local), `CustomVideoPlayer`×3 (components/dashboard/CustomVideoPlayer.tsx), `Share2`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `UserPlus`×2 (lucide-react), `Download` (lucide-react), `GooglePlayMark` (local), `AppleMark` (local), `Popover` (components/ui/popover.tsx), `PopoverTrigger` (components/ui/popover.tsx), `PopoverContent` (components/ui/popover.tsx), `ExternalLink` (lucide-react), `User` (lucide-react), `Upload` (lucide-react), `CircleDollarSign` (lucide-react), `GrowNetworkSharerPicker` (local), `AlertCircle` (lucide-react), `GrowNetworkReferRow` (local), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), … +22 more

### Props

- **`CommunityImageGallery`**: `coverImage?: string`, `galleryImages: string[]`
- **`RightPanel`**: `collapsed: boolean`, `setCollapsed: (v: boolean) => void`, `activeChatId: { type: "dm" | "group" | "global-dm"; id: string }`, `setActiveChatId: (v: { type: "dm" | "group" | "global-dm"; id: string…`, `setActivePopover: (v: string | null) => void`, `width?: number`, `setWidth?: (v: number) => void`, `isDragging?: boolean`, `setIsDragging?: (v: boolean) => void`, `onClose?: () => void`, `activePopover?: string | null`

**Hooks used:** `useState`×83, `useEffect`×29, `useMemo`×11, `useRef`×3, `useSidebarCollapse` (lib/sidebar-collapse-context.tsx), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useOrgShareOrigin` (lib/hooks/useOrgShareOrigin.ts), `useAuthStore` (store/authStore.tsx), `useChat` (lib/chat-context.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GrowNetworkLinkKind` | type | The funnels a user can hand out from "Grow Your Network". | 459 |
| `CommunityImageGallery` | component | `CommunityImageGallery({ coverImage, galleryImages, }: { coverImage?: string; gall…)` — Community images for the info panel. | 1629 |
| `default (RightPanel)` | component | `RightPanel({ collapsed, setCollapsed, activeChatId, setActiveChatId, s…)` | 1696 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/affiliate/referrer-info?userId=${encodeURIComponent(candidate.id)}` (L1145)
  - `GET /backend/org/${orgId}` (L2316)
  - `GET /backend/guest-auth/guest-limit-status?orgId=${orgId}` (L2344)
  - `GET /backend/affiliate/my-affiliate-id` (L2371)
  - `POST /backend/drops/${id}/view` (L2723)
  - `GET /backend/groups?orgId=${orgId}` (L5311)
  - `GET /backend/global-dm/conversations` (L5323)
  - `GET /backend/users/discover?search=${encodeURIComponent(search)}&limit=20` (L5334)
  - `POST /backend/drops/${currentDrop._id}/share` (L6851)
  - `POST /backend/drops/${currentDrop._id}/like` (L6888)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${API_URL}/note-taker/by-workshop/${encodeURIComponent(realId)}/summary` (L2065)
  - `GET ${apiUrl}/webinar/${video._id}/recordings` (L2117)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_NETWORKCHAINS_URL`, `NEXT_PUBLIC_GARAGE_FOUNDERS_URL`, `NEXT_PUBLIC_GARAGE_ECOMMERCE_URL`, `NEXT_PUBLIC_GARAGE_IRL_URL`, `NEXT_PUBLIC_GARAGE_BACKOFFICE_URL`, `NEXT_PUBLIC_GARAGE_WHITELABEL_URL`, `NEXT_PUBLIC_GARAGE_COMPLAN_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GARAGE_AFFILIATE_BASE_URL`, `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `garage_org_slug` (localStorage: get), `dashboard.rightpanel.width` (localStorage: get/set), `dashboard.rightpanel.infowidth` (localStorage: set), `chat_favourites` (localStorage: get/set/remove)
- **Timers / queues:** `setTimeout` at L958, L1086, L1299, L2709
- **External hosts mentioned in the code:** `www.garage.app`, `www.youtube.com`, `api.qrserver.com`, `play.google.com`, `apps.apple.com`, `networkchains.com`, `founder.garage.app`, `ecommerce.garage.app`, `irl.garage.app`, `backoffice.garage.app`, `whitelabel.garage.app`, `complan.garage.app`, `my.garage.app`, `gotobigwin.com`

## Dependencies

- **Internal:**
  - `components/chat/ChatPreviewText.tsx` — `ChatPreviewText`
  - `components/dashboard/drops/DropVideoPlayer.tsx` — `DropVideoPlayer (default)`
  - `components/dashboard/CustomVideoPlayer.tsx` — `CustomVideoPlayer (default)`
  - `components/webinar/WebinarChatReplay.tsx` — `WebinarChatReplay (default)`
  - `lib/hooks/useOrgShareOrigin.ts` — `useOrgShareOrigin`
  - `lib/utils.ts` — `cn`, `slugify`
  - `lib/coverOriginal.ts` — `readCoverOriginal`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `lib/chat-context.tsx` — `useChat`
  - `lib/sidebar-collapse-context.tsx` — `useSidebarCollapse`
  - `components/dashboard/NotificationPage.tsx` — `NotificationPage (default)`
  - `components/dashboard/MiniChatWindow.tsx` — `MiniChatWindow (default)`
  - `components/dashboard/CreateGroupDialog.tsx` — `CreateGroupDialog (default)`
  - `components/dashboard/InviteMemberDialog.tsx` — `InviteMemberDialog (default)`
  - `lib/feed-api.ts` — `getTeamMembers`, `TeamMember`, `searchUsersForAssignment`, `getCombPlanForItem`, `getChannelSubscribers`, `getChannelMembershipDetails`, `getChannelWithStats`, `CombPlan`, … +19
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/calendar.tsx` — `Calendar`
  - `components/reviews/index.ts` — `ReviewsPanel`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `store/authStore.tsx` — `useAuthStore`
  - `lib/reviews-api.ts` — `ReviewTargetType`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `useRef`
  - `lucide-react` — `StickyNote`, `ThumbsUp`, `ThumbsDown`, `ChevronDown`, `ChevronUp`, `Bell`, …
  - `framer-motion` — `AnimatePresence`, `motion`
  - `date-fns` — `format`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/MobileRightPanelOverlay.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L4238), `dangerouslySetInnerHTML` (L4475), `dangerouslySetInnerHTML` (L5574).
- Large file (6989 lines) — read it by section; line numbers above point into it.

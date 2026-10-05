# `components/dashboard/FeedPageRedesigned.tsx`

> React component `FeedPage`.

**Kind:** React component · **Lines:** 2430 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog`×6 (components/ui/dialog.tsx), `DialogContent`×6 (components/ui/dialog.tsx), `Button`×5 (components/ui/button.tsx), `MemoPostCard`×3 (local), `Hash`×3 (lucide-react), `DialogHeader`×3 (components/ui/dialog.tsx), `DialogTitle`×3 (components/ui/dialog.tsx), `Play`×2 (lucide-react), `Hand`×2 (lucide-react), `MessageCircle`×2 (lucide-react), `Calendar`×2 (lucide-react), `CheckSquare`×2 (lucide-react), `BookingDialog`×2 (components/dashboard/BookingDialog.tsx), `UserTodosDialog`×2 (components/dashboard/UserTodosDialog.tsx), `InlinePostComposer`×2 (components/feed/InlinePostComposer.tsx), `ImageIcon` (lucide-react), `PostDetailView` (components/dashboard/PostDetailView.tsx), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `Link2` (lucide-react), `Lock` (lucide-react), `Rss` (lucide-react), `RatingsReviewsCard` (components/reviews/index.ts), `Bookmark` (lucide-react), `ArrowLeft` (lucide-react), `CreatePostModal` (components/feed/CreatePostModal.tsx), `Youtube` (lucide-react), `Input` (components/ui/input.tsx), `Upload` (lucide-react), `Loader2` (lucide-react), `Video` (lucide-react), `ChannelPaymentModalNew` (components/dashboard/ChannelPaymentModalNew.tsx), `QuotePostModal` (components/feed/QuotePostModal.tsx), `AnimatePresence` (framer-motion), `X` (lucide-react)

**Hooks used:** `useState`×61, `useCallback`×31, `useEffect`×18, `useMemo`×12, `useUploadThing`×3 (lib/uploadthing.ts), `useRef`×2, `useUser` (store/authStore.tsx), `useIsomorphicLayoutEffect` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FeedPage` | component | `FeedPage()` | 181 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl}/affiliate/my-affiliate-id` (L350)
- **Socket.IO events:**
  - emits: `feed:join-org`, `feed:join-channels`, `feed:leave-org`, `feed:leave-channel`, `feed:join-post`, `feed:leave-post`
  - listens for: `feed:new-post`, `feed:post-liked`, `feed:new-comment`, `feed:post-pinned`, `feed:post-unpinned`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get), `feed` (sessionStorage: selected-channel-id/selected-channel-id), `garage_org_slug` (localStorage: get), `workspace` (sessionStorage: pending-knock)
- **Timers / queues:** `setTimeout` at L753, L757
- **External hosts mentioned in the code:** `www.youtube.com`, `img.youtube.com`

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `getOrgChannels`, `getPosts`, `createPost`, `updatePost`, `deletePost`, `toggleLike`, `toggleRepost`, `toggleBookmark`, … +17
  - `components/ui/button.tsx` — `Button`
  - `lib/utils.ts` — `cn`
  - `lib/sanitizeDescription.ts` — `sanitizeDescription`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/FeedComponents.tsx` — `PostCard`, `Post as CardPost`
  - `components/dashboard/PostDetailView.tsx` — `PostDetailView`
  - `components/ui/link-preview.tsx` — `LinkPreview`
  - `lib/url-utils.ts` — `getFirstUrl`
  - `lib/revenue-network-cache.ts` — `getPageCache`, `setPageCache`, `invalidatePageCache`, `getRevenueNetworkData`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/input.tsx` — `Input`
  - `lib/uploadthing.ts` — `useUploadThing`
  - `components/dashboard/ChannelPaymentModalNew.tsx` — `ChannelPaymentModalNew`
  - `lib/socket.ts` — `connectSocket`
  - `components/feed/CreatePostModal.tsx` — `CreatePostModal`
  - `components/feed/InlinePostComposer.tsx` — `InlinePostComposer`
  - `components/feed/MobileCreatePostPage.tsx` — `MobileCreatePostPage`
  - `components/feed/QuotePostModal.tsx` — `QuotePostModal`
  - `components/dashboard/BookingDialog.tsx` — `BookingDialog (default)`
  - `components/dashboard/UserTodosDialog.tsx` — `UserTodosDialog`
  - `components/reviews/index.ts` — `RatingsReviewsCard`
  - `store/authStore.tsx` — `useUser`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useLayoutEffect`, `useCallback`, `useMemo`, `useRef`, …
  - `lucide-react` — `Rss`, `Plus`, `X`, `Image as ImageIcon`, `Video`, `FileText`, …
  - `framer-motion` — `motion`, `AnimatePresence`
  - `sonner` — `toast`

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L1805), `dangerouslySetInnerHTML` (L2192).
- Large file (2430 lines) — read it by section; line numbers above point into it.

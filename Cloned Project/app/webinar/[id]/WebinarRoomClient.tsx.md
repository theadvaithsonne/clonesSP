# `app/webinar/[id]/WebinarRoomClient.tsx`

> React component `WebinarRoomClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 2342 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StoreCheckoutDialog`×2 (components/webinar/StoreCheckoutDialog.tsx), `Check`×2 (lucide-react), `WebinarPreJoin` (components/webinar/WebinarPreJoin.tsx), `EvergreenRoom` (components/webinar/EvergreenRoom.tsx), `ChatPanel` (components/webinar/ChatPanel.tsx), `BidsPanel` (components/webinar/BidsPanel.tsx), `ParticipantsList` (components/webinar/ParticipantsList.tsx), `ShopPanel` (components/webinar/ShopPanel.tsx), `JoinRequestsPanel` (components/webinar/JoinRequestsPanel.tsx), `StreamHeaderInfo` (local), `InviteButton` (local), `ChatToggleButton` (local), `VideoGrid` (components/webinar/VideoGrid.tsx), `FullscreenButton` (components/webinar/FullscreenButton.tsx), `ControlBar` (components/webinar/ControlBar.tsx), `MicPickerDialog` (components/webinar/MicPickerDialog.tsx), `PlanPhoneVerifySheet` (components/webinar/PlanPhoneVerifySheet.tsx), `LiveAuctionCard` (components/webinar/LiveAuctionCard.tsx), `PinnedProductCard` (components/webinar/PinnedProductCard.tsx), `ProductPickerDialog` (components/webinar/ProductPickerDialog.tsx), `WebinarCheckoutDialog` (components/webinar/WebinarCheckoutDialog.tsx), `TabButton` (local), `X` (lucide-react), `WebinarPipContent` (components/webinar/WebinarPipContent.tsx), `UserPlus` (lucide-react), `Share2` (lucide-react), `MessageSquare` (lucide-react)

**Hooks used:** `useState`×36, `useEffect`×17, `useWebinarStore`×14 (store/webinarStore.ts), `useCallback`×12, `useRef`×8, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useRouter` (next/navigation), `useSimulatedAudience` (components/webinar/useSimulatedAudience.ts), `useWebinarLiveKit` (hooks/useWebinarLiveKit.ts), `useLiveLot` (hooks/webinar/useLiveLot.ts), `useMemo`, `usePictureInPicture` (hooks/livekit/usePictureInPicture.ts), `useAuthStore` (store/authStore.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (WebinarRoomClient)` | component | `WebinarRoomClient()` | 89 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/webinar/${webinarId}/evergreen-state` (L551)
  - `POST /backend/public/webinar/join-anonymous` (L594)
  - `GET /backend/affiliate/my-affiliate-id` (L2211)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${base}/public/webinar/validate?id=${webinarId}` (L644)
- **Socket.IO events:**
  - emits: `webinar:startRecording`, `webinar:endWebinar`, `webinar:joinRoom`, `webinar:respondJoinRequest`, `webinar:leaveRoom`, `webinar:productPurchased`, `webinar:unpinProduct`, `webinar:pinProduct`
  - listens for: `connect`, `disconnect`, `connect_error`, `webinar:newMessage`, `webinar:messageReaction`, `webinar:recordingStarted`, `webinar:recordingStopped`, `webinar:recordingReady`, `webinar:replacedByDevice`, `webinar:peerJoined`, `webinar:peerLeft`, `webinar:peerRoleChanged`, `webinar:peerMicState`, `webinar:peerCameraState`, `webinar:joinRequest`, `webinar:handRaised`, `webinar:forceMuted`, `webinar:reaction`, `webinar:removedFromRoom`, `webinar:roleChanged`, `webinar:webinarEnded`, `webinar:newQA`, `webinar:qaUpdated`, `webinar:newPoll`, `webinar:pollUpdated`, `webinar:productPinned`, `webinar:productUnpinned`, `webinar:productPurchased`, `webinar:auctionPing`
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setInterval` at L488; `setTimeout` at L731, L1175, L1211, L1517, L2234, …
- **External hosts mentioned in the code:** `www.garage.app`

## Dependencies

- **Internal:**
  - `lib/socket.ts` — `connectWebinarSocket`, `disconnectWebinarSocket`
  - `components/webinar/EvergreenRoom.tsx` — `EvergreenRoom (default)`
  - `lib/auth.ts` — `getToken`, `getUserDataFromToken`, `getOrgId`, `isAuthenticated`
  - `hooks/useWebinarLiveKit.ts` — `useWebinarLiveKit`
  - `lib/webinar/magic-link.ts` — `createMagicLink`, `readMagicLink`, `magicLinkUrl`
  - `components/webinar/PlanPhoneVerifySheet.tsx` — `PlanPhoneVerifySheet (default)`
  - `components/webinar/JoinRequestsPanel.tsx` — `JoinRequestsPanel (default)`
  - `lib/whitelabel.ts` — `fetchWhitelabelOrg`
  - `lib/webinar/garage-store-plans.ts` — `resolveGarageStoreItem`, `resolveTermMonths`, `parseGarageStoreId`, `createComboInvoice`, `claimFreeMonth`, `subscribeStandalone`, `subscribeOffice`
  - `store/webinarStore.ts` — `useWebinarStore (default)`, `detectLocalDeviceType`
  - `components/webinar/useSimulatedAudience.ts` — `useSimulatedAudience`
  - `lib/webinar-device.ts` — `describeThisBrowser`, `getWebinarDeviceId`
  - `store/webinarStore.ts` — `WebinarRole`, `(types only)`
  - `components/webinar/VideoGrid.tsx` — `VideoGrid (default)`
  - `components/webinar/ChatPanel.tsx` — `ChatPanel (default)`
  - `components/webinar/ParticipantsList.tsx` — `ParticipantsList (default)`
  - `components/webinar/ControlBar.tsx` — `ControlBar (default)`
  - `components/webinar/MicPickerDialog.tsx` — `MicPickerDialog (default)`
  - `lib/webinar/mic-devices.ts` — `realAudioInputs`
  - `components/webinar/FullscreenButton.tsx` — `FullscreenButton (default)`
  - `components/webinar/PinnedProductCard.tsx` — `PinnedProductCard (default)`
  - `components/webinar/ProductPickerDialog.tsx` — `ProductPickerDialog (default)`
  - `components/webinar/WebinarCheckoutDialog.tsx` — `WebinarCheckoutDialog (default)`
  - `components/webinar/StoreCheckoutDialog.tsx` — `StoreCheckoutDialog (default)`
  - `lib/feed-api.ts` — `generateInvoice`, `InvoiceReferrerInfo`, `Sellable`
  - `lib/webinar/currency.ts` — `DisplayCurrency`, `(types only)`
  - `hooks/livekit/usePictureInPicture.ts` — `usePictureInPicture`
  - `components/webinar/WebinarPipContent.tsx` — `WebinarPipContent (default)`
  - `components/webinar/WebinarPreJoin.tsx` — `WebinarPreJoin (default)`
  - `components/webinar/ShopPanel.tsx` — `ShopPanel (default)`
  - `components/webinar/BidsPanel.tsx` — `BidsPanel (default)`
  - `components/webinar/LiveAuctionCard.tsx` — `LiveAuctionCard (default)`
  - `hooks/webinar/useLiveLot.ts` — `useLiveLot`
  - `lib/api/auctions.ts` — `cancelAuction`, `startAuctionRound`, `AuctionRoundConfig`
  - `lib/api/auctionLot.ts` — `isSettled`
  - `lib/webinar/bid-channel.ts` — `announceLotChange as announceLot`, `dispatchLocalPing`
  - `store/authStore.tsx` — `useAuthStore`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useRef`, `useCallback`, `useMemo`
  - `next` — `useParams`, `useSearchParams`, `useRouter`
  - `sonner` — `toast`
  - `socket.io-client` — `Socket`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Share2`, `Check`, `X`, `MessageSquare`, `UserPlus`

## Used by

- `app/webinar/[id]/page.tsx`

## Notes

- Large file (2342 lines) — read it by section; line numbers above point into it.

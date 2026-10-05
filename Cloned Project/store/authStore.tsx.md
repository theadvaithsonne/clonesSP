# `store/authStore.tsx`

> React hooks `useUser`, `useIsAuthenticated`, `useAuthLoading`, `useAuthError`.

**Kind:** client state store · **Lines:** 365

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useAuthStore`×4 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `User` | interface |  | 8 |
| `AuthState` | interface |  | 41 |
| `useAuthStore` | const | `= create<AuthState>()( persist( (set, get) => ({ user: null, isAuthenticated: false, isLoading: fal…` | 65 |
| `useUser` | hook | `useUser()` | 362 |
| `useIsAuthenticated` | hook | `useIsAuthenticated()` | 363 |
| `useAuthLoading` | hook | `useAuthLoading()` | 364 |
| `useAuthError` | hook | `useAuthError()` | 365 |

## Interfaces

- **Browser storage / cookies:** `user-data` (cookie: set/remove), `auth-token` (cookie: remove/set), `auth-token` (localStorage: get/remove/set), `garage_tok` (localStorage: get), `facebook_leads_integration` (localStorage: get/set)

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`
  - `js-cookie`
  - `jwt-decode` — `jwtDecode`

## Used by

- `app/(auth)/verify/page.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/components/TaskroomSubPage.tsx`
- `app/(dashboard)/taskroom/components/sidebar.tsx`
- `app/events/[id]/checkout/CheckoutClient.tsx`
- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`
- `components/dashboard/RightPanel.tsx`
- `components/dashboard/docusign/internal/SigningView.tsx`
- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`
- `components/dashboard/inlineApps/events/browse-ui.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx`
- `components/events/ShareEventModal.tsx`
- `components/events/checkout/CheckoutIdentity.tsx`
- `components/shared/AssociateAccountCard.tsx`
- `components/shared/PhoneVerifyBanner.tsx`
- `components/shared/ProfilePopover.tsx`
- `components/webinar/ChatPanel.tsx`
- `components/webinar/ParticipantsList.tsx`
- `components/webinar/PlanPhoneVerifySheet.tsx`
- `components/webinar/VideoGrid.tsx`
- `components/webinar/WebinarPipContent.tsx`
- `lib/account-session.ts`

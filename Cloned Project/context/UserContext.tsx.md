# `context/UserContext.tsx`

> React context that exposes the signed-in user's identity (decoded from the `garage_tok` JWT in localStorage) and the organisation's Razorpay payment/subscription status.

**Kind:** React context · **Lines:** 352

## Purpose
A lightweight, legacy-style user context used by a handful of features (Thoughts notes, Deals, a taskroom document manager) that need the current user's name, ID, email, role or organisation ID without going through the main zustand auth store (`store/authStore.tsx`). It also carries a small "does this organisation have an active payment" model, fetched from an external payments service. It is mounted locally by the pages that need it, not globally.

## How it works

### Identity state (L77-L98, L226-L244)
- Holds seven string fields in separate `useState` hooks: `name`, `role`, `userId`, `employeeId`, `clientId`, `email`, `organizationId`.
- On mount, reads `localStorage.getItem("garage_tok")` and decodes it with `jwtDecode` (no signature verification - this is display data only). Mapping:
  - `name` <- `name`; `role` <- `role` (default `'user'`)
  - `userId` <- `userId` or `id`
  - `email` <- `email`; `employeeId` <- `employeeId`
  - `clientId` <- `clientId` or `id`
  - `organizationId` <- `orgId`
- Decode errors are logged and the fields stay empty. Subscriptions are intentionally **not** fetched on mount (a comment says the launchpad page should trigger that explicitly).

### `setUser(...)` (L246-L299)
- Overwrites all identity fields from its arguments.
- Re-decodes the current `garage_tok` and, if it has `isImpersonated`, copies the impersonation claims (`isImpersonated`, `impersonationId`, `originalSupportUserId`, `impersonatorId`, `impersonatorName`, `impersonatorRole`).
- Writes a `user-data` cookie (JSON of the new identity plus any impersonation claims) with `path: "/"`, `secure: true`, `sameSite: "none"` (so iframes on other origins can read it) and a 7-day expiry.
- If an organisation ID was supplied, triggers a subscription fetch.

### `clearUser()` (L301-L324)
Resets all fields and the subscription data to defaults and removes the `user-data` cookie. It does **not** remove `garage_tok`.

### Subscription model (L100-L224)
- `fetchSubscriptionDetails(orgId)` calls `GET https://garage.marketsverse.com/v1/payments/razorpay/{orgId}/status` (external service, hardcoded URL). If the response has `status` and `data`, it reads `data.paymentStatus` and `data.paymentType`; `statusCounts.active` becomes 1 only when `paymentStatus === 'active'`. All other counters always stay 0. Errors return an empty result.
- `fetchAllSubscriptions(orgId)` sets `isLoading`, then:
  - active payment -> builds a single **synthetic** `Subscription` object (`id: "{orgId}-payment"`, period `lifetime` for `oneTime` else `monthly`, `amount: 0`, fabricated `subscriptionDetails` IDs and timestamps) so UIs that list subscriptions have something to render;
  - otherwise -> empty list, `hasActiveSubscriptions: false`.
- `totalAmount` is always 0 because the status API gives no amount.
- `refreshSubscriptions()` re-runs the fetch for the current `organizationId`; `fetchSubscriptionsForOrganization(orgId)` runs it for any org.

## Exports
- `UserProvider({ children })` - provider component holding all state above.
- `useUser()` - returns the context value (`name`, `role`, `userId`, `employeeId`, `clientId`, `email`, `organizationId`, `subscriptionData`, `setUser`, `clearUser`, `refreshSubscriptions`, `fetchSubscriptionsForOrganization`); throws `useUser must be used within a UserProvider` outside a provider.

Internal (not exported) types: `SubscriptionStatus`, `StatusCounts`, `SubscriptionDetails`, `JwtPayload`, `Subscription`, `SubscriptionData`, `UserContextType`.

## Interfaces
- **External services:** `GET https://garage.marketsverse.com/v1/payments/razorpay/{orgId}/status` - organisation payment status (not part of this repo).
- **Browser storage / cookies:** reads localStorage `garage_tok` (the main app JWT); writes/removes cookie `user-data` (Secure, SameSite=None, 7 days).

## Dependencies
- **Packages:** `react` (context/state), `jwt-decode` (decode `garage_tok` claims), `js-cookie` (`user-data` cookie), `axios` (payment status request).

## Used by
- Providers mounted in `app/(dashboard)/deals/layout.tsx` (wraps `/deals/*`) and `app/(dashboard)/thoughts/page.tsx` (`/thoughts`).
- `useUser()` consumers: `app/(dashboard)/thoughts/components/NotePageComments.tsx`, `NoteSharePopover.tsx`, `blocks/CommentBlock.tsx`, `components/deals/ProductOnboardingFlow.tsx`, `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/DocumentManager.tsx`.

## Notes
- The file has no `"use client"` directive; it works only because every importer is itself a client component.
- `DocumentManager.tsx` calls `useUser()` but is not under either known `UserProvider`; if it renders outside one, the hook throws.
- Identity comes from an unverified client-side JWT decode and is not refreshed when the token changes in another tab or after login, unless `setUser` is called.
- The error message in the mount effect says "from cookies" but the data is read from localStorage.
- The subscription objects are fabricated placeholders; do not treat their IDs, dates or amounts as real billing data.

# `app/(affiliate)/[orgSlug]/[channelId]/page.tsx`

> Public affiliate invite landing page for a single channel: shows who invited the visitor and to which organization, then runs an email-OTP sign-up that joins the organization (and the channel) and, for paid one-time channels, opens Razorpay checkout.

**Kind:** Next.js page · **Lines:** 997 · **Route:** `/[orgSlug]/[channelId]?ref=<affiliateId>`

## Purpose
Affiliates share channel-specific links in the form `/{storeSlug}/{channelId}?ref={affiliateId}` (built in `components/dashboard/AffiliatePageNew.tsx`). This page is what a visitor lands on. It renders a branded "Exclusive Invitation" view, records the affiliate click (through the invite-details call), and turns the visitor into a guest stakeholder member of the organization, attributed to the referring affiliate. It is the channel-level counterpart of `app/(affiliate)/[orgSlug]/page.tsx`, which lets the visitor choose a channel instead. The `(affiliate)` route group does not appear in the URL, so the page answers any two-segment path not taken by a more specific route.

## How it works

### Loading (L77-L152)
- Reads `orgSlug` and `channelId` from the route params and `ref` (the affiliate id) from the query string.
- If `orgSlug` or `ref` is missing, it shows a toast "Invalid invite link" and stops loading, which ends on the "Invalid Invitation" card.
- Otherwise `fetchInviteDetails()` calls `GET /backend/affiliate/invite-details?orgSlug=...&affiliateId=...&channelId=...` plus `&cs=<sessionId>&cv=<visitorId>` from `affiliateClickParams()`. The backend looks the organization up by `store.slug`, the affiliate by `User.affiliateId`, and the channel by id. It also records a deduplicated affiliate click as a fire-and-forget side effect.
- `organization`, `affiliate` and `channel` are stored in state. With no organization or affiliate, the page renders the "Invalid Invitation" card with a link home.

### Derived values
- `isPaidChannel = channel && !channel.isFree && channel.price > 0`.
- `displayPrice = channel.price`. It is always shown with a hard-coded `₹`, whatever `channel.currency` says.

### Step machine
`step` is one of `"view" | "email" | "otp" | "details" | "processing" | "payment"`. The right-hand column changes with it:
1. **view**: cover photo (or a placeholder with a sparkles icon), a "What You'll Get" benefits grid, and the CTA. The CTA reads "Join & Pay ₹X" for paid channels and "Accept Invitation & Join" otherwise. Clicking it goes to `email`.
2. **email** (`handleRequestOTP`): `POST /backend/affiliate/request-otp` with `{ email, orgSlug }`. The backend creates an OTP with purpose `affiliate-invite`, tied to the org, and emails it.
3. **otp** (`handleVerifyOTP`): the input accepts digits only, and the code must be exactly 6 digits. Calls `POST /backend/affiliate/check-user` with `{ email, code }`. This checks the OTP without consuming it and reports `needsProfile` (true when there is no user, or the user has no name or no phone). Existing name and phone values are prefilled. If a profile is needed the page goes to `details`; if not, it calls `handleAcceptInvite()` straight away. The backend answers 400 when the user already belongs to the organization, and `api()` turns that into a thrown error shown as a toast.
4. **details**: asks for full name and phone (digits only), then submits to `handleAcceptInvite`.
5. **processing** (`handleAcceptInvite`, L329-L393): `POST /backend/affiliate/accept-invite` with `{ email, code, orgSlug, channelId, affiliateId, name?, phone? }`. `channelId` is sent **only for free channels**, so a paid channel is not joined before payment. The backend consumes the OTP and finds or creates the user. A new user is created as a guest with a generated affiliate id, `referredBy` set to the referrer and HQ membership added. The backend then adds a `stakeholder` guest membership on the org's lowest floor, joins the channel if an id was sent, and returns `{ token, orgId }`.
   - Free channel: the page stores `garage_tok` and `garage_org_id` in localStorage and calls `router.push("/workspace")` after 1 second.
   - Paid channel: it keeps the token and orgId in `tempToken`/`tempOrgId`, sets `step = "payment"` and calls `handleChannelPayment`.
   - On failure it goes back to `details` or `otp`.
6. **payment** (`handleChannelPayment`, L170-L261):
   - `loadRazorpayScript()` injects `https://checkout.razorpay.com/v1/checkout.js` once.
   - It calls `POST /backend/feed/channels/:channelId/create-order?orgId=...` with the new token.
   - It opens the Razorpay modal with `key: NEXT_PUBLIC_RAZORPAY_KEY_ID`, the email and phone prefilled, and theme colour `#FBA70A`.
   - On success the handler calls `POST /backend/feed/channels/:channelId/verify-payment?orgId=...` with `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`. The backend checks the signature, subscribes the user to the paid channel and distributes commissions. The page then saves the token and org id and redirects to `/workspace`.
   - If the modal is dismissed, a "Payment cancelled" toast appears and the "Pay Now" button lets the user retry with the stored temp token.

### Static left column
The left column shows an "Invited By" card (affiliate avatar or initial, name, email, and a role badge from `affiliate.type`) and an "Organization" card (icon, name, city/state/country, `headingText`, `subHeadingText`, description). When a channel was loaded, a channel card shows its cover, title, sanitized HTML description, and either the price with "One-time payment" / "`<period>` subscription", or "Free Access".

## Exports
- `default AffiliateInvite()` - the client page component.
- Also adds a global type declaration: `Window.Razorpay: any`.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/affiliate/invite-details?orgSlug&affiliateId&channelId&cs&cv` - org, affiliate and channel details, plus server-side click recording
  - `POST /backend/affiliate/request-otp` - email the invite OTP
  - `POST /backend/affiliate/check-user` - validate the OTP and decide whether a profile is needed
  - `POST /backend/affiliate/accept-invite` - create or attach the user, add org (and free channel) membership, return a JWT
  - `POST /backend/feed/channels/:channelId/create-order?orgId=` (auth) - Razorpay order for a one-time paid channel
  - `POST /backend/feed/channels/:channelId/verify-payment?orgId=` (auth) - verify the payment and subscribe the user
- **External services:** Razorpay Checkout (script loaded from `checkout.razorpay.com`).
- **Environment variables:** `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Razorpay public key id; `NEXT_PUBLIC_API_URL` (indirectly through `lib/api.ts`).
- **Browser storage / cookies:** writes `garage_tok` and `garage_org_id` to localStorage. `affiliateClickParams()` reads or creates `nc_click_sid` (sessionStorage) and `nc_click_vid` (localStorage).

## Dependencies
- **Internal:**
  - `lib/api.ts` - `api()` fetch wrapper (adds the Bearer token, throws on non-2xx)
  - `lib/affiliate-click.ts` - `affiliateClickParams()` for click attribution
  - `lib/sanitizeDescription.ts` - sanitizes channel description HTML before `dangerouslySetInnerHTML`
  - `lib/auth.ts` - `isAuthenticated` (imported but unused)
  - `components/ui/button.tsx`, `card.tsx`, `input.tsx` - shadcn UI primitives
- **Packages:** `react`, `next` (`next/navigation`, `next/link`), `lucide-react` (icons), `sonner` (toasts).

## Used by
No file imports it. It is reached at `/{orgSlug}/{channelId}?ref={affiliateId}`; those links are generated in `components/dashboard/AffiliatePageNew.tsx`.

## Notes
- **Subscription channels cannot be bought here.** `create-order` returns 400 for `isSubscription` channels and points to `/create-subscription`. `api()` throws, and the user sees only "Failed to process payment" after already being made an org member.
- Paid flow ordering: the user becomes an org member in `accept-invite` **before** paying, but the token is only saved to localStorage after a verified payment. If the user abandons payment and reloads, `check-user` rejects them as "already a member" and they have no saved session from this page.
- The `affiliate.type` badge (Founder/Stakeholder) never renders, because `invite-details` does not return a `type` field.
- `isAuthenticated`, `redirecting`/`setRedirecting` and the `earngpt_data` field on `OrganizationData` are unused.
- The `response.success === false` branches only run on a 2xx response with `success: false`. Errors returned as 4xx/5xx are thrown by `api()` and handled in the `catch` blocks.
- The phone placeholder `923XXXXXXXX` suggests a Pakistani number format, and no country code is collected.

# `app/(affiliate)/[orgSlug]/page.tsx`

> Public affiliate invite landing page for an organization: shows the inviting affiliate and the organization, lets the visitor browse the org's channels, and runs an email-OTP sign-up that joins the org and the chosen channel.

**Kind:** Next.js page · **Lines:** 829 · **Route:** `/[orgSlug]?ref=<affiliateId>`

## Purpose
Affiliates share organization-level links in the form `https://my.garage.app/{storeSlug}?ref={affiliateId}` (built in `components/dashboard/AffiliatePageNew.tsx`). This page is the landing page for those links. It records the affiliate click, presents the organization, and turns the visitor into a guest stakeholder member attributed to the referring affiliate. Unlike its sibling `app/(affiliate)/[orgSlug]/[channelId]/page.tsx`, the visitor picks a channel here, and there is no payment step. The `(affiliate)` route group does not appear in the URL, so the page answers any single-segment path not claimed by a more specific route.

## How it works

### Loading (L84-L146)
- Reads `orgSlug` from the route params and `ref` (the affiliate id) from the query string. If either is missing, it shows the toast "Invalid invite link" and ends on the "Invalid Invitation" card.
- `fetchInviteDetails()` calls `GET /backend/affiliate/invite-details?orgSlug=...&affiliateId=...` plus `&cs=&cv=` from `affiliateClickParams()`. The backend looks the organization up by `store.slug` and the affiliate by `User.affiliateId`. It also records a deduplicated affiliate click as a fire-and-forget side effect (item type `unknown`, because no channel is given).
- With no organization or affiliate, the page shows the "Invalid Invitation" card with a link home.

### Step machine
`type ViewStep = "initial" | "channels" | "email" | "otp" | "details" | "processing"`. Each step renders its own full-width layout:
1. **initial** (L383-L568): a two-column grid. The left column has the "Invited By" card (avatar or initial, name, email, role badge from `affiliate.type`) and the "Organization" card (icon, name, city/state/country, `headingText`, `subHeadingText`). The right column has an "Explore Exclusive Channels" call to action with a **See Channels** button.
2. **See Channels** (`handleSeeChannels`, L148-L176): requires `organization.earngpt_data.store.storeId`, then calls `GET /backend/affiliate/org-channels/:storeId`. The backend runs `getStoreChannels()`, which finds active `Channel` documents with that `storeId`. On success the page shows the `channels` step.
3. **channels** (L571-L634): a grid of channel cards (cover image, title, sanitized HTML description, then "Free" or `currency price`). Clicking one calls `handleChannelSelect`, which stores `selectedChannel` and goes to `email`.
4. **email** (`handleRequestOTP`): `POST /backend/affiliate/request-otp` with `{ email, orgSlug }`, which emails an `affiliate-invite` OTP tied to the org. A "Back to channels" link returns to the list.
5. **otp** (`handleVerifyOTP`): accepts exactly 6 digits, then calls `POST /backend/affiliate/check-user` with `{ email, code }`. This validates the OTP without consuming it, rejects users who are already members (400, surfaced as a toast), and returns `needsProfile` and the existing name and phone. The page goes to `details` if a profile is needed; otherwise it calls `handleAcceptInvite()` directly.
6. **details**: full name and phone (digits only), then submit.
7. **processing** (`handleAcceptInvite`, L244-L300): requires `selectedChannel`, then calls `POST /backend/affiliate/accept-invite` with `{ email, code, orgSlug, channelId: selectedChannel._id, affiliateId, name?, phone? }`. The backend consumes the OTP, finds or creates the user (new users are guests with a generated affiliate id and `referredBy` the referrer), adds a `stakeholder` guest membership on the org's lowest floor, adds the user to the channel, and returns a JWT plus `orgId`. The page stores `garage_tok` and `garage_org_id` in localStorage and calls `router.push("/workspace")` after 1 second. On failure it returns to `details` or `otp`.

## Exports
- `default OrgAffiliateInvite()` - the client page component.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/affiliate/invite-details?orgSlug&affiliateId&cs&cv` - org and affiliate details, plus click recording
  - `GET /backend/affiliate/org-channels/:storeId` - active channels for the store
  - `POST /backend/affiliate/request-otp` - email the invite OTP
  - `POST /backend/affiliate/check-user` - validate the OTP and decide whether a profile is needed
  - `POST /backend/affiliate/accept-invite` - join the org and channel, return a JWT
- **Environment variables:** `NEXT_PUBLIC_API_URL` (indirectly through `lib/api.ts`).
- **Browser storage / cookies:** writes `garage_tok` and `garage_org_id` to localStorage. `affiliateClickParams()` uses `nc_click_sid` (sessionStorage) and `nc_click_vid` (localStorage).

## Dependencies
- **Internal:**
  - `lib/api.ts` - `api()` fetch wrapper (Bearer token, throws on non-2xx)
  - `lib/affiliate-click.ts` - session and visitor ids for click attribution
  - `lib/sanitizeDescription.ts` - sanitizes channel description HTML before `dangerouslySetInnerHTML`
  - `components/ui/button.tsx`, `card.tsx`, `input.tsx` - shadcn UI primitives
- **Packages:** `react`, `next` (`next/navigation`, `next/link`), `lucide-react`, `sonner`.

## Used by
No file imports it. It is reached at `/{orgSlug}?ref={affiliateId}`; those links are generated in `components/dashboard/AffiliatePageNew.tsx`.

## Notes
- **"See Channels" is likely broken.** The page reads the store id from `organization.earngpt_data.store.storeId`, but the backend `invite-details` response does not include `earngpt_data`. It returns `store` instead, and `server/scripts/migrate-remove-earngpt.ts` strips `earngpt_data` from organizations. With the current backend, the button always shows "Store ID not found", so visitors cannot get past the initial step.
- There is no payment handling. A paid channel picked here is sent to `accept-invite` as `channelId`, so channel membership is decided entirely by the backend's `addUserToChannel`. Compare the channel page, which deliberately leaves `channelId` out for paid channels and goes through Razorpay.
- The `affiliate.type` role badge never renders, because `invite-details` returns no `type` field.
- The OTP step has no "Back" button. Once the code has been sent, the user cannot change the email without reloading.
- The `response.success === false` branches only run for 2xx responses. Real errors arrive as thrown exceptions from `api()`.

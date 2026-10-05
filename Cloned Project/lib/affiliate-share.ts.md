# `lib/affiliate-share.ts`

> Helpers that make share links carry the sharer's affiliate id: fetch the signed-in user's id, set `?ref=` on a URL, and copy text to the clipboard.

**Kind:** frontend library · **Lines:** 58

## Purpose
Every share URL the product hands out (files, events, jobs, sellable items and so on) should carry `?ref=<affiliateId>` so that a signup starting from the link is credited to the person who shared it. The id must be the sharer's own, never a `ref` the visitor arrived with; the file points to the same rule in `app/webinar/[id]/WebinarRoomClient.tsx`. These three small helpers are reused by share buttons across the app.

## How it works
- `fetchMyAffiliateId()` calls `api("/affiliate/my-affiliate-id")`, which goes to `GET /backend/affiliate/my-affiliate-id` with the stored bearer token. The backend (`server/routes/affiliate.ts`, guarded by `requireUserOrGarageAdminAsUser`) returns the user's `affiliateId`, generating and saving one first if the user has none. Any failure, or a response without `success` and `affiliateId`, yields `""`, which callers treat as "share the plain link".
- `withAffiliateRef(url, affiliateId)` returns `url` unchanged when either argument is empty. Otherwise it parses the URL (resolving relative URLs against `window.location.origin` in the browser) and uses `searchParams.set("ref", ...)`, which replaces any existing `ref` instead of adding a second one. If parsing throws (for example a relative URL on the server), it falls back to string manipulation: split off the `#hash`, strip existing `ref=` params with a regex, append `ref=<encoded id>` with the right `?` or `&`, and re-attach the hash.
- `copyToClipboard(text)` wraps `navigator.clipboard.writeText` and returns `true`/`false` instead of throwing, because clipboard permission can be denied.

## Exports
- `fetchMyAffiliateId(): Promise<string>` - signed-in user's affiliate id, or `""`.
- `withAffiliateRef(url: string, affiliateId?: string): string` - URL with `ref` set (or replaced).
- `copyToClipboard(text: string): Promise<boolean>` - clipboard write that reports success.

## Interfaces
- **Backend endpoints called:** `GET /backend/affiliate/my-affiliate-id` - get (or lazily create) the caller's affiliate id.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper (prefixes `NEXT_PUBLIC_API_URL`, adds the bearer token and JSON headers).
- **Packages:** none.

## Used by
- `lib/hooks/useAffiliateShare.ts`
- `app/f/[token]/ShareableLinkViewer.tsx`
- `components/dashboard/CabinetPage.tsx`
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
- `components/dashboard/inlineApps/events/EventsBrowse.tsx`
- `components/dashboard/inlineApps/events/browse-ui.tsx`
- `components/dashboard/jobs/useReferralLink.ts`
- `components/events/ShareEventModal.tsx`
- `components/shared/SellablePublishedModal.tsx`

## Notes
- The `/affiliate/my-affiliate-id` call has a side effect: for a user without an affiliate id it creates one and saves it on the user document.
- Many other components call `/affiliate/my-affiliate-id` with their own inline fetch instead of this helper (for example `components/webinar/WebinarPreJoin.tsx`, `app/(dashboard)/layout.tsx`, `lib/api/garage.ts`), so the logic is duplicated across the codebase.
- When parsing succeeds, `withAffiliateRef` returns an absolute URL even if a relative one was passed in.

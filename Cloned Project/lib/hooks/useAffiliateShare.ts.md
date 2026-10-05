# `lib/hooks/useAffiliateShare.ts`

> A hook used by every cabinet (file storage) page to mint a public share link for a file, add the copier's affiliate `?ref=` to it, copy it to the clipboard, and show consistent upload and copy toasts.

**Kind:** React hook · **Lines:** 283

## Purpose
Files in the cabinet (personal, organisation or floor) can be shared through a public link. When the user who copies the link is an affiliate, the link carries their affiliate id, so a sign-up that starts from it is credited to them. This hook centralises that logic so the four cabinet pages behave the same way, including the toast shown after an upload with a "Copy Affiliate Link" action.

## How it works
**Affiliate id.** On mount it calls `fetchMyAffiliateId()` (`GET /backend/affiliate/my-affiliate-id`) and keeps the result in state and in a ref, so async callbacks always see the latest value.

**Endpoint fallback chain (`shareLinkPaths`).** Endpoints are tried from most to least specific, all `POST` with body `{ linkType: "external" }` and `?organizationId=<org>`:
- `organization` scope: `/cabinet/organization/files/:fileId/share-link`, then the personal route.
- `floor` scope: `/cabinet/floor/:floorId/files/:fileId/share-link`, then the organisation route, then the personal route.
- `personal` scope: `/cabinet/files/:fileId/share-link`.
The first success wins; its `data.url` is passed through `withAffiliateRef()` to append `ref`. Failures are logged with `console.warn` and the next path is tried.

**Viewer fallback (`viewerFallbackLink`).** If every endpoint fails (typically a 404 "File not found or you are not the owner" for a file that lives in another cabinet tree), the hook builds `<origin>/cabinet/view/<fileId>?ref=<affiliateId>` instead. That page (`app/cabinet/view/[fileId]/page.tsx`) resolves the file by id, so sharing never dead-ends.

**Caching and de-duplication (`buildLink`).** Minted links are cached per file id in `linksRef`, and in-flight requests in `requestsRef`, so a copy click during a background mint after an upload waits on the same request instead of minting twice. Both live in refs because nothing renders them. `forgetLink(fileId?)` drops one cached link, or all of them, after a file's sharing access changes (the backend revokes the old token).

**User actions.**
- `copyAffiliateLink(fileId, fileName?)` - shows a loading toast, builds and copies the link, then shows "Affiliate link copied" or "Share link copied" with `LINK_LIFETIME_NOTE` as the description. If the clipboard is blocked it shows the link in the toast instead. A missing `fileId` shows an error toast.
- `copyAffiliateLinks(files)` - builds links one by one and copies `"<name>: <link>"` lines.
- `prefetchLinks(files)` - mints links in the background (`Promise.allSettled`).
- `announceUpload(uploaded)` - prefetches links for uploaded files that have an id, then shows a success toast: plain if none have ids, a single-file toast with a "Copy Affiliate/Share Link" action, or a multi-file toast with "Copy Affiliate/Share Links".

## Exports
- `useAffiliateShare(scope: CabinetScope, organizationId: string)` - returns `{ affiliateId, copyAffiliateLink, copyAffiliateLinks, prefetchLinks, announceUpload, forgetLink }`.
- `LINK_LIFETIME_NOTE` - user-facing note: links expire in 30 days and are replaced if the file's sharing settings change. The source comment says the backend also caps links at 100 opens.
- `type CabinetScope` - `{ kind: "personal" } | { kind: "organization" } | { kind: "floor"; floorId }`.
- `interface ShareableFile` - `{ _id, name }`.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/affiliate/my-affiliate-id` - the caller's affiliate id (via `lib/affiliate-share.ts`).
  - `POST /backend/cabinet/files/:fileId/share-link?organizationId=` - personal file link.
  - `POST /backend/cabinet/organization/files/:fileId/share-link?organizationId=` - organisation file link.
  - `POST /backend/cabinet/floor/:floorId/files/:fileId/share-link?organizationId=` - floor file link (tried first for floor scope).
  The cabinet routes are in `server/routes/cabinet.ts` and are handled by `server/controllers/shareableLink.controller.ts`.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` authenticated fetch; `lib/affiliate-share.ts` - `fetchMyAffiliateId`, `withAffiliateRef`, `copyToClipboard`.
- **Packages:** `react` - state/refs/callbacks; `sonner` - toasts.

## Used by
- `components/dashboard/CabinetPage.tsx`
- `components/dashboard/FloorCabinetPage.tsx`
- `components/dashboard/FounderCabinetPage.tsx`
- `components/dashboard/OrganizationCabinetPage.tsx`

## Notes
- In the current `server/routes/cabinet.ts` there is no `/floor/:floorId/files/:fileId/share-link` route, so floor-scope copies always fail on the first attempt and fall through to the organisation and personal routes (each failure logs a console warning).
- If the affiliate id has not loaded yet when a link is first minted, the cached link has no `ref`, and later copies reuse it until `forgetLink` is called.

# `lib/api/funnels.ts`

> Types and an axios client for affiliate marketing funnels: CRUD, the admin funnel library, public funnel pages, visitor tracking, lead capture and funnel analytics.

**Kind:** frontend library · **Lines:** 343

## Purpose
Affiliates can build funnels: landing experiences tied to a referral code and, optionally, a product link. There are four content modes: `default` and `custom` (video/question tree), `pages` (page designer) and `site` (AI-generated multi-step site). This file was ported from the NetworkChains/contacts apps. It defines the funnel data model and analytics shapes, plus a `funnelsApi` object that calls a `/funnels` REST API. The comments point at the external "contacts-backend" (`src/routes/funnels.ts`) as the server. **This repo's `server/app.ts` mounts no `/funnels` router.**

## How it works

### Data model (L5-L87)
- `FunnelLink`: the product a funnel promotes (`itemType`, `itemId`, optional category, org slug, name, image, price, currency, `commissionPct`, and an explicit `href` for general platform products whose URL can't be built from the type and id).
- `Funnel`: `_id`, `name`, `referralCode`, optional `link`, `content` (`mode` plus a `FunnelTheme` from `lib/funnel-pages.ts`), optional `adminFunnelId` (set when adopted from the admin library), `userId`, `orgId` and timestamps.
- `FunnelLibraryItem`: an admin library funnel with a CTA descriptor (offering key or id, item type, name, `priceMinor`).
- `PublicFunnelTemplate`, `PublicFunnelNode`, `PublicFunnelVideo`: the public question/video tree of video-mode funnels.
- `FunnelResponse`: the funnel plus whichever content applies: `template` (video mode), `pages: FunnelPage[]` (pages mode) or `steps: SiteStep[]` (site mode, type from `lib/ai-site/types.ts`).

### Tracking events (L89-L108)
`TrackEvent` is the union of visitor events (`visit`, `survey_completed`, `option_selected`, `video_started`, `video_completed`, `registered`, `product_opened`, `page_viewed`, `cta_clicked`, `form_submitted`, `form_step_completed`). The comment warns that the backend keeps its own hand-written copy of this list (`TRACK_EVENTS`). If the two drift apart, the server rejects the event with 400 while both sides still compile. `form_step_completed` must always carry a per-step `meta`, because client-side dedupe is keyed on `event:meta`.

### Analytics shapes (L110-L200)
`FunnelStep`, `FunnelVisitor`, `FunnelVideoStat`, `FunnelNodeStat` and `FunnelTreeStats` cover the legacy video funnel. For `mode: "pages"` funnels, `FunnelStatsResponse.stats` also carries:
- `pages: FunnelPageStat[]`, keyed on page `slug` (never index). `viewRate` is the share of *tracked* visitors who reached that page. It is not a conversion rate.
- `removedPages`: traffic recorded on slugs that no longer exist, kept rather than dropped.
- `instrumentation`: tracked versus untracked visitor counts. Visitors from before per-page tracking shipped are excluded from every `viewRate` denominator.
- `completedLeads`: counted from Contact records, not from `FunnelVisit.registeredAt`, which isn't always set on the pages-mode lead path.
When these optional fields are missing, the doc comments say to treat them as "not available", never as zero.

### `funnelsApi` (L202-L327)
All calls go through `apiClient` from `lib/api/client.ts` (base `NEXT_PUBLIC_API_URL`, bearer token attached, 401 clears the session):
- Authenticated: `list()`, `getLibrary()`, `garage(ref)` (the affiliate's Garage Funnels with auto-provisioned refs), `create(body)` (accepts `mode`, `adminFunnelId` and an `opportunityId` that auto-attaches a matched product server-side), `updateLink(id, link | null)`, `delete(id)`, `getStats(id)`, `getSubmissions(id, page)` (returns `{ submissions, total }` with defaults of `[]` and `0`).
- Public (no auth needed): `getPublic(id)`, `track(funnelId, body)`, `submitLead(funnelId, body)`. `submitLead` accepts named fields plus free-form `fields` (saved as Rolodex custom fields) and `partial: true` for auto-saved drafts.

### Submissions (L329-L342)
`FunnelSubmission`: one lead-form submission. A missing `status` (legacy rows from before auto-save) should be treated as `complete`.

## Exports
- Types and interfaces: `FunnelLink`, `Funnel`, `FunnelLibraryItem`, `FunnelsResponse`, `PublicFunnelVideo`, `PublicFunnelNode`, `PublicFunnelTemplate`, `FunnelResponse`, `TrackEvent`, `FunnelStep`, `FunnelVisitor`, `FunnelVideoStat`, `FunnelNodeStat`, `FunnelTreeStats`, `FunnelPageStat`, `FunnelRemovedPageStat`, `FunnelStatsInstrumentation`, `FunnelStatsResponse`, `FunnelSubmission`.
- `funnelsApi` - an object with `list`, `getLibrary`, `garage`, `create`, `updateLink`, `delete`, `getPublic`, `track`, `submitLead`, `getStats` and `getSubmissions`.

## Interfaces
- **Backend endpoints called** (relative to `NEXT_PUBLIC_API_URL`; in this project that resolves to `/backend/funnels...`, which `server/` does not serve):
  - `GET /funnels`, `GET /funnels/library`, `GET /funnels/garage?ref=`, `POST /funnels`, `PATCH /funnels/:id`, `DELETE /funnels/:id`
  - `GET /funnels/public/:id`, `POST /funnels/:id/track`, `POST /funnels/:id/lead`
  - `GET /funnels/:id/stats`, `GET /funnels/:id/submissions?page=`
- **External services:** the funnels API of the NetworkChains contacts backend, according to the comments.

## Dependencies
- **Internal:** `lib/api/client.ts` - the axios instance. `lib/funnel-pages.ts` - `FunnelPage` and `FunnelTheme` types. `lib/ai-site/types.ts` - the `SiteStep` type.
- **Packages:** none directly (axios comes through `client.ts`).

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx`
- `components/funnel-studio/funnel-studio.tsx`, `components/funnel-studio/preview-canvas.tsx`
- `components/garage/attach-product-drawer.tsx`
- `lib/affiliate/link-card-adapters.ts`

All five import only the `FunnelLink` **type**.

## Notes
- Nothing in this repo calls `funnelsApi`, so the runtime client is dead code here. Only the types are in use. Calling it would hit `/backend/funnels`, which has no matching Express route in `server/app.ts`.

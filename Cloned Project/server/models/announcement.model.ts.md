# `server/models/announcement.model.ts`

> Mongoose model `Announcement`: an admin-authored dialog or banner ("Alerts & Promotions") shown on the login screen and/or inside the app.

**Kind:** Mongoose model · **Lines:** 167

## Purpose
Garage super admins author announcements in the garage-admin console (`/garage-admin/announcements`) to put a modal or banner in front of users. The app reads the live ones through the **unauthenticated** `GET /backend/public/announcements/active` endpoint - unauthenticated because the pre-login surface has no token by definition. One document fully describes one announcement: placement, size, visual template, icon, content, CTA, scheduling and priority.

## How it works
### Display model
- `surface` - `pre-login`, `post-login` (default) or `everywhere`.
- `size` - `sm`, `md` (default), `lg`, or `banner` (full-width strip pinned to the top instead of a modal).
- `contentType` - `text` (default) or `image-text`; `imageUrl` (an S3 URL from `/garage-admin/upload`) is only meaningful for `image-text`.
- `template` - free string (default `"solid"`, max 40). Deliberately not an enum: the catalogue lives in the frontend (`lib/announcements.ts` `TEMPLATE_OPTIONS`), and the renderer maps unknown / legacy names (`feature-promo`, `system-alert`, `clean-announcement`) to a current style.
- `icon` - free string (default `"megaphone"`), independent of template; `"none"` means no badge. Catalogue in `lib/announcements.ts` `ICON_OPTIONS`.
- `eyebrow` - small line above the title (max 60).
- `comingSoon` / `comingSoonLabel` - shows a "Coming Soon" badge and makes the CTA inert.

### Content
- `title` - required, max 140.
- `body` - rich text stored as HTML (max 8000). **Not trusted**: the frontend `components/announcements/AnnouncementCard` sanitises it with DOMPurify and an allow-list before rendering.
- `cta` (sub-schema, no `_id`) - `enabled`, `label` (max 60), `kind` (`page` = curated in-app path such as `/taskroom`, `url` = anything typed), `href` (max 2000), `newTab` (forced on for off-platform URLs by the renderer).

### Lifecycle
- `enabled` - default `false`: saving a draft never shows it to everyone; the admin must switch it on.
- `startsAt` / `endsAt` - optional schedule window.
- `priority` - higher wins when several are live on one surface.
- `version` - dismissal is client-side in `localStorage` keyed by `${id}:${version}`, so there is no per-user read model; bumping `version` re-shows an announcement to everyone who dismissed it.
- `createdByAdminId` - ref `GarageAdmin`.

### Indexes
`surface` and `enabled` single-field, plus `{ enabled, surface, priority -1, createdAt -1 }` matching the public "what is live on this surface, best first" query.

The model is registered with a `mongoose.models.Announcement || mongoose.model(...)` guard to avoid an OverwriteModelError if the file is loaded twice.

## Exports
- `default` / `Announcement` - Mongoose model.
- `interface IAnnouncement`, `interface IAnnouncementCta`.
- Types `AnnouncementSurface`, `AnnouncementSize`, `AnnouncementContentType`, `AnnouncementTemplate` (string), `AnnouncementIcon` (string), `AnnouncementCtaKind`.

## Interfaces
- **Database:** `Announcement` (collection `announcements`).
- **Browser storage / cookies:** dismissal state lives in the viewer's `localStorage` (frontend), keyed `${id}:${version}`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/garageAdminAnnouncements.ts` - mounted at `/garage-admin/announcements` (browser `/backend/garage-admin/announcements`), admin CRUD.
- `server/routes/publicAnnouncements.ts` - mounted at `/public/announcements`; `GET /backend/public/announcements/active` for the app.

## Notes
- The interface comment mentions a `stripDangerousHtml` pass "below", but that function is not in this file: it lives in `server/routes/garageAdminAnnouncements.ts` and runs on `body` through the route's zod schema. It is a crude second pass; DOMPurify on the client is the real security boundary.

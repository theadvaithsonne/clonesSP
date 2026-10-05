# `lib/admin-api/announcements.ts`

> Garage-admin client for writing "Alerts & Promotions" announcements: list, create, update, delete, reset dismissals, and upload the image.

**Kind:** frontend library · **Lines:** 102

## Purpose
Super admins write in-app announcements (alerts and promotional banners) from the console. The shapes the app renders (`Announcement`, `AnnouncementDraft`) live in `lib/announcements.ts`, because the member-facing app reads them too. This file only holds the calls used to write them.

## How it works
- All JSON calls go through `garageAdminApi` (admin JWT from `localStorage.garage_admin_token`) and unwrap the backend's `{ success, data, message? }` envelope (`Envelope<T>`).
- `payload(draft)` normalises a draft before it is sent:
  - an empty `eyebrow` or `comingSoonLabel` becomes `undefined`;
  - `imageUrl` is kept only when `contentType === "image-text"`;
  - an empty `startsAt` or `endsAt` becomes `null`, which clears the schedule.
- `resetAnnouncementDismissals` asks the backend to increase the announcement's `version`. Dismissals are recorded per version, so every browser sees the announcement again.
- `uploadAnnouncementImage(file)` posts a `FormData` with field `file` to `/garage-admin/upload` using a direct `fetch` with the admin Bearer token. It uses the admin upload route (S3-backed) because the console has no user JWT for the normal `/upload`. On a non-2xx response it throws the body's `error` or `Upload failed (status)`. It also throws if the response has no `url`.

## Exports
- `listAnnouncements(): Promise<Announcement[]>` - every announcement (`[]` when `data` is missing).
- `createAnnouncement(draft: AnnouncementDraft): Promise<Announcement>`
- `updateAnnouncement(id: string, draft: AnnouncementDraft): Promise<Announcement>`
- `deleteAnnouncement(id: string): Promise<void>`
- `resetAnnouncementDismissals(id: string): Promise<Announcement>` - increases `version` so the announcement shows again for everyone.
- `uploadAnnouncementImage(file: File): Promise<string>` - returns the uploaded image URL.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/garage-admin/announcements` - list
  - `POST /backend/garage-admin/announcements` - create
  - `PATCH /backend/garage-admin/announcements/:id` - update
  - `DELETE /backend/garage-admin/announcements/:id` - delete
  - `POST /backend/garage-admin/announcements/:id/reset-dismissals` - reset dismissals
  - `POST /backend/garage-admin/upload` - multipart image upload (`server/routes/garageAdmin.ts`, `upload.single("file")`)
  - The announcement routes are `server/routes/garageAdminAnnouncements.ts`, mounted at `/garage-admin/announcements` in `server/app.ts` (super admin only per the source comment).
- **Browser storage / cookies:** reads `localStorage.garage_admin_token` for the upload.
- **Environment variables:** `NEXT_PUBLIC_API_URL`, read through `API_URL`.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`, `API_URL`; `lib/announcements.ts` - `Announcement` and `AnnouncementDraft` types.

## Used by
- `components/garage-admin/AnnouncementsConsole.tsx`

## Notes
- The upload comment says `api()` would stringify the `FormData`. The current `api()` in `lib/api.ts` detects `FormData` and leaves it alone (`lib/admin-api/support-chats.ts` uploads through `garageAdminApi` this way), so the hand-written `fetch` is now just a style choice.

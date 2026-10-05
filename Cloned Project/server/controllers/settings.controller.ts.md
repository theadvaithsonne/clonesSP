# `server/controllers/settings.controller.ts`

> Express handlers that create, read and update the signed-in user's per-organisation settings (email notification preferences, office dynamic emails, UI language and display currency).

**Kind:** Express controller · **Lines:** 96 · **Mounted at:** `/settings` (browser: `/backend/settings`)

## Purpose
Each user has one settings document per organisation (unique index `{ userId, orgId }` on the `Settings` model). This controller is the HTTP layer over `server/services/settings.service.ts`. It enforces that the token carries an organisation and validates PATCH bodies with zod. Founders and stakeholders can only manage their own settings, because the user and organisation come from the token, never from the request.

## How it works
- All three handlers read `{ userId, orgId }` from `req.user`. They return 400 `"Organization context is required"` when the token has no `orgId`.
- Responses use `ok(data)` / `fail(message)` from `server/utils/http.ts`, so errors are shaped `{ success: false, message, code }`, with `message` rather than `error`.
- Successful bodies always go through `buildSettingsResponse()`. That function fills `emailPreferences` with the service defaults, returns `officeDynamicEmails` (or `[]`), and returns `language` / `currency` as `null` when unset.
- **Create:** `createSettings()` returns the existing document if there is one. A 409 therefore happens only when a Mongo duplicate key (11000) occurs because two creates raced.
- **Get:** `getSettings()` creates the document with defaults if it is missing, so GET never 404s.
- **Update:** `updateSettingsSchema` (zod) accepts:
  - `emailPreferences` - a record of string to boolean
  - `officeDynamicEmails` - an array of `{ key, title, description, enabled }`, with non-empty strings
  - `language` - shape-checked only: `^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$` (for example `en` or `pt-BR`)
  - `currency` - shape-checked only: three letters, upper-cased

  An invalid body returns 400 `"Invalid payload: ..."`. The service merges `emailPreferences` over the defaults and the stored values. It replaces `officeDynamicEmails` only when sent, sets `language` / `currency` only when sent, and upserts.

## Exports
- `createMySettings(req, res)` - `POST`: creates the settings document with defaults. Returns 201.
- `getMySettings(req, res)` - `GET`: returns the settings, creating them on first read.
- `updateMySettings(req, res)` - `PATCH`: validates and applies a partial update.

## Interfaces
- **Endpoints served** (each guarded by `requireAuth` in `server/routes/settings.ts`):
  - `POST /backend/settings`
  - `GET /backend/settings`
  - `PATCH /backend/settings`
- **Database** (through the service): `Settings` model (`server/models/setting.model.ts`, default collection `settings`) - read/write.

## Dependencies
- **Internal:** `server/services/settings.service.ts` - `createSettings`, `getSettings`, `updateSettings`, `buildSettingsResponse`. `server/utils/http.ts` - `ok`/`fail` envelopes.
- **Packages:** `express` - types. `zod` - PATCH body validation.

## Used by
- `server/routes/settings.ts`, mounted in `server/app.ts` with `app.use("/settings", settingsRoutes)`.
- On the frontend, `lib/hooks/useSettings.ts` calls `/settings`. That hook POSTs when no document exists and handles a 409 by re-fetching.

## Notes
- `language` and `currency` are deliberately not checked against an allow-list (see the inline comments). The client decides which values to offer, so adding a language does not require a backend deploy.
- Settings are per organisation. The same user in two offices has two independent preference sets.

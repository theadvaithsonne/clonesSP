# `server/models/setting.model.ts`

> Mongoose model for a user's per-organisation preferences: email notification toggles, office dynamic-email items, UI language and display currency.

**Kind:** Mongoose model · **Lines:** 67

## Purpose
Each user has one settings document per organisation they belong to. It stores which notification emails they want, a list of configurable "dynamic emails" for their office, and two optional display preferences (language and currency) added later.

## How it works
- `userId` (ref `User`) and `orgId` (ref `Organization`) - required, each indexed; `{ userId, orgId }` is unique.
- `emailPreferences` - a `Map<string, boolean>` (default `{}`) keyed by notification type.
- `officeDynamicEmails` - array of `DynamicEmailItemSchema` (`key`, `title`, `description` required; `enabled` default `true`; no `_id`).
- `language` - optional ISO-639 code, optionally with a region (`"pt-BR"`), trimmed and capped at 10 characters so a client bug cannot write an essay.
- `currency` - optional ISO-4217 code such as `"USD"`; the client owns the list of selectable currencies.
- Timestamps. Documents created before `language`/`currency` existed have neither, and clients that never send them keep working.
- Registered with a `mongoose.models.Settings ||` guard against duplicate model registration.

## Exports
- `Settings` - the model `"Settings"` (collection `settings`).
- `ISettings` - document interface.
- `IDynamicEmailItem` - dynamic-email item interface.

## Interfaces
- **Database:** `Settings` (collection `settings`) - schema only.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
`server/services/settings.service.ts` - `createSettings()` (creates with default preferences if missing), `getSettings()` (auto-creates), `updateSettings()` (merges default, existing and incoming email preferences, upserts, and only sets `language`/`currency` when the client sends them). That service is called by `server/controllers/settings.controller.ts`, behind `server/routes/settings.ts` mounted at `/settings` (browser: `POST`, `GET`, `PATCH /backend/settings`, all `requireAuth`, scoped to the caller's own settings).

## Notes
- The file is named `setting.model.ts` (singular) but exports `Settings`.

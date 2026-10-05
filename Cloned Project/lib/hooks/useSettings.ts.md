# `lib/hooks/useSettings.ts`

> React hook that loads, creates and updates the signed-in user's per-organisation settings (email notification preferences and office dynamic emails) through the backend `/settings` API.

**Kind:** React hook · **Lines:** 243

## Purpose
Each user has one settings document per organisation on the backend (`Settings` model). This hook gives the UI a single place to read that document and to change email preferences, including an optimistic single-toggle helper used by the profile popover's notification switches. It also tries to self-heal when the settings document does not exist yet by creating it.

## How it works
- **State:** `settings` (`Settings | null`), `loading` (initial/refetch load), `updating` (a PATCH is in flight), `error` (message string).
- **Guards:** `mountedRef` stops state updates after unmount; `initializingRef` prevents concurrent `initSettings` calls (React Strict Mode double effects, overlapping retries). A second concurrent call returns `null` immediately.
- **Mount:** an effect calls `fetchSettings()` once (and again whenever its identity changes, which it does not in practice).
- **`fetchSettings`:** `GET /settings`. If the response `data` is null it calls `initSettings()`. Intended error branches: 404 -> create, 401 -> stay silent (not logged in), anything else -> `error`.
- **`initSettings`:** `POST /settings`. Intended error branch: 409 ("already exists", a race with another creator) -> fall back to `GET /settings`.
- **`updateEmailPreferences(map)` / `updateOfficeDynamicEmails(list)`:** `PATCH /settings` with `{ emailPreferences }` or `{ officeDynamicEmails }`, replace local state with the server's response, and rethrow on failure (after setting `error`). Intended 404 branch: init, then retry once by recursion.
- **`toggleEmailPreference(key, enabled)`:** no-op if settings are not loaded. Snapshots current settings, applies the change optimistically, then `PATCH /settings` with `{ emailPreferences: { [key]: enabled } }`. On failure it reverts to the snapshot (not just flipping the boolean back), sets `error` and rethrows. The backend merges partial `emailPreferences` maps with the stored/default map, so sending a single key is safe.

## Exports
- `useSettings()` - returns `{ settings, loading, updating, error, initSettings, updateEmailPreferences, updateOfficeDynamicEmails, toggleEmailPreference, refetch }` (`refetch` is `fetchSettings`).
- `interface DynamicEmailItem` - `{ key, title, description, enabled }`, one configurable office email.
- `interface EmailSectionItem` - `{ key, title, description }`, a UI row describing a preference.
- `interface EmailSection` - `{ id, title, items: EmailSectionItem[] }`, a UI grouping of rows (type only; not used inside this file).
- `interface Settings` - `{ emailPreferences: Record<string, boolean>; officeDynamicEmails: DynamicEmailItem[] }`.

## Interfaces
- **Backend endpoints called** (via `api()`, so prefixed with `NEXT_PUBLIC_API_URL`):
  - `GET /backend/settings` - fetch my settings; the backend (`getSettings` in `server/services/settings.service.ts`) auto-creates the document when missing.
  - `POST /backend/settings` - create my settings; returns 409 if they already exist.
  - `PATCH /backend/settings` - partial update (`emailPreferences`, `officeDynamicEmails`; the backend also accepts `language` and `currency`, which this hook never sends).
  All three require auth (`requireAuth`) and an org context on the token; the router is mounted at `/settings` in `server/app.ts`.
- **Database (indirect):** `Settings` model (`server/models/setting.model.ts`, default collection `settings`) read/written by the backend.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper that adds the bearer token and JSON headers.
- **Packages:** `react` - `useState`, `useEffect`, `useCallback`, `useRef`.

## Used by
- `components/shared/ProfilePopover.tsx` - uses `settings`, `loading`, `updating` and `toggleEmailPreference` for the email-notification switches.

## Notes
- **Status-code branches never fire.** `api()` in `lib/api.ts` throws a plain `Error` whose message is the server's `error`/`message` text; it carries no `status`/`statusCode`. So the 404, 409 and 401 checks (`err?.status === ...`) are always false: a 401 surfaces as a generic `error`, and the create-and-retry paths are dead. In practice this matters little because `GET` and `PATCH` auto-create on the backend.
- The 404 retry paths recurse without a limit; if they ever became reachable and creation kept failing, they could loop.
- `toggleEmailPreference` depends on `settings`, so its identity changes after every update.

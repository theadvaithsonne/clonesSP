# `components/coverfi/policy-settings/PolicySettingsForm.tsx`

> Client-side key/value editor for a Coverfi brokerage's policy settings, loaded from and saved to the external Coverfi API.

**Kind:** React component · **Lines:** 208

## Purpose
Coverfi is the insurance-brokerage module of Garage. Each brokerage has one "policy settings" document whose `settings` field has no fixed schema yet. This component is the whole UI for the `/coverfi/policy-settings` page: it shows every setting as an editable row, lets the user add and delete keys, and saves the whole map in one call. The on-screen note says the schema is "intentionally open in v1", and typed inputs are meant to come later.

## How it works
- **State:** `settings` (a `Record<string, string>`), `loading`, `saving`, and the `newKey` / `newValue` drafts for the "Add setting" row.
- **Load (`refresh`, runs once on mount):** calls `getPolicySettings()` and flattens `doc.settings` into strings. Strings stay as they are, `null`/`undefined` become `""`, and anything else (numbers, booleans, objects) is `JSON.stringify`-ed. Errors show a `sonner` toast.
- **Edit:** each value `Input` updates local state only (`updateLocal`).
- **Add (`onAdd`):** trims the key, rejects an empty key or one that already exists, then adds the pair to local state only. The helper text says new rows are not saved until **Save all** is clicked. Pressing Enter in the value field also adds the row.
- **Remove (`onRemove`):** asks for `confirm()`, then calls `unsetPolicySetting(key)` on the server **right away** and removes the key from local state.
- **Save all (`onSaveAll`):** sends the whole local `settings` map with `patchPolicySettings(settings)`. The button sits in the `PageHeader` `action` slot and is disabled while loading or saving.
- **Rendering:** a `PageHeader` (eyebrow "Coverfi · Settings"), an info banner, a three-column table (Key / Value / delete) with loading and empty states, and an "Add setting" box. The dark palette is hardcoded in Tailwind classes.

## Exports
- `default PolicySettingsForm()`: the settings editor. It takes no props.

## Interfaces
- **External services:** Coverfi API (`NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`), reached through `coverfiApi` in `lib/coverfi/api.ts`. It is a separate service. No `/v1/coverfi` routes exist under `server/`.
  - `GET /v1/coverfi/policy-settings`: load the document
  - `PATCH /v1/coverfi/policy-settings`: save the full key/value map
  - `DELETE /v1/coverfi/policy-settings/:key`: remove one key (the key is URL-encoded)
- **Browser storage / cookies:** the bearer token comes from `localStorage` via `getToken()` in `lib/auth.ts`, inside `coverfiApi`.

## Dependencies
- **Internal:** `lib/coverfi/policy-settings-api.ts` (`getPolicySettings`, `patchPolicySettings`, `unsetPolicySetting`); `components/coverfi/PageHeader.tsx` (page title bar); `components/ui/button`, `input`, `label`, `table` (shadcn primitives).
- **Packages:** `react` (state/effects), `lucide-react` (icons), `sonner` (toasts).

## Used by
- `app/(dashboard)/coverfi/policy-settings/page.tsx`, which renders it at the URL `/coverfi/policy-settings`.

## Notes
- Saving is inconsistent: a delete is sent at once, but adds and edits wait for "Save all". If the user reloads, unsaved edits are lost and deletes stay.
- Every value goes back as a string. A setting that was a number or object comes back as its JSON text (for example `"5"` or `"{\"a\":1}"`), so the stored type changes after the first save.
- Because `PATCH` sends the whole map, whether the server merges or replaces is up to the Coverfi API. A key deleted with `DELETE` is gone from local state, so it is not sent again.

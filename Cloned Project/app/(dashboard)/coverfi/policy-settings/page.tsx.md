# `app/(dashboard)/coverfi/policy-settings/page.tsx`

> Thin route file that renders the Coverfi Policy Settings form.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/policy-settings`

## Purpose
This route edits the brokerage's policy-level settings by binding the URL to `PolicySettingsForm`. The form reads and writes through the external Coverfi API (`lib/coverfi/policy-settings-api.ts`, base path `/v1/coverfi/policy-settings`).

## How it works
`PolicySettingsPage()` returns `<PolicySettingsForm />`. The page has no logic of its own. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default PolicySettingsPage()` - renders the settings form.

## Dependencies
- **Internal:** `components/coverfi/policy-settings/PolicySettingsForm.tsx` - the settings editor.

## Used by
No file imports it. It is reached at `/coverfi/policy-settings`, through Coverfi navigation.

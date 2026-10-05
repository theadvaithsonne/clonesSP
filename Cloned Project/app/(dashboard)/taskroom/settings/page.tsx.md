# `app/(dashboard)/taskroom/settings/page.tsx`

> Placeholder Next.js page for Taskroom settings. It renders only the text "Taskroom Settings".

**Kind:** Next.js page · **Lines:** 3 · **Route:** `/taskroom/settings`

## Purpose
This page reserves the `/taskroom/settings` URL inside the dashboard route group. No settings UI has been built yet.

## How it works
It is a server component (no `"use client"`) that returns a single `<div>Taskroom Settings</div>`. It has no state, does not fetch data and does not check auth beyond whatever the `(dashboard)` layout already enforces.

## Exports
- `default TaskroomSettingsPage()` - the placeholder page component.

## Dependencies
- **Internal:** none
- **Packages:** none (React JSX only)

## Used by
No file imports it. It is reached only by visiting `/taskroom/settings`; the `(dashboard)` route group does not appear in the URL.

## Notes
- This is a stub. Real Taskroom configuration lives in the external Taskroom service (`uatapi.garage.app/taskroom`) and in the other Taskroom pages.

# `lib/nc-admin-first-route.ts`

> A one-constant module that names the landing route of the NetworkChains section of the Garage admin back-office.

**Kind:** frontend library · **Lines:** 7

## Purpose
The admin back-office (`app/garage-admin/...`) has a NetworkChains dashboard with its own sidebar (`NC_NAV`). Several places need to know which page to open when someone enters that dashboard: the dashboard type switcher in the admin layout and the `/garage-admin/networkchains` index page. Keeping the target in one shared constant means the landing page and the first sidebar entry (Users) cannot drift apart.

## How it works
It exports a single string constant, `NC_FIRST_HREF = "/garage-admin/networkchains/users"`. The doc comment says the Users entry in `NC_NAV` is bound to this constant directly, so changing the constant moves both the landing route and the first nav entry together. There is no logic.

## Exports
- `NC_FIRST_HREF: string` - `"/garage-admin/networkchains/users"`, the URL to open first when entering the NetworkChains admin dashboard.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `app/garage-admin/(admin-dashboard)/layout.tsx` - the admin layout (type switcher / `NC_NAV`).
- `app/garage-admin/(admin-dashboard)/networkchains/page.tsx` - the `/garage-admin/networkchains` index, which sends the user to this route.

## Notes
- If you reorder the NetworkChains sidebar so a different page comes first, update this constant too; the comment presents it as the source of truth for "first entry".

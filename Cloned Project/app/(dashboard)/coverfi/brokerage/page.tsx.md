# `app/(dashboard)/coverfi/brokerage/page.tsx`

> Thin route file that renders the brokerage Profile form, the default tab of "My Brokerage".

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/brokerage`

## Purpose
This is the "Profile" tab of the Coverfi brokerage settings. The file only binds the URL to the `ProfileForm` component. All loading and saving happens in that component, which talks to the external Coverfi API (`lib/coverfi/brokerage-api.ts`, base path `/v1/coverfi/brokerage`).

## How it works
`BrokerageProfilePage()` returns `<ProfileForm />`. The page has no props, state or data fetching of its own. The header and tabs come from `app/(dashboard)/coverfi/brokerage/layout.tsx`. The founder check and password gate come from `app/(dashboard)/coverfi/layout.tsx`.

## Exports
- `default BrokerageProfilePage()` - renders the profile form.

## Dependencies
- **Internal:** `components/coverfi/brokerage/ProfileForm.tsx` - the brokerage profile editor.

## Used by
No file imports it. It is reached at `/coverfi/brokerage` through the "Profile" tab in `BrokerageTabs` and the "Set up your brokerage" card on `/coverfi`.

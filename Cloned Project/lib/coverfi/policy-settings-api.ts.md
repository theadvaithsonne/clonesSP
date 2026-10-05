# `lib/coverfi/policy-settings-api.ts`

> Client for the brokerage's free-form policy-settings document (a key/value map) in the external Coverfi backend.

**Kind:** frontend library · **Lines:** 20

## Purpose
Each brokerage has one `PolicySettingsDoc` whose `settings` field is an open `Record<string, unknown>`. This module reads it, merges changes into it and removes individual keys, for the policy-settings form.

## How it works
Base path: `/v1/coverfi/policy-settings`. All three functions return the updated `PolicySettingsDoc` (unwrapped `.data`).
- `getPolicySettings()` - `GET /v1/coverfi/policy-settings`.
- `patchPolicySettings(patch)` - `PATCH` with the given key/value object.
- `unsetPolicySetting(key)` - `DELETE /v1/coverfi/policy-settings/:key`. The key is URL-encoded with `encodeURIComponent`.

## Exports
`getPolicySettings`, `patchPolicySettings`, `unsetPolicySetting`.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL`.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `PolicySettingsDoc`.

## Used by
`components/coverfi/policy-settings/PolicySettingsForm.tsx`.

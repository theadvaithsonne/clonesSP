# `lib/hooks/use-admin-funnels.ts`

> React Query hooks for the admin "funnel library" pages, reading and writing funnels on the external NetworkChains admin API with automatic one-shot recovery from an expired NC admin token.

**Kind:** frontend library · **Lines:** 223

## Purpose
The garage-admin back-office hosts ported NetworkChains admin pages, including a funnel editor (`/garage-admin/networkchains/funnels` and `/garage-admin/networkchains/funnels/[id]`). Funnels live on contacts-backend (`NEXT_PUBLIC_NC_API_URL`, default `https://backend.networkchains.com`), not on this project's Express backend. This file wraps `adminFunnelsApi` (from `lib/nc-admin-api/admin-funnels.ts`) in TanStack Query queries and mutations so the pages get caching, invalidation, toasts and token recovery for free.

## How it works
- **Query keys.** The list is cached under `["admin", "funnels"]` (`LIST_KEY`); a single funnel under `["admin", "funnel", id]`.
- **`useNcRecovery()` (internal).** Returns two refs: `recoveryAttempted` (has this failure episode already tried to recover?) and `mountedRef` (is the component still mounted?). The comment explains the design: an expired NC token is recovered by re-elevating from the Garage admin session, never by reloading the page, which would kick the operator out of the Garage shell.
- **Queries (`useAdminFunnels`, `useAdminFunnel`).** Each watches `query.isSuccess` / `query.error`. On success it re-arms recovery. On an `AdminUnauthorizedError` (an alias of `NcAdminUnauthorizedError`) it calls `ensureNcAdminToken()` once per failure episode; if that resolves `{ ok: true }` and the component is still mounted, it calls `query.refetch()`. `ensureNcAdminToken` exchanges the Garage token (localStorage `garage_admin_token`) for an NC token at the NC endpoint `POST /admin/auth/elevate-garage` and de-duplicates concurrent elevations. `useAdminFunnel` is disabled while `id` is empty.
- **Mutations.** Every write hook stores the mutation object in `mutationRef` and routes errors through `handleMutationError()`:
  - On `AdminUnauthorizedError`: if recovery was already attempted, show "Session expired. Please try again."; otherwise elevate once and, if still mounted and elevation succeeded, re-run `mutate()` with the **same variables**. The mounted check stops a save from firing after the operator has navigated away.
  - Any other error: `toast.error(message || fallback)`.
  - On success each hook resets `recoveryAttempted`, invalidates the relevant keys and (except for meta updates) shows a success toast.

| Hook | NC API call | Invalidates | Toast |
|---|---|---|---|
| `useCreateFunnel()` | `POST /admin/funnels` `{ name }` | list | "Funnel created" |
| `useSaveFunnel(id)` | `PUT /admin/funnels/:id` (full tree) | funnel + list | "Funnel saved" |
| `useUpdateFunnelMeta(id)` | `PATCH /admin/funnels/:id/meta` (name/CTA only) | funnel + list | none (quiet, used by toolbar autosaves) |
| `useDeleteFunnel()` | `DELETE /admin/funnels/:id` | list | "Funnel deleted" |
| `useSetDefaultFunnel()` | `POST /admin/funnels/:id/default` | list | "Default funnel updated" |

## Exports
- `useAdminFunnels()` - query for the whole funnel library (`listFunnels().funnels`; the backend returns the default first).
- `useAdminFunnel(id: string)` - query for one funnel's full tree and CTA, for the editor.
- `useCreateFunnel()` - mutation; variable is an optional name.
- `useSaveFunnel(id: string)` - mutation; variable is a `FunnelSaveInput` (root question, options tree, optional CTA).
- `useUpdateFunnelMeta(id: string)` - mutation; variable is `{ name?, cta? }`.
- `useDeleteFunnel()` - mutation; variable is the funnel id.
- `useSetDefaultFunnel()` - mutation; variable is the funnel id.

## Interfaces
- **External services:** NetworkChains contacts-backend admin API (`/admin/funnels*`, `/admin/auth/elevate-garage`) via `ncAdminFetchRaw` - not part of this repo.
- **Browser storage / cookies:** indirectly, through `lib/nc-admin-api/auth.ts` - localStorage `nc_admin_token` (NC token) and `garage_admin_token` (Garage admin session used for elevation).

## Dependencies
- **Internal:** `lib/nc-admin-api/admin-funnels.ts` - `adminFunnelsApi`, `FunnelSaveInput`, `FunnelCta`; `lib/nc-admin-api/admin.ts` - `AdminUnauthorizedError`; `lib/nc-admin-api/auth.ts` - `ensureNcAdminToken`.
- **Packages:** `@tanstack/react-query` - queries/mutations/cache; `react` - refs and effects; `sonner` - toasts.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/page.tsx` (library list)
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx` (editor)

## Notes
- Recovery is capped at one elevation per failure episode, so an endpoint that keeps returning 401 cannot loop. The token clearing on 401 happens inside `lib/nc-admin-api/auth.ts`, not here.
- The 401 recovery effect is duplicated in both query hooks rather than factored out.
- The JSDoc above `RetryableMutation` contains the typo "eleflating" (meaning "elevating").

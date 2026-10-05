# `lib/coverfi/roles-api.ts`

> CRUD client for Coverfi role labels, the brokerage-defined titles that are assigned to stakeholders. Served by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 23

## Purpose
Coverfi lets a brokerage define its own role names (`CoverfiRole`: name plus an optional description). These are only labels. They are **not** Garage permission roles and grant no access. The roles table manages them, and the stakeholders table assigns one to each stakeholder through `updateStakeholderAssignment` in `brokerage-api.ts`.

## How it works
Base path: `/v1/coverfi/roles`.
- `listRoles()` - `GET`, returns `CoverfiRole[]`.
- `createRole({ name, description? })` - `POST`.
- `updateRole(id, patch)` - `PATCH /:id`.
- `deleteRole(id)` - `DELETE /:id`. Returns the raw `ApiResult<null>`; the other functions unwrap `.data`.

## Exports
`listRoles`, `createRole`, `updateRole`, `deleteRole`.

## Interfaces
- **External services:** the Coverfi backend at `NEXT_PUBLIC_COVERFI_API_URL`.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `CoverfiRole`.

## Used by
`components/coverfi/brokerage/StakeholdersTable.tsx` (role picker) and `components/coverfi/roles/RolesTable.tsx`.

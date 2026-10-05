# `lib/types.ts`

> Tiny type-only module that declares a `Role` union and a `Member` shape for organisation members.

**Kind:** frontend library · **Lines:** 9

## Purpose
This file holds a minimal shared definition of a team member with an admin/user role. It looks like an early or legacy type file. Nothing in the project imports it.

## How it works
It contains no runtime code, only two TypeScript types:
- `Role` is `"admin" | "user"`.
- `Member` is `{ id?: string; name?: string; email: string; role: Role; createdAt?: string }`. Only `email` and `role` are required.

## Exports
- `type Role` - `"admin" | "user"`.
- `type Member` - a member record with optional ID, name and creation timestamp.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
Appears unused. No importers were found.

## Notes
- The role model here (`admin` / `user`) does not match the roles used elsewhere in the app (for example `employee`, `stakeholder`, founder). Do not treat it as the source of truth for roles.
- Because the file is unused, it can probably be removed.

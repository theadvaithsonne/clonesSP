# `server/utils/userSearchClauses.ts`

> The `$or` clauses for "find a user by what someone typed".

**Kind:** backend utility · **Lines:** 49

<!-- docgen:auto -->

## Purpose
The `$or` clauses for "find a user by what someone typed".

Phone is a login identity now, not just a contact field, so every surface
that finds people by email has to find them by number too — otherwise an
admin can see an account exists but cannot search for it by the thing the
user actually signed in with.

Numbers are stored E.164 (`+919876543210`), which is NOT how people type
them. A bare `98765 43210`, or `(647) 559-0183`, matches nothing under a
plain regex. So a query containing digits also gets a digits-only clause
that ignores the formatting on both sides.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `escapeRegex` | function | `escapeRegex(s: string): string` — Query strings are user-controlled and go straight into a RegExp. | 16 |
| `userSearchClauses` | function | `userSearchClauses(q: string, extraFields: string[] = []): any[]` — Clauses matching `q` against name, email and phone. | 27 |
| `userSearchOr` | function | `userSearchOr(q: string, extraFields: string[] = [])` — Convenience for `filter.$or = ...` call sites. | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/bat246/services/bat246Admin.service.ts`
- `server/bat246/services/bat246Layaway.service.ts`
- `server/controllers/cabinet.controller.ts`

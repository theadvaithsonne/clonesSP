# `lib/cms/ids.ts`

> Generates short random ids for CMS page-builder modules, columns and list items.

**Kind:** frontend library · **Lines:** 4

## Purpose
Every node in a CMS page tree (modules, layout columns, social icons, footer links) needs a client-side id so the builder can find, update and remove it. This file provides the single id generator, kept in its own module so `columns.ts` and `moduleDefaults.ts` can both use it without a circular import.

## How it works
`newModuleId()` returns `m_` followed by 8 base-36 characters taken from `Math.random()`, e.g. `m_k3x9a1qz`. The ids are only unique in practice (random, not guaranteed) and are not cryptographically secure, which is fine for in-document node keys.

## Exports
- `newModuleId(): string` - a new id of the form `m_xxxxxxxx`.

## Dependencies
None.

## Used by
- `lib/cms/columns.ts` - ids for new columns in `makeColumns`.
- `lib/cms/moduleDefaults.ts` - ids for new modules and their nested items; also re-exports `newModuleId` for its own importers.

## Notes
- `Math.random().toString(36).slice(2, 10)` can, rarely, yield fewer than 8 characters; collisions within one page are very unlikely but not impossible.

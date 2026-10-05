# `lib/cms/moduleTree.ts`

> Immutable tree operations over a CMS page's module list: find a module, find its parent column, replace/remove a module anywhere in the tree, and add or remove blocks inside layout columns.

**Kind:** frontend library · **Lines:** 168

## Purpose
A CMS page's content is a nested tree: top-level modules, layout modules with `props.columns`, each column holding more modules, and (in older pages) modules with a legacy `children` array. The page builder keeps that tree in React state, so every edit must return a new tree rather than mutate. This file provides those pure functions so `PageBuilderShell.tsx` can update a deeply nested block by id.

## How it works
- **Traversal rule:** for a layout module (`isLayoutModule`), descend into `getLayoutColumns(m)` (which also understands the legacy `children` shape); for any other module with `children`, descend into `children`.
- `mapModules(modules, id, fn)` walks the tree and, at the module whose `id` matches, calls `fn(m)`: returning a module replaces it, returning `null` deletes it. Layout modules are rebuilt through the private helper `mapColumnModules` and written back with `withLayoutColumns`. The function is the basis for all the update helpers below.
- `findModule(modules, id)` - depth-first search returning the module or `null`.
- `findModuleParent(modules, id)` - returns `{ layoutId, columnId }` for the layout column that directly contains the module, or `null`. It only reports column parents: top-level modules and modules held in a non-layout module's `children` return `null`.
- `updateLayoutColumns(modules, layoutId, updater)` - finds the layout module by id and replaces its columns with `updater(currentColumns)`; a non-layout target is left unchanged.
- `addModuleToColumn(modules, layoutId, columnId, type)` - creates a module with `createModule(type)` and appends it to the matching column.
- `removeModuleFromColumn(modules, layoutId, columnId, moduleId)` - filters the module out of that column.
- `addModuleToLayoutStack(modules, layoutId, type)` - appends a new module to the target: for a layout module, to its first column (creating a single 100%-wide column with id `col_<moduleId>` if it has none); for a non-layout module, to its legacy `children` array.

## Exports
- `mapModules(modules: CmsModule[], id: string, fn: (m) => CmsModule | null): CmsModule[]` - replace or delete one module anywhere in the tree.
- `findModule(modules: CmsModule[], id: string): CmsModule | null`
- `findModuleParent(modules: CmsModule[], id: string): { layoutId: string; columnId: string } | null`
- `updateLayoutColumns(modules, layoutId, updater: (cols) => CmsColumnData[]): CmsModule[]`
- `addModuleToColumn(modules, layoutId, columnId, type: CmsModuleType): CmsModule[]`
- `removeModuleFromColumn(modules, layoutId, columnId, moduleId): CmsModule[]`
- `addModuleToLayoutStack(modules, layoutId, type: CmsModuleType): CmsModule[]`

## Dependencies
- **Internal:** `lib/cms/types.ts` - tree types; `lib/cms/moduleDefaults.ts` - `createModule` for new blocks; `lib/cms/columns.ts` - `isLayoutModule`, `getLayoutColumns`, `withLayoutColumns`.

## Used by
`components/deals/cms/PageBuilderShell.tsx` (only importer).

## Notes
- **No structural sharing in practice:** `mapColumnModules` always returns a new array from `.map`, so the `updated !== nested` / `nextCols !== cols` checks are always true and every layout module in the tree is rebuilt (and migrated to `props.columns`) on every `mapModules` call, even when the target id is elsewhere. Results are correct, but React memoisation on unchanged branches will not help.
- Side effect of the above: any legacy layout module without `props.columns` gets new random column ids on each edit (see the note in `lib/cms/columns.ts`), so a `columnId` captured before an edit may no longer match after it until the migrated tree is saved.
- In `addModuleToLayoutStack`, the local `first` is assigned but unused.

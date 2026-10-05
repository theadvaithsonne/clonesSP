# `lib/cms/columns.ts`

> Helpers for CMS "layout" modules (section, container, two/three-column, columns): identify them, create column sets, and read/write their columns while migrating an older data shape.

**Kind:** frontend library · **Lines:** 59

## Purpose
In the Deals CMS page builder, layout modules hold other modules inside columns. Columns live in `module.props.columns` as `CmsColumnData[]` (`{ id, width, modules }`). Older saved pages instead stored a flat `module.children` array with one block per column. This file centralises the column logic so the editor, the renderer and the tree utilities all treat both shapes the same way.

## How it works
- `LAYOUT_MODULE_TYPES` lists the five layout types; `isLayoutModule(type)` checks membership. Note that `hero` is *not* a layout module.
- `defaultColumnCount(type)`: `three_column` -> 3, `two_column` -> 2, `section`/`container` -> 1, anything else (including `columns`) -> 2.
- `makeColumns(count)` clamps `count` to 1-4 and builds that many empty columns with fresh ids (`newModuleId`). Widths are percentages: each gets `floor(100 / n)` and the last column takes the remainder so the total is exactly 100 (e.g. 3 columns -> 33/33/34).
- `getLayoutColumns(module)` is the read path with on-the-fly migration:
  1. if `props.columns` is a non-empty array, return it as is;
  2. else, if legacy `children` exist, create `defaultColumnCount` columns and put child *i* alone into column *i* (extra children beyond the column count are dropped);
  3. else return fresh empty columns.
  It does not mutate the module; when it migrates or creates columns, new ids are generated on every call, so callers should persist the result via `withLayoutColumns`.
- `withLayoutColumns(module, columns)` is the write path: returns a copy with `props.columns` set and `children` explicitly `undefined`, completing the migration away from the legacy shape.

## Exports
- `LAYOUT_MODULE_TYPES: CmsModuleType[]` - `section`, `container`, `two_column`, `three_column`, `columns`.
- `isLayoutModule(type: CmsModuleType): boolean`
- `defaultColumnCount(type: CmsModuleType): number`
- `makeColumns(count: number): CmsColumnData[]` - 1-4 empty columns with widths summing to 100.
- `getLayoutColumns(module: CmsModule): CmsColumnData[]` - columns, migrating legacy `children`.
- `withLayoutColumns(module: CmsModule, columns: CmsColumnData[]): CmsModule` - copy with columns set and `children` cleared.

## Dependencies
- **Internal:** `lib/cms/types.ts` - `CmsColumnData`, `CmsModule`, `CmsModuleType`; `lib/cms/ids.ts` - `newModuleId` for column ids.

## Used by
`components/deals/cms/ColumnModuleEditor.tsx`, `components/deals/cms/PageBuilderShell.tsx`, `components/deals/cms/PageRenderer.tsx`, `lib/cms/moduleDefaults.ts`, `lib/cms/moduleTree.ts`.

## Notes
- Because `getLayoutColumns` generates new random column ids each time for a module without `props.columns`, two reads of the same unmigrated module return different column ids. Code that relies on stable column ids (e.g. `addModuleToColumn` in `moduleTree.ts`) works reliably only once the module has been written back with `withLayoutColumns`.

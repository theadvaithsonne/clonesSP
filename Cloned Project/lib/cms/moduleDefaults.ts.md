# `lib/cms/moduleDefaults.ts`

> The CMS page builder's module catalogue: which block types exist in the library panel, which can go inside a column, and the default props each new block is created with.

**Kind:** frontend library · **Lines:** 201

## Purpose
When a user drags or clicks a block into a CMS landing page, the builder needs a starting `CmsModule` with sensible placeholder content. This file is the single source of those defaults and of the library list shown in the builder sidebar, so the editor (`PageBuilderShell`, `ColumnModuleEditor`) and the tree helpers (`moduleTree.ts`) create identical modules.

## How it works
- `ModuleLibraryItem` describes a library entry: `type`, display `label`, a `category` (`Layout`, `Content`, `Lead Form`, `Media`, `Social Proof`, `Advanced`) and an optional `disabled` flag. No entry in `MODULE_LIBRARY` currently sets `disabled`, and no entry uses the `Media` category.
- `MODULE_LIBRARY` lists all 16 module types with labels: Layout (Section, Columns, Two Column, Three Column, Hero Block, Container), Content (Logo, Heading, Text Block, Image, Button, Divider, Spacer), Social Proof (Social Icons), Advanced (Footer), Lead Form (Lead Form).
- `COLUMN_ADDABLE_TYPES` is the whitelist of block types allowed inside a layout column: `logo`, `heading`, `text`, `image`, `button`, `divider`, `spacer`, `social_icons`, `footer`, `lead_form`. Layout types and `hero` are excluded, which keeps nesting one level deep from the column picker.
- `createModule(type)` assigns a new id (`newModuleId`) and returns default props per type:
  - `hero` - dark-gradient background, placeholder heading/subheading, "Get Started" button in the brand yellow `#F5C518`, centred, 48px font, padding object `{ t, r, b, l }`.
  - `section` / `container` - white background, 24px padding, one column (`makeColumns(1)`).
  - `columns` / `two_column` - 16px gap, 24px padding, white, two columns; `three_column` - 12px gap, three columns.
  - `heading` - "Heading", 28px, weight 700, left, `#111111`; `text` - body placeholder, 15px, `#555555`.
  - `image` - empty `src`, alt "Image", 8px radius, empty `linkUrl`.
  - `button` - "Click me" linking to `#`, yellow background, black text, 8px radius.
  - `divider` - `#e5e5e5`, 1px; `spacer` - 32px height.
  - `lead_form` - only a `title` ("Get the Free Blueprint"); the form fields live in the page's separate `CmsForm` record.
  - `logo` - empty `src`, alt, link, centred, width 150.
  - `social_icons` - centred, size 32, spacing 12, three visible icons (facebook, instagram, linkedin), each with its own id.
  - `footer` - placeholder company name, address, contact email, copyright text, two links (Privacy Policy, Terms of Service) with ids, and dark colour scheme.
  - anything else - empty `props`.

## Exports
- `newModuleId(): string` - re-exported from `lib/cms/ids.ts`.
- `type ModuleLibraryItem` - library entry shape.
- `COLUMN_ADDABLE_TYPES: CmsModuleType[]` - types insertable into a column.
- `MODULE_LIBRARY: ModuleLibraryItem[]` - builder library entries.
- `createModule(type: CmsModuleType): CmsModule` - a new module with default props.

## Dependencies
- **Internal:** `lib/cms/types.ts` - `CmsModule`, `CmsModuleType`; `lib/cms/columns.ts` - `makeColumns` for layout defaults; `lib/cms/ids.ts` - `newModuleId`.

## Used by
`components/deals/cms/ColumnModuleEditor.tsx`, `components/deals/cms/PageBuilderShell.tsx`, `lib/cms/moduleTree.ts` (uses `createModule` when inserting blocks).

## Notes
- The footer default hardcodes "© 2026" in `copyrightText`; it will not update by itself in later years.
- Placeholder content (e.g. the footer's sample address and `hello@company.com`) is saved into the page as real content until the user edits it.

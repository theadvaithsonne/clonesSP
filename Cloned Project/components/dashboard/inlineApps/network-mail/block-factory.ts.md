# `components/dashboard/inlineApps/network-mail/block-factory.ts`

> Module exporting `makeId`, `parseColumns`, `serializeColumns`, `makeColumnsContent` and 1 more.

**Kind:** React component · **Lines:** 249

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BlockType` | type |  | 14 |
| `ComponentBlock` | interface |  | 27 |
| `ColumnData` | interface |  | 34 |
| `makeId` | function | `makeId()` | 40 |
| `parseColumns` | function | `parseColumns(json: string): ColumnData[]` | 44 |
| `serializeColumns` | function | `serializeColumns(cols: ColumnData[]): string` | 52 |
| `makeColumnsContent` | function | `makeColumnsContent(count: number): ColumnData[]` | 56 |
| `createComponent` | function | `createComponent(type: BlockType): ComponentBlock` | 65 |
| `createBlock` | const | `= createComponent` | 248 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/social-icons.tsx` — `createSocialIconsBlockContent`, `createSocialIconsBlockStyles`
  - `components/dashboard/inlineApps/network-mail/footer-block.tsx` — `createFooterBlockContent`, `createFooterBlockStyles`
  - `components/dashboard/inlineApps/network-mail/preheader-block.tsx` — `createPreheaderBlockContent`, `createPreheaderBlockStyles`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/email-html-export.ts`
- `components/dashboard/inlineApps/network-mail/email-template-presets.ts`
- `lib/network-mail-api.ts`

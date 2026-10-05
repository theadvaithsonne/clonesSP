# `components/athena/components/import-export/importExportStyles.ts`

> A single constant object of Tailwind class strings that gives every part of the Athena Import / Export UI the same typography and colours.

**Kind:** style constants module · **Lines:** 36

## Purpose
The Import / Export wizard has many small text elements: titles, step badges, column headers, table cells, selects and buttons. This module gives each one a named Tailwind class string, so the dashboard and its picker columns use `ie.<role>` instead of repeating class strings.

## How it works
- `ie` is a plain object frozen with `as const`. Each key names a UI role and each value is a Tailwind class string. For example, `pageTitle` is a white semibold base-size title, `tableHead` an uppercase muted caption, `select` a full-width dark 36px-tall select box.
- The palette is built for a dark surface: white text at several opacities (`/40`, `/50`, `/70`, `/75`) plus the theme's `brand` colour for active and selected states (`columnTitleActive`, `summaryValue`, `cardLabelSelected`, `sectionDivider`).
- Some keys come in idle/active pairs, such as `columnTitleIdle` / `columnTitleActive` and `cardLabelIdle` / `cardLabelSelected`. Callers combine them with `cn()`.
- `select` hardcodes the background `#0a0a0d` and removes the focus ring and outline.

## Exports
- `ie` - read-only map of role names to Tailwind class strings:
  - page header: `pageTitle`, `pageSubtitle`
  - steps and tabs: `tab`, `stepBadge`, `stepLabel`
  - sections: `sectionTitle`, `sectionDesc`, `sectionDivider`
  - picker columns: `columnTitle`, `columnTitleIdle`, `columnTitleActive`
  - summary: `summaryLabel`, `summaryValue`
  - cards: `cardLabel`, `cardLabelSelected`, `cardLabelIdle`
  - empty and helper text: `placeholder`, `empty`, `hint`
  - table: `table`, `tableHead`, `tableCell`, `tableCellStrong`, `tableCellMuted`
  - select: `select`, `selectPlaceholder`
  - small labels: `chip`, `badge`
  - buttons: `backBtn`, `ghostBtn`, `actionBtn`

## Dependencies
- **Internal:** none.
- **Packages:** none. The values only take effect because Tailwind CSS 4 picks up these class names when it scans the source.

## Used by
- `components/athena/components/import-export/ImportExportDashboard.tsx`
- `components/athena/components/import-export/PaginatedSelectColumn.tsx`

## Notes
- A path heuristic labels this file a React component, but it contains no JSX. It only holds class-name strings.

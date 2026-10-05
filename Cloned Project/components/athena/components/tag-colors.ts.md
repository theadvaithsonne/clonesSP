# `components/athena/components/tag-colors.ts`

> Shared palette and helpers that turn any stored Athena tag colour (preset hex, custom hex or old Tailwind class name) into a background colour plus a readable text colour.

**Kind:** Utility module · **Lines:** 65

## Purpose
Taskroom tags were once stored with Tailwind class names (for example `bg-blue-500`) and are now stored as hex values. This module gives every tag renderer one consistent way to show both kinds, and provides the preset swatches offered when a new tag is created.

## How it works
- `TAG_PRESET_COLORS` lists 10 presets, each with a `hex`, a hand-picked `fontColor` (black or white), and the `legacyClass` it replaces.
- Two private lookup maps are built from it: legacy class -> preset, and upper-case hex -> font colour.
- `normalizeTagColor(color)`:
  1. Empty input gives the fallback slate `#64748b` with black text.
  2. A known legacy class maps to its preset hex and font colour.
  3. A value starting with `#` keeps that hex. Its font colour comes from the preset table, or else from `getContrastFontColor`, which computes perceived luminance (0.299R + 0.587G + 0.114B) and returns black above 0.55, otherwise white. Non-6-digit hex values get black.
  4. Anything else gives the fallback.
- The other helpers wrap this for specific uses: inline style objects, the value to highlight in a picker, and case-insensitive equality.

## Exports
- `TAG_PRESET_COLORS` - readonly array of `{ hex, fontColor, legacyClass }`.
- `TAG_PRESET_HEX` - the 10 preset hex strings, in order (used as picker swatches).
- `normalizeTagColor(color?: string): { hex, fontColor }` - the core resolver.
- `getTagStyles(color?: string): { backgroundColor, color }` - React inline style for a tag chip.
- `resolveTagColorForPicker(color?: string): string` - the normalised hex to preselect in a colour picker.
- `isSameTagColor(a?: string, b?: string): boolean` - compares two stored colours after normalising them.

## Dependencies
None.

## Used by
`components/athena/components/tag-picker.tsx`, `components/athena/components/card-modal.tsx`, `components/athena/components/kanban-card.tsx`.

## Notes
- The listed `fontColor` values were chosen by hand and can differ from what the luminance formula would give (for example `#D53696` uses black text).

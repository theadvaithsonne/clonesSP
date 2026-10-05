# `app/(dashboard)/thoughts/components/ColorPicker.tsx`

> Small swatch grid that lets the user pick one of the predefined Thoughts note background colours.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 59

## Purpose
Notes in the Thoughts app can have a pastel background colour. This component renders the palette defined by `NOTE_COLORS` in `../types` as round buttons and reports the chosen hex value. It is reused by the note card, editor and viewer.

## How it works
- Renders a "Choose color" label and one ghost `Button` per entry in `NOTE_COLORS` (Default `#ffffff`, Red, Orange, Yellow, Green, Teal, Blue, Indigo, Purple, Pink, Brown, Gray).
- Each swatch is painted with the colour via inline `backgroundColor`; white gets a grey border so it is visible.
- The swatch matching `selectedColor` gets a ring and a check icon.
- Clicking calls `e.stopPropagation()` (so a click inside a clickable `NoteCard` does not also open the note), then `onColorSelect(color)` and the optional `onClose()`.

## Exports
- `default ColorPicker({ selectedColor = "#ffffff", onColorSelect, onClose?, className? })` - `onColorSelect(color: string)` receives the hex value from `NOTE_COLORS`.

## Dependencies
- **Internal:** `../types` (`NOTE_COLORS`, `NoteColor`) - the palette; `components/ui/button.tsx` - swatch buttons; `lib/utils.ts` (`cn`) - class merging.
- **Packages:** `react`; `lucide-react` (`Check`).

## Used by
- `app/(dashboard)/thoughts/components/NoteCard.tsx`
- `app/(dashboard)/thoughts/components/NoteEditor.tsx`
- `app/(dashboard)/thoughts/components/NoteViewer.tsx`

## Notes
- It only reports a value; persisting it (e.g. `PATCH notes/:id` with `{ color }`) is the parent's job. `getColorClass` in `../types` maps the stored hex back to Tailwind classes.

# `components/analytics/ControlBar.tsx`

> Client components for the analytics date-range and interval filters: the page-wide pill bar, the right-side filter drawer it opens (also used per card), and the inline dropdowns used inside the fullscreen dialog.

**Kind:** React component (client) · **Lines:** 489

## Purpose
Every analytics filter control lives in this file. The controls are fully controlled and purely presentational: they never fetch data or touch mock data. They report the user's choice through callbacks, and the owning page (`AnalyticsMetricsPage`) decides what to load. The same drawer serves both the page-wide filter and a single card's override, so both look and behave the same.

## How it works

### Option sets (L31-L57)
- `DateRangePreset` has seven values: last 7, 30 or 90 days, last 12 months, year to date, all time, and `custom`.
- `RANGE_LABELS` and `INTERVAL_LABELS` map each preset and each `ChartInterval` to its display text. The drawer and the dropdowns build their option lists by iterating these maps.

### `TractionFilterDrawer` (L98-L264)
This drawer follows the garage-admin drawer pattern; the comment points to `NetworkChainSubsFilterDrawer` as the model.

- **Rendering.** It is portalled to `document.body` with `createPortal`, but only after mount (`mounted` state), so the server render never touches `document`. The backdrop is a full-screen `framer-motion` overlay (z-100, blurred) and the panel springs in from the right.
- **Width.** The panel is 400 px, or 620 px while the draft range is `custom`, to fit the calendar.
- **Draft state.** Range, interval and custom start/end live in local draft state, and nothing is applied until **Apply**. Each time the drawer opens, the drafts reset from the applied props, so an abandoned edit never carries over into the next session.
- **Closing.** Escape, the X button and a backdrop click all call `onClose`. Clicks inside the panel stop propagation, so they do not close it.
- **Sections.**
  - "Date Range" lists every preset as a `DrawerOption`: `role="radio"`, `aria-checked`, a gold tint when selected.
  - When `custom` is chosen, a `RangeCalendar` appears and writes `start`/`end` as `YYYY-MM-DD` strings.
  - "Date Intervals" lists all six intervals.
- **Footer.**
  - **Reset** sets the drafts to `last_12_months` / `month`. It does not apply them.
  - **Apply** is disabled for `custom` until both dates are set and start is not after end. It calls `onApply({ range, interval, customStart?, customEnd? })`, with the custom dates only when the range is `custom`, and then closes the drawer.
- **Title.** The `title` prop (default `"Traction"`) is the small heading above "Filters". A card passes its metric name here.

### `Pill` (L268-L289)
A forwardRef button showing a label, a 2 px divider, the value and a chevron. It is 34 px high, and `minWidth` is a floor, not a fixed width, so labels like "Last 12 months" or a custom date range are never truncated.

### `InlineFilters`, `InlinePill`, `InlineMenu` (L291-L424)
These are used inside `ChartFullscreenDialog`. The drawer cannot open there, for three reasons given in the comment:
1. The drawer sits at z-100 and the dialog at z-1100, so the drawer would open behind the dialog.
2. Radix would treat clicks in the drawer as clicks outside the dialog and close it.
3. The dialog's focus trap would pull focus out of the drawer's inputs.

Instead, `InlineFilters` uses two Radix `DropdownMenu`s, which are built to work inside a Dialog.
- `InlineMenu` renders the items at `z-[1200]` (menu content is portalled to `body`) and marks the active item with a check.
- The range options leave out `custom`, because choosing one needs the drawer's calendar. If a custom window is already active, its value shows as `start → end`.

### `ControlBar` (L426-L488)
The page-wide bar: two pills (min widths 235 and 246) that both open the same `TractionFilterDrawer`. Its `onApply` applies changes in a set order:
1. If the range is `custom` with dates, it calls `onCustomRangeChange` first, so the page never renders a `custom` range without dates.
2. It calls `onRangeChange` only when the preset actually changed.
3. It calls `onIntervalChange` only when the interval changed. The page's range handler re-picks a default interval, so the user's own interval choice is applied after it and is not overwritten.

## Exports
- `ControlBar({ range, onRangeChange, interval, onIntervalChange, customStart?, customEnd?, onCustomRangeChange?, className? })` - page-wide pill bar plus drawer.
- `TractionFilterDrawer({ open, onClose, range, interval, customStart?, customEnd?, onApply, title? })` - portalled filter drawer.
- `InlineFilters({ range, onRangeChange, interval, onIntervalChange, customStart?, customEnd?, className? })` - dropdown filters that are safe inside a dialog.
- `DateRangePreset` - the preset union type.
- `RANGE_LABELS` - `Record<DateRangePreset, string>`.
- `INTERVAL_LABELS` - `Record<ChartInterval, string>`.

## Interfaces
- **Browser storage / cookies:** none.
- Keyboard: Escape closes the drawer through a `window` `keydown` listener, attached only while the drawer is open.

## Dependencies
- **Internal:**
  - `@/components/ui/dropdown-menu` - Radix dropdown wrappers.
  - `@/components/ui/range-calendar` - `RangeCalendar` for picking a custom window.
  - `./types` - `ChartInterval`.
- **Packages:**
  - `react` - state, effects, `forwardRef`.
  - `react-dom` - `createPortal`.
  - `framer-motion` - drawer animation.
  - `lucide-react` - `Check`, `ChevronDown`, `X` icons.

## Used by
- `components/analytics/AnalyticsMetricsPage.tsx` - `ControlBar` and `DateRangePreset`.
- `components/analytics/ChartCard.tsx` - `TractionFilterDrawer`, for per-card filters.
- `components/analytics/ChartFullscreenDialog.tsx` - `InlineFilters`.
- `components/analytics/mock.ts` - the `DateRangePreset` type only.

## Notes
- `custom` is a `DateRangePreset`, but the helpers in `mock.ts` (`rangeFromPreset`, `defaultIntervalForPreset`) have no `custom` case. Callers must handle `custom` themselves.
- The `ControlBar` pill's aria-label always uses `RANGE_LABELS[range]`, so a custom window is announced as "Custom range" rather than by its dates.
- The custom date check (`draftStart > draftEnd`) compares `YYYY-MM-DD` strings. That works because the format sorts lexically.

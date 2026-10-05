# `components/athena/components/timesheetTheme.ts`

> A set of CSS colour-value constants that give the Athena timesheet screens one shared brand accent.

**Kind:** Theme constants module (it contains no JSX, so it is not a component) · **Lines:** 11

## Purpose
The timesheet widgets use inline `style` props in some places, where Tailwind classes are not convenient. This module puts the accent colours in one place so those inline styles follow the white-label brand colour instead of hard-coded hex values.

## How it works
Every constant is a plain string that the browser resolves at render time:
- `var(--brand)` and `var(--brand-foreground)` are the CSS custom properties for the active brand.
- The other shades come from `color-mix(in srgb, ...)`, which mixes the brand colour with black, near-black `#0a0a0a` or `transparent`. That produces darker or softer versions without any JavaScript colour maths.

There is no runtime logic. Because the values are CSS expressions rather than resolved colours, they only work where CSS evaluates them, such as `style={{ background: TS_ACCENT }}`. They do not work where code needs a literal hex value, for example a canvas or a colour-parsing library.

## Exports
- `TS_ACCENT` - `var(--brand)`, the base accent.
- `TS_ACCENT_DARK` - the brand mixed 80% with black.
- `TS_ACCENT_DEEP` - the brand mixed 67% with black.
- `TS_ON_ACCENT` - `var(--brand-foreground)`, the text colour for use on top of the accent.
- `TS_ACCENT_SOFT_BG` - a 16% brand tint over `#0a0a0a`, for dark soft backgrounds.
- `TS_ACCENT_SOFT_BG_HOVER` - a 24% tint, the hover state of the soft background.
- `TS_ACCENT_BORDER` - the brand mixed 48% with black, for borders.
- `TS_ACCENT_RGBA_12` - the brand at 12% over transparent. The name says "RGBA", but the value is a `color-mix` expression.
- `TS_ACCENT_RGBA_04` - the brand at 4% over transparent.

## Dependencies
- **Internal:** none. It relies on the `--brand` and `--brand-foreground` CSS variables, which the app's global theme / white-label setup defines.
- **Packages:** none.

## Used by
- `components/athena/components/TimesheetWeekPicker.tsx`, which imports `TS_ACCENT`, `TS_ACCENT_SOFT_BG_HOVER` and `TS_ON_ACCENT`.

The other six constants are not imported anywhere in that file.

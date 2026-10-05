# `lib/utils.ts`

> The project-wide general utility module: the shadcn `cn()` class-name merger plus small date, time, slug and HTML-to-text helpers.

**Kind:** frontend library · **Lines:** 52

## Purpose
This is the standard shadcn/ui `lib/utils.ts`. Almost every UI component imports `cn` from it to build conditional Tailwind class strings. Over time a few generic, dependency-free formatting helpers were added. With 413 importers it is one of the most widely used files in the frontend.

## How it works
- `cn(...inputs)` runs `clsx` (conditional class lists, arrays, objects), then `twMerge`, which resolves conflicting Tailwind utilities so the last one wins (for example `p-2 p-4` becomes `p-4`).
- `parseDateLocal(dateStr)` takes the `yyyy-MM-dd` part of an ISO or date string and builds a *local* `Date` at midnight. This avoids the off-by-one-day bug where `new Date("2026-01-05")` is UTC midnight and shows as 4 January in western timezones. It does not validate input: a malformed string produces `Invalid Date`.
- `formatTime12Hour("HH:mm")` returns `"h:mm AM/PM"`. `00` becomes 12 AM and `12` becomes 12 PM. Minutes default to `"00"`. An empty input returns `""`.
- `slugify(text)` lower-cases and trims, strips characters other than word characters, spaces and hyphens, collapses runs of spaces, underscores and hyphens into one `-`, and trims hyphens from both ends.
- `stripHtml(html)` turns `<br>` and block-closing tags into spaces, removes all other tags, decodes `&nbsp; &amp; &lt; &gt; &quot; &#39;`, collapses whitespace and trims. It is meant for previews and excerpts. It is not a sanitiser.

## Exports
- `cn(...inputs: ClassValue[]): string` - merges Tailwind and conditional class names.
- `parseDateLocal(dateStr: string): Date` - local-midnight date without a timezone shift.
- `formatTime12Hour(time24: string): string` - converts 24-hour time to 12-hour format.
- `slugify(text: string): string` - URL-safe slug.
- `stripHtml(html: string): string` - plain-text version of an HTML fragment.

## Dependencies
- **Internal:** none.
- **Packages:** `clsx` - conditional class composition. `tailwind-merge` - resolves Tailwind class conflicts.

## Used by
413 files. Examples: `app/(auth)/verify/page.tsx`, `app/(dashboard)/coverfi/page.tsx`, `app/(dashboard)/deals/page.tsx`, `app/(dashboard)/flowboard/[symbol]/components/kanban-board.tsx`, `app/(dashboard)/layout.tsx`, the Taskroom components (`app/(dashboard)/taskroom/...`), the Thoughts pages and components (`app/(dashboard)/thoughts/...`), `app/(dashboard)/workspace/WorkspaceClient.tsx`, `app/(dashboard)/workspace/components/EventCard.tsx`, and 388 more, including essentially every `components/ui/*` shadcn wrapper.

## Notes
- `slugify` uses `\w`, which is ASCII-only, so non-Latin text (for example Hindi or accented characters) is removed rather than transliterated. A title written only in such characters produces an empty slug.
- Do not use `stripHtml` output as safe HTML. It is for text extraction only.

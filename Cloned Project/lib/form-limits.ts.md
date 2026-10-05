# `lib/form-limits.ts`

> Shared caps and helpers for the repeatable list fields (FAQs, benefits, learning points, key features, deliverables) in the founder creation forms.

**Kind:** frontend library · **Lines:** 41

## Purpose
The community, live-stream, webinar, course, service and product creation forms each save one JSON document holding every list entry plus a rendered email-alert HTML snapshot. Unbounded lists once pushed that body past the request size limit, so saves failed with HTTP 413 before reaching a route handler. The file header notes the backend body limit is now 50 MB, so these caps are a guard against runaway forms and a readability limit for the sales pages the lists render on, rather than the thing that keeps a normal save under the limit.

## How it works
Plain constants and two pure functions; no state or side effects.
- The caps are numbers that each form checks before letting the author add another row.
- `limitReachedLabel` builds the standard helper text shown once a list is full.
- `filterNonEmptyStrings` trims each entry and drops empty or whitespace-only ones, so blank editor rows are never sent. Note it returns the **trimmed** strings, not the originals.

## Exports
- `MAX_FAQS = 30` - FAQ accordions on a sales page.
- `MAX_BENEFITS = 20` - "Benefits" / "What's included" cards.
- `MAX_LEARNING_POINTS = 20` - "What you'll learn" bullet points.
- `MAX_KEY_FEATURES = 20` - key feature cards on a product page.
- `MAX_DELIVERABLES = 20` - service deliverables, overall or per milestone.
- `limitReachedLabel(max: number, noun: string): string` - returns `"Maximum <max> <noun> reached"`.
- `filterNonEmptyStrings(items: string[]): string[]` - trims entries and removes blank ones.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `components/dashboard/CallsPage.tsx` - `MAX_FAQS`, `MAX_BENEFITS`, `limitReachedLabel`, `filterNonEmptyStrings`
- `components/dashboard/ChannelsPage.tsx` - `MAX_FAQS`, `MAX_BENEFITS`, `limitReachedLabel`
- `components/dashboard/CoursesPage.tsx` - `MAX_LEARNING_POINTS`, `limitReachedLabel`
- `components/dashboard/ProductsPage.tsx` - `MAX_FAQS`, `MAX_KEY_FEATURES`, `limitReachedLabel`
- `components/dashboard/ServiceFormModal.tsx` - `MAX_BENEFITS`, `MAX_DELIVERABLES`, `limitReachedLabel`, `filterNonEmptyStrings`
- `components/dashboard/WorkshopsPage.tsx` - `MAX_FAQS`, `MAX_LEARNING_POINTS`, `limitReachedLabel`, `filterNonEmptyStrings`

## Notes
- The doc comment on `filterNonEmptyStrings` speaks of "every text field", but the function only accepts plain strings. Lists of objects (such as FAQ question/answer pairs) must be filtered by the calling form.
- The header mentions milestones too, but there is no separate milestone cap here.
- The caps are enforced only in the UI. The file does not say whether the backend checks them.

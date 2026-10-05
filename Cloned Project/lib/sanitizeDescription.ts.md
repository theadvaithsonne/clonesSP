# `lib/sanitizeDescription.ts`

> Cleans org-authored rich-text descriptions with DOMPurify, removing inline styles and classes and normalising links, so the HTML can be rendered safely with `dangerouslySetInnerHTML` on themed pages.

**Kind:** frontend library · **Lines:** 71

## Purpose
Courses, channels, products, services and events carry descriptions that organisers often paste in from Apple Notes, Word, Google Docs or other editors. That markup carries inline styles such as `color: rgb(0,0,0)`, which turn text invisible on dark checkout cards, and font overrides that break the Tailwind styling. This helper is the single sanitiser used wherever such descriptions are rendered as HTML: checkout pages, guest pages, the feed and dashboard cards.

## How it works
1. **SSR guard:** if `window` is undefined it returns the raw HTML unchanged, because DOMPurify v3 needs `DOMParser`. The client re-renders with the sanitised version during hydration.
2. **DOMPurify pass:** `DOMPurify.sanitize(html, { FORBID_ATTR: ["style", "class"], ADD_ATTR: ["target", "rel"] })`. This removes scripts and event handlers via the default allow-list, drops Office/Notes wrapper junk, and strips every `style` and `class`. Structural tags (`ol`, `li`, `b`, `p`, `a`...) are kept, so the page's Tailwind selectors such as `[&_ol]:list-decimal` take effect.
3. **Anchor post-processing:** the cleaned HTML is parsed with `DOMParser`, and for every `<a>`:
   - an `href` that does not start with `http(s)://`, `mailto:` or `#` gets an `https://` prefix, so `www.google.com` becomes an absolute external link;
   - `target="_blank"` and `rel="noopener noreferrer"` are always set.
4. It returns `doc.body.innerHTML`. If post-processing throws, it returns the DOMPurify output instead.

## Exports
- `sanitizeDescription(html: string): string` - returns the sanitised, theme-friendly HTML (raw HTML during SSR).

## Dependencies
- **Internal:** none
- **Packages:** `dompurify` - HTML sanitisation.

## Used by
- `app/(affiliate)/[orgSlug]/[channelId]/page.tsx`
- `app/(affiliate)/[orgSlug]/page.tsx`
- `app/checkout/course/[courseId]/CourseCheckoutPage.tsx`
- `app/checkout/product/[productId]/ProductCheckoutPage.tsx`
- `app/checkout/workshop/[workshopId]/WorkshopCheckoutPage.tsx`
- `app/guest/[slug]/course/[courseId]/page.tsx`
- `app/guest/[slug]/product/[productId]/page.tsx`
- `components/dashboard/ChannelPaymentModal.tsx`
- `components/dashboard/ChannelPaymentModalNew.tsx`
- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/FeedComponents.tsx`
- `components/dashboard/FeedPageRedesigned.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/RightPanel.tsx`
- `components/webinar/SessionNotStartedCard.tsx`

## Notes
- Callers must be client components (`"use client"`).
- **Security caveat:** during SSR the HTML is returned **unsanitised**. That is fine only while descriptions are rendered by client components that re-render after hydration. A server component calling this would ship raw org HTML.
- Relative links (such as `/courses/123`) also get `https://` prepended, which produces `https:///courses/123`. Authors should use absolute URLs.

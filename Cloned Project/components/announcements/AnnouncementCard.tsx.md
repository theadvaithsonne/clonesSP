# `components/announcements/AnnouncementCard.tsx`

> Pure presentation component for "Alerts & Promotions": renders an announcement (saved or draft) as a dialog card or a top banner, plus the fixed overlay that shows it live.

**Kind:** React component · **Lines:** 741

## Purpose
Alerts & Promotions are admin-authored notices (promos, outage alerts, "coming soon" teasers) shown on the login screen and in the dashboard. This file is the single visual implementation of such a card. Because it takes plain data and has no fetching or storage logic, the garage-admin editor can render the exact same component as a live preview of what users will see, instead of maintaining a separate mock that drifts.

It deliberately does not use `components/ui/dialog`: that component portals to `<body>`, which would break the inline preview pane. Instead the live overlay is a plain `position: fixed` container, so the card itself works both inline and as a modal.

## How it works

### Data shape (L108-L121)
`AnnouncementCardData` is the minimal set of fields needed to draw a card: title, body (HTML or plain text), eyebrow, `size`, `contentType` (`"text"` or `"image-text"`), `imageUrl`, `template`, `icon`, `cta` (`enabled`, `label`, `href`, `newTab`), `comingSoon` and `comingSoonLabel`. A full `Announcement` row from `lib/announcements.ts` satisfies it structurally, as does an editor draft.

### Glass badge (L37-L106)
`GLYPHS` maps the stored `AnnouncementIcon` value (`megaphone`, `bell`, `alert`, `info`, `sparkle`, `gift`, `rocket`, `bolt`, `calendar`, `lock`, `wrench`) to a `lucide-react` icon. `GlassBadge` draws it inside a colourless "liquid glass" squircle (`rounded-[30%]`, `backdrop-blur-xl`, inset shadows, a diagonal specular sweep and a bottom highlight). `icon === "none"` renders nothing; an unknown stored value falls back to `Megaphone`. `compact` shrinks it (used for `sm` cards and banners).

### Template chrome (L123-L209)
`TEMPLATE_CHROME` defines five visually distinct styles keyed by `AnnouncementTemplate`:
- `solid` - dark `#101010` card, neutral shadow.
- `glass` - translucent `bg-white/[0.07]` with `backdrop-blur-2xl`, so it frosts the dimmed page behind it.
- `spotlight` - solid card plus a radial "top bloom" light.
- `accent` - solid card with a brand-coloured left rail and brand eyebrow.
- `caution` - solid card with a diagonal hazard-stripe top bar in the brand colour.

Every template uses the same brand-yellow primary button (`YELLOW_BUTTON`). `chromeFor()` resolves a stored template string, mapping three legacy names (`feature-promo` -> `accent`, `system-alert` -> `caution`, `clean-announcement` -> `solid`) and falling back to `solid` for anything else, so old rows keep rendering.

`SIZE_WIDTH` maps `sm`/`md`/`lg`/`banner` to `max-w-sm`/`max-w-lg`/`max-w-3xl`/`max-w-none`.

### Body rendering and sanitisation (L218-L288)
`AnnouncementBody` is the app's sanitisation boundary for announcement HTML. If the body looks like HTML (regex `/<[a-z][\s\S]*>/i`) it is passed through `DOMPurify.sanitize` with a strict allow-list: tags `p, br, b, strong, i, em, u, s, span, div, ul, ol, li, a, blockquote, code, h3, h4` and attributes `href, target, rel` only. No images, tables, ids, classes or `style` - a promo must not be able to reposition itself over the app. The result is injected with `dangerouslySetInnerHTML`. Sanitising is memoised and skipped when `window` is undefined (returns an empty string, so a server render can never emit unsanitised markup). Plain-text bodies (rows from before the rich-text editor) render as React text with `whitespace-pre-line`. Typography classes force long words to wrap and shrink headings to body scale so nothing out-shouts the title.

### CTA and coming-soon (L290-L352)
`CtaButton` renders nothing when the CTA is disabled. If `comingSoon` is set it renders an inert, greyed label with a clock icon (`comingSoonLabel` or "Coming Soon") regardless of `href`. Otherwise it needs a non-empty `href` and renders an `<a>` (label defaults to "Learn more"; `target="_blank"` with `rel="noopener noreferrer"` when `newTab`), calling `onNavigate` on click. `ComingSoonBadge` adds a small brand pill next to the eyebrow when `comingSoon` is set.

### Banner form (L354-L453)
For `size === "banner"`, `AnnouncementBanner` renders a full-width `role="region"` strip: optional bloom, a 1px top rule for `caution` (hazard bar) or `accent` (the side rail becomes a top rule since a banner has no left edge), then a row with a thumbnail image or compact glass badge, eyebrow + truncated title + coming-soon badge, a two-line-clamped body, the CTA, a "Don't show again" link (hidden below `sm`), and an X dismiss button.

### Dialog form (L455-L678)
`AnnouncementCard` delegates banners to `AnnouncementBanner`; otherwise it builds a `role="dialog"` card. `compact` = `sm`, `roomy` = `lg`. The copy column holds eyebrow/coming-soon badge, the glass badge beside the title (`h2`, size scaled) and body, then:
- A CTA row shown only when `hasCta` (enabled CTA with either `comingSoon` or a non-empty `href`, mirroring what `CtaButton` actually draws). It pairs the CTA with a "Not now" button (calls `onDismiss`); a lone "Not now" without a CTA is deliberately suppressed. On `sm` the buttons stack full-width.
- A quieter "Don't show this again" link when `onDiscard` is provided.

The shell adds the hazard top bar, spotlight bloom, accent side rail and an absolute X dismiss button. With an image (`contentType === "image-text"` and `imageUrl` set) the card is always a two-column split at `sm:` and up: copy left, image right. On mobile it collapses to one column with the image moved first visually via `order-first`, while copy stays first in the DOM for screen readers and tab order.

### Live overlay (L680-L738)
`AnnouncementOverlay` adds a window `keydown` listener so Escape calls `onDismiss`. Banners are pinned `fixed top-0` at `z-[1000]`: above app chrome (around z-900) but below Radix dialogs (z-1100) and call overlays (z-9999), so a lingering banner never covers a dialog the user opened. Dialog sizes render a full-screen `z-[1200]` container with a `bg-black/70 backdrop-blur-sm` backdrop (clicking it dismisses) and the card centred, scrollable when tall.

## Exports
- `default AnnouncementCard` - same as the named export.
- `AnnouncementCard({ data, onDismiss?, onDiscard?, onNavigate?, className? })` - renders the card (dialog or banner) inline, with no positioning. `onDismiss` = close for now (X and "Not now"); `onDiscard` = permanent opt-out link; `onNavigate` = fired when the CTA link is clicked. Omitting a callback hides its control.
- `AnnouncementOverlay({ data, onDismiss, onDiscard?, onNavigate? })` - the live fixed-position presentation with backdrop, Escape-to-dismiss and banner pinning.
- `AnnouncementCardData` (interface) - the fields the card needs; satisfied by a saved `Announcement` or an editor draft.

## Interfaces
- **Browser storage / cookies:** none here; dismissal persistence lives in `lib/announcements.ts` and is driven by `AnnouncementHost`.

## Dependencies
- **Internal:** `lib/announcements.ts` - types `AnnouncementIcon`, `AnnouncementSize`, `AnnouncementTemplate` (type-only import); `lib/utils.ts` - `cn` class merging.
- **Packages:** `dompurify` - HTML sanitisation of the body; `lucide-react` - badge glyphs, clock and close icons; `react` - `useEffect`, `useMemo`.

## Used by
- `components/announcements/AnnouncementHost.tsx` - uses `AnnouncementOverlay` to show live announcements on the login screen and dashboard.
- `components/garage-admin/AnnouncementPreviewStage.tsx` - uses the default `AnnouncementCard` for the live preview in the garage-admin announcements editor (`/garage-admin/announcements`).

## Notes
- The DOMPurify allow-list is the only XSS defence for admin-authored body HTML; widening it (especially adding `style`, `img` or `class`) changes the security posture.
- The CTA `href` is not validated here; it is rendered as given (only the body is sanitised).
- Images use a plain `<img>` with an empty `alt` (decorative), not `next/image`.
- `role="dialog"` with `aria-modal="true"` is applied even when the card is rendered inline in the admin preview.
- The z-index values (1000 for banners, 1200 for dialogs) are tuned against the rest of the app's layers; see the comment at L705-L709.

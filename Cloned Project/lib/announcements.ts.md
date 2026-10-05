# `lib/announcements.ts`

> The shared vocabulary for "Alerts & Promotions": types, picker options, a blank draft, browser-side dismissal tracking, and the public fetch of the announcements currently live.

**Kind:** frontend library · **Lines:** 360

## Purpose
Admins write announcement cards and banners in the garage-admin console (`/garage-admin/announcements`). The cards appear on two surfaces: the login/signup screens (pre-login) and the dashboard (post-login). This file is the single definition of what an announcement looks like and is shared by the authoring console, the preview stage, the card renderer and the host that decides what to show. It also holds the "don't show this again" logic, which lives entirely in the browser.

## How it works

### Types (L10-L95)
- `AnnouncementSurface`: `pre-login`, `post-login` or `everywhere`.
- `AnnouncementSize`: `sm`, `md` or `lg` dialogs, or `banner`, a full-width strip with no modal.
- `AnnouncementContentType`: `text` or `image-text`.
- `AnnouncementTemplate`: the visual style (`solid`, `glass`, `spotlight`, `accent`, `caution`). The comment explains that styles are named for how they look, not what they're for: older rows stored use-case names (for example `feature-promo`, `system-alert`), the backend keeps the field as a free string, and `components/announcements/AnnouncementCard.tsx` maps those legacy names onto the nearest style.
- `AnnouncementIcon`: the badge glyph, chosen independently of the template. The backend stores it as a free string, so adding an icon here needs no backend change. Unknown values fall back to `megaphone`.
- `AnnouncementCta`: an optional button (`enabled`, `label`, `kind` of `page` or `url`, `href`, `newTab`).
- `Announcement`: the full record, including schedule (`startsAt` and `endsAt`, as ISO strings or null), `priority`, a `comingSoon` flag with its label, `enabled`, and a server-managed `version`.
- `AnnouncementDraft`: an `Announcement` without `id`, `version`, `createdAt` and `updatedAt`. This is what the editor posts.

### Picker options (L97-L224)
- `SURFACE_OPTIONS`, `SIZE_OPTIONS`, `TEMPLATE_OPTIONS` and `ICON_OPTIONS` give the label and hint text for each editor control.
- `DEEP_LINK_TARGETS` is the CTA destination dropdown, grouped into Workspace, Discover & earn, Money, and Public pages. Most of the app lives inside one `/workspace` route whose panels are React state, so in-app links take the form `/workspace?openApp=<slug>`. Each slug must exist in `OPEN_APP_POPOVER` in `app/(dashboard)/layout.tsx`, which is what opens the panel. There is deliberately no bare "Discover" entry, because `?openApp=discover` needs an item type and id. The "Public pages" group holds real routes (`/browse-hqs`, `/careers`, `/jobs`, `/select-organization`, `/login`).

### Blank draft (L226-L251)
`emptyAnnouncementDraft()` returns a disabled, post-login, `md`, `solid`, megaphone draft with no CTA, no schedule and priority 0.

### Dismissal (L253-L334)
There are two levels of dismissal, because "close this" and "never show it again" mean different things:
- **Snooze** (sessionStorage key `garage_announcements_snoozed`): set by closing the card or choosing "Not now". It hides the card for the current tab session.
- **Discard** (localStorage key `garage_announcements_dismissed`): set by "Don't show this again". It hides the card permanently in this browser.

Both lists store keys of the form `"<id>:<version>"`. When an admin uses "Show again", the server bumps `version`, every stored key goes stale and the card reappears. Lists are JSON arrays capped at the 100 most recent keys. Every storage read and write is wrapped in try/catch, and on the server (no `window`) every check returns "not hidden". `isAnnouncementHidden` is true when the card is either discarded or snoozed.

### Fetch (L336-L359)
`fetchActiveAnnouncements(surface)` calls the unauthenticated public endpoint with `cache: "no-store"` and returns `json.data` as an array. It never throws: a non-OK response, a parse error or a network error all return `[]`, so a failed fetch can't break the login screen.

## Exports
- Types: `AnnouncementSurface`, `AnnouncementSize`, `AnnouncementContentType`, `AnnouncementTemplate`, `AnnouncementCtaKind`, `AnnouncementIcon`, `AnnouncementCta`, `Announcement`, `AnnouncementDraft`.
- `SURFACE_OPTIONS`, `SIZE_OPTIONS`, `TEMPLATE_OPTIONS`, `ICON_OPTIONS` - editor option lists.
- `DEEP_LINK_TARGETS` - grouped CTA destinations.
- `emptyAnnouncementDraft(): AnnouncementDraft` - a blank draft.
- `isAnnouncementDiscarded(a)`, `discardAnnouncement(a)` - permanent dismissal (localStorage).
- `isAnnouncementSnoozed(a)`, `snoozeAnnouncement(a)` - per-session dismissal (sessionStorage).
- `isAnnouncementHidden(a)` - either level. Each of these dismissal functions takes `Pick<Announcement, "id" | "version">`.
- `fetchActiveAnnouncements(surface: "pre-login" | "post-login"): Promise<Announcement[]>` - live announcements, best first.

## Interfaces
- **Backend endpoints called:** `GET /backend/public/announcements/active?surface=pre-login|post-login`. It needs no auth. Served by `server/routes/publicAnnouncements.ts` (mounted at `/public/announcements`), which returns announcements that are enabled, within their schedule window and targeting that surface or `everywhere`, sorted by priority then newest, at most 10.
- **Database (via backend):** `Announcement` model (`server/models/announcement.model.ts`), read only.
- **Browser storage / cookies:** localStorage `garage_announcements_dismissed`, sessionStorage `garage_announcements_snoozed`.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL`.
- **Packages:** none.

## Used by
- `components/announcements/AnnouncementCard.tsx` - renders a card.
- `components/announcements/AnnouncementHost.tsx` - fetches and decides which card to show.
- `components/garage-admin/AnnouncementsConsole.tsx` - the authoring console.
- `components/garage-admin/AnnouncementPreviewStage.tsx` - the live preview.
- `lib/admin-api/announcements.ts` - admin CRUD client (for the `/garage-admin/announcements` backend routes).

## Notes
- Dismissal is per browser, not per user. Clearing site data or switching device brings cards back.
- Adding a CTA deep link here does nothing unless the matching `openApp` slug is also handled in `app/(dashboard)/layout.tsx`.

# `server/models/eventWebsiteConfig.model.ts`

> Mongoose model for the saved output of the visual Event Web Builder: a draft and a published copy of ordered content blocks and theme, plus the custom domain, branding, SEO and social-card settings for one Event Program's public site.

**Kind:** Mongoose model · **Lines:** 219

## Purpose
Every Event Program gets a public landing page that the organiser assembles from modular blocks. This document is that page's source. It separates the **draft** (`blocks`/`theme`, which the builder edits) from the **live** snapshot (`publishedBlocks`/`publishedTheme`, which the public page reads exclusively). Without the split, every keystroke in the builder would go live on the customer site. Each event has one config.

## How it works
**Blocks**
- `EventBlockType` and `EVENT_BLOCK_TYPES` list the block kinds: `hero`, `about`, `agenda`, `speakers`, `sponsors`, `tickets`, `venue_map`, `faq`, `cta_banner`, `footer`.
- `BlockSchema` / `IEventWebsiteBlock` (`_id: false`): `id` (required string), `type` (enum), `order`, `isVisible`, and two free-form Mixed objects, `content` and `styles`. They are free-form on purpose so each block type owns its content shape and the builder can add fields without a schema migration.

**Theme**
- `ThemeSchema` / `IEventWebsiteTheme`: `primaryColor` (default `#FACC15`), `backgroundColor` (default `#0c0c0e`), `font` (default `Inter`).

**Custom domain**
- `DomainSchema` / `IEventDomain`: `host` (lowercased, max 253), `status` (`pending | verified | failed`, default `pending`), `verificationToken`, `lastError` (what the last DNS check found, max 500), `lastCheckedAt`, `verifiedAt`.
- `status` is the source of truth for whether the domain is live. It only becomes `verified` after a real DNS lookup succeeds, never on the organiser's word. The token is minted once per domain and never reused, so removing and re-adding a host forces a fresh proof of ownership.

**Branding, SEO and social**
- `IEventBranding`: `logoUrl`, `faviconUrl` (max 2000 each), and `siteName` (max 120; falls back to the event name).
- `IEventSeo`: `title` (max 70), `description` (max 200), `keywords[]` (max 60 each), and `noIndex` to keep private or dry-run events out of search results.
- `IEventSocial`: `ogTitle` (max 120), `ogDescription` (max 300), `ogImageUrl` (1200x630 recommended), `twitterCard` (`summary` or `summary_large_image`, default the latter), `twitterHandle` (max 40).

**Document**
- Stored in collection **`event_website_configs`**: `eventId` (ref `EventProgram`, unique), `isPublished`, `theme` (default `{}`), `blocks` (default `[]`), `publishedTheme`, `publishedBlocks` (default `undefined`, so a config that was never published has none), `publishedAt`, `domain` (default `undefined`), and `branding`, `seo`, `social` (each default `{}`). Timestamps are on.
- A sparse unique index on `domain.host` means one host can point at only one event, and configs without a custom domain do not collide.

## Exports
- `EventBlockType`, `EVENT_BLOCK_TYPES`.
- `IEventWebsiteBlock`, `IEventWebsiteTheme`, `IEventWebsiteConfig`, `IEventDomain`, `IEventBranding`, `IEventSeo`, `IEventSocial`.
- `EventWebsiteConfig` - the model.

## Interfaces
- **Database:** `EventWebsiteConfig` (collection `event_website_configs`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/eventManagement.ts` (mounted at `/event-management`): `GET`/`PUT /backend/event-management/:id/website`, plus the publish, domain and branding routes that follow them.
- `server/routes/publicEventManagement.ts`: `GET /backend/public/event-management/resolve-domain` maps a custom host to its event. The root `middleware.ts` uses this for organisers' event domains. The slug page reads the published snapshot.
- `server/services/eventManagement.ts` - `ensureWebsiteConfig` and `defaultWebsiteBlocks`.

## Notes
- Public rendering must read `publishedBlocks` and `publishedTheme`, never the draft fields.

# `server/models/testimonial.model.ts`

> Mongoose model for an organisation's client testimonials / case studies, built from ordered rich-content blocks.

**Kind:** Mongoose model · **Lines:** 409

## Purpose
Organisations publish case-study style testimonials ("what we did for client X") on their public pages. A testimonial has client details, a card preview, an unlimited list of typed content blocks (text, image, video, YouTube, gallery, quote), optional headline metrics, a primary client quote, an optional "live artifact" link, display ordering and SEO fields. Founders manage them through the authenticated `/testimonials` API; visitors read published, public ones through `/public/testimonials/...`.

## How it works

### Sub-schemas
- **`GalleryImageSchema`** (`_id: false`): `url` (required), `caption`, `alt`.
- **`ContentBlockSchema`** (L129-L207): each block has its own `_id` (generated with a default `new Types.ObjectId()` even though the schema option is `_id: false`, so blocks are addressable by id for the block edit/delete/reorder endpoints), a required `order` number and a required `type` from `text | image | video | youtube | gallery | quote`. Type-specific optional fields sit side by side on the same sub-document:
  - text: `content` (rich HTML)
  - image: `imageUrl`, `imageCaption`, `imageAlt`
  - video: `videoUrl`, `videoThumbnail`
  - youtube: `youtubeUrl`, `youtubeId`
  - gallery: `galleryImages[]` (default `[]`)
  - quote: `quoteText`, `quoteAuthor`, `quoteRole`
  No validator ties fields to the block `type`; the routes and UI are responsible for that.
- **`MetricSchema`** (`_id: false`): `label` and `value` (both required strings, so values such as "3x" or "40%" are allowed), optional `description`.

### Main schema (L230-L382)
| Group | Fields |
| --- | --- |
| Ownership | `organizationId` (-> `Organization`, required, indexed), `createdBy` (-> `User`, required) |
| Client | `clientName` (required), `clientLogo`, `clientWebsite`, `clientIndustry` |
| Identity | `title` (required), `slug` (required, lowercased), `shortDescription` (required; used on cards) |
| Visual | `coverImage`, `featuredImage` (hero on the detail page) |
| Filtering | `categories: string[]`, `tags: string[]` (free strings, e.g. "AI") |
| Content | `contentBlocks: ContentBlock[]` (no limit) |
| Quote | `primaryQuote`, `primaryQuoteAuthor`, `primaryQuoteAuthorRole`, `primaryQuoteAuthorImage` |
| Results | `metrics: Metric[]` |
| Artifact | `artifactUrl`, `artifactLabel` |
| Display | `isFeatured` (default false), `displayOrder` (default 0) |
| Status | `status` (`draft | published | archived`, default `draft`), `isPublic` (default false), `publishedAt` |
| SEO | `metaTitle`, `metaDescription` |

Timestamps are enabled. All string fields are trimmed.

### Indexes (L384-L403)
- `{ organizationId, slug }` **unique**: slugs are unique per organisation, not globally.
- `{ organizationId, status }`, `{ organizationId, categories, status }`, `{ organizationId, isFeatured, displayOrder }`, `{ organizationId, isPublic, status }`, `{ tags }`, `{ createdBy, status }`.

### Visibility rule
A testimonial is visible publicly only when `status === "published"` **and** `isPublic === true`; `server/routes/public.ts` applies both conditions on its list, categories and detail endpoints.

## Exports
- `Testimonial` - Mongoose model `"Testimonial"` typed as `ITestimonial` (collection `testimonials`).
- `interface IGalleryImage` - gallery image shape.
- `interface IContentBlock` - content block shape (union of type-specific optional fields).
- `interface IMetric` - metric shape.
- `interface ITestimonial extends Document` - full document type.

## Interfaces
- **Database:** `Testimonial` (collection `testimonials`).

## Dependencies
- **Packages:** `mongoose` - schemas, model, `Types.ObjectId`.

## Used by
- `server/routes/testimonials.ts` - mounted at `/testimonials` (browser `/backend/testimonials`), all `requireAuth`: CRUD, `POST /:testimonialId/publish`, block add/update/delete/reorder (`/:testimonialId/blocks...`), testimonial reorder and `GET /meta/categories`.
- `server/routes/public.ts` - mounted at `/public`: `GET /public/testimonials/:orgSlug` (filter by `category`, `tag`, `featured`, paginated), `GET /public/testimonials/:orgSlug/categories`, `GET /public/testimonials/:orgSlug/:testimonialSlug` (with related testimonials).
- `server/routes/contentEngagement.ts` - lists a user's testimonials in an org for content-engagement stats.

## Notes
- The interface marks `_id` on `IContentBlock` as required while the schema relies on a default; block ids exist on every saved block.
- Because `slug` uniqueness is per organisation, lookups must always include `organizationId`.

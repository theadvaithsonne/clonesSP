# `lib/testimonials-api.ts`

> Typed browser client for the Testimonials (client case-study) feature: authenticated CRUD for an organisation's testimonials and their content blocks, public read endpoints for guest pages, and YouTube URL helpers.

**Kind:** frontend library · **Lines:** 630

## Purpose
Founders can publish rich testimonials or case studies about their clients: logo, cover image, quote, metrics, a live "artifact" link, and an ordered list of content blocks (text, image, video, YouTube, gallery, quote). This file is the only frontend gateway to the backend's `/testimonials` router (authenticated, org-scoped) and to the public `/public/testimonials/:orgSlug...` endpoints that power the guest-facing pages. It also defines the TypeScript data model the UI shares.

## How it works

### Types (L7-L235)
- `ContentBlock`: `type` is one of `"text" | "image" | "video" | "youtube" | "gallery" | "quote"`, plus the optional fields for that type (`content` rich HTML, `imageUrl`/`imageCaption`/`imageAlt`, `videoUrl`/`videoThumbnail`, `youtubeUrl`/`youtubeId`, `galleryImages: GalleryImage[]`, `quoteText`/`quoteAuthor`/`quoteRole`) and an `order`.
- `Testimonial`: the full record. Ownership (`organizationId`, `createdBy`), client info, `title`/`slug`/`shortDescription`, images, `categories` and `tags`, `contentBlocks`, primary quote fields, `metrics: Metric[]`, `artifactUrl`/`artifactLabel`, `isFeatured`/`displayOrder`, `status` (`draft | published | archived`), `isPublic`, SEO meta, timestamps.
- `TestimonialListItem` is a lighter version for lists. `OrganizationInfo` and `FounderInfo` are returned with public responses.
- Response envelopes: `TestimonialsListResponse` (with pagination, `categories`, optional `isFounder`), `TestimonialDetailResponse`, `PublicTestimonialsListResponse` (adds `organization` and `founders`), `PublicTestimonialDetailResponse` (adds `relatedTestimonials`).
- Inputs: `CreateTestimonialData` (required: `clientName`, `title`, `shortDescription`), `UpdateTestimonialData` (partial), `CreateContentBlockData`.

### Request helper (L237-L269)
- `getOrgId()` reads the current organisation from localStorage `garage_org_id`. It returns `null` on the server.
- `fetchFromBackend(endpoint, options)` sends a JSON request to `${NEXT_PUBLIC_API_URL}${endpoint}` with `Authorization: Bearer <garage_tok>` when a token exists. On a non-OK response it throws `Error(error.error || error.details || "API Error: <status>")`.
- Every authenticated call adds `?orgId=<garage_org_id>` when it is set. The backend uses it to scope the request to the organisation.

### Authenticated testimonial APIs (L271-L487)
Each wraps one backend route (all `requireAuth` in `server/routes/testimonials.ts`). The function comments say founders see drafts and only founders may mutate. The backend enforces this.
- `getTestimonials(options?)` lists with filters `status`, `category`, `tag`, `search`, `featured`, `page`, `limit`.
- `getTestimonial(idOrSlug)` fetches one testimonial.
- `createTestimonial(data)`, `updateTestimonial(id, data)`, `deleteTestimonial(id)`, `publishTestimonial(id)`.
- Content blocks: `addContentBlock`, `updateContentBlock`, `deleteContentBlock`, `reorderContentBlocks(id, blockIds)`.
- `reorderTestimonials(testimonialIds)` and `getCategories()`.

### Public APIs (L489-L586)
These use plain `fetch` with no auth header and no `orgId`. Error handling is the same as `fetchFromBackend`. The backend handlers live in `server/routes/public.ts` (mounted at `/public`) and return only published, public testimonials.
- `getPublicTestimonials(orgSlug, options?)` takes the filters `category`, `tag`, `featured`, `page`, `limit`.
- `getPublicTestimonialCategories(orgSlug)`.
- `getPublicTestimonialDetail(orgSlug, testimonialSlug)` also returns related testimonials.

### YouTube helpers (L588-L629)
- `extractYoutubeId(url)` handles `youtube.com/watch?v=`, `youtu.be/`, `/embed/` and `/shorts/` URLs, and returns `null` otherwise.
- `getYoutubeEmbedUrl(id)` returns `https://www.youtube.com/embed/<id>`.
- `getYoutubeThumbnailUrl(id, quality = "hq")` maps `default | hq | mq | sd | maxres` to the `img.youtube.com/vi/<id>/<name>.jpg` file names.

## Exports
- Functions: `getTestimonials`, `getTestimonial`, `createTestimonial`, `updateTestimonial`, `deleteTestimonial`, `publishTestimonial`, `addContentBlock`, `updateContentBlock`, `deleteContentBlock`, `reorderContentBlocks`, `reorderTestimonials`, `getCategories`, `getPublicTestimonials`, `getPublicTestimonialCategories`, `getPublicTestimonialDetail`, `extractYoutubeId`, `getYoutubeEmbedUrl`, `getYoutubeThumbnailUrl`.
- Types: `GalleryImage`, `ContentBlock`, `Metric`, `Testimonial`, `TestimonialListItem`, `OrganizationInfo`, `FounderInfo`, `TestimonialsListResponse`, `TestimonialDetailResponse`, `PublicTestimonialsListResponse`, `PublicTestimonialDetailResponse`, `CreateTestimonialData`, `UpdateTestimonialData`, `CreateContentBlockData`.

## Interfaces
- **Backend endpoints called** (authenticated ones take `?orgId=`):
  - `GET /backend/testimonials` - list, with filters.
  - `GET /backend/testimonials/:testimonialId` - detail (by ID or slug).
  - `POST /backend/testimonials` - create.
  - `PUT /backend/testimonials/:testimonialId` - update.
  - `DELETE /backend/testimonials/:testimonialId` - delete.
  - `POST /backend/testimonials/:testimonialId/publish` - publish.
  - `POST /backend/testimonials/:testimonialId/blocks` - add a block.
  - `PUT /backend/testimonials/:testimonialId/blocks/:blockId` - update a block.
  - `DELETE /backend/testimonials/:testimonialId/blocks/:blockId` - delete a block.
  - `POST /backend/testimonials/:testimonialId/blocks/reorder` - body `{ blockIds }`.
  - `POST /backend/testimonials/reorder` - body `{ testimonialIds }`.
  - `GET /backend/testimonials/meta/categories` - the organisation's categories.
  - `GET /backend/public/testimonials/:orgSlug` - public list (no auth).
  - `GET /backend/public/testimonials/:orgSlug/categories` - public categories.
  - `GET /backend/public/testimonials/:orgSlug/:testimonialSlug` - public detail plus related testimonials.
- **External services:** YouTube embed and thumbnail URLs (`youtube.com`, `img.youtube.com`). The code only builds the URLs; it never fetches them.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (default `http://localhost:4000`).
- **Browser storage / cookies:** localStorage `garage_org_id`. The token comes from `getToken()` (localStorage `garage_tok`).

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
- `components/dashboard/TestimonialsPage.tsx` - founder/member management UI inside the dashboard.
- `app/guest/[slug]/testimonials/page.tsx` - public list page (`/guest/:slug/testimonials`).
- `app/guest/[slug]/testimonials/[testimonialSlug]/TestimonialDetailClient.tsx` - public detail page (`/guest/:slug/testimonials/:testimonialSlug`).

## Notes
- The header comment says "roam-backend". That is the old name of the backend, which now lives in `server/`.
- The `orgId` comes only from localStorage. If `garage_org_id` is stale or missing, authenticated calls go out without `orgId` and the backend decides the scope.
- Route ordering on the backend matters. `POST /testimonials/reorder` and `GET /testimonials/meta/categories` are separate routes from `/:testimonialId`. They work for POST and for the `/meta/...` path because those differ in method or segment count.

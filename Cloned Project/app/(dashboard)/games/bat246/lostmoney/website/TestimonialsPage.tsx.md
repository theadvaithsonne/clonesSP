# `app/(dashboard)/games/bat246/lostmoney/website/TestimonialsPage.tsx`

> Client component for the public "Testimonials" page of the YourMoneyBack.info (BAT246 "Lost Money") website: lists approved testimonials with photo carousels and a zoomable lightbox, and lets visitors submit their own testimonial with up to 10 captioned photos.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 716

## Purpose
The BAT246 "Lost Money" programme has a small public marketing site (branded YourMoneyBack.info) whose page bodies live in this `website/` folder and are re-exported by thin route files under `app/games/bat246/lostmoney/index/`. This file is the Testimonials page body. It reads the moderated, public list of testimonials from the backend and offers an anonymous submission form; submissions only appear after an admin approves them in the back-office moderation queue (`/backend/bat246/lostmoney/testimonials/pending`, approve/reject/hide routes, Alan-only). It is rendered inside `LostMoneySiteLayout` (header + footer) by the route's layout.

## How it works

### Data loading (L452-L468)
- On mount it fetches `GET ${API}/bat246/lostmoney/testimonials` (no auth). The backend returns only testimonials with `approved: true` and not `hidden`, sorted newest-approved first, with fields `name`, `message`, `images`, `approvedAt`.
- `testimonials` state is `null` while loading (spinner "Loading..."), `[]` on error or empty (an empty-state card "No testimonials yet"), otherwise a two-column grid (`lg:grid-cols-2`) of `TestimonialCard`s.

### `TestimonialCard` (L47-L175)
- Renders an optional photo pane (240px wide on `sm+`, `aspect-[4/5]`, black background) plus the quote text and the author's name.
- All photos of a card are mounted at once and switched by toggling opacity instead of changing one `<img>` `src`, so next/prev is instant with no refetch (explained in the inline comment).
- With more than one photo: prev/next round buttons (index wraps around with modulo arithmetic), an "n/total" counter and page dots.
- The current photo's caption and the dots share one bottom gradient scrim. The caption is clamped to 2 lines and expands on hover of that bar only (Tailwind named group `group/cap`), capped at 75% of the photo height with its own scroll. The comment explains why the hover scope was narrowed: a photo-wide hover group made the caption expand while clicking the arrows.
- Messages longer than 260 characters are clamped to 4 lines with a "Read more" / "Show less" toggle.
- Clicking a photo calls `onImageClick(images, index)`, which opens the lightbox at that photo.

### `Lightbox` (L177-L450)
A full-screen (`z-[9999]`) viewer with:
- **Navigation:** prev/next buttons, an "n/total" counter, keyboard (`Escape` closes, `ArrowLeft` / `ArrowRight` navigate). While open it sets `document.body.style.overflow = "hidden"` and restores the original value on unmount.
- **Close animation:** `handleClose` sets `closing`, fades the overlay out over 150ms, then calls `onClose` via `setTimeout`. Clicking the backdrop closes it; clicks on the image area and caption are stopped from propagating.
- **Zoom/pan:** scale clamped between `MIN_SCALE` (1) and `MAX_SCALE` (4). Zoom in/out buttons step by 0.5, mouse wheel by 0.4, double-click toggles between 1x and 2.5x. Mouse drag pans only while zoomed; touch supports two-finger pinch (ratio of current to initial finger distance via `touchDistance`) and one-finger pan while zoomed. Returning to scale 1 resets the pan offset, and zoom resets whenever the visible image changes. A percentage readout sits between the zoom buttons.
- Like the card, all images are mounted and swapped by opacity; only the visible one carries the `translate(...) scale(...)` transform.
- Controls use `z-20` and `touchAction: "manipulation"` so the full-screen image can never swallow taps meant for the close button (inline comment L331-L334).

### Submission form (L470-L554, L586-L704)
- **Name** input passes every change through `capitalizeWords`, which uppercases the first letter of each word as the user types.
- **Photos:** a hidden multi-file `<input accept="image/*">` triggered by an "add" tile. `handleFilesSelected` keeps only `image/*` files, limits to the remaining room under `MAX_IMAGES` (10), creates object-URL previews and immediately uploads each file with `uploadImage`.
- `uploadImage` posts the file as multipart field `file` to `POST ${API}/uploads/public` (unauthenticated public S3 upload, images only, 5 MB cap). On success it stores the returned `url` in that entry's `uploadedUrl`; on failure it marks the entry `error` (a red "Failed" overlay). Entries are matched by object identity (`img === entry`).
- Each successfully uploaded photo gets an optional caption input (`maxLength` 200). Captions are hidden while the upload is in flight or failed.
- Removing a photo drops it from state and revokes its object URL.
- `handleSubmit` validates that name and message are non-empty and that no upload is still running, then posts JSON `{ name, message, images: [{ url, caption }] }` (only entries with an `uploadedUrl`; failed uploads are silently dropped) to `POST ${API}/bat246/lostmoney/testimonials`. Server error messages (`d.error`) are shown inline. On success it shows a "submitted for review" confirmation in place of the form, clears the fields and revokes all preview URLs.

## Exports
- `default LostMoneyTestimonialsPage()` - the whole page: testimonial grid, submission form and lightbox.

Internal (not exported): `TestimonialCard`, `Lightbox`, `capitalizeWords`, `clampScale`, `touchDistance`, and the `Testimonial`, `TestimonialImage`, `PendingImage` interfaces.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/lostmoney/testimonials` - public list of approved, non-hidden testimonials.
  - `POST /backend/bat246/lostmoney/testimonials` - submit a testimonial (route uses `softAuth`, so it works logged out). The server trims fields, caps images at 10 and captions at 200 characters, and stores it unapproved.
  - `POST /backend/uploads/public` - unauthenticated image upload to S3 (stored under the `public-onboarding/` prefix); returns `{ url, ... }`.
- **Database (indirectly, via backend):** `Bat246LostMoneyTestimonial` (collection `bat246LostMoneyTestimonials`) - read on load, created on submit.
- **External services:** AWS S3 (photos are uploaded there by the backend and displayed from the returned URLs).
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).

## Dependencies
- **Packages:** `react` (state, effects, refs, callbacks), `lucide-react` (icons: spinner, check, quote, image-plus, close, chevrons, zoom).

## Used by
- `app/games/bat246/lostmoney/index/testimonials/page.tsx` re-exports it as its default, so it is served at `/games/bat246/lostmoney/index/testimonials`. On the YourMoneyBack.info custom domain, `middleware.ts` (`LOSTMONEY_ROUTE_ALIASES`) rewrites `/testimonials` to that path.

## Notes
- The page is public; the only protection on submissions is server-side moderation. Images are uploaded the moment they are picked, so abandoned forms leave orphan files in S3.
- Uses plain `<img>` tags (with the Next lint rule disabled) because image optimisation is off in this project and the photos are external S3 URLs.
- Mounting every photo up front trades bandwidth for instant switching; a card or lightbox with 10 full-resolution photos loads all of them.

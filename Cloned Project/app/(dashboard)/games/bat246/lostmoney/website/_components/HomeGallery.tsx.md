# `app/(dashboard)/games/bat246/lostmoney/website/_components/HomeGallery.tsx`

> Client-side photo carousel for the YourMoneyBack.info (BAT246 Lost Money) home page, showing the admin-curated gallery images in order.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 94

## Purpose
The Lost Money public website's home page shows a gallery of photos that an admin uploads and orders in the back office. This component fetches that list and renders it as a simple slideshow. It sits in the site's private `_components/` folder (the underscore keeps it out of Next.js routing).

## How it works
- On mount it calls `GET ${API}/bat246/lostmoney/gallery` (public, no auth). The backend returns `{ images: [{ _id, url, order }] }` sorted by `order`, then `createdAt`.
- `images` is `null` while loading and `[]` on error. **While loading, on error, or when there are no images, the component renders nothing** (`return null`) so the home page shows no empty box.
- Every image is mounted at once, absolutely positioned and `object-contain` on a black background, and the visible one is chosen by opacity (`opacity-100` vs `opacity-0 pointer-events-none`). The inline comment explains this replaced swapping one `<img>` `src`, which caused a refetch/decode lag on every click.
- With more than one image it shows prev/next buttons (the index wraps with modulo arithmetic), page dots and an "n/total" counter badge.
- The frame is `aspect-[4/3]`, widening to `aspect-[16/11]` from the `sm` breakpoint.

## Exports
- `default HomeGallery()` - the carousel; takes no props.

## Interfaces
- **Backend endpoints called:** `GET /backend/bat246/lostmoney/gallery` - ordered list of gallery images.
- **Database (indirectly):** `Bat246LostMoneyGalleryImage` - read by the backend route.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (falls back to `http://localhost:4000`).

## Dependencies
- **Packages:** `react` (`useState`, `useEffect`), `lucide-react` (`ChevronLeft`, `ChevronRight`, `ImageIcon`).

## Used by
- `app/(dashboard)/games/bat246/lostmoney/website/HomePage.tsx` - rendered on the Lost Money site home page.

## Notes
- No autoplay, swipe or keyboard support; navigation is by buttons only.
- All images are loaded up front, so a large gallery costs bandwidth on first view.

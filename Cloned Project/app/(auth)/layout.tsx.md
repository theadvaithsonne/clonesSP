# `app/(auth)/layout.tsx`

> Client layout for the `(auth)` route group. It wraps the welcome, login, verify and guest pages in the whitelabel provider, locks the page to one viewport that cannot scroll or zoom (and shifts content up when the mobile keyboard opens), and mounts the pre-login announcements.

**Kind:** Next.js layout · **Lines:** 190 · **Route:** `/` (group layout for `/`, `/login`, `/verify`, `/guest-login`, `/guest-verify`)

## Purpose
The auth pages are single-card screens, and most visitors use them on phones. On mobile browsers, focusing an input usually zooms the page, and the opening on-screen keyboard scrolls it, which moves the card around. This layout stops that. It also gives every auth page access to whitelabel branding through `WhitelabelProvider` and shows "Alerts & Promotions" to signed-out visitors. `(auth)` is a route group, so it adds no URL segment. It sits under the root `app/layout.tsx`.

## How it works
### Viewport and scroll lock (effect, L29-L167)
The effect runs once on mount. Its only dependency is the memoised `preventTouchMove`.
1. **gotobigwin.com exception (L49-L51).** If `getCurrentDomain()` matches `gotobigwin.com` or one of its subdomains, the effect returns and does nothing. That domain renders the long, scrollable BAT246 funnel (`components/welcome/Bat246Landing.tsx`) through this same layout, and the lock made it impossible to scroll. The source comment explains why the check lives here, before any lock is applied, rather than in the child undoing the lock afterwards. The child mounts only after an async whitelabel lookup, so undoing the lock from there raced. The check calls `getCurrentDomain()` instead of reading the context because the provider is created below this layout.
2. **Viewport meta.** If a `<meta name="viewport">` exists, the effect saves its content and replaces it with `maximum-scale=1, user-scalable=no, viewport-fit=cover`. This blocks pinch zoom and focus zoom.
3. **Fixed html/body.** Sets `cssText` on both `document.documentElement` and `document.body`: `position: fixed`, full width and height, `overflow: hidden`, `overscroll-behavior: none`, `touch-action: none`.
4. **Touch move.** A non-passive `touchmove` listener (`preventTouchMove`) calls `preventDefault()` unless the target is an `INPUT` or `TEXTAREA`, sits inside one, or sits inside an element that has the `data-allow-scroll` attribute. Child pages use that attribute to opt their scrollable regions out of the lock.
5. **Focus.** A `focusin` listener resets the window, body and html scroll positions to 0 fifty milliseconds after an input or textarea gains focus. This undoes the browser's auto-scroll.
6. **Mobile keyboard (L113-L155).** This step runs only on iPhone/iPad/iPod/Android user agents that have `window.visualViewport`. A resize handler compares the current visual viewport height with the height recorded at mount. If the height dropped by more than 100px, the keyboard is treated as open and the content container moves up by `min(diff * 0.5, 200)` px. Otherwise the transform is reset. A `scroll` listener on the visual viewport forces `window.scrollTo(0, 0)`.
7. **Cleanup.** Removes the listeners, restores the original viewport content (only if that content was non-empty) and clears the inline styles on html and body.

### Render (L169-L188)
- `WhitelabelProvider` wraps everything.
- Children render inside a full-size `div` (`containerRef`) with `will-change: transform` and a 0.15s transform transition. The keyboard handler moves this div.
- `<AnnouncementHost surface="pre-login" delayMs={600} />` is deliberately a sibling of that div, not a child. A transformed ancestor becomes the containing block for `position: fixed` descendants, which would pin the announcement dialog to the document instead of the viewport.

## Exports
- `default AuthLayout({ children }: { children: ReactNode })`: the group layout.

## Interfaces
- **Browser storage / cookies:** none directly. The layout changes global DOM state: the viewport meta tag, inline styles on `<html>` and `<body>`, and listeners on `document` and `visualViewport`.

## Dependencies
- **Internal:**
  - `lib/whitelabel-context.tsx`: `WhitelabelProvider`, the branding context for the auth pages.
  - `lib/whitelabel.ts`: `getCurrentDomain()`, used for the gotobigwin.com exception.
  - `components/announcements/AnnouncementHost.tsx`: the Alerts & Promotions overlay. The app has two instances; the other is in `(dashboard)/layout.tsx` with `surface="post-login"`.
- **Packages:** `react`: `useEffect`, `useRef`, `useCallback`, `ReactNode`.

## Used by
Next.js applies this layout to every page in `app/(auth)/`: `page.tsx` (`/`), `login/page.tsx` (`/login`), `verify/page.tsx` (`/verify`), `guest-login/page.tsx` (`/guest-login`) and `guest-verify/page.tsx` (`/guest-verify`). Nothing imports it directly.

## Notes
- **A local testing override is active.** In the current `lib/whitelabel.ts`, `getCurrentDomain()` returns the hardcoded string `"bat246.com"` before it ever reads `window.location.hostname`. The line is marked "LOCAL TESTING ... Comment it out for production". While it is in place, the gotobigwin.com exception never fires, even on the real gotobigwin.com host, so the scroll lock applies there too. Remove the override before shipping.
- Cleanup never removes the anonymous `visualViewport` `scroll` listener. It stays attached after the layout unmounts (for example after navigating into the dashboard) and keeps forcing the scroll position to the top. The lock styles themselves are cleared correctly.
- A source comment says the effect will create a viewport meta tag if none exists, but it never does. If the page has no viewport meta, zoom is not blocked.
- A child page that needs its own scroll area must mark it with `data-allow-scroll`. Otherwise the lock swallows touch scrolling inside it.

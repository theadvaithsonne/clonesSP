# `hooks/use-mobile.ts`

> A small React hook that reports whether the viewport is narrower than 768 px (the "mobile" breakpoint).

**Kind:** React hook · **Lines:** 20

## Purpose
Several components switch layout between desktop and phone widths. This hook (the stock shadcn/ui `use-mobile` helper) gives them a single boolean that stays in sync with the window width, so they do not each wire up their own `matchMedia` listener.

## How it works
- `MOBILE_BREAKPOINT` is `768`. The hook subscribes to `window.matchMedia("(max-width: 767px)")` inside a `useEffect`.
- On mount and on every media-query `change` event it sets state from `window.innerWidth < 768`.
- Internal state starts as `undefined` (unknown until the effect runs on the client); the hook returns `!!isMobile`, so the first render (including server render) always reports `false`.
- The listener is removed on unmount.

## Exports
- `useIsMobile(): boolean` - `true` when the viewport is under 768 px wide.

## Dependencies
- **Packages:** `react` - `useState` / `useEffect`.

## Used by
- `app/(dashboard)/taskroom/components/sidebar.tsx`
- `components/athena/components/ListView.tsx`
- `components/checkout/PaymentMethodSelector.tsx`
- `components/welcome/Bat246Landing.tsx`

## Notes
- Because the first render returns `false`, mobile users can see a brief desktop layout before the effect corrects it.
- The BAT246 board has its own separate mobile hook (`components/bat246/hooks/useIsMobileBoard.ts`); the two are not shared.

# `components/Layout/Shell.tsx`

> Minimal page shell: a sticky `Topbar` above a centred, padded `<main>` container.

**Kind:** React component · **Lines:** 11

## Purpose
Provides a simple full-height layout wrapper for the onboarding flow. It sets the page background and text colours from the theme CSS variables and constrains content width.

## How it works
- Outer `<div>`: `min-h-screen`, background `var(--background)`, text `var(--foreground)`.
- Renders `<Topbar />` (the "TEAM • ONBOARDING" header with Dashboard and Login links).
- Wraps `children` in `<main className="mx-auto max-w-6xl p-6">`.
- No state, no effects. It has no `"use client"` directive, so it can render as a server component when its parent allows.

## Exports
- `default Shell({ children }: { children: React.ReactNode })` - the layout wrapper.

## Dependencies
- **Internal:** `components/Layout/Topbar.tsx` - the header bar.

## Used by
- `app/(onboarding)/team/page.tsx` (Next.js route `/team`), which wraps its content in `<Shell>`.

## Notes
- `React.ReactNode` is used without importing `React`; this relies on the global `React` types namespace provided by `@types/react`.

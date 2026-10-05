# `app/(dashboard)/deals/components/theme-provider.tsx`

> A thin client-side wrapper around `next-themes`' `ThemeProvider`, used to give the Deals section its own light/dark theme setting.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 12

## Purpose
`next-themes` providers have to run on the client, but the module itself does not carry a `'use client'` boundary that App Router code can rely on. This file is the standard shadcn-style wrapper: it marks itself `'use client'` and re-exports the provider. It belongs to the Deals (CRM) area and gives that area a theme setting separate from the rest of the app.

## How it works
- `ThemeProvider` takes `children` plus any other `ThemeProviderProps` and passes them unchanged to `NextThemesProvider`.
- It adds no defaults and no logic of its own. The configuration comes from the caller.

## Exports
- `ThemeProvider({ children, ...props }: ThemeProviderProps)` - named export. Renders `next-themes`' provider with the given props around `children`.

## Interfaces
- **Browser storage / cookies:** `next-themes` saves the chosen theme in localStorage under the `storageKey` the caller passes. The Deals layout passes `"deals-theme"`, so the Deals theme choice is stored apart from the theme for the rest of the app.

## Dependencies
- **Packages:** `next-themes` - theme state, the `class` attribute on `<html>`, and saving the choice. `react` - imported as a namespace for JSX/types.

## Used by
- `app/(dashboard)/deals/layout.tsx` - wraps every `/deals` route with `attribute="class"`, `defaultTheme="dark"`, `enableSystem`, `disableTransitionOnChange` and `storageKey="deals-theme"`.

## Notes
- `next-themes` sets the theme class on the document root. While the user is on a Deals page, the Deals theme therefore applies to the whole document, not only the Deals subtree.

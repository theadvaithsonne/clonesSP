# `app/layout.tsx`

> Next.js layout for `/`.

**Kind:** Next.js layout · **Lines:** 93 · **Route:** `/` (layout)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `metadata`, `viewport`

### Composition

**Renders:** `FirstVisitCleanup` (components/FirstVisitCleanup.tsx), `Bat246Branding` (components/bat246/Bat246Branding.tsx), `PostHogInit` (components/PostHogInit.tsx), `MeetingProvider` (lib/meeting-context.tsx), `PipProvider` (components/meet/PersistentPipRenderer.tsx), `OpenInAppGate` (components/shared/OpenInAppGate.tsx), `Toaster` (sonner)

### Props

- **`RootLayout`**: `props: Readonly<{
  children: React.ReactNode;
}>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `metadata` | const | `= { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL \|\| "https://my.garage.app"), ti…` | 51 |
| `viewport` | const | `= { width: "device-width", initialScale: 1, }` | 57 |
| `default (RootLayout)` | component | `RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>)` | 62 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_APP_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/globals.css` (side effect)
  - `components/shared/Header.tsx` — `Header (default)`
  - `components/landing/Footer.tsx` — `Footer (default)`
  - `components/FirstVisitCleanup.tsx` — `FirstVisitCleanup (default)`
  - `components/PostHogInit.tsx` — `PostHogInit (default)`
  - `lib/meeting-context.tsx` — `MeetingProvider`
  - `components/meet/PersistentPipRenderer.tsx` — `PipProvider`
  - `components/shared/OpenInAppGate.tsx` — `OpenInAppGate (default)`
  - `components/bat246/Bat246Branding.tsx` — `Bat246Branding (default)`
- **Packages:**
  - `next` — `Metadata`, `Viewport`, `Geist`, `Geist_Mono`, `Inter`, `Oswald`, …
  - `sonner` — `Toaster`

## Used by

Entry: reached by the Next.js router at `/` (layout).

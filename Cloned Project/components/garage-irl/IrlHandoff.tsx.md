# `components/garage-irl/IrlHandoff.tsx`

> React component `IrlHandoff`.

**Kind:** React component · **Lines:** 225 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Smartphone`×2 (lucide-react), `Image` (next/image), `Apple` (lucide-react)

### Props

- **`IrlHandoff`**: `kind: IrlLinkKind`, `id: string`, `product?: IrlProductPreview | null`

**Hooks used:** `useState`×2, `useEffect`×2, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (IrlHandoff)` | component | `IrlHandoff({ kind, id, product }: IrlHandoffProps)` — Phone handoff for GarageIRL links (see lib/garageIrl.ts). | 65 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/garageIrl.ts` — `IRL_IOS_STORE_URL`, `irlBillLink`, `irlIntentUrl`, `irlPlayUrl`, `irlProductLink`, `irlSchemeUrl`, `irlStoreLink`, `IrlLinkKind`, … +1
  - `lib/installIntent.ts` — `registerInstallIntent`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `next`
  - `lucide-react` — `Apple`, `Smartphone`

## Used by

- `app/a/[code]/page.tsx`
- `app/product/[id]/page.tsx`
- `app/s/[slug]/page.tsx`

# `app/(dashboard)/games/bat246/lostmoney/website/RegisterPage.tsx`

> React component `LostMoneyRegisterPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 425 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `CheckCircle2` (lucide-react), `X` (lucide-react), `ImagePlus` (lucide-react), `ShieldCheck` (lucide-react), `Clock` (lucide-react), `FileText` (lucide-react)

**Hooks used:** `useState`×6, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LostMoneyRegisterPage)` | component | `LostMoneyRegisterPage()` | 125 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/uploads/public` (L149)
  - `POST /backend/bat246/lostmoney/claims` (L212)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useRef`, `useState`
  - `lucide-react` — `CheckCircle2`, `Loader2`, `ShieldCheck`, `Clock`, `FileText`, `ImagePlus`, …

## Used by

- `app/games/bat246/lostmoney/index/register/page.tsx`

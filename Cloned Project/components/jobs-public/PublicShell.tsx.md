# `components/jobs-public/PublicShell.tsx`

> Chrome shared by the public careers page and job pages: the office's top bar ("Sign in" / "Powered by Garage") and the footer.

**Kind:** React component · **Lines:** 96 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Chrome shared by the public careers page and job pages: the office's top bar
("Sign in" / "Powered by Garage") and the footer. Styled like the rest of
the app's dark surfaces so a candidate moving from here into Garage doesn't
feel the seam.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×5 (next/link), `OrgLogo` (components/dashboard/jobs/ui.tsx)

### Props

- **`PublicTopBar`**: `org: Pick<PublicOrg, "name" | "slug" | "icon"> | null`
- **`PublicFooter`**: `org: Pick<PublicOrg, "name" | "slug"> | null`
- **`PublicState`**: `title: string`, `message?: string`, `action?: React.ReactNode`

**Hooks used:** `useSignedIn` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useSignedIn` | hook | `useSignedIn(): boolean` — Whether a Garage session exists in this browser. | 15 |
| `loginUrl` | function | `loginUrl(redirect: string, ref?: string \| null): string` — `/login` that brings the visitor back to `redirect` once signed in. | 24 |
| `PublicTopBar` | component | `PublicTopBar({ org }: { org: Pick<PublicOrg, "name" \| "slug" \| "icon"> \|…)` | 30 |
| `PublicFooter` | component | `PublicFooter({ org }: { org: Pick<PublicOrg, "name" \| "slug"> \| null })` | 64 |
| `PublicState` | component | `PublicState({ title, message, action }: { title: string; message?: stri…)` | 87 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/jobs/ui.tsx` — `OrgLogo`
  - `components/jobs-public/types.ts` — `PublicOrg`, `(types only)`
- **Packages:**
  - `react`
  - `next`

## Used by

- `components/jobs-public/CareersPageClient.tsx`
- `components/jobs-public/PublicJobClient.tsx`

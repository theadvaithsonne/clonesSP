# `app/(dashboard)/workspace/sign/[token]/page.tsx`

> Next.js page rendered at `/workspace/sign/[token]`.

**Kind:** Next.js page · **Lines:** 29 · **Route:** `/workspace/sign/[token]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `metadata`

### Composition

**Renders:** `DocusignErrorBoundary` (components/dashboard/docusign/shared/DocusignErrorBoundary.tsx), `PublicSigningView` (app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx)

### Props

- **`EsignSignPage`**: `params: Promise<{ token: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `metadata` | const | `= { title: "Sign document \| Garage", description: "Review and sign a document sent to you…` — The public self-sign page — lives at /workspace/sign/[token] to match the backend's FRONTEND_URL base (see the docusign backend's utils/frontendUrl.util.js). | 14 |
| `default (EsignSignPage)` | component | `async EsignSignPage({ params }: { params: Promise<{ token: string }> })` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/docusign/shared/DocusignErrorBoundary.tsx` — `DocusignErrorBoundary`
  - `app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx` — `PublicSigningView`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/workspace/sign/[token]` (page).

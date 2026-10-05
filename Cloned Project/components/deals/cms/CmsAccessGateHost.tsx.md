# `components/deals/cms/CmsAccessGateHost.tsx`

> React component `CmsAccessGateHost`.

**Kind:** React component · **Lines:** 56 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `CmsPasswordDialog` (components/deals/cms/CmsPasswordDialog.tsx)

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CmsAccessGateHost)` | component | `CmsAccessGateHost()` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/deals/cms/CmsPasswordDialog.tsx` — `CmsPasswordDialog`
  - `lib/cms/accessGate.ts` — `registerCmsAccessDialog`, `unregisterCmsAccessDialog`, `unlockCmsAccess`, `verifyCmsPassword`
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `app/(dashboard)/deals/layout.tsx`
- `components/dashboard/inlineApps/deals/DealsApp.tsx`

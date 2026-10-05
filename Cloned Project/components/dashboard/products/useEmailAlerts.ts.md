# `components/dashboard/products/useEmailAlerts.ts`

> React hook `useEmailAlerts`.

**Kind:** React component · **Lines:** 144 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useCallback`×7, `useState`×4

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useEmailAlerts` | hook | `useEmailAlerts(initial?: ProductEmailAlerts \| null)` — Shared form logic for the post-purchase email alerts section, used by the product, course and community forms. | 22 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `ProductEmailAlerts`, `(types only)`
  - `lib/product-email-template.ts` — `DEFAULT_PRODUCT_EMAIL_TEMPLATE_ID`
  - `lib/network-mail-api.ts` — `getNetworkMailOrgId`, `recordTemplateUse`
  - `components/dashboard/products/ProductEmailAlertsSection.tsx` — `ProductEmailAlertsValue`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useState`

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/WorkshopsPage.tsx`

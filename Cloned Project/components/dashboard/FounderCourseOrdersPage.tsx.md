# `components/dashboard/FounderCourseOrdersPage.tsx`

> FounderCourseOrdersPage — the Founder:Courses:Orders route.

**Kind:** React component · **Lines:** 26 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderCourseOrdersPage — the Founder:Courses:Orders route.

Mounts the shared `FounderOrdersTable` pinned to itemType="course". Shows
the org-wide view of every customer's course invoice (not the founder's
own orders, which is what the legacy
`<OrdersPage initialType="course" />` did).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GridPageShell` (components/dashboard/founderGrid/chrome.tsx), `FounderOrdersTable` (components/dashboard/founderGrid/orders/FounderOrdersTable.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderCourseOrdersPage` | component | `FounderCourseOrdersPage()` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/founderGrid/chrome.tsx` — `GridPageShell`
  - `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx` — `FounderOrdersTable`
- **Packages:** none

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

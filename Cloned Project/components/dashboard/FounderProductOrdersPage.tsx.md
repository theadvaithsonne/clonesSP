# `components/dashboard/FounderProductOrdersPage.tsx`

> FounderProductOrdersPage — the Founder:Products:Orders route.

**Kind:** React component · **Lines:** 26 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderProductOrdersPage — the Founder:Products:Orders route.

Mounts the shared `FounderOrdersTable` pinned to itemType="product".
Shows the org-wide view of every customer's product invoice (not the
founder's own orders, which is what the legacy
`<OrdersPage initialType="product" />` did).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GridPageShell` (components/dashboard/founderGrid/chrome.tsx), `FounderOrdersTable` (components/dashboard/founderGrid/orders/FounderOrdersTable.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderProductOrdersPage` | component | `FounderProductOrdersPage()` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/founderGrid/chrome.tsx` — `GridPageShell`
  - `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx` — `FounderOrdersTable`
- **Packages:** none

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

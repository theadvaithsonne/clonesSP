# `components/dashboard/FounderLiveOrdersPage.tsx`

> FounderLiveOrdersPage — the Founder:Live:Orders route.

**Kind:** React component · **Lines:** 26 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderLiveOrdersPage — the Founder:Live:Orders route.

Mounts the shared `FounderOrdersTable` pinned to itemType="workshop".
Shows the org-wide view of every customer's live stream invoice (not the
founder's own orders, which is what the legacy
`<OrdersPage initialType="workshop" />` did).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GridPageShell` (components/dashboard/founderGrid/chrome.tsx), `FounderOrdersTable` (components/dashboard/founderGrid/orders/FounderOrdersTable.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderLiveOrdersPage` | component | `FounderLiveOrdersPage()` | 15 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/founderGrid/chrome.tsx` — `GridPageShell`
  - `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx` — `FounderOrdersTable`
- **Packages:** none

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

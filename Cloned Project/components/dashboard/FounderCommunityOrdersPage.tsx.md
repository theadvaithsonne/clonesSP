# `components/dashboard/FounderCommunityOrdersPage.tsx`

> FounderCommunityOrdersPage — the Founder:Communities:Orders route.

**Kind:** React component · **Lines:** 25 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderCommunityOrdersPage — the Founder:Communities:Orders route.

Mounts the shared `FounderOrdersTable` pinned to itemType="channel".
Data source is unchanged: `/feed/founder/invoices?itemType=channel` and
`/feed/founder/item-users?itemType=channel`.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GridPageShell` (components/dashboard/founderGrid/chrome.tsx), `FounderOrdersTable` (components/dashboard/founderGrid/orders/FounderOrdersTable.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderCommunityOrdersPage` | component | `FounderCommunityOrdersPage()` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/founderGrid/chrome.tsx` — `GridPageShell`
  - `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx` — `FounderOrdersTable`
- **Packages:** none

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

# `components/dashboard/FounderProductCustomersPage.tsx`

> FounderProductCustomersPage — the Founder:Products:Customers route.

**Kind:** React component · **Lines:** 32 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderProductCustomersPage — the Founder:Products:Customers route.

The same `FounderOrdersTable` the Orders page mounts, opened on its
Customers view with the view switcher hidden — this page sits in the nav
beside its own Orders entry, so a second route back to Invoices from here
would make two nav items lead to the same screen.

Parity with the other founder-facing buyer views (Community Members / Live
Streams Attendees / Courses Students). Reads the same
`/feed/founder/item-users?itemType=product` endpoint.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GridPageShell` (components/dashboard/founderGrid/chrome.tsx), `FounderOrdersTable` (components/dashboard/founderGrid/orders/FounderOrdersTable.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderProductCustomersPage` | component | `FounderProductCustomersPage()` | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/founderGrid/chrome.tsx` — `GridPageShell`
  - `components/dashboard/founderGrid/orders/FounderOrdersTable.tsx` — `FounderOrdersTable`
- **Packages:** none

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

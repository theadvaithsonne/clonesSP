# `components/dashboard/FounderUnsubLogPage.tsx`

> FounderUnsubLogPage — the Unsub Log route for every item kind.

**Kind:** React component · **Lines:** 46 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
FounderUnsubLogPage — the Unsub Log route for every item kind.

Mounts the shared `UnsubLogTable`; the parent route pins `itemKind`, so
this serves Founder:Communities:UnsubLog, Founder:Live:UnsubLog and
Founder:Courses:UnsubLog from one component. (The product variant is wired
and functional but has no nav entry today — see layout.tsx.)

Data sources and filters are unchanged from the sidebar-and-panel layout
this replaced; see `UnsubLogTable` for which endpoint each kind reads.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `GridPageShell` (components/dashboard/founderGrid/chrome.tsx), `UnsubLogTable` (components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx)

### Props

- **`FounderUnsubLogPage`**: `itemKind: FounderUnsubLogKind`, `itemLabel: string`, `itemLabelPlural: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderUnsubLogKind` | export |  | 21 |
| `FounderUnsubLogPage` | component | `FounderUnsubLogPage({ itemKind, itemLabel, itemLabelPlural, }: FounderUnsubLogP…)` | 31 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/founderGrid/chrome.tsx` — `GridPageShell`
  - `components/dashboard/founderGrid/unsubLog/UnsubLogTable.tsx` — `UnsubLogTable`, `FounderUnsubLogKind`
- **Packages:** none

## Used by

- `components/dashboard/RevenueNetworkPages.tsx`

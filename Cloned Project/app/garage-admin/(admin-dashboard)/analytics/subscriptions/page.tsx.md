# `app/garage-admin/(admin-dashboard)/analytics/subscriptions/page.tsx`

> Admin -> Analytics -> Subscriptions (Figma frame "MacBook Pro 16" - 5", node 265:614): the same screen as Traction with four subscription-product cards — NetworkChains, Founder Office Pro, Whitelabel, MyCryptoBrand.

**Kind:** Next.js page · **Lines:** 34 · **Directive:** `"use client"` · **Route:** `/garage-admin/analytics/subscriptions` (page)

<!-- docgen:auto -->

## Purpose
Admin -> Analytics -> Subscriptions (Figma frame "MacBook Pro 16" - 5",
node 265:614): the same screen as Traction with four subscription-product
cards — NetworkChains, Founder Office Pro, Whitelabel, MyCryptoBrand.

Card titles match the Figma labels; the ids match the backend metric ids in
routes/garageAdminAnalytics.ts, which resolve to the real plan/addon rows
(officeplans "Founders Office" (pro), officeaddons "White-Label" and
"Cryptosub") rather than to name strings.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AnalyticsMetricsPage` (components/analytics/AnalyticsMetricsPage.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SubscriptionsAnalyticsPage)` | component | `SubscriptionsAnalyticsPage()` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/analytics/AnalyticsMetricsPage.tsx` — `AnalyticsMetricsPage`, `AnalyticsMetric`
- **Packages:** none

## Used by

Entry: reached by the Next.js router at `/garage-admin/analytics/subscriptions` (page).

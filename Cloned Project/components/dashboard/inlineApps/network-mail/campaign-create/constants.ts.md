# `components/dashboard/inlineApps/network-mail/campaign-create/constants.ts`

> Module exporting `CAMPAIGN_ACCENT`, `CAMPAIGN_STEPS`, `TEMPLATE_CATEGORIES`, `CATEGORY_COLORS` and 11 more.

**Kind:** React component · **Lines:** 91

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CAMPAIGN_ACCENT` | const | `= "#f5c518"` | 1 |
| `CAMPAIGN_STEPS` | const | `= [ { id: 1, label: "Template" }, { id: 2, label: "Recipients" }, { id: 3, label: "Schedu…` | 3 |
| `TEMPLATE_CATEGORIES` | const | `= [ "All", "Marketing", "General", "Promotional", "Transactional", ] as const` | 10 |
| `CATEGORY_COLORS` | const | `= { General: { bg: "bg-[#2a2a35]", text: "text-[#c0c0cc]" }, Marketing: { bg: "bg-emerald…` | 18 |
| `MOCK_LISTS` | const | `= [ { id: "1", name: "All Subscribers", count: 2453 }, { id: "2", name: "Newsletter Subsc…` | 25 |
| `MOCK_SEGMENTS` | const | `= [ { id: "1", name: "Active Users (Last 30 days)", count: 892 }, { id: "2", name: "Engag…` | 34 |
| `MOCK_SEGMENT_PREVIEW` | const | `= [ { name: "John Smith", email: "john@example.com" }, { name: "Sarah Johnson", email: "s…` | 42 |
| `MOCK_EXCLUDE_LISTS` | const | `= [ { id: "1", name: "Unsubscribed", count: 432 }, { id: "2", name: "Bounced Emails", cou…` | 48 |
| `TIMEZONES` | const | `= ["EST", "PST", "CST", "MST", "UTC", "GMT", "IST"]` | 55 |
| `DRIP_FREQUENCIES` | const | `= [ "Every 1 hour", "Every 2 hours", "Every 6 hours", "Every 12 hours", "Every 24 hours",…` | 57 |
| `RETRY_WAIT_OPTIONS` | const | `= ["5 min", "15 min", "1 hour"]` | 65 |
| `DRAFT_STORAGE_KEY` | const | `= "network-mail-campaign-draft"` | 67 |
| `BLANK_TEMPLATE_ID` | const | `= "__blank__"` | 69 |
| `CRM_LEAD_STATUS_FILTER_OPTIONS` | const | `= [ { value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: …` | 71 |
| `CRM_LEAD_SOURCE_FILTER_OPTIONS` | const | `= [ "", "Website", "Referral", "Cold Call", "LinkedIn", "Event", "Email Campaign", "Faceb…` | 79 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-3-schedule.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/template-picker-dropdown.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`

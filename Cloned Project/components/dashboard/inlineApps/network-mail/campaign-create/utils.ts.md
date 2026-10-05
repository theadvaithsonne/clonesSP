# `components/dashboard/inlineApps/network-mail/campaign-create/utils.ts`

> Module exporting `parseEmails`, `estimateSendMinutes`, `hasUnsubscribeLink`, `hasPhysicalAddress` and 6 more.

**Kind:** React component · **Lines:** 214

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `parseEmails` | function | `parseEmails(input: string): { valid: string[]; invalid: string[] }` | 5 |
| `estimateSendMinutes` | function | `estimateSendMinutes(recipientCount: number): number` | 26 |
| `hasUnsubscribeLink` | function | `hasUnsubscribeLink(data: Partial<CampaignData>): boolean` | 30 |
| `hasPhysicalAddress` | function | `hasPhysicalAddress(data: Partial<CampaignData>): boolean` | 35 |
| `ReviewFieldKey` | type |  | 40 |
| `TemplatePublishStatus` | type |  | 48 |
| `CampaignReviewOptions` | interface |  | 50 |
| `getReviewFieldErrors` | function | `getReviewFieldErrors(data: Partial<CampaignData>, opts?: CampaignReviewOptions): Partial<Record<ReviewFieldKey, string>>` — Field-level errors for step 4 review UI (maps to checklist blocking items). | 73 |
| `validateCampaign` | function | `validateCampaign(data: Partial<CampaignData>, opts?: CampaignReviewOptions): ChecklistItem[]` | 93 |
| `getScheduleDescription` | function | `getScheduleDescription(data: Partial<CampaignData>): string` | 172 |
| `isWeekend` | function | `isWeekend(dateStr: string): boolean` | 189 |
| `formatDisplayDate` | function | `formatDisplayDate(iso?: string): string` | 195 |
| `formatDisplayDateTime` | function | `formatDisplayDateTime(iso?: string): string` | 204 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` — `CampaignData`, `ChecklistItem`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-success.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/crm-recipients-api.ts`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-3-schedule.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`

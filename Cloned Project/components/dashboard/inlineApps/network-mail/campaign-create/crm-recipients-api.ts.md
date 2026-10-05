# `components/dashboard/inlineApps/network-mail/campaign-create/crm-recipients-api.ts`

> Module exporting `listCrmFunnels`, `getCrmFunnelStages`, `extractLeadEmail`, `extractLeadStatus` and 3 more.

**Kind:** React component · **Lines:** 281

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CrmFunnelOption` | interface |  | 5 |
| `CrmFunnelStageOption` | interface |  | 11 |
| `CrmLeadFilter` | interface |  | 16 |
| `CrmLeadFilterStats` | interface |  | 24 |
| `listCrmFunnels` | function | `async listCrmFunnels(): Promise<CrmFunnelOption[]>` | 50 |
| `getCrmFunnelStages` | function | `async getCrmFunnelStages(funnelId: string): Promise<CrmFunnelStageOption[]>` | 76 |
| `extractLeadEmail` | function | `extractLeadEmail(lead: Record<string, unknown>): string \| null` | 88 |
| `extractLeadStatus` | function | `extractLeadStatus(lead: Record<string, unknown>): string` | 110 |
| `extractLeadName` | function | `extractLeadName(lead: Record<string, unknown>): string` | 120 |
| `listCrmLeadTags` | function | `async listCrmLeadTags(): Promise<string[]>` | 132 |
| `fetchCrmLeadFilterStats` | function | `async fetchCrmLeadFilterStats(filter: CrmLeadFilter, signal?: AbortSignal): Promise<CrmLeadFilterStats>` — Count matching leads and how many have a sendable email (samples up to 3 contacts). | 215 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `components/dashboard/inlineApps/network-mail/campaign-create/utils.ts` — `parseEmails`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx`

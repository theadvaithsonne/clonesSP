# `lib/network-mail-campaigns-api.ts`

> The typed client for Network Mail email **campaigns** (CRUD, recipient previews, CSV upload, launch, cancel, test send, reports, sender settings) plus mappers between the campaign wizard's state and the API payload.

**Kind:** frontend library · **Lines:** 597

## Purpose
This is the campaign half of Network Mail; the template half is `lib/network-mail-api.ts`. The campaign wizard (template, recipients, schedule, review), the campaign list and details views, and the Events app's campaigns section all go through it. Like the template client, it talks to the **external** Garage API at `https://uatapi.garage.app/api/network-mail/...`, built with `buildExternalUrl` from `lib/api-config.ts`. No campaign backend exists in this repository.

## How it works
### Transport
`campaignsApi<T>(endpoint, opts)` is the same pattern as the template client: `authenticatedFetch(buildExternalUrl(endpoint), opts)` followed by `handleApiResponse<T>`. Auth is the bearer token from `auth-token` or `garage_tok`, with `credentials: "include"`. `withOrg()` appends `?orgId=...`; every call is org-scoped by this query parameter.

### Campaign lifecycle
- **Statuses:** `draft -> scheduled | sending -> sent | failed`, plus `cancelled`.
- **CRUD:** `createCampaign` and `updateCampaign` take a partial body (name, templateId, recipients, schedule, subject, from name/email, preview text) and return the `campaign` from `{ success, campaign }`. `duplicateCampaign` accepts an optional new name.
- **Recipients:** three sources (`RecipientSource`: `csv | manual | leads`), each with a server-side preview that dedupes, applies exclusions and returns the net count:
  - `previewLeadRecipients` - filters CRM leads by funnel, stage, tag, status and source.
  - `uploadCsvRecipients` - multipart CSV with optional column-name hints; returns `csvFileId`, the column mapping and valid/duplicate/invalid stats.
  - `previewManualRecipients` - a list of typed-in emails.
  - Exclusions cover lists, specific emails, unsubscribed, bounced and spam addresses.
- **Schedule:** `SchedulePayload.type` is `now | scheduled | timezone | drip`, with date/time, timezone, drip batch size and frequency, throttling and retry options.
- **Send:** `launchCampaign` can override subject and sender at launch time. It returns the scheduled state, `estimatedCompletionMinutes` and an optional `senderFallbackPolicy`. `cancelCampaign` stops a scheduled or sending campaign. `sendCampaignTestEmail` sends one preview.
- **Sender fallback:** if the preferred From domain is not verified, the external API sends from a default verified address. This shows up as `senderNotice` and `actualFromEmail` on the campaign and test-send responses, and as `senderFallbackPolicy` on launch and settings responses. Code comments mention Resend as the email provider.
- **Reports:** `getCampaignReport` returns per-campaign stats, open/click rates, a timeline and `failedRecipients`. `retryFailedRecipients` re-sends only to the failed addresses. `getCampaignReportsSummary(period)` returns org-wide totals, period-over-period changes and a daily chart for `7d | 30d | 90d`.
- **Settings:** `getNetworkMailSettings` and `updateNetworkMailSettings` cover sender identity (default from name/email, verified emails), domain authentication flags (SPF/DKIM/DMARC) and unsubscribe settings.

### Wizard mapping and display helpers (L478-L596)
- `campaignDataToApiPayload(data)` copies only the fields that are set from the wizard's `CampaignData` into the API body. Recipients are copied field by field.
- `apiCampaignToCampaignData(campaign)` does the reverse, used when reopening a draft.
- `formatCampaignListDate` formats dates as en-US "Jan 5, 2026, 3:04 PM" and returns `null` for no date.
- `apiStatusToTableFilter` maps UI labels (`Delivered`, `Scheduled`, `Draft`, `Sending`, `Failed`) to API statuses. `apiStatusToDisplayStatus` maps the other way and adds `cancelled -> Cancelled`. Note that API `sent` is displayed as **Delivered**.

## Exports
**API functions** (all take `orgId` first)
- `listCampaigns(orgId, { status?, search?, limit?, offset?, sort?: "newest"|"oldest" }?): Promise<ListCampaignsResponse>`
- `getCampaign(orgId, campaignId): Promise<EmailCampaign>`
- `createCampaign(orgId, body): Promise<EmailCampaign>`
- `updateCampaign(orgId, campaignId, body): Promise<EmailCampaign>`
- `deleteCampaign(orgId, campaignId): Promise<void>`
- `duplicateCampaign(orgId, campaignId, campaignName?): Promise<EmailCampaign>`
- `previewLeadRecipients(orgId, { leadFilter, exclusions? }): Promise<PreviewLeadsResponse>`
- `uploadCsvRecipients(orgId, file, { emailColumn?, firstNameColumn?, lastNameColumn? }?): Promise<UploadCsvResponse>`
- `previewManualRecipients(orgId, { emails, exclusions? }): Promise<PreviewManualResponse>`
- `launchCampaign(orgId, campaignId, overrides?): Promise<LaunchCampaignResponse>`
- `cancelCampaign(orgId, campaignId)`
- `sendCampaignTestEmail(orgId, campaignId, { to, mergeData?, htmlBody? })`
- `getCampaignReport(orgId, campaignId)`
- `retryFailedRecipients(orgId, campaignId): Promise<{ success; retrying }>`
- `getCampaignReportsSummary(orgId, period = "30d"): Promise<ReportsSummaryResponse>`
- `getNetworkMailSettings(orgId)`, `updateNetworkMailSettings(orgId, partialSettings)`

**Helpers:** `campaignDataToApiPayload`, `apiCampaignToCampaignData`, `formatCampaignListDate`, `apiStatusToTableFilter`, `apiStatusToDisplayStatus`; `getNetworkMailOrgId` is re-exported from `lib/network-mail-api.ts`.

**Types:** `CampaignStatus`, `RecipientSource`, `RecipientsPayload`, `SchedulePayload`, `EmailCampaign`, `CampaignListItem`, `ListCampaignsResponse`, `CampaignResponse`, `PreviewLeadsResponse`, `UploadCsvResponse`, `PreviewManualResponse`, `LaunchCampaignResponse`, `ReportsSummaryResponse`, `NetworkMailSettings`, `FailedRecipient`.

## Interfaces
- **Backend endpoints called** (external host `https://uatapi.garage.app/api`, all with `?orgId=`):
  - `GET|POST network-mail/campaigns`
  - `GET|PATCH|DELETE network-mail/campaigns/:id`
  - `POST network-mail/campaigns/:id/duplicate`, `/launch`, `/cancel`, `/send-test`, `/retry-failed`
  - `GET network-mail/campaigns/:id/report`
  - `POST network-mail/campaigns/recipients/preview-leads`, `/upload-csv` (multipart), `/preview-manual`
  - `GET network-mail/campaigns/reports/summary?period=`
  - `GET|PATCH network-mail/settings`
- **External services:** Garage UAT API (`uatapi.garage.app`), which sends email through Resend according to the code comments.
- **Browser storage / cookies:** through `utils/api.ts`, the tokens `auth-token` and `garage_tok`.

## Dependencies
- **Internal:**
  - `lib/api-config.ts` - `buildExternalUrl`.
  - `lib/network-mail-api.ts` - `getNetworkMailOrgId`.
  - `utils/api.ts` - `authenticatedFetch`, `handleApiResponse`.
  - `components/dashboard/inlineApps/network-mail/campaign-create/types.ts` - wizard types `CampaignData`, `RecipientsData`, `ScheduleData`.
- **Packages:** none

## Used by
- `components/dashboard/inlineApps/events/sections/CampaignsSection.tsx`
- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-2-recipients.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-3-schedule.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`

## Notes
- `RecipientsData` is imported but not used in this file.
- `campaignDataToApiPayload` skips an empty `campaignName` or `templateId` (it uses truthiness checks), while subject, from name/email and preview text are copied even when they are empty strings.
- The host is UAT, hardcoded in `lib/api-config.ts`.

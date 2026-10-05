# `lib/network-mail-api.ts`

> The typed client for Network Mail email **templates** (list, CRUD, publish, duplicate, assets, preview, test send, merge tags) on the external Garage UAT API.

**Kind:** frontend library · **Lines:** 308

## Purpose
Network Mail is the in-app email marketing tool: a block-based template builder plus campaigns. This file is the data layer for the template half, and it also provides the org-id helper used by the campaign client (`lib/network-mail-campaigns-api.ts`). Its backend is **not in this repository**. Every call goes to the external Garage API at `https://uatapi.garage.app/api/network-mail/...` (the host hardcoded in `lib/api-config.ts` as `API_CONFIG.EXTERNAL_BASE_URL`), the same host the Deals CRM uses. Product email alerts and the org welcome email reuse these functions to store their templates.

## How it works
### Transport
- `networkMailApi<T>(endpoint, opts)`, private, builds the URL with `buildExternalUrl(endpoint)` and calls `authenticatedFetch`, then parses the result with `handleApiResponse<T>`. Both come from `utils/api.ts`. `authenticatedFetch` adds `Authorization: Bearer <token>` (from `auth-token` in localStorage or cookies, falling back to `garage_tok`; during impersonation it prefers the cookie), sends `credentials: "include"`, sets JSON `Content-Type` except for `FormData`, and clears auth when it sees an expired-token response.
- `withOrg(path, orgId)` appends `orgId=...` to the query string. Every endpoint is org-scoped through this query parameter.
- `BASE = "network-mail"`.

### Org resolution
`getNetworkMailOrgId()` returns `getUserData()?.orgId` (the decoded `garage_tok` JWT) or, failing that, `localStorage["garage_org_id"]`. It returns `null` during SSR.

### Response normalisation
The single-template functions (`getTemplate`, `createTemplate`, `updateTemplate`, `publishTemplate`, `duplicateTemplate`) accept either `{ success, template }` or a bare `EmailTemplate` from the server and always return the bare template.

### Template HTML
Templates store both `components` (the block tree from `block-factory`) and a rendered `htmlBody`. `syncTemplateHtmlBody` loads a template, rebuilds `htmlBody` on the client with `buildTemplateHtmlBody(components, name)` from `email-html-export.ts`, and saves it with a PATCH. This keeps the stored HTML in step with the blocks before a send. If the template has no components, the existing `htmlBody` (or `null`) is returned untouched.

### Defaults on create
`createTemplate` sends `{ status: "draft", components: [], subject: "", presetId: null, ...body }`, so caller values override the defaults.

## Exports
**Functions**
- `getNetworkMailOrgId(): string | null` - the current org id for Network Mail calls.
- `listTemplates({ orgId, category?, status?, search?, sort?: "newest"|"most-used", limit?, offset? }): Promise<ListTemplatesResponse>` - paged list with `counts` (all, draft, published).
- `getTemplate(orgId, templateId): Promise<EmailTemplate>`
- `createTemplate(orgId, { name, category, components?, subject?, presetId?, status? }): Promise<EmailTemplate>`
- `updateTemplate(orgId, templateId, body: TemplateWriteBody): Promise<EmailTemplate>` - PATCH.
- `publishTemplate(orgId, templateId, body?): Promise<EmailTemplate>` - publishes, optionally saving fields in the same call.
- `duplicateTemplate(orgId, templateId, name?): Promise<EmailTemplate>`
- `deleteTemplate(orgId, templateId): Promise<void>`
- `uploadTemplateAsset(orgId, file, { templateId?, purpose?: "logo"|"image"|"social-icon" }?): Promise<AssetUploadResponse>` - multipart upload; returns `{ url, width, height }`.
- `syncTemplateHtmlBody(orgId, templateId): Promise<string | null>` - rebuilds and saves `htmlBody` (see above).
- `sendTemplateTestEmail(orgId, templateId, { to, subject?, mergeData?, htmlBody? }): Promise<SendTestResponse>`
- `recordTemplateUse(orgId, templateId): Promise<RecordUseResponse>` - increments `useCount`.
- `renderTemplatePreview(orgId, { components, title? }): Promise<RenderPreviewResponse>` - server-side render to `htmlBody` and `preheaderText`.
- `fetchMergeTags(orgId): Promise<MergeTag[]>` - available `{{merge}}` keys and labels.
- `formatTemplateListDate(iso): string` - formats a date like "Jan 5, 2026" (en-US).

**Types**
- `TemplateCategory` (`Marketing | General | Promotional | Transactional`), `TemplateStatus` (`draft | published | archived`)
- `EmailTemplate`, `TemplateListItem`, `ListTemplatesResponse`, `TemplateResponse`, `AssetUploadResponse`, `RenderPreviewResponse`, `SendTestResponse`, `RecordUseResponse`, `MergeTag`, `TemplateWriteBody`
- `EmailTemplatePresetId` - re-exported from `email-template-presets.ts` so callers need not import from the component tree.

## Interfaces
- **Backend endpoints called** (external host `https://uatapi.garage.app/api`, all with `?orgId=`):
  - `GET network-mail/templates` - list
  - `GET|PATCH|DELETE network-mail/templates/:id`
  - `POST network-mail/templates` - create
  - `POST network-mail/templates/:id/publish`, `/duplicate`, `/send-test`, `/record-use`
  - `POST network-mail/templates/assets` - multipart asset upload
  - `POST network-mail/templates/render-preview`
  - `GET network-mail/merge-tags`
- **External services:** Garage UAT API (`uatapi.garage.app`). None of these calls reach the combined app's `/backend` Express server.
- **Browser storage / cookies:** reads `localStorage` `garage_tok` (via `getUserData`) and `garage_org_id`; `authenticatedFetch` also reads `auth-token`.

## Dependencies
- **Internal:**
  - `lib/api-config.ts` - `buildExternalUrl` (external base URL).
  - `utils/api.ts` - `authenticatedFetch`, `getUserData`, `handleApiResponse`.
  - `components/dashboard/inlineApps/network-mail/block-factory.ts` - `ComponentBlock` type.
  - `components/dashboard/inlineApps/network-mail/email-html-export.ts` - `buildTemplateHtmlBody`.
  - `components/dashboard/inlineApps/network-mail/email-template-presets.ts` - `EmailTemplatePresetId` type.
- **Packages:** none

## Used by
- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/campaign-create-flow.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-1-template.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-create/step-4-review.tsx`
- `components/dashboard/inlineApps/network-mail/campaign-details-view.tsx`
- `components/dashboard/inlineApps/network-mail/network-mail-editor-context.tsx`
- `components/dashboard/products/ProductEmailAlertsSection.tsx`
- `components/dashboard/products/useEmailAlerts.ts`
- `components/shared/OrgWelcomeEmailSection.tsx`
- `lib/network-mail-campaigns-api.ts` - reuses `getNetworkMailOrgId`.
- `lib/org-welcome-email-template.ts`
- `lib/product-email-template.ts`

## Notes
- The API host is hardcoded to UAT in `lib/api-config.ts`, not set by an environment variable. Switching environments means editing that file.
- `orgId` is client-supplied. Org authorisation has to be enforced by the external API.

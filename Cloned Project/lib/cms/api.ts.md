# `lib/cms/api.ts`

> Typed fetch client for the Deals CMS API: landing pages, their lead forms, funnel rules, custom domains, CRM pipelines, plus the public page fetch and form submission.

**Kind:** frontend library · **Lines:** 204

## Purpose
All CMS screens (dashboard, page builder, domain settings, CRM funnel mapping) and the public landing-page route talk to the CMS backend only through this module. Each function wraps one HTTP endpoint, attaches auth where needed, and returns the parsed JSON with a TypeScript shape from `lib/cms/types.ts`.

## How it works
- **Base URL:** every URL is built with `buildExternalUrl()` from `lib/api-config.ts`, which prefixes `API_CONFIG.EXTERNAL_BASE_URL`. That constant is hardcoded to `https://uatapi.garage.app/api`, so these calls go to the **external Garage UAT API**, not to this repo's `/backend` Express server (there are no `/cms` routes under `server/`). Paths below are relative to that base.
- **Auth:** dashboard/builder calls use `authenticatedFetch()` from `utils/api.ts`, which adds the user's bearer token (from `localStorage` `garage_tok`, or the `auth-token` cookie during impersonation). The two public functions (`fetchPublicCmsPage`, `submitCmsForm`) use plain `fetch` with no auth, because they run for anonymous visitors.
- **Errors:** `jsonOrThrow(res)` parses the body (falling back to `{}` if it is not JSON) and throws `Error(data.error || data.message || "Request failed (<status>)")` on any non-2xx response, so callers can `try/catch` and show the message.
- JSON bodies are sent with `Content-Type: application/json`. Return types are TypeScript casts only; nothing is validated at runtime.

## Exports
**Pages**
- `listCmsPages(status?: string)` - `GET /cms/pages[?status=]`; `status` omitted or `"all"` means no filter. Returns `{ pages, stats: { totalPages, published, totalLeads, conversionRate } }`.
- `createCmsPage(payload?: { name?, slug? })` - `POST /cms/pages`; returns `{ page, form }` (a form is created with the page).
- `getCmsPage(id)` - `GET /cms/pages/:id`; returns `{ page, form | null, rules }`.
- `updateCmsPage(id, payload: Partial<CmsPage>)` - `PUT /cms/pages/:id`; returns `{ page }`.
- `deleteCmsPage(id)` - `DELETE /cms/pages/:id`.
- `cloneCmsPage(id)` - `POST /cms/pages/:id/clone`; returns `{ page, form }`.
- `publishCmsPage(id)` - `POST /cms/pages/:id/publish`; returns `{ page, publicUrl }`.
- `updateCmsPageStatus(id, status)` - `PATCH /cms/pages/:id/status` with `{ status }`.

**Forms**
- `updateCmsForm(id, payload: Partial<CmsForm>)` - `PUT /cms/forms/:id`; returns `{ form }`.

**Domains**
- `listCmsDomains()` - `GET /cms/domains`; returns `{ domains }`.
- `addCmsDomain(hostname)` - `POST /cms/domains` with `{ hostname }`; returns `{ domain }`.
- `verifyCmsDomain(id)` - `POST /cms/domains/:id/verify`; returns `{ domain, verified, message }`.
- `deleteCmsDomain(id)` - `DELETE /cms/domains/:id`.

**Funnel rules**
- `listCmsRules(pageId)` - `GET /cms/pages/:pageId/rules`; returns `{ rules }`.
- `createCmsRule(pageId, payload)` - `POST /cms/pages/:pageId/rules`; returns `{ rule }`.
- `updateCmsRule(pageId, ruleId, payload)` - `PUT /cms/pages/:pageId/rules/:ruleId`; returns `{ rule }`.
- `deleteCmsRule(pageId, ruleId)` - `DELETE /cms/pages/:pageId/rules/:ruleId`.

**CRM**
- `listCmsPipelines()` - `GET /cms/crm/pipelines`; returns `{ pipelines }`.
- `connectCmsCrm(pageId, { crmPipelineId?, crmSyncEnabled? })` - `POST /cms/pages/:pageId/crm-connect`; returns `{ page }`.

**Public (no auth)**
- `fetchPublicCmsPage(slug)` - `GET /cms/pages/public/:slug` with `cache: "no-store"`; returns untyped JSON.
- `submitCmsForm(formId, data: Record<string, any>, source?: string)` - `POST /cms/forms/:formId/submit` with `{ data, source }`.

## Interfaces
- **External services:** Garage UAT API at `https://uatapi.garage.app/api` (hardcoded in `lib/api-config.ts`), all `/cms/...` endpoints listed above.
- **Browser storage / cookies:** indirectly, via `authenticatedFetch` (`localStorage` `garage_tok`, cookie `auth-token`).

## Dependencies
- **Internal:** `utils/api.ts` - `authenticatedFetch` adds auth headers; `lib/api-config.ts` - `buildExternalUrl` builds the external URL; `lib/cms/types.ts` - response types.

## Used by
- `app/p/[slug]/page.tsx` - public landing page; calls `fetchPublicCmsPage`.
- `components/deals/cms/PageRenderer.tsx` - renders a page and calls `submitCmsForm` on lead-form submit.
- `components/deals/cms/CmsDashboard.tsx`, `components/deals/cms/PageBuilderShell.tsx`, `components/deals/cms/DomainSettingsModal.tsx`, `components/deals/cms/CrmFunnelMapping.tsx` - authenticated management screens.

## Notes
- The base URL is a hardcoded UAT host, not an env variable, so the CMS points at UAT regardless of which environment this app runs in; changing it means editing `lib/api-config.ts`.
- `submitCmsForm` is never called with `source` from `PageRenderer.tsx` (only `form.id` and values are passed).

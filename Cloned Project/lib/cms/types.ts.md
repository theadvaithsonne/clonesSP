# `lib/cms/types.ts`

> TypeScript types for the Deals CMS: pages, the module tree that makes up page content, lead forms, funnel-routing rules, custom domains, CRM pipelines and device preview modes.

**Kind:** frontend library · **Lines:** 147

## Purpose
The CMS lets an organisation build public landing pages (served at `/p/[slug]` or on a custom domain), capture leads through a form, and route those leads into CRM funnels. This file is the shared vocabulary for that feature: the API client (`lib/cms/api.ts`), the tree utilities, the builder UI and the public renderer all use these shapes. It contains types only, no runtime code.

## How it works
The types fall into five groups.

**Page content (module tree)**
- `CmsModuleType` - the 16 block kinds: layout (`section`, `two_column`, `three_column`, `columns`, `container`), `hero`, content (`heading`, `text`, `image`, `button`, `divider`, `spacer`, `logo`), `social_icons`, `footer`, `lead_form`.
- `CmsModule` - `{ id, type, props, children? }`. `props` is an untyped `Record<string, any>`; each module type's expected props are defined by convention in `lib/cms/moduleDefaults.ts`. `children` is the legacy nesting field (see `lib/cms/columns.ts`).
- `CmsColumnData` - `{ id, width, modules }`, one column of a layout module; `width` is a percentage. Stored in `props.columns` of layout modules.
- `CmsPageContent` - `{ modules }`, the root of a page's tree.

**Pages**
- `CmsPageStatus` - `"draft" | "published" | "archived"`.
- `CmsPage` - id, `organizationId`, `name`, `slug`, `status`, `content`, SEO fields (`metaTitle`, `metaDescription`, `ogImageUrl`, `faviconUrl`), `domainId`, `formId`, CRM link (`crmPipelineId`, `crmSyncEnabled`), metrics (`pageViews`, `leadCount`, `conversionRate`) and timestamps (`createdAt`, `updatedAt`, `publishedAt`).

**Lead forms**
- `CmsFormFieldType` - `text`, `email`, `phone`, `dropdown`, `checkbox`, `radio`, `textarea`, `file`, `date`, `number`.
- `CmsFormField` - `id`, `type`, `key` (the submission data key), `label`, optional `placeholder`, `required`, `order`, `options` (for choice fields), `helpText`, `maxLength`.
- `CmsForm` - `id`, `pageId`, `title`, `submitButtonText`, `successMessage`, optional `redirectUrl`, `recaptchaEnabled`, `fields`, and `validation` flags (`emailFormat`, `phoneFormat`, `preventDuplicates`, `rateLimitPerHour`).

**Funnel routing**
- `CmsFunnelRuleCondition` - `fieldKey` (plus optional `field_id`), an `operator` (`equals`, `not_equals`, `contains`, `starts_with`, `greater_than`, `less_than`, `in_list`), a `value` (string or string array for `in_list`) and an optional `logic` (`"AND" | "OR"`) joining it to the next condition.
- `CmsFunnelRule` - `id`, `pageId`, optional `formId`, `name`, `conditions`, target `funnelId`, `isDefault`, `priority`, `isActive`.

**Domains, CRM, preview**
- `CmsDomain` - `id`, `hostname`, verification `status` (`pending`/`verifying`/`verified`/`failed`), `cnameTarget` (the DNS CNAME the customer must create), `sslStatus` (`pending`/`provisioned`/`failed`), `verifiedAt`, `lastVerifyMessage`.
- `CmsPipeline` - `{ id, name, stages? }` (stages untyped).
- `DevicePreview` - `"desktop" | "tablet" | "mobile"`, the builder's preview width modes.

## Exports
All type-only: `CmsPageStatus`, `CmsModuleType`, `CmsColumnData`, `CmsModule`, `CmsPageContent`, `CmsFormFieldType`, `CmsFormField`, `CmsForm`, `CmsPage`, `CmsFunnelRuleCondition`, `CmsFunnelRule`, `CmsDomain`, `CmsPipeline`, `DevicePreview`.

## Dependencies
None.

## Used by
`app/p/[slug]/page.tsx`, `components/deals/cms/CmsBlockViews.tsx`, `components/deals/cms/CmsDashboard.tsx`, `components/deals/cms/ColumnModuleEditor.tsx`, `components/deals/cms/CrmFunnelMapping.tsx`, `components/deals/cms/DomainSettingsModal.tsx`, `components/deals/cms/LeadFormBuilderModal.tsx`, `components/deals/cms/PageBuilderShell.tsx`, `components/deals/cms/PageRenderer.tsx`, `lib/cms/api.ts`, `lib/cms/columns.ts`, `lib/cms/moduleDefaults.ts`, `lib/cms/moduleTree.ts`.

## Notes
- These types describe the JSON returned by the external CMS API (see `lib/cms/api.ts`); this repo's `server/` has no CMS model, so the types are not checked against a schema here.
- `props: Record<string, any>` means module props are not type-checked; a typo in a prop name compiles fine.

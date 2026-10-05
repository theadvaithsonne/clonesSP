# `lib/nc-admin-api/admin-funnels.ts`

> Typed client for the NetworkChains "Garage Funnels" library: CRUD for question-tree funnels, setting the default funnel, the legacy single-template API, and presigned S3 uploads for funnel media.

**Kind:** frontend library · **Lines:** 128

## Purpose
A funnel is a branching question tree (`rootQuestion` plus `options` made of `FunnelNode`s, which can carry videos) that leads visitors to a call-to-action product. Super admins edit these funnels in the Garage admin's Funnel Studio, and the data lives on the external NetworkChains contacts-backend. This file was ported from `networkchains-web-app` `lib/api/admin-funnels.ts` with the same surface. Only the transport changed, to `./auth`'s Garage→NC elevation.

## How it works
- Every `/admin/funnels*` route on contacts-backend returns a flat `{ ok, ... }` body with no `data` envelope, so all calls use `ncAdminFetchRaw`, which throws only on a non-2xx status.
- The tree types (`FunnelVideo`, `FunnelNode`, `FunnelTemplate`) live in `lib/funnel-tree.ts` and are re-exported from here.
- The local interfaces `FunnelCta`, `FunnelListItem`, `FunnelDetail` and `FunnelSaveInput` must stay field-for-field identical to the NC source (a mirror requirement stated in the header).
- `adminFunnelsApi.uploadFile(file)` works in two steps. First it calls `presignUpload(file.type, file.size)` to get `{ key, uploadUrl, uploadHeaders, publicUrl }`. Then it `PUT`s the bytes directly to S3 with plain `fetch` (no auth header) and returns `{ key, publicUrl }`. A failed PUT throws `Upload failed (<status>)`.
- `getTemplate` and `saveTemplate` are kept for backward compatibility: they treat the default funnel as a single "template".

## Exports
- Re-exported types: `FunnelVideo`, `FunnelNode`, `FunnelTemplate` (from `@/lib/funnel-tree`).
- `interface FunnelCta` - the target product (`itemType`, `itemId`, `category`, `orgSlug`, `name`, `image`, `price`, `currency`, all optional).
- `interface FunnelListItem` - list row (`id`, `name`, `isDefault`, `cta`, `updatedAt?`, `updatedByEmail?`).
- `interface FunnelDetail` - full funnel for the editor (`id`, `name`, `isDefault`, `cta`, `rootQuestion`, `options`).
- `interface FunnelSaveInput` - editor save payload (`name?`, `rootQuestion`, `options`, `cta?`).
- `adminFunnelsApi` - an object with these methods: `listFunnels()`, `createFunnel(name?)`, `getFunnel(id)`, `saveFunnel(id, input)`, `updateFunnelMeta(id, { name?, cta? })`, `deleteFunnel(id)`, `setDefaultFunnel(id)`, `getTemplate()`, `saveTemplate(template)`, `presignUpload(mimeType, sizeBytes)`, `uploadFile(file)`.

## Interfaces
- **Backend endpoints called** (on the external NC contacts-backend, `NC_API_URL`):
  - `GET /admin/funnels` - list. `POST /admin/funnels` `{ name }` - create.
  - `GET /admin/funnels/:id` - detail. `PUT /admin/funnels/:id` - save the tree and metadata. `DELETE /admin/funnels/:id` - delete.
  - `PATCH /admin/funnels/:id/meta` - save only the name and CTA (used by the editor toolbar).
  - `POST /admin/funnels/:id/default` - make this the default funnel.
  - `GET` / `PUT /admin/funnels/template` - legacy default-funnel-as-template.
  - `POST /admin/funnels/upload-url` `{ mimeType, sizeBytes }` - presigned upload URL.
- **External services:** NetworkChains contacts-backend, and S3 via the presigned PUT URL it returns.

## Dependencies
- **Internal:** `lib/nc-admin-api/auth.ts` - `ncAdminFetchRaw`. `lib/funnel-tree.ts` - funnel tree types.
- **Packages:** none.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/page.tsx` - route `/garage-admin/networkchains/funnels`, the funnel library.
- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx` - route `/garage-admin/networkchains/funnels/:id`, the editor.
- `components/funnel-studio/funnel-cta-picker.tsx` - the CTA product picker.
- `lib/hooks/use-admin-funnels.ts` - hook wrapper.

## Notes
- Funnel ids are interpolated into paths without `encodeURIComponent`, unlike the sibling clients. That is harmless for ObjectId-shaped ids.

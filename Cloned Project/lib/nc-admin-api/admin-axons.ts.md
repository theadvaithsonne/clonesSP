# `lib/nc-admin-api/admin-axons.ts`

> Typed client for the NetworkChains super-admin Axon directory (de-duplicated person identities): it lists and fetches Axons and runs the dry-run and confirm steps of merges and unmerges against the external contacts-backend.

**Kind:** frontend library · **Lines:** 363

## Purpose
In NetworkChains, an "Axon" is the shared, de-duplicated identity record behind users' contacts. It carries emails, phones, social profiles, enrichment data and the number of users who contributed to it. This file was ported from `networkchains-web-app` `lib/api/admin-axons.ts` with the same exported names, so the ported admin pages work unchanged. Only the transport changed: requests go through `./auth` (silent Garage→NC elevation) instead of the NC OTP flow.

## How it works
**Types (L19-L212).** The types describe the raw, un-redacted Axon document as admins see it:
- `RawAxon` has identity fields, `emails` (`AxonEmail`), `phones` (`AxonPhone`), `socialProfiles`, `matchKeys` with their `keyStrength` (`strong`/`weak`/`role`), loose profile arrays (experiences, skills, ...), per-channel `enrichment` (linkedin/facebook/instagram as `AxonEnrichmentChannel`), `enrichmentRuns`, `status` (`AxonStatus`: `active` / `merged_into` / `erased`), `mergedInto`, erasure fields and `contributorCount`.
- `AxonLink` is a back-index row linking an axon to a user, contact or synapse. The server fills in `userName`/`userEmail`.
- List and detail responses: `AxonListData` (`items`, `total`, `limit`, `skip`) and `AxonDetailData` (`axon`, `contributors`).
- Merge types: `ForwardMergeImpact` (outcome plus counts of contacts, synapses and links to move, and the keys added to the survivor), `MergeResult`/`MergeStatus` (`merged`, `noop_same`, `noop_already_merged`, `lock_unavailable`, `quarantined`, `disabled`), and `MergeDryRunResponse` / `MergeConfirmResponse`.
- Unmerge types: `MergeImpact`, `UnmergeResult`/`UnmergeStatus` (`reverted`, `dry_run`, `not_applied`, `state_mismatch`) and `UnmergeResponse`.

**Transport (L225-L259).** `axonRequest` wraps `ncAdminFetch`, which unwraps the `{ok,data}` envelope, and remaps a 404 `NcAdminApiError` to `AxonSurfaceDisabledError` (meaning "axon or merge log not found"). All other errors, including `NcAdminUnauthorizedError`, propagate unchanged. `getAxon` and `postAxon` (which JSON-encodes the body) are thin wrappers around it.

**Endpoints (L263-L345).** Merge and unmerge both use two calls to the same endpoint. The first, without `confirm`, is a dry run that returns the impact. The second sends `confirm: true` and performs the change. An optional `reason` (an audit justification) is passed through on every call.

**Display helpers (L349-L362).** `isValidObjectId` checks for a 24-hex-character id. `axonLabel` picks `displayName`, then first plus last name, then the first email, then `_id`.

## Exports
- Types: `AxonStatus`, `AxonEmail`, `AxonPhone`, `AxonSocialProfile`, `AxonEnrichmentChannel`, `AxonEnrichmentRun`, `RawAxon`, `AxonLink`, `AxonSort` (`contributorCount` / `updatedAt` / `createdAt` / `displayName`), `AxonListData`, `AxonDetailData`, `MergeOutcome`, `ForwardMergeImpact`, `MergeStatus`, `MergeResult`, `MergeDryRunResponse`, `MergeConfirmResponse`, `UnmergeStatus`, `MergeImpact`, `UnmergeResult`, `UnmergeResponse`, `AxonListParams`.
- `class AxonSurfaceDisabledError extends Error` - thrown on a 404 ("Axon not found").
- `listAxons(params?: AxonListParams): Promise<AxonListData>` - search or list with `q`, `status`, `limit`, `skip`, `sort`, `order` (sent as `sortOrder`) and `reason`.
- `getAxonDetail(id, reason?): Promise<AxonDetailData>` - one axon plus its contributors.
- `dryRunMerge(aId, bId, reason?)` / `confirmMerge(aId, bId, reason?)` - forward merge, preview then commit.
- `dryRunUnmerge(logId, reason?)` / `confirmUnmerge(logId, reason?)` - revert a merge by its merge-log id, preview then commit.
- `isValidObjectId(s): boolean`, `axonLabel(a): string` - display helpers.

## Interfaces
- **Backend endpoints called** (on the external NC contacts-backend, `NC_API_URL`):
  - `GET /admin/axons?q&status&limit&skip&sort&sortOrder&reason` - list.
  - `GET /admin/axons/:id?reason=` - detail.
  - `POST /admin/axons/merge` `{ aId, bId, confirm?, reason? }` - merge, dry run or confirm.
  - `POST /admin/axons/unmerge` `{ logId, confirm?, reason? }` - unmerge, dry run or confirm.
- **External services:** NetworkChains contacts-backend.

## Dependencies
- **Internal:** `lib/nc-admin-api/auth.ts` - `ncAdminFetch` and `NcAdminApiError`.
- **Packages:** none.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/axons/page.tsx` - route `/garage-admin/networkchains/axons`, the Axon directory.
- `app/garage-admin/(admin-dashboard)/networkchains/axons/[axonId]/page.tsx` - route `/garage-admin/networkchains/axons/:axonId`, the detail page.
- `components/nc-admin/axons/merge-dialog.tsx`, `components/nc-admin/axons/unmerge-dialog.tsx` - the merge and unmerge flows.

## Notes
- The confirm calls change identity data across all NC users who share that axon (contacts, synapses and links are moved). The UI is expected to always show the dry-run impact first.
- The error class name `AxonSurfaceDisabledError` is historical. It now means only "not found".
- This file returns un-redacted PII (emails, phones), which is only appropriate for super-admin pages.

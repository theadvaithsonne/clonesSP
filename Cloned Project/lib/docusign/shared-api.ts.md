# `lib/docusign/shared-api.ts`

> Authenticated Docusign client for endpoints that serve both the internal and external flows: profile sync, analytics, folders, templates, admin member roles and email branding.

**Kind:** frontend library · **Lines:** 184

## Purpose
Most Docusign calls belong to one flow (`internal-api.ts` for logged-in org signers, `external-api.ts` for emailed outsiders). A few resources on the Docusign service are backed by a single collection used by both: folders (`ds_folder`), templates (`ds_template`, with one instantiation endpoint per flow), admin rights, the user profile, branding, and the analytics summary, which deliberately merges both flows' totals. They live here. `DsDocument` and `DsExternalDocument` are imported type-only for the template-instantiation return shapes; this module calls nothing in either flow.

## How it works
All calls use `api()` + `url()` / `withQuery()` from `client.ts`, so they go to the external Docusign service at `DOCUSIGN_URL` with the `garage_tok` Bearer token, a 30 s timeout and `DocusignAuthExpiredError` on 401.

- **Identity.** `syncDocusignProfile()` fetches (and server-side syncs) the caller's `ds_user` profile (`DsUser`), which drives `access.ts` role checks.
- **Analytics.** `getDocusignAnalytics(range = "1m")` backs the founder Dashboard tab in one call: status donut, KPI trends, signing-activity chart, top senders and recipient-status breakdown. Admin/founder only.
- **Folders (founder/Docusign-admin only, enforced server-side).** Folders are per flow via `scope` (`"internal"` | `"external"`). `scope` is **required** on `listFolders` and `createFolder` on purpose: it used to default to `"internal"`, and the External tab's create call omitted it, so folders created there were silently written as internal and never showed up. Making it required turns that mistake into a compile error. `listFolders` returns folders, the combined and per-flow unfiled counts, and `maxFolders`. `createFolder` returns 409 for a duplicate name (case-insensitive). `createFolder` and `renameFolder` send `orgId: getOrgId()`. `deleteFolder` does not delete documents; they return to Global, and the response reports `documentsUnfiled`.
- **Templates.** `listTemplates(page, limit, search?)` is server-paginated, newest first, with case-insensitive substring title search (escaped server-side, so punctuation is literal). `createTemplate` stores the PDF, optional `originalFileHash` (copied onto documents made from it) and field layout, with `orgId`. `instantiateTemplate` creates an internal draft document; `instantiateExternalTemplate` creates an external one. Both return the template fields with abstract `recipientSlot` numbers: the caller must map each slot to a real recipient after adding recipients and then save via `setFields` / `setExternalFields`.
- **Admin members.** `listDocusignRoleHolders(orgId, page, limit, search?)` (`scope=roles`) returns everyone holding a Docusign role, fully from the Docusign service with real pagination. `listDocusignAdminOverlay(orgId)` (`scope=all`) returns only role and activity counts per userId with no name/email; the Members tab merges it client-side with the org's live member list (from the main backend) to find people who have no role yet. `orgId` is validated server-side against the caller's token, so an admin can only query their own org. `setDocusignMemberRole(userId, role, profile?)` sets `admin`, `sender` or `none`; optional `email`/`name`/`profilePicture` from the org member list fill in a Docusign profile that is missing or incomplete (never overwriting the member's own synced data; an email is required to create one).
- **Branding (Admin -> Branding).** `getDocusignBranding()` returns the editor payload (`DsBrandingEditor`; before the first save, prefilled with the org's name and logo). `updateDocusignBranding(branding)` saves the whole form; a 400 puts every field problem on the thrown error's `errors`. `previewDocusignBranding(branding, kind, signal?)` renders an unsaved form as that email would really be sent, and accepts an `AbortSignal` so callers can cancel stale previews.

## Exports
- `syncDocusignProfile()` - `{ status, data: DsUser }`.
- `getDocusignAnalytics(range?: DsAnalyticsRange)` - `{ status, data: DsAnalyticsSummary }`.
- `type FolderScope` - `"internal" | "external"`.
- `listFolders(scope)`, `createFolder(name, scope)`, `renameFolder(id, name)`, `deleteFolder(id)`.
- `listTemplates(page?, limit?, search?)`, `createTemplate(data)`, `getTemplate(id)`, `deleteTemplate(id)`, `instantiateTemplate(id, data?)`, `instantiateExternalTemplate(id, data?)`.
- `listDocusignRoleHolders(orgId, page?, limit?, search?)`, `listDocusignAdminOverlay(orgId)`, `setDocusignMemberRole(userId, role: DsAssignableRole, profile?)`.
- `getDocusignBranding()`, `updateDocusignBranding(branding: DsBranding)`, `previewDocusignBranding(branding, kind: DsEmailKind, signal?)`.

## Interfaces
- **External services (Docusign service, relative to `DOCUSIGN_URL`):**
  - `GET users/profile`; `GET analytics/summary?range`
  - `GET folders?scope`; `POST folders`; `PATCH folders/:id`; `DELETE folders/:id`
  - `GET templates?page&limit&search`; `POST templates`; `GET templates/:id`; `DELETE templates/:id`; `POST templates/:id/instantiate`; `POST templates/:id/instantiate-external`
  - `GET admin/members?orgId&scope=roles&page&limit&search`; `GET admin/members?orgId&scope=all`; `PUT admin/members/:userId/role`
  - `GET branding`; `PUT branding`; `POST branding/preview`
- **Browser storage / cookies:** `localStorage["garage_org_id"]` via `getOrgId()`; token via `client.api()`.

## Dependencies
- **Internal:**
  - `lib/docusign/client.ts` - `api`, `url`, `withQuery`.
  - `lib/docusign/types.ts` - `DsAdminMember`, `DsAdminOverlay`, `DsAnalyticsRange`, `DsAnalyticsSummary`, `DsAssignableRole`, `DsBranding`, `DsBrandingEditor`, `DsBrandingPreview`, `DsEmailKind`, `DsFolder`, `DsPagination`, `DsRole`, `DsTemplate`, `DsUser`.
  - `lib/docusign/internal-api.ts`, `lib/docusign/external-api.ts` - type-only (`DsDocument`, `DsExternalDocument`).
  - `lib/auth.ts` - `getOrgId()`.
- **Packages:** none.

## Used by
`components/dashboard/docusign/external/ExternalSignaturesList.tsx`, `components/dashboard/docusign/internal/AgreementsView.tsx`, `components/dashboard/docusign/internal/FieldEditorView.tsx`, `components/dashboard/docusign/shared/FolderSelect.tsx`, `components/dashboard/docusign/shared/MoveToFolderDialog.tsx`, `components/dashboard/docusign/shared/TemplatesList.tsx`, `components/dashboard/docusign/shared/admin/MembersTab.tsx`, `components/dashboard/docusign/shared/admin/branding/BrandingTab.tsx`, `store/docusign/sharedSlice.ts`.

## Notes
- Comments referring to `createDocument` / `getDocumentStats` "above" point to `internal-api.ts`, a leftover from an earlier single-file layout.
- The org member list that `listDocusignAdminOverlay` is merged with comes from the main backend (`/public/organizations/:orgId/users`, per `types.ts`), not from the Docusign service.

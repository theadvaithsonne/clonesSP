# `store/docusign/docusignStore.ts`

> The Docusign store, composed from three slices along the same internal/external/shared boundary as the components and the API modules:

**Kind:** client state store · **Lines:** 32

<!-- docgen:auto -->

## Purpose
The Docusign store, composed from three slices along the same internal/external/shared
boundary as the components and the API modules:

  sharedSlice    — identity, merged dashboard stats + analytics, folders, org members
  internalSlice  — the ds_* document lists, folder counts and open-document detail
  externalSlice  — the esign_* document list and its folder counts

Deliberately still ONE store behind one hook. The slices split the code, not the public
API, so every existing consumer — including the global bottom nav dock in
app/(dashboard)/layout.tsx, which reads `me`/`activeTab`/`setActiveTab` — keeps working
unchanged, and a slice can still read another slice's state when it genuinely needs to.

Note `adminMembers`/`isLoadingAdminMembers` are gone: they were declared here but never
written by anything (the Admin tab calls the API directly).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OrgMemberLite` | re-export | `from ./types` | 24 |
| `DocusignStats` | re-export | `from ./types` | 24 |
| `ExternalStats` | re-export | `from ./types` | 24 |
| `DocusignState` | re-export | `from ./state` | 25 |
| `useDocusignStore` | const | `= create<DocusignState>()((...a) => ({ ...createSharedSlice(...a), ...createInternalSlice(...a), ..…` | 27 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `store/docusign/sharedSlice.ts` — `createSharedSlice`
  - `store/docusign/internalSlice.ts` — `createInternalSlice`
  - `store/docusign/externalSlice.ts` — `createExternalSlice`
  - `store/docusign/state.ts` — `DocusignState`, `(types only)`
- **Packages:**
  - `zustand` — `create`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/docusign/DocusignDashboardView.tsx`
- `components/dashboard/docusign/DocusignPage.tsx`
- `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx`
- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `components/dashboard/docusign/internal/AgreementsView.tsx`
- `components/dashboard/docusign/internal/DocumentUploadDialog.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
- `components/dashboard/docusign/internal/RecipientPicker.tsx`
- `components/dashboard/docusign/internal/RecipientsPanel.tsx`
- `components/dashboard/docusign/shared/FolderSelect.tsx`
- `components/dashboard/docusign/shared/MoveToFolderDialog.tsx`
- `components/dashboard/docusign/shared/admin/MembersTab.tsx`

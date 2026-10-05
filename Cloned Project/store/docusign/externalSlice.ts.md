# `store/docusign/externalSlice.ts`

> EXTERNAL flow store state: the External Signatures list and its per-folder status counts.

**Kind:** client state store · **Lines:** 66

<!-- docgen:auto -->

## Purpose
EXTERNAL flow store state: the External Signatures list and its per-folder status counts.
Backed entirely by lib/docusign/external-api (the esign_* collections).

Smaller than the internal slice because this flow has one list, not three, and its editor
holds the open document in local component state rather than in the store.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ExternalSlice` | interface |  | 17 |
| `createExternalSlice` | function | `createExternalSlice(set)` | 29 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsPagination`, `FolderFilter`, `(types only)`
  - `lib/docusign/external-api.ts` — `DsExternalDocument`, `listMyExternalDocuments`, `getExternalDocumentStats`
  - `store/docusign/state.ts` — `DocusignState`, `(types only)`
  - `store/docusign/types.ts` — `EMPTY_PAGINATION`, `ExternalStats`
- **Packages:**
  - `zustand` — `StateCreator`
  - `sonner` — `toast`

## Used by

- `store/docusign/docusignStore.ts`
- `store/docusign/state.ts`

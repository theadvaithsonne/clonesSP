# `store/docusign/internalSlice.ts`

> INTERNAL flow store state: the three document lists the internal tabs page through, the per-folder status counts behind the Agreements rail, and the currently-open document detail.

**Kind:** client state store · **Lines:** 161

<!-- docgen:auto -->

## Purpose
INTERNAL flow store state: the three document lists the internal tabs page through, the
per-folder status counts behind the Agreements rail, and the currently-open document detail.
Backed entirely by lib/docusign/internal-api (the ds_* collections).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InternalSlice` | interface |  | 29 |
| `createInternalSlice` | function | `createInternalSlice(set)` | 57 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsPagination`, `DsField`, `DsAuditLogEntry`, `FolderFilter`, `(types only)`
  - `lib/docusign/internal-api.ts` — `DsDocument`, `DsRecipient`, `listSentByMe`, `listAssignedToMe`, `listAllInOrg`, `getDocumentStats`, `getDocumentDetail as apiGetDocumentDetail`
  - `store/docusign/state.ts` — `DocusignState`, `(types only)`
  - `store/docusign/types.ts` — `EMPTY_PAGINATION`, `DocusignStats`
- **Packages:**
  - `zustand` — `StateCreator`
  - `sonner` — `toast`

## Used by

- `store/docusign/docusignStore.ts`
- `store/docusign/state.ts`

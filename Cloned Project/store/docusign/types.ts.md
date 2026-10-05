# `store/docusign/types.ts`

> Store-level types shared by all three slices.

**Kind:** client state store · **Lines:** 38

<!-- docgen:auto -->

## Purpose
Store-level types shared by all three slices.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OrgMemberLite` | interface |  | 5 |
| `DocusignStats` | interface |  | 16 |
| `ExternalStats` | interface |  | 26 |
| `EMPTY_PAGINATION` | const | `= { page: 1, limit: 20, total: 0, totalPages: 1 }` | 37 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/docusign/types.ts` — `DsPagination`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/docusign/external/ExternalSignaturesList.tsx`
- `store/docusign/docusignStore.ts`
- `store/docusign/externalSlice.ts`
- `store/docusign/internalSlice.ts`
- `store/docusign/sharedSlice.ts`

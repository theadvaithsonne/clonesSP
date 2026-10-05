# `store/docusign/sharedSlice.ts`

> Store state serving BOTH flows: identity, the merged dashboard stats and analytics, the folder list (one collection holds internal and external documents alike), and the org member directory.

**Kind:** client state store · **Lines:** 247

<!-- docgen:auto -->

## Purpose
Store state serving BOTH flows: identity, the merged dashboard stats and analytics, the
folder list (one collection holds internal and external documents alike), and the org
member directory.

fetchStats deliberately lives here rather than in either flow: it writes internal and
external counts in a single set() from one Promise.all, and splitting it would either
duplicate the call or tear the two halves apart.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SharedSlice` | interface |  | 24 |
| `createSharedSlice` | function | `createSharedSlice(set, get)` | 82 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${apiUrl.replace(/\/+$/, "")}/public/organizations/${orgId}/users${query}` (L211)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **External hosts mentioned in the code:** `test.garage.app`

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`, `getUserDataFromToken`
  - `lib/docusign/types.ts` — `DsFolder`, `DsUser`, `DsAnalyticsSummary`, `DsAnalyticsRange`, `(types only)`
  - `lib/docusign/internal-api.ts` — `getDocumentStats`
  - `lib/docusign/external-api.ts` — `getExternalDocumentStats`
  - `lib/docusign/shared-api.ts` — `syncDocusignProfile`, `listFolders`, `getDocusignAnalytics`, `FolderScope`
  - `lib/docusign/access.ts` — `canSendDocuments`, `isDocusignAdminUser`
  - `store/docusign/state.ts` — `DocusignState`, `(types only)`
  - `store/docusign/types.ts` — `DocusignStats`, `ExternalStats`, `OrgMemberLite`, `(types only)`
- **Packages:**
  - `zustand` — `StateCreator`
  - `sonner` — `toast`

## Used by

- `store/docusign/docusignStore.ts`
- `store/docusign/state.ts`

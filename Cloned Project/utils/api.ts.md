# `utils/api.ts`

> Module exporting `authenticatedFetch`, `fetchWithRetry`, `externalFetch`, `getUserData` and 2 more.

**Kind:** frontend utility · **Lines:** 594

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `authenticatedFetch` | function | `async authenticatedFetch(url: string, options: RequestInit = {}, retryAttempt: number = 0): Promise<Response>` | 37 |
| `fetchWithRetry` | function | `async fetchWithRetry(url: string, options: RequestInit = {}, retryAttempt: number = 0): Promise<Response>` | 255 |
| `externalFetch` | function | `async externalFetch(endpoint: string, options: RequestInit = {}, retryAttempt: number = 0): Promise<Response>` | 316 |
| `getUserData` | function | `getUserData()` | 339 |
| `isAuthenticated` | function | `isAuthenticated()` | 352 |
| `handleApiResponse` | function | `async handleApiResponse(response: Response): Promise<T>` | 389 |
| `UserData` | interface |  | 433 |
| `ReferrerUser` | interface |  | 446 |
| `referrerApi` | const | `= { search: async (query: string): Promise<ReferrerUser[]> => { const response = await fe…` | 460 |
| `programTypeCloneApi` | const | `= { getProgramTypeClone: async ( email: string, programTypeId: string, ): Promise<any> =>…` | 578 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/organizations/${orgId}/users?id=${encodeURIComponent(id)}` (L484)
  - `GET /backend/public/organizations/${orgId}/users?email=${encodeURIComponent(email)}` (L525)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get/remove), `auth-token` (cookie: get/remove), `auth-token` (localStorage: get/remove), `user-data` (cookie: remove), `garage_tok` (cookie: remove), `user-data` (localStorage: remove), `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L165, L179, L246, L280, L294, …
- **External hosts mentioned in the code:** `startupbrokers.marketsverse.com`

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `API_CONFIG`, `buildExternalUrl`, `RATE_LIMIT_CONFIG`
- **Packages:**
  - `js-cookie`
  - `jwt-decode` — `jwtDecode`

## Used by

- `app/(dashboard)/deals/companies/page.tsx`
- `app/(dashboard)/deals/contacts/page.tsx`
- `app/(dashboard)/deals/facebook/facebookintegration.jsx`
- `app/(dashboard)/deals/funnel/page.tsx`
- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/leads/page-old.tsx`
- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/deals/page.tsx`
- `app/(dashboard)/deals/products/page.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/components/TaskroomSubPage.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/components/taskroom-card.tsx`
- `app/(dashboard)/taskroom/all-taskrooms/componentsSymbol/DocumentManager.tsx`
- `app/(dashboard)/taskroom/assigned-to-me/page.tsx`
- `app/(dashboard)/thoughts/archive/page.tsx`
- `app/(dashboard)/thoughts/components/NoteBreadcrumbs.tsx`
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx`
- `app/(dashboard)/thoughts/components/NotePageHoverCard.tsx`
- `app/(dashboard)/thoughts/components/NoteSharePopover.tsx`
- `app/(dashboard)/thoughts/components/NotionDropdownItem.tsx`
- `app/(dashboard)/thoughts/components/VersionHistory.tsx`
- `app/(dashboard)/thoughts/components/blocks/MentionPageBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/NestedPageBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/PageLinkPillBlock.tsx`
- `app/(dashboard)/thoughts/page.tsx`
- `app/(dashboard)/thoughts/recovery/page.tsx`
- _…and 33 more_

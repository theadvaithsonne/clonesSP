# `store/athena/userStore.ts`

> Module exporting `useUserStore`.

**Kind:** client state store · **Lines:** 71

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useUserStore` | const | `= create<UserStore>((set) => ({ userProfile: null, isUserProfileFetched: false, isLoading: false, e…` | 19 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}users/profile` (L35)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get), `TaskRoomUserDetails` (cookie: set)

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `js-cookie`

## Used by

- `app/taskroom/backOffice/athena/AthenaDeepLink.tsx`
- `components/athena/ProjectMangement.tsx`
- `components/athena/components/AssignedToMe.tsx`
- `components/athena/components/Dashbaord.tsx`
- `components/athena/components/ListView.tsx`
- `components/dashboard/TaskroomWorkspace.tsx`
- `components/dashboard/backOfficeAppSideBar.tsx`
- `components/dashboard/taskroomSiderBar.tsx`

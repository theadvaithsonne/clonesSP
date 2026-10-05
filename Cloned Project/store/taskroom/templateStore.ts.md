# `store/taskroom/templateStore.ts`

> Module exporting `Stage`, `StageTemplate`, `useTemplateStore`.

**Kind:** client state store · **Lines:** 154

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Stage` | interface |  | 6 |
| `StageTemplate` | interface |  | 13 |
| `useTemplateStore` | const | `= create<TemplateState>((set, get) => ({ isOpenTempate: false, selectedTemplate: 'custom', template…` | 45 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${process.env.NEXT_PUBLIC_TASKROOM_URL}Template/stages` (L82)
  - `POST ${process.env.NEXT_PUBLIC_TASKROOM_URL}Template/stages` (L107)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`
  - `axios`
  - `js-cookie`
  - `sonner` — `toast`

## Used by

- `app/taskroom/components/add-workspace-dialog.tsx`
- `app/taskroom/components/task-stage-template-dialog.tsx`
- `components/athena/components/create-room-dialog.tsx`
- `components/athena/components/task-stage-template-dialog.tsx`
- `components/athena/components/workspacesidebar.tsx`
- `components/dashboard/taskroomSiderBar.tsx`
- `store/taskroom/taskroomWorkspace.tsx`
- `store/taskroom/workspaceStore.ts`

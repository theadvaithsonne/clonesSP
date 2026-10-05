# `app/(dashboard)/taskroom/all-taskrooms/components/create-taskroom-modal.tsx`

> Modal form for creating a new TaskRoom (name, description and colour theme).

**Kind:** Next.js app-directory module (colocated) · **Lines:** 168

## Purpose
Collects the fields needed to create a TaskRoom and hands them to the parent, which posts them to the external Taskroom API. The modal itself makes no network calls.

## How it works
- **State:** `formData` of type `CreateTaskRoomRequest` (`name`, `description`, `color`, `orgId`, `userId`) and `isSubmitting`.
- **Seeding:** `orgId` and `userId` come from the `organizationId` and `userId` props. A `useEffect` resets the whole form whenever either prop changes, because the parent decodes them from the JWT after the first render.
- **Colour picker:** five round buttons (`blue`, `green`, `purple`, `orange`, `pink`); the selected one gets a ring. Defaults to blue.
- **Submit:** `handleSubmit` does nothing unless both name and description are non-blank. It awaits `onSubmit(formData)`, then resets the form and calls `onClose()`. Errors are only logged to the console. The submit button is disabled while submitting or while either field is blank, and its label changes to "Creating...".
- Returns `null` when `isOpen` is false.

## Exports
- `CreateTaskRoomModal({ isOpen, onClose, onSubmit, organizationId, userId })` - `onSubmit` receives `{ name, description, color, orgId, userId }` and must return a Promise.

## Dependencies
- **Internal:** `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/textarea.tsx` - shadcn form controls.
- **Packages:** `react` - state and effects; `lucide-react` - `X` close icon.

## Used by
- `app/(dashboard)/taskroom/all-taskrooms/components/AllTaskroomDashbaord.tsx` - passes `handleCreateTaskRoom`, which calls `POST https://uatapi.garage.app/taskroom/v1/rooms`.

## Notes
- The form is closed and reset after `onSubmit` resolves even when the parent's API call failed, because the parent catches its own errors and never rejects.
- `console.log('formData', ...)` runs on every render.

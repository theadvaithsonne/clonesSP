# `lib/mobile-sidebar-context.tsx`

> React context that tracks whether the mobile left navigation sidebar or the mobile right action sidebar is open, making sure only one is open at a time.

**Kind:** frontend library · **Lines:** 105

## Purpose
On phone-width layouts the dashboard hides its sidebars behind overlays: a left one for navigation and a right one for actions. The header buttons that open them and the overlay components that render them are in different parts of the tree, so their open/closed state is shared through this provider, mounted in the dashboard layout.

## How it works
- Two booleans: `isMobileSidebarOpen` (left) and `isMobileActionSidebarOpen` (right).
- Opening or toggling either side always closes the other (`openMobileSidebar`, `toggleMobileSidebar`, `openMobileActionSidebar`, `toggleMobileActionSidebar`). The close functions affect only their own side.
- All callbacks are stable (`useCallback` with no dependencies) and the context value is memoised, so consumers re-render only when an open flag changes.
- `useMobileSidebar()` throws a descriptive error if called outside the provider.

## Exports
- `MobileSidebarProvider({ children })` - provider component.
- `useMobileSidebar()` - returns `{ isMobileSidebarOpen, openMobileSidebar, closeMobileSidebar, toggleMobileSidebar, isMobileActionSidebarOpen, openMobileActionSidebar, closeMobileActionSidebar, toggleMobileActionSidebar }`.

## Dependencies
- **Internal:** none.
- **Packages:** `react` - context, state, callbacks, memo.

## Used by
- `app/(dashboard)/layout.tsx` - mounts the provider for all dashboard routes.
- `components/dashboard/MobileHeader.tsx` - buttons that toggle the left and right sidebars.
- `components/dashboard/MobileSidebarOverlay.tsx`, `components/dashboard/MobileActionSidebar.tsx`, `components/dashboard/MobileRightPanelOverlay.tsx` - render the overlays.
- `components/athena/components/workspacesidebar.tsx`, `components/dashboard/taskroomSiderBar.tsx` - close the sidebar after navigation.

## Notes
- State is not persisted and not tied to the route; components that navigate are responsible for calling the close functions.

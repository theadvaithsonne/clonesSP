# `lib/sidebar-collapse-context.tsx`

> A React context and provider that holds the dashboard sidebar's collapsed/expanded state and saves it to localStorage.

**Kind:** frontend library · **Lines:** 68

## Purpose
The dashboard layout has a collapsible sidebar. Components outside the sidebar, such as the right panel, also need to know or change whether it is collapsed. This client module provides that shared state and keeps it across reloads.

## How it works
- `useLocalStorageBoolean(key, fallback)`, a private hook, starts from `localStorage[key]`, where `"1"` or `"true"` mean true. It uses `fallback` during SSR or when the key is missing. An effect writes `"1"` or `"0"` back whenever the value changes, wrapped in `try/catch` so a blocked storage write is ignored.
- `SidebarCollapseProvider` uses this hook with key `"dashboard.sidebar.collapsed"` and default `false`. It adds a memoised `toggle()` and provides `{ collapsed, setCollapsed, toggle }` through `SidebarCollapseCtx`.
- `useSidebarCollapse()` reads the context and throws if it is used outside the provider.

## Exports
- `SidebarCollapseProvider({ children })` - context provider; mount it once near the top of the dashboard tree.
- `useSidebarCollapse(): { collapsed: boolean; setCollapsed(v | updater): void; toggle(): void }` - accessor hook; throws outside the provider.

## Interfaces
- **Browser storage / cookies:** `localStorage["dashboard.sidebar.collapsed"]`, either `"1"` or `"0"`.

## Dependencies
- **Internal:** none
- **Packages:** `react` - context, state and effect hooks.

## Used by
- `app/(dashboard)/layout.tsx` - wraps the dashboard in the provider.
- `components/dashboard/RightPanel.tsx` - reads or toggles the collapse state.

## Notes
- The initial `useState` reads localStorage directly during the first client render, without `try/catch`. In environments where storage access throws, that read would throw. The SSR render always uses `false`, so a stored `"1"` can cause a hydration mismatch on the first client render.

# `lib/cms/accessGate.ts`

> Client-side password gate that decides whether the current browser tab may open the Deals CMS (landing-page builder), and lets UI ask for that access via a globally registered dialog.

**Kind:** frontend library · **Lines:** 41

## Purpose
The CMS area under `/deals/cms` is hidden behind a shared password while the feature is pre-release. This module holds the unlock state (per browser session), checks the password, and acts as a tiny bridge between code that wants to navigate into the CMS (sidebar links, deal events) and the React component that actually renders the password dialog.

## How it works
- **Unlock state** is stored in `sessionStorage` under the key `garage:cms-access-unlocked` with value `"1"`. It therefore lasts for the tab's session only and is lost when the tab closes. Both `isCmsAccessUnlocked()` and `unlockCmsAccess()` are no-ops / `false` during SSR (`typeof window === "undefined"`).
- **Password check:** `verifyCmsPassword()` trims the input and compares it to the exported constant `CMS_ACCESS_PASSWORD` (a hardcoded literal on line 2).
- **Dialog bridge:** a module-level `openDialogHandler` variable holds one callback. `components/deals/cms/CmsAccessGateHost.tsx` registers it on mount with `registerCmsAccessDialog()` and clears it with `unregisterCmsAccessDialog()` on unmount. Only one handler exists at a time; a later registration replaces an earlier one.
- **`requestCmsAccess(onGranted)`:** if already unlocked, calls `onGranted` immediately; otherwise, if a dialog host is registered, hands `onGranted` to it so the dialog can call it after a correct password; otherwise does nothing (fails closed, as the inline comment says: the host is not mounted yet).

## Exports
- `CMS_ACCESS_PASSWORD: string` - the shared CMS password (hardcoded literal).
- `registerCmsAccessDialog(handler: (onGranted: () => void) => void): void` - install the function that opens the password dialog.
- `unregisterCmsAccessDialog(): void` - remove it.
- `isCmsAccessUnlocked(): boolean` - whether this tab has unlocked the CMS.
- `unlockCmsAccess(): void` - mark the tab as unlocked.
- `verifyCmsPassword(password: string): boolean` - compare (trimmed) input with the password.
- `requestCmsAccess(onGranted: () => void): void` - run `onGranted` now, or after the dialog grants access.

## Interfaces
- **Browser storage / cookies:** `sessionStorage["garage:cms-access-unlocked"] = "1"` once unlocked.

## Dependencies
None (no imports).

## Used by
- `app/(dashboard)/layout.tsx` - dynamically imports it and calls `requestCmsAccess` before navigating to Deals.
- `components/crm/CRMSidebar.tsx` - the CMS sidebar entry calls `requestCmsAccess(() => router.push("/deals/cms"))`.
- `components/deals/cms/CmsAccessGateHost.tsx` - registers the dialog, verifies and unlocks.
- `components/deals/cms/CmsPageAccessGuard.tsx` - page-level guard that checks `isCmsAccessUnlocked`, verifies and unlocks.
- `lib/deals-events.ts` - dynamically imports it and gates navigation with `requestCmsAccess`.

## Notes
- **Security:** this is not real access control. The password ships in the client JavaScript bundle (line 2) and anyone can set the `sessionStorage` key by hand. Treat it as a soft feature flag; actual authorisation must be enforced by the backend CMS API.
- If `requestCmsAccess` is called before `CmsAccessGateHost` mounts, the click is silently ignored.

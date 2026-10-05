# `components/crm/CRMSidebar.tsx`

> Collapsible left navigation for the Deals (CRM) module. It has links to Dashboard, Leads (with a live count badge), Funnels, Products & Services, CMS (password-gated), Contacts and Companies, plus a user menu with Sign out. It is currently not rendered anywhere.

**Kind:** React component · **Lines:** 562

## Purpose
This was the original side menu of the Deals CRM, when it ran as its own app. It is still imported by several Deals pages and by `CRMPageLayout`, but every `<CRMSidebar />` usage is commented out. Deals navigation now comes from `DealsNavbar` and, in inline mode, from `DealsApp`. Read this file as legacy UI that can be switched back on.

## How it works

### State and data (L40-L104)
- `userData`: on mount, `getUserData()` from `utils/api.ts` decodes the `garage_tok` JWT in localStorage. The result is used only for the avatar initials and display name.
- `leadsCount`: on mount, an `authenticatedFetch` to `buildExternalUrl("crm/leads/count")`. The response count is read from `data.data.count` or `data.count`, defaulting to 0. A network error sets the count to 0. A non-OK response leaves it `null`, and then no badge is shown.
- `sidebarCollapsed` / `toggleSidebar` come from the zustand `useUIStore` (`store/uiStore.tsx`). That store persists `sidebarCollapsed` under the `ui-storage` key, so the collapsed state survives reloads and is shared with other sidebars that use the same store.
- `theme` from `next-themes` controls every colour. There are three visual variants: `dark`, `color` (cyan-on-navy `#0A0A1E`) and the default/light theme.

### Sign out (`handleSignOut`, L76-L104)
1. Removes every cookie visible to `js-cookie`, trying four variants each time: no options, `path: "/"`, the exact hostname as domain, and `.<hostname>`.
2. Saves `localStorage["facebook_leads_integration"]`, clears all localStorage, then restores that one key so the Facebook Leads connection survives logout. Also clears sessionStorage.
3. Always redirects with `window.location.href = "/login"` (a full reload), even if clearing failed.

### Header (L111-L138)
The Deals logo (an image on a hard-coded S3 URL) and the "Deals" label. Clicking anywhere on the header toggles collapse. Width is `w-64` expanded and `w-16` collapsed.

### Navigation items (L140-L496)
Each item is wrapped in a Radix `Tooltip`. The tooltip shows the label only when the sidebar is collapsed. An item counts as active when the pathname equals its path or starts with `path + "/"`. Active items get a bold label, a highlighted background and a stronger icon colour for each theme.

| Item | Target | Notes |
|---|---|---|
| Dashboard | `<Link href="/">` | active on `/` or `/deals` |
| Leads | `<Link href="/leads">` | count badge expanded; red dot capped at "99+" when collapsed; tooltip shows `(count)` |
| Funnels | `<Link href="/funnel">` | |
| Products & Services | `<Link href="/products">` | |
| CMS | button | `requestCmsAccess(() => router.push("/deals/cms"))` |
| Contacts | `<Link href="/contacts">` | |
| Companies | `<Link href="/companies">` | |

A "Communication" (`/messages`) link remains as a commented-out block (L464-L495).

### User menu (L499-L558)
Avatar initials: first and last word of `name`, otherwise `firstName` plus `lastName`, otherwise one letter, falling back to "U". When expanded, the full name and a chevron are shown. The dropdown has a single red "Sign out" item. It calls `preventDefault()` and then `handleSignOut()`.

## Exports
- `default CRMSidebar()` - the sidebar. It takes no props.

## Interfaces
- **Backend endpoints called:** `GET https://uatapi.garage.app/api/crm/leads/count`. This goes to the external Garage UAT API set by `API_CONFIG.EXTERNAL_BASE_URL` in `lib/api-config.ts`, not to this repo's `/backend`. It is sent through `authenticatedFetch`, which attaches the user's token.
- **Browser storage / cookies:** reads `garage_tok` (localStorage). Sign out deletes all cookies, all localStorage except `facebook_leads_integration`, and all sessionStorage. The CMS gate reads and writes `sessionStorage["garage:cms-access-unlocked"]` (inside `lib/cms/accessGate.ts`). The collapsed state is persisted by `useUIStore` (`ui-storage`).

## Dependencies
- **Internal:** `utils/api.ts` - `getUserData`, `authenticatedFetch`; `lib/api-config.ts` - `buildExternalUrl`; `lib/cms/accessGate.ts` - `requestCmsAccess`, the client-side password gate for the CMS; `store/uiStore.tsx` - collapse state; `components/ui/button`, `dropdown-menu`, `tooltip` - UI primitives (`Button` is imported but unused).
- **Packages:** `next` (`Link`, `Image`, `usePathname`, `useRouter`); `next-themes`; `js-cookie`; `lucide-react` icons (`Mail` and `HelpCircle` are imported but unused); `react`.

## Used by
Imported by `app/(dashboard)/deals/leads/page.tsx`, `app/(dashboard)/deals/leads/[id]/page.tsx`, `app/(dashboard)/deals/products/page.tsx` and `components/crm/CRMPageLayout.tsx`. In all of them the `<CRMSidebar />` element is commented out, and in `leads/[id]/page.tsx` it is never referenced, so the component appears unused at runtime.

## Notes
- **Stale link targets:** the links point to root paths (`/`, `/leads`, `/funnel`, `/products`, `/contacts`, `/companies`) from when Deals had its own domain. In this app the pages live under `/deals/...` (`app/(dashboard)/deals/leads`, `funnel`, `products`, `contacts`, `companies`), and `middleware.ts` has no rewrite for these paths. Only the CMS button already uses `/deals/cms`. If you re-enable the sidebar, update the hrefs.
- `requestCmsAccess` fails closed: if no access dialog host is registered and the session is not unlocked, clicking CMS does nothing. The gate is a client-side check against a password hard-coded in `lib/cms/accessGate.ts`, so it is not a real security boundary.
- The Deals logo image is loaded from a hard-coded S3 URL through `next/image`. Images in this project are unoptimised.
- The class-name logic is copied out for each item, so a style change has to be made in seven places.

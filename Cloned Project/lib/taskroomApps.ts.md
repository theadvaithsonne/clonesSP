# `lib/taskroomApps.ts`

> Static app catalogue (a legacy "app launcher" registry) for the Taskroom sidebar: a list of Garage sub-apps with icons, categories, URLs and sidebar menu items, plus role-aware helpers that return each app's menu.

**Kind:** frontend library · **Lines:** 1447

## Purpose
Taskrooms (the task-management area at `/taskroom/*`) has a sidebar that can list sibling apps and their sub-menus. This file is the hard-coded registry behind it. It is a configuration file: about 80% of its length is commented-out entries for retired or never-launched apps (GU Edge, NvestBank, Vault, InstantFunnel, Viralverse, Chats, Gmail/Drive/Calendar integrations, "Prime agencies", "Coming soon" apps). It holds no runtime state and makes no network calls.

## How it works

### Types (L87-L106)
- `MenuItem` is `{ title, icon: LucideIcon, href }`.
- `App` is `{ id, name, icon: string | LucideIcon, otherIcons?, color (Tailwind bg class), href, category, enabled, description?, menuItems?, file?, newTab? }`. A string `icon` is a path under `public/appicons/`. `newTab` marks external links.

### The `apps` array (L122-L1259)
These are the active (uncommented) entries in order, with `id`, then name, then category:
- `teamforce`: Teamforce (HRMS), Departmental Tools. Menu: Dashboard, Departments, Employees, Attendance, Recruitment.
- `deals`: Deals (CRM), Departmental Tools. Menu: Dashboard, Product & Services, Leads, Funnel, Contacts, Companies.
- `clarity`: Clarity, Departmental Tools, `file: true`. Menu: Workspace, Automate, Jobs, Marketplace (`/dashboard/clarity/...`).
- `taskroom`: Taskrooms, Productivity Tools. Menu: Overview (`/taskroom/overview`), All Taskrooms (`/taskroom/all-taskrooms`), Assigned to Me (`/taskroom/assigned-to-me`). The FlowBoards, My Taskrooms, Templates and Settings items are commented out.
- `Thoughts` (capital T): Notes, Productivity Tools. Menu: All Notes, Starred, Archive, Trash.
- `Sequence`, `Voicemails`, `Pulse`: Productivity Tools, `enabled: false`, no menus.
- `ideastomvp`, `copilot` (Conversations, Documents, Profile), `programsmanager` (named "Supernova", with `otherIcons` for supernova, liftoff and air; menu Programs, Documents): Incubation.
- `brain`: Memory (Brain), Productivity Tools, `/dashboard/myDrive`. Menu: Home, Starred.
- `startupbrokers` (Dashboard, Explore Jobs, My Applications, Services, Portfolio), `socially` (Maps): Marketplaces.
- `indian-investor` (`https://indianinvestor.com`) and `earngpt` (`https://earngpt.io`): Marketplaces, external, `newTab: true`.
- `capitalized`: Incubation. Menu: Company Profile.
- `coverfi`: No-Code Platforms. Menu: Brokerages, Products, Corporates, User Roles, Insurance Company, Communication, Notifications.
- `vision`: Incubation. Menu: App Builder (`/dashboard/v0-app`).
- `helpdesk`: System. Uses the Lucide `HeadsetIcon` component as its icon. Menu: My Tickets, Report a bug.
- `settings`: System. Menu: Employee Profile, Founder Profile.

Many `href` values use the old `/dashboard/...` URL scheme or relative stubs such as `/` and `/employees`. Some of these routes may not exist in the current App Router tree, so treat them as configuration, not as verified links.

### Helpers (L1261-L1446)
- `getAppsByRole(role = "admin")`: employees get every app whose `category` is not `"Programs"`. No current app uses that category, so in practice it returns all apps. Every other role gets the full list.
- `getAppMenuItems(appId, role = "admin", startupbrokerRole?)`:
  1. For `teamforce` it always logs debug lines with emoji to the console.
  2. Returns `[]` when the app has no menu.
  3. `startupbrokers` with `startupbrokerRole`: `"Client"` gets a hard-coded menu (Dashboard, My Jobs, Applications, Browse Vendors). `"Vendor"` gets Dashboard, Explore Jobs, My Applications, Services, Portfolio.
  4. `role === "employee"`: `teamforce` is reduced to Attendance and Recruitment (Attendance first). `clarity` is reduced to Jobs only. `settings` keeps items titled "Employee Profile" or "Notifications", with Employee Profile first. No "Notifications" item exists in settings, so the result is just Employee Profile. Every other app gets its full menu.
  5. Other roles: `settings` hides "Employee Profile". Every other app gets its full menu.
- `getAllMenuItems(role, startupbrokerRole?)` returns a map from `appId` to that app's menu items, for apps whose filtered menu is not empty.

## Exports
- `interface MenuItem` - one sidebar link.
- `interface App` - one catalogue entry.
- `apps: App[]` - the registry.
- `getAppsByRole(role?: string): App[]`
- `getAppMenuItems(appId: string, role?: string, startupbrokerRole?: string): MenuItem[]`
- `getAllMenuItems(role?: string, startupbrokerRole?: string): Record<string, MenuItem[]>`

## Dependencies
- **Internal:** none.
- **Packages:** `lucide-react` - icon components, imported in two blocks with many entries commented out. `recharts` appears only in a commented-out `import { Funnel }` line (L85). It is not actually imported, even though the dependency index lists it.

## Used by
- `app/(dashboard)/taskroom/components/sidebar.tsx` - imports `apps` and `getAppMenuItems` to render the Taskroom sidebar.

## Notes
- Leftover debug `console.log` calls with emoji run on every `getAppMenuItems("teamforce", ...)` call.
- App IDs are not consistently cased (`Thoughts`, `Sequence`, `Voicemails`, `Pulse` versus lower-case for the rest). Lookups are case-sensitive.
- Many lucide icons are imported but unused (for example `Wallet`, `Coins`, `Terminal`, `Nfc`). That causes lint noise but no runtime effect.
- This registry looks like a copy of an older dashboard app list. The main dashboard may keep its own catalogue elsewhere, so changing this file only affects the Taskroom sidebar.

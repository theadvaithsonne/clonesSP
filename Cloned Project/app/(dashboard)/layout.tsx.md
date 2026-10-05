# `app/(dashboard)/layout.tsx`

> The client-side shell for every page in the `(dashboard)` route group. It sets up the global providers, owns the "active popover" navigation model (most dashboard sections are React state, not URLs), and renders the sidebar, tab bar, bottom dock, right panel, chat overlays, notification toasts and global dialogs.

**Kind:** Next.js layout · **Lines:** 5958 · **Route:** `/` (wraps every route under `app/(dashboard)/`, e.g. `/workspace`, `/coverfi`, `/games/bat246/...`, `/workspace/sign/[token]`)

## Purpose

Garage's logged-in app is mostly a single-page application that sits on top of a handful of real routes. Most sections (Feeds, Communities, Live Streams, Courses, Products, Services, 1:1 Calls, GaragePay, Taskroom, DocuSign, the founder consoles and so on) are not Next.js pages. They are values of one state variable, `activePopover`, and `getActiveComp()` turns that value into a React component. This file holds that state machine and every control that drives it: deep links (`?openApp=...`), the sidebar, the browser-style tab bar, the floating bottom dock, the right-click "open in new tab / side peek" menu, and `window` CustomEvents sent by child components. It also holds cross-cutting concerns: the auth guard, Socket.IO chat/mention notifications, loading org members and groups, the profile-completion prompt, incoming WebRTC calls, and the mobile "Grow Your Network" funnel.

The file is "use client" and very large. The sections below are ordered by line range.

## How it works

### 1. Module-level constants and helpers (L84-L401)

- **`Member`, `Group` types** (L84-L98). These are exported and reused by the chat pages.
- **`TASKROOM_BOTTOM_NAV_MAP`** (L100). Maps dock tab values (`People`, `Setting`, `TimeSheets`, `AssignedToMe`, `AllTasks`, `Dashboard`, `ImportExport`) to the Taskroom store's `projectActiveItem` names (`WorkspacePeople`, `WorkspaceSettings`, `DashMangement`, ...).
- **`DISCOVER_POPOVER`** (L118). Maps a storefront item type (`channel`, `course`, `workshop`, `product`, `service`, `call`) to the popover holding that type's Discover section. `?openApp=discover` uses it.
- **`OPEN_APP_POPOVER`** (L140). The generic `?openApp=<slug>` to popover map (`taskroom`, `deals`, `mail`, `notes`/`thoughts`, `orders`, `vault`, `feeds`, `communities`, `drops`, `learn`/`courses`, `events`/`live`, `live-enrolled`, `recordings`, `store`/`products`, `services`, `calls`, `teamforce`, `jobs`). A comment says `DEEP_LINK_TARGETS` in `lib/announcements.ts` may only offer slugs that exist here.
- **`OPEN_APP_SLUG_EXTRA`** and **`openAppLinkFor(popover)`** (L169-L185). These reverse the maps to build a `${origin}/workspace?openApp=<slug>` link for the sidebar's "Copy link" and new-browser-tab actions.
- **`NO_SIDE_PEEK`** and **`canSidePeek(popover)`** (L191-L199). These pages cannot appear in the side-peek panel: Taskroom, docusign, Conference, Deskstream, the inline apps (Deals, Notes, Network Mail, Teamforce*), `Founder:Events*` and Drops.
- **`normalizeTab(tabName)`** (L204-L269). Collapses a popover name into its tab section. Founder pages keep two segments (`Founder:Live:Orders` becomes `Founder:Live`), and recordings, articles and analytics go to `Founder:Content`. Sub-tabs drop their suffix, and aliases are mapped (Drops becomes Content, Learn becomes Courses, Feeds/Conference/Org Cabinet become Community, Thoughts becomes Notes, and so on). `null` maps to `"Community"`.
- **`FOUNDER_TAB_LABELS`**, **`getTabLabel`**, **`TAB_DEFAULT_PAGE`**, **`SHARED_TABS`** (L274-L306). Display names for tabs, the default page for grouping tabs, and global pages (Orders, GaragePay, Vault, Rank Bonus, Support, Auction, 1Network, Notifications) that never switch the tab set.
- **`getTabSet(popover, pathname)`** (L309-L318). Decides whether a page belongs to the `"main"` or `"founders"` tab set, using `isFounderPage` from `lib/founderPages`. It returns `null` to keep the current set. `/coverfi` counts as founders.
- **Page tabs** (L325-L329). A tab id with the `@page:` prefix is pinned to one page, as opposed to a section tab that follows the user around inside its section. Helpers: `isPageTab`, `pageTabFor`, `pageOfTab`, `sectionOfPage`.
- **Storage helpers** (L331-L369). `recentTabsKey`, `pageTabLabelsKey`, `loadPageTabLabels` and `loadRecentTabs` read per-org sessionStorage. `loadRecentTabs` also migrates older sessions that kept founder pages in the main list.
- **`isVideoSizingPage`** (L371). Video pages that open a wider right panel.
- **`EVENT_SECTION_PILLAR`** (L391). Maps an Events console section to the `plan`, `sell` or `reach` pillar. A comment says it must stay in sync with the events module.

### 2. `DashboardLayout` provider stack (L403-L459)

The default export wraps everything in this order: `ChatProvider`, then `WebRTCProvider`, then `ScreenRecordingProvider`, then `WorkspaceLiveKitProvider`, then `SidebarCollapseProvider`, then `MobileSidebarProvider`, then `WhitelabelProvider`, then `BrandColorProvider`. Inside that it renders a `Suspense` around `LayoutInner`, then `WorkspacePipBridge` and `SellablePublishedHost`.

- `WorkspaceLiveKitProvider` sits this high so a workspace or HQ conference LiveKit call survives navigation between dashboard routes. `WorkspacePipBridge` shows a floating PiP pill while the user is in a call on a non-workspace URL.
- The `Suspense` is required because `LayoutInner` calls `useSearchParams()` (a Next 15 prerender requirement).
- `DocusignPage`, `FounderJobsApp` and `CandidateJobsApp` are loaded with `next/dynamic` and `ssr: false`, with a spinner fallback (L472-L497). DocuSign pulls in react-pdf/pdfjs, which touches browser globals.

### 3. `LayoutInner`: dock popover positioning and the Feeds switcher (L566-L817)

- Five dock drop-ups (Feeds community switcher, Communities menu, Live Streams menu, Videos menu, Create Live Stream menu) each have a show flag and a coordinate state. `updatePopupCoords` measures the matching `#bottom-nav-tab-<id>` button. It runs in a layout effect (`useIsomorphicLayoutEffect`) and on resize and scroll. It bails out when the position has not changed, which stops the dock from flickering.
- Feeds switcher data comes from `getOrgChannels(orgId)` and `getSubscribedChannels(orgId)` in `lib/feed-api.ts`. It is fetched on mount and again whenever the popover opens. Favourites are saved in localStorage under `feeds:favourites`. The selected channel lives in sessionStorage under `feed:selected-channel-id` and is kept in sync with the `feed:channel-changed` event. Picking a channel dispatches `feed:switch-channel`.
- `playNotificationSound()` plays `/notification.mp3`. If that fails it falls back to a WebAudio sine beep.
- On mount the layout asks for browser `Notification` permission.

### 4. Real-time chat and mention notifications (L854-L1188)

Uses the singleton from `connectSocket()` (`lib/socket.ts`):

- `dm:message`, `group:message`, `global-dm:message`: for messages from other users (group messages of `type === "system"` are skipped), it builds a 50-character preview and shows a native browser `Notification` (tagged per conversation, closes after 5 s, click focuses the window) plus the sound. Sender names come from the loaded `members`; global DMs use `fromName`/`fromEmail`. A group notification title says "mentioned you" when `message.mentions` includes the current user. The in-app toast setters are commented out ("disabled as requested"), so the DM, group and global-DM toast JSX near the end of the file never appears.
- `notification:new` with type `post_mention` or `comment_mention`: plays the sound, shows the mention toast for 6 s and dispatches `notifications:refresh`.

### 5. Route-specific chrome and the BAT246 / e-sign exceptions (L1193-L1250)

- `isBat246BoardPage`: `/games/bat246/<24-hex id>`. The board view is full-bleed, so the shell is hidden.
- `/games/bat246/documentation/board-button-details` and `/workspace/sign/<token>` are public pages. The chrome is hidden only when there is no valid session (`hasValidSession` is set after mount from `getToken()`/`isTokenExpired()`).
- On `/games/bat246/boards` the layout calls `GET /backend/bat246/distributor/progress` with a raw `fetch` and a Bearer token. Until `isQualified` comes back true, `bat246OnboardingActive` collapses the sidebar and hides the desktop `AppTabBar`.

### 6. Deep links (L1255-L1548)

`activePopover` starts as `"Feeds"`. A run-once effect (guarded by `openAppHandledRef`) reads the query string in this order:

| Query | Effect |
|---|---|
| `openApp=teamforce[&orgId=]` | `saveOrgId(orgId)`, then open `Teamforce:dashboard` (Teamforce onboarding email). |
| bare `orgId` that differs from `getOrgId()` | `saveOrgId`, remove the param, `window.location.replace` (full reload, so org-scoped effects never fire with the stale org). |
| `openApp=whitelabel` | `Whitelabel` page. |
| `openApp=garagepay` / `wallet` | `GaragePay` (coupon/reward email CTA; `?tab=` is read by the wallet page itself). |
| `openApp=note`/`thoughts` + `noteId` | Saves `thoughts:inline-pending-note-id`, opens the Thoughts container, dispatches `thoughts:open-note`. |
| `openApp=course` + `courseId` | Saves `courses:inline-pending-course-id`, opens `Courses:Enrolled`, dispatches `courses:open-course`. |
| `openApp=webinar` or `tab=Live:*` / `tab=enrolled` | A Live sub-tab (`Live:Enrolled`, `Live:Discover`, or the given tab). |
| `openApp=channel` + `channelId` | Sets the Feeds channel and dispatches `feed:switch-channel`. |
| `openApp=cabinet` / `support` | `Cabinet` / `Support`. |
| `openApp=docusign&documentId=&mode=sign\|edit\|external-edit` | Sets `docusignDeepLink` (passed to `DocusignPage` as `initialView`) and opens `docusign`. The link is cleared when the user leaves docusign. |
| `openApp=discover&itemType=&itemId=` | Opens `DISCOVER_POPOVER[itemType]`, then dispatches `community:subscribe-request`, `courses:open-course` (with `goToLearning: false`), `workshop:register-request` or `services:open-service`. Services also save `services:pending-service-id`. Products and calls only land on their list. |
| any other `openApp` | `OPEN_APP_POPOVER[slug]`. |

The follow-up events are sent in `setTimeout(..., 0)` so the target page has mounted first. Other query handlers:
- `?completeProfile=true` (L1541) opens the ProfilePopover in first-time mode.
- `?open=product-orders[&order=]` (L3316) saves `products:pending-order-id` and opens `Products:Orders`.
- `?open=orders` or `?invoice=` opens `Orders` (for example after a crypto payment redirect).

### 7. Popover side effects, breadcrumbs, history (L1550-L1657)

- Course popovers dispatch `courses:tab-clicked`. The scroll container is reset to the top on every popover change.
- `previousPopoverRef` remembers the last "real" page, so overlay-style pages (Org Cabinet, Deskstream, Cabinet, Notifications) can close back to it.
- `Founder:Communities:Create` and `Founder:Events:Create` are redirected to their base page, and then `channels:open-create-modal` or `events:open-create-modal` is dispatched.
- `useNavigationHistory(activePopover, setActivePopover)` provides back and forward for the tab bar. `tabTrail` keeps the last 3 popovers. Dynamic breadcrumbs come from `workspace:set-breadcrumbs` and are cleared on every popover change.

### 8. Browser-style tab bar (L1659-L1928)

- `recentTabs` (`{ main, founders }`) loads lazily from sessionStorage (`garage_recent_tabs[_<orgId>]`, `garage_recent_founder_tabs[_<orgId>]`). `tabSet` follows the open page and is changed during render when `getTabSet` disagrees.
- `activeTab` prefers the last clicked tab (`tabSelection`). Otherwise a page's own `@page:` tab beats its section tab.
- `lastActiveSubpages` (sessionStorage `garage_last_active_subpages[_<orgId>]`) records where each section tab should reopen.
- Each new section tab is added at the front, with at most 5 per set.
- `handleTabSelect`: opens `pageForTab(tab)` and dispatches `courses:tab-clicked` and `workspace:breadcrumb-click`.
- `handleTabClose`: closing the active tab activates the tab to its right, or else the one to its left. Closing the last founder tab returns to the last main page.
- Right-click menu support for `SidebarContextMenu`: `getNavPageState`, `openTabInBackground` (adds a pinned tab without switching to it, trims to 5 without dropping the active tab, saves the label in `garage_page_tab_labels[_<orgId>]`, and shows a toast when the tab lands in the hidden set), `closeNavTab`, plus `openNavPage` and `openSidePeek` (L3971-L4028).

### 9. Inline-app containers (L1930-L2014)

`activeContainer` (`teamforce`, `deals`, `thoughts`, `network-mail`, or any app id) renders `AppContainer` as an overlay. Two effects keep `activePopover` and `activeContainer` in sync in both directions. `Teamforce:<section>`, `Deals`, `Notes` and `Network Mail` set the container, and the container sets the popover back. The section state for Teamforce, Deals, Network Mail, Thoughts and Events lives here, so the dock and the sidebar can both drive it.

### 10. Misc UI state and Teamforce flags (L2016-L2342)

- `activeChatId` (`dm` | `group` | `global-dm`) opens `DMPage`, `GroupPage` or `GlobalDMPage` as an overlay. Opening a chat collapses the right panel.
- GaragePay sub-tab: a `garagepay:open` event (sent from the sidebar dropdown) opens `Orders` on the `one_time` or `recurring` tab.
- `bottom-tab:hide` / `bottom-tab:show` hide the dock while a form is open. `feed:open-new-post` closes every dock drop-up, and opening a drop-up dispatches `feed:close-new-post`.
- On a founder's first render for a given token, `Feeds` is swapped for `Founder:Communities`, except on full-bleed routes.
- Teamforce: for non-founders, `getEmployee(uid)` (Teamforce API, `GET /backend/teamforce/employees/:userId`) sets `tfHasWriteAccess` (true when `teamforceRole === "admin"`) and `tfNeedsOnboarding`. Founders always get write access. These events update the flags: `teamforce:onboarding-complete`, `teamforce:navigate`, `teamforce:bulk-edit-mode`, `teamforce:employee-detail`, `teamforce:self-attendance`. `service:open-taskroom` opens Taskroom.
- Sidebar and right-panel collapse state is saved in localStorage (`dashboard.sidebar.collapsed`, `dashboard.rightpanel.collapsed`, `dashboard.rightpanel.width`, `dashboard.rightpanel.infowidth`). Both auto-collapse below 1200px and 1024px. The sidebar is forced open on `BAT246_HOME_PATH` when the window is at least 1024px wide. `members`, `groups` and `rightPanelCollapsed` are mirrored onto `window`.

### 11. Bottom dock (L2343-L3249, rendered L4384-L5189)

- `getPageGroup(popover)` maps the current state to a dock group: `teamforce`, `Taskroom`, `cabinet`, `docusign`, `garagepay`, `deals`, `thoughts`, `network-mail`, `office-settings` (including `/coverfi`), `communities`, `live`, `content`, `courses`, `products`, `services`, `1:1 Calls`, the `founder-*` groups, `events-browse`, or `default`.
- `bottomNavTabs` (memoised) is a list of `{id,label,icon,value}` per group, with optional dividers, `disabled` and `title`. Notable rules:
  - Taskroom shows Add Task or Invite People, and Settings only for workspace admins or owners (`MemberDetail.role`).
  - Teamforce shows no dock while onboarding. The Self Attendance view swaps in Clock In/Out, Breaks and Apply Leave. Admin-only actions are Create Request, Add Department/Branch, Add Employee, Bulk Assign and the Recruitment tab.
  - The Deals "add" label changes with the section.
  - Founder Events shows only create + list on the catalogue. Inside an event it shows the current pillar's pages plus the console's own actions, received through `events:actions`.
  - DocuSign tabs depend on `canSendDocuments` / `isDocusignAdminUser`.
- `handleBottomTabClick(value)` is the dispatcher. Most values either set `activePopover` or dispatch a module event. Events dispatched include: `services:show-list`, `events:show-discover`, `garagepay:set-tab`, `courses:open-create-modal`, `products:open-create-modal`, `services:open-create-modal`, `channels:open-create-modal`, `events:action`, `events:navigate`, `events:open-create-modal`, `cabinet:trigger-upload`, `cabinet:trigger-new-folder`, `cabinet:trigger-create-folder`, `feed:open-new-post`, `taskroom:open-invite-people`, `taskroom:open-create-task`, `network-mail:open-create-campaign`, `teamforce:create-recruitment|create-department|create-branch|attendance-action|edit-current-employee`, `deals:open-add-*` / `deals:open-new-cms-page` / `deals:open-add-lead-request`, `deals:inline-navigate` (CMS is gated through `requestCmsAccess` from `lib/cms/accessGate`, loaded with a dynamic import), `thoughts:inline-navigate`, `network-mail:inline-navigate`, `docusign:open-upload`, `docusign:open-external-upload`. When the target page is not mounted yet, the event is delayed by 150-300 ms. `coverfi` and `OfficeStream` navigate with `router.push`.
- `isTabActive` decides which dock button is lit for each group.
- The dock is hidden on `/games/bat246*`, while a form is open, and on 1Network, Vault, GaragePay, Whitelabel and the Jobs pages. It can collapse off-screen, with a re-expand button. On DocuSign it uses a solid background instead of backdrop blur, because live blur over scrolling PDF canvases could blank the view.
- The drop-up menus (L4421-L5038) offer Communities (Discover / My Communities / My Reserves), Create Live Stream (Instant dispatches `workshops:open-instant-modal`, Schedule dispatches `workshops:open-create-modal`), Live Streams and Videos. The last two show founder variants when `amIFounder` is true and the user is on a founder page.

### 12. Auth guard and route resets (L3251-L3332)

- Saves `app:lastPathname` in sessionStorage (used by Deals entry guards).
- Auth guard: on every path change except the two public pages, a missing or expired token triggers `toast.error`, `clearToken()` and `router.replace("/login?error=session_expired&redirect=<path+query>")`.
- On `/cabinet/editor/`, `/meet/`, `/games/`, `/coverfi`, `/thoughts` and `/workspace/sign/`, `activePopover` and `activeContainer` are cleared, so the routed `children` render instead of a popover page (`/games/` also collapses the right panel).

### 13. Data loading and global window events (L3334-L3944)

- `useWebRTC()` provides `incomingCall`, `answerCall` and `declineCall` for `IncomingCallDialog`. The caller is looked up in `members`.
- `loadMembers()`: `GET /backend/team/list?orgId=`. `loadGroups()`: `GET /backend/groups?orgId=` (skipped without an org). `loadMyApps()`: `GET /backend/apps/my?orgId=`. All use `api()` from `lib/api.ts` with the stored token.
- `checkProfileStatus()`: `GET /backend/profile/status?userId=` runs once members and `meId` are known. A non-founder with an incomplete profile, or a failed request, opens the ProfilePopover in first-time mode.
- Mobile funnel data on mount: `GET /backend/affiliate/my-affiliate-id`, `GET /backend/org/:orgId`, `GET /backend/org/:orgId/branding` (the brand colour tints the mobile footer).
- `useAuthStore().refreshUser()` runs once per mount, because the ProfilePopover needs `phone`/`phoneVerified` from the auth user. Org member rows do not carry them.
- Founders get `adminApps` built from Marketplace's `CATALOG`, minus Teamforce.
- `window` events handled in one effect (L3481-L3717): `team:reload`, `groups:reload`, `org:switched` (reload members, groups and apps, reload per-org tabs, labels and subpages, reset to Feeds), `notification:open-dm`, `notification:open-group`, `notification:open-global-dm`, `notification:open-post` (opens Feeds, then dispatches `feed:highlight-post`), `workspace:knock-user` (closes popovers and goes to `/workspace`), `profile:open`, `affiliate-profile:open`, `open:guest-funnel`, `manage-org:open`, `invite:open`, `invite-employees:open`, `feed:mobile-composer-visibility`, `right-panel:open-information|open-video-player|open-playlist|open-drops-feed|close|toggle-tint`, `layout:set-active-popover`. Separate effects handle `deals:inline-navigate`, `events:state`, `events:actions`, `thoughts:inline-navigate`, `network-mail:inline-navigate`, `deals:open-lead-inline` (saves `deals:inline-pending-lead-id`, then dispatches `deals:inline-open-lead`), `apps:reload`.
- `activeComp` and `sidePeekComp` are memoised calls to `getActiveComp`, so unrelated layout state changes do not re-render the page. The side peek closes when the main view shows the same page.

### 14. Render tree (L4030-L5587)

Until `useHydration()` reports true, a "Loading Dashboard..." spinner is shown. After that the tree contains:
- Global elements: `VideoCallOverlay`, `AudioCallOverlay`, `FloatingRecordingIndicator`, `IncomingCallDialog`, `ProfilePopover`, `WelcomeModal`, `AnnouncementHost surface="post-login"`, `SidebarContextMenu`, `AffiliateProfileOverlay`.
- After profile completion, `WelcomeModal` opens unless the user is on a `/games/bat246` route or the current org is the hardcoded BAT246 org id (L4124).
- `OfficeSubscriptionLock` wraps the shell. Inside it: `PhoneVerifyBanner`, `OrgKycBanner`, `MobileHeader`, `MobileSidebarOverlay`, `MobileRightPanelOverlay`, then a CSS grid made of `MainSidebar`, the main column and `RightPanel`, plus `SidePeekPanel`.
- The main column holds the mobile `RecentTabs` + `WorkspaceToolbar`, the desktop `AppTabBar` (with `WorkspaceToolbar` as a child), then the content body. The body shows `activeComp` when a popover is set and the routed `children` otherwise. `AppContainer`, the chat overlay and `AskCabinetSidebar` are layered on top. The ActivityPage overlay is disabled with `false &&`.
- After the lock wrapper: `GlobalKnockRing` (knock ringing off `/workspace`), `AccessInboxModal`, the four toast blocks (DM, group and global-DM are effectively dead, see section 4; the mention toast is live), the mobile "Grow Your Network" sticky footer (hidden on BAT246 routes, in chats, in the composer and in inline apps), `GuestFunnelDialog`, `ManageOrgPopover`, `ReferFounderDialog` and `InviteMemberDialog` (dispatches `team:reload` after an invite).

### 15. `getActiveComp()` (L5590-L5957)

`getActiveComp(val, setActivePopover, amIFounder, planSlug, onOpenApp, previousPopover, garagePayTab, docusignDeepLink)` is the popover-to-component router. Highlights:
- `Founder:Jobs*` renders `FounderJobsApp` and `Job Board*` renders `CandidateJobsApp`. Both pick their own sub-page from the key.
- `Taskroom` renders `ProjectMangement`. `BackOffice` renders `BackOfficeLockedOverlay` for founders on the `starter` plan and `MarketplacePage` otherwise.
- `NetworkMail` and `Domain Management` are wrapped in `WhitelabelGate`.
- Customer pages come from `RevenueNetworkPages`: `FeedPage`, `WorkshopsPage`, `CoursesPage`, `ContentPage`, `DropsPage`, `ProductsPage`, `ServicesPage`, `CallsPage`, `OrdersPage`, `WalletPage` (GaragePay/Vault), `AffiliatePage` (1Network), `ChannelsPage` and others. Each gets an `initialTab`, `initialSection` or `initialView`.
- AI pages map to `AIManagementPage` tabs. `Office Settings:*` maps to `ManagementPage`. `Content Rewards` shows the founder or affiliate variant depending on `amIFounder`.
- Founder pages render the same components with `viewRole="founder"`, plus `FounderCommunityOrdersPage`, `FounderLiveOrdersPage`, `FounderCourseOrdersPage`, `FounderProductOrdersPage`, `FounderProductCustomersPage` and `FounderUnsubLogPage` (channel/workshop/course). Founder Calls/Services orders use `OrdersPage` with `hideTabs`.
- `Founder:Events` renders `EventsApp`. `Events` and `Events:Purchases` render `EventsBrowse` and `EventsPurchases`. Notifications render `NotificationPage`. Unknown keys render an empty fragment.

## Exports

- `default DashboardLayout({ children })`: the route-group layout. It wraps `LayoutInner` in the provider stack described above.
- `type Member`: `{ _id?, id?, name?, email, role: "founder" | "stakeholder", profilePicture? }`, an org member row from `/team/list`.
- `type Group`: `{ id, name, description?, picture?, unread? }`, a chat group from `/groups`.

## Interfaces

- **Backend endpoints called:**
  - `GET /backend/team/list?orgId=`: org members.
  - `GET /backend/groups?orgId=`: chat groups.
  - `GET /backend/apps/my?orgId=`: subscribed apps.
  - `GET /backend/profile/status?userId=`: whether the profile is complete.
  - `GET /backend/affiliate/my-affiliate-id`: affiliate id for the referral and guest funnel.
  - `GET /backend/org/:orgId`: org name and slug.
  - `GET /backend/org/:orgId/branding`: primary colour.
  - `GET /backend/bat246/distributor/progress`: BAT246 qualification (raw `fetch`).
  - `GET /backend/teamforce/employees/:userId` through `getEmployee`.
  - Channel list and subscribed channels through `getOrgChannels` / `getSubscribedChannels` (`lib/feed-api.ts`).
  - `/auth/me` through `useAuthStore.refreshUser`.
- **Socket.IO events:** listens for `dm:message`, `group:message`, `global-dm:message`, `notification:new`. Emits none directly.
- **Environment variables:** `NEXT_PUBLIC_API_URL`, the backend base for the BAT246 progress fetch (falls back to `http://localhost:4000`). Other calls go through `lib/api.ts`.
- **Browser storage / cookies:**
  - localStorage: `garage_org_id` (via `getOrgId`/`saveOrgId`), `feeds:favourites`, `dashboard.sidebar.collapsed`, `dashboard.rightpanel.collapsed`, `dashboard.rightpanel.width`, `dashboard.rightpanel.infowidth`.
  - sessionStorage: `garage_recent_tabs_*`, `garage_recent_founder_tabs_*`, `garage_page_tab_labels_*`, `garage_last_active_subpages_*`, `feed:selected-channel-id`, `app:lastPathname`, and the pending-item handoff keys (`thoughts:inline-pending-note-id`, `courses:inline-pending-course-id`, `services:pending-service-id`, `products:pending-order-id`, `deals:inline-pending-lead-id`).
  - The auth token is read through `lib/auth`.
- **Background work:** timers only. Toasts and notifications close after 5-6 s, and delayed CustomEvent dispatches wait 0-300 ms. Resize and scroll listeners position the dock drop-ups and auto-collapse the panels.

## Dependencies

- **Internal:**
  - Providers and contexts: `lib/chat-context`, `lib/webrtc-context`, `lib/screen-recording-context`, `lib/workspace-livekit-context`, `lib/sidebar-collapse-context`, `lib/mobile-sidebar-context`, `lib/whitelabel-context`, `lib/brand-color-context`.
  - Auth, API and socket: `lib/auth` (token/org helpers), `lib/api` (`api()`), `lib/socket` (`connectSocket`).
  - Data helpers: `lib/feed-api` (channels), `lib/founderPages` (`isFounderPage`, `TabSet`), `lib/bat246Office` (`BAT246_HOME_PATH`), `lib/docusign/access`, `lib/cms/accessGate` (dynamic import).
  - Hooks: `lib/hooks/useAmIFounder`, `useHydration`, `useNavigationHistory`, `usePresenceTracking`.
  - Stores: `store/authStore`, `store/taskroom/taskroomWorkspace`, `store/docusign/docusignStore`.
  - Teamforce: `components/dashboard/inlineApps/teamforce/api` (`getEmployee`).
  - UI: the many `components/dashboard/*` pages and shell pieces (MainSidebar, AppTabBar, RecentTabs, RightPanel, SidePeekPanel, SidebarContextMenu, AppContainer, call overlays, RevenueNetworkPages, ...), `components/shared/*` dialogs and banners, `components/announcements/AnnouncementHost`, `components/affiliate/globe`, `components/athena/ProjectMangement`, `app/(dashboard)/auction/page`, `app/(dashboard)/workspace/components/WorkspaceToolbar`.
  - Imported but unused: the three `taskroom/*/page` imports (their cases are commented out).
- **Packages:**
  - `next` (`navigation`, `dynamic`, `Image`): routing, code splitting and images.
  - `react`: state and effects.
  - `framer-motion`: animation for the dock, drop-ups and toasts.
  - `lucide-react`: icons.
  - `sonner`: toasts.

## Used by

Next.js applies this layout to every route under `app/(dashboard)/`. It is also imported by `components/dashboard/DMPage.tsx` and `components/dashboard/GlobalDMPage.tsx` (type `Member`), `components/dashboard/GroupChatPage.tsx` (type `Group`), and `components/dashboard/MainSidebar.tsx` (default import of `DashboardLayout`).

## Notes

- **Navigation is state, not URLs.** Most sections have no URL. `?openApp=` is the only addressable entry point, so new panels need an entry in `OPEN_APP_POPOVER` if they should be linkable, and `lib/announcements.ts` must stay in sync with it.
- **CustomEvent bus.** Much of the coordination between this shell and its pages happens through dozens of `window` CustomEvent names (listed above). Renaming an event on one side silently breaks the feature.
- The DM, group and global-DM in-app toasts are disabled (their `set*Notification` calls are commented out), but the JSX and the auto-hide timers remain. Only browser notifications and the mention toast are live.
- A BAT246 organisation id is hardcoded at L4124 to suppress the WelcomeModal. It is not a secret, but it is duplicated elsewhere according to the comment.
- `console.log` calls run on every render (`activePopover`, `popover`, and inside `getPageGroup`).
- A comment at L3289 refers to "the ternary around line 3787". The line number is stale; the ternary is now around L4313.
- `setRightPanelWidth` is used inside event handlers registered before its `useState` declaration (L3887). This works only because the handlers run after render.
- The ActivityPage panel is intentionally disabled (`false &&`) but its state is kept so the child props still typecheck.
- `MainSidebar.tsx` imports this layout's default export, which creates a circular import between the two modules.

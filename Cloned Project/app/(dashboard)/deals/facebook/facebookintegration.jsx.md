# `app/(dashboard)/deals/facebook/facebookintegration.jsx`

> Client-side React component that connects a user's Facebook account, lists the Lead Ad leads from their Facebook Pages, and exports selected leads into the Garage Deals CRM (contacts + leads) on the external UAT CRM API.

**Kind:** Next.js app-directory module (colocated, not a route) · **Lines:** 4907

## Purpose

The Deals CRM has a "Leads" screen with two tabs: CRM Leads and Facebook Leads. This file is the whole Facebook Leads tab. It does five jobs:

- It runs the Facebook login, using the JS SDK popup.
- It turns the short-lived Facebook token into a long-lived one (about 60 days) and keeps it fresh.
- It finds the user's Pages, Lead Forms and leads by calling the Facebook Graph API from the browser.
- It caches the Facebook session in three places: localStorage, sessionStorage and an httpOnly cookie set by a Next.js route.
- It walks the user through a field-mapping "Export to CRM" dialog. That dialog creates or reuses a CRM contact and then creates a CRM lead for each selected Facebook lead.

The folder `app/(dashboard)/deals/facebook/` has no `page.tsx`, so this file has no URL of its own. It is only rendered inside the leads page.

The code is plain JavaScript (`.jsx`) with almost everything in one component. Styling is mostly inline style objects, with one branch per theme.

## How it works

### Theme and inline mode (L41-L57)
- The component reads `theme` / `resolvedTheme` from `next-themes` and reduces them to one of three values: `"color"`, `"dark"` or `"light"`.
- `window.__garageDealsInline` is set by `components/dashboard/inlineApps/deals/DealsApp.tsx` when Deals is embedded in the workspace. When it is set, the component always uses the dark palette and slightly different header classes (`isInlineDealsMode`).
- `mutedTextColor` is computed once and reused for secondary text.

### Session persistence layer (L59-L395)
The Facebook session object has this shape:

```
{ accessToken, tokenExpiresAt, tokenIsLongLived, userInfo, pages, selectedPage, leadForms, selectedForm }
```

`pages[]` and `selectedPage` include each Page's own `access_token`. The session is stored in three places:

| Store | Key | Helpers |
|---|---|---|
| localStorage | `facebook_leads_integration` (`STORAGE_KEY`) | `saveToStorage`, `loadFromStorage`, `clearStorage` |
| sessionStorage | `facebook_leads_integration_leads_cache` (`LEADS_CACHE_STORAGE_KEY`) | `saveLeadsToSessionCache`, `loadLeadsFromSessionCache`, `clearLeadsSessionCache`, `persistLeadsCache` |
| httpOnly cookie `fb_leads_session` (60 days), set by the Next.js route `app/api/facebook/session/route.ts` | n/a | `saveToBackend`, `loadFromBackend`, `clearBackend` |

**Leads cache.** The cache key is built by `buildLeadsCacheKey(pageId, leadForms)` as `"<pageId>::<sorted form ids joined by |>"`. A cached leads list is used only if its key matches the stored page and forms. `getInitialLeadsFromCache()` (L94) runs during the first render, so the leads table can appear immediately without a Graph call. `leadsHydratedRef` records that leads are already loaded.

**Merging the cookie copy.** The cookie route trims oversized payloads (over 3800 chars) down to just the token, user info and a minimal `selectedPage`. To cope with that, `mergeFacebookSession(local, remote)` (L161) never lets an empty `pages` or `leadForms` array from the cookie overwrite a richer localStorage copy.

**Token helpers.**
- `pickPageWithFreshToken(pagesList, preferredPage)` replaces the stored page object with the freshly fetched copy of the same page id, so a new page token is used.
- `syncTokenHealthFromStorage()` copies the expiry and long-lived flag into `tokenHealth`. If the flag is missing, it treats more than 24 hours remaining as long-lived.

**`fetchFacebookSession(url, options)` (L204).** A custom fetch used only for the session route:
- It uses `credentials: 'include'`.
- It adds `Authorization: Bearer <auth-token>` from localStorage or the `auth-token` cookie.
- It does not redirect on 401.
- It calls `jwtDecode(localStorage.garage_tok)` only so it can log the result. If `garage_tok` is missing this throws. Callers catch the error and fall back to localStorage only (see Notes).

**`saveSession(data)` (L335).** Carries `tokenExpiresAt` and `tokenIsLongLived` over from the existing stored copy, then writes both the cookie (through POST) and localStorage.

**`loadFromBackend()`.** A 401 means "no cookie yet". On any other error it falls back to localStorage.

### Component state (L397-L461)
- **Facebook data:** token, `tokenHealth`, `userInfo`, `pages`, `selectedPage`, `leadForms`, `selectedForm`, `leads`, `filteredLeads`, `totalLeadsCount`, `nextPageUrl`, `hasMoreLeads`.
- **Import dialog:** `selectedLeadIds`, `salesFunnels`, `selectedFunnelId`, `ownerOptions`, `selectedOwnerId`, `fieldMappings`, `availableFacebookFields`, and the open, loading and importing flags.
- **Filter dialog:** `filterSelectedPage`, `filterSelectedForms`, `filterStartDate`, `filterEndDate`, `filterPageForms`, `appliedFilters`.

### Facebook SDK and login (L612-L694, L861-L874)
- **SDK loading.** On mount, the component injects `https://connect.facebook.net/en_US/sdk.js` and calls `FB.init` with a hardcoded app id, Graph `v23.0`, `cookie` and `xfbml`.
- **`handleFacebookLogin()`.** Calls `FB.login` with these scopes: `pages_read_engagement, leads_retrieval, pages_manage_metadata, pages_show_list, pages_manage_ads, pages_read_user_content, business_management`. It also passes `auth_type: 'rerequest'` and `return_scopes: true`.
  - If `pages_show_list` was not granted, it stops with an error.
  - Otherwise it calls `verifyAndSetToken`.
- **OAuth redirect fallback.** `handleOAuthRedirectLogin()` builds a redirect to `https://www.facebook.com/v23.0/dialog/oauth?...&response_type=token`. No button calls it.
- **Redirect return path.** A separate mount effect (L862) reads `access_token` and `expires_in` from `location.hash`, verifies the token, and strips the hash with `history.replaceState`.

### Token verification, exchange and auto-refresh (L876-L1044, L1865-L1931)
- **`verifyAndSetToken(token, expiresIn)`.**
  1. Calls `GET graph.facebook.com/v23.0/app` and checks that the token belongs to the expected app id.
  2. Calls `exchangeForLongLivedToken`.
  3. Stores the token with its expiry, then calls `fetchUserInfo` and `fetchPages`.
  - If the exchange fails, it keeps the short-lived token and shows a warning toast.
- **`exchangeForLongLivedToken`.** Calls `POST /api/facebook/exchange-token` with `{ shortLivedToken }`. A successful response is `{ success, accessToken, expiresIn }`, with `expiresIn` defaulting to 5,184,000 s (60 days).
- **`refreshTokenInBackground(currentToken)`.** Calls `POST /api/facebook/refresh-token` with `{ currentToken }`.
  - **On success:** updates state and storage, re-runs `fetchPages` to get fresh page tokens, and shows a toast.
  - **On failure with `reason` = `invalid_token` or `expired`:** probes `GET /v23.0/<selectedPage.id>` with the stored page token. If that works, it returns `{ pageTokenValid: true }`, so the UI keeps working on page tokens alone.
- **`isFacebookTokenError(err)`.** Matches Graph error code 190 or expiry/OAuth message text.
- **`handleTokenExpired()`.** Tries a refresh first. If both the user token and the page token are dead, it sets `tokenExpiresAt: 0` and shows a "reconnect" error.
- **When refreshes run:**
  - **On restore:** refresh immediately if expired, or proactively if 7 days or less remain.
  - **On window `focus` (L1866):** the same checks.
  - **Every 12 hours (L1911):** a proactive refresh if 7 days or less remain.
- **Token-health label.** `tokenHealth` is re-synced every 60 s (L1899). `renderTokenHealthCorner()` (L2952) draws a small label in the bottom-right corner, `FB stable · 42d` or `FB short · 3h`, with a tooltip showing the expiry date.

### Restoring on mount and on tab switch (L696-L859)
`restoreState()` runs these steps:

1. Load the session from the cookie route, falling back to localStorage.
2. Handle expiry or near-expiry as described above.
3. Restore token, user info and pages. If `pages` is empty but `selectedPage` exists, rebuild `pages` from it and save the fix.
4. Restore the selected page (swapping in the fresh-token copy), its forms and the selected form. If no page was selected, auto-select the first page and fetch its forms.
5. Rehydrate leads from the sessionStorage cache if the cache key matches.
6. If forms are missing, call `fetchPages` again.

A second effect re-runs `fetchPages` whenever `activeTab` switches to `"facebook-leads"` from another tab, because page tokens expire independently of the user token. The leads page mounts this component with `forceMount`, so it stays mounted while hidden.

### Discovering Pages (`fetchPages`, L1078-L1421)
The function tries several strategies in order and stops at the first one that returns pages:

1. `GET /me/permissions`. If `pages_show_list` is not granted, set an error and stop. Cached pages are kept.
2. `GET /me` (diagnostic logging only).
3. `GET /me/accounts?fields=id,name,access_token,category&limit=100`.
4. `GET /me?fields=accounts{id,name,access_token,category}`.
5. `GET /me/accounts` with the extra fields `link,about`.
6. Business Manager: `GET /me/businesses`, then `GET /<business>/owned_pages` for each business. Each page is tagged with `businessName` and `businessId`. An OAuth or permission error here sets a long help message about the `business_management` permission.
7. If nothing worked: keep cached pages if there are any (with an "Using cached pages" warning). Otherwise show the "No pages found" help text.
   - If step 6 found pages, they are de-duplicated by id.

Each successful branch:
- picks the page through `pickPageWithFreshToken`
- calls `fetchLeadForms`
- saves `{ accessToken, userInfo, pages, selectedPage, leadForms, selectedForm }`

On a token error the function calls `handleTokenExpired`. It never clears storage; a user stays "connected" until they press Disconnect.

### Forms and leads (L1423-L1704)
- **`fetchLeadForms(pageId, pageToken, isRetry)`.** Calls `GET /<pageId>/leadgen_forms?fields=id,name,status,leads_count,created_time` and saves the result to the session. If the page token fails, it refreshes pages once and retries with the new page token. After that it falls back to `handleTokenExpired`.
- **`fetchLeads(formId, pageToken, formName, limit=100, loadAll=true)`.** Calls `GET /<formId>/leads?fields=id,created_time,field_data`.
  - It follows `paging.next` until there are no more pages, and stops at 2000 leads per form.
  - Each lead is tagged with `formName`.
  - The `loadAll=false` branch returns only one page and is never used.
- **Fetching every form.** `fetchAllLeadsFromForms(pageOverride?, formsOverride?)` and its near-duplicate `fetchAllLeads()` fetch every form one after another, skipping forms that fail. They then:
  - sort the leads newest first
  - set the count and mark leads as hydrated
  - write the sessionStorage cache
- **Auto-fetch effects.** Two effects (L548 and L1851) start a fetch of all leads once forms are present, there are no leads and leads are not hydrated. Another effect (L1826) auto-selects the first page when pages arrive and no page is selected.
- **`handlePageSelect(page)`.**
  - Resets the forms, leads and cache.
  - Saves the selection.
  - Calls `POST /<page.id>/subscribed_apps?subscribed_fields=leadgen` with the page token. This subscribes the Page to the app's leadgen webhook so new leads reach the backend; success or failure is shown as a toast.
  - Loads the page's forms.
- **`handleFormSelect(form)`.** Loads only that form's leads. Choosing "All Forms" in the dropdown runs `fetchAllLeads()` again.
- **`refreshFacebookData()`.** Used by the Refresh button. It clears the leads and cache, re-runs `fetchPages`, then fetches all leads for the stored page and forms.
- **`handleLogout()`.** Calls `FB.logout()`, resets state, calls `DELETE /api/facebook/session`, and clears localStorage and the sessionStorage cache.

### Reading lead fields (L1706-L1749)
- `formatLeadData(lead)` flattens `field_data[]` into a `{ name: firstValue }` map.
- `getLeadField` does a case-insensitive "name contains" match.
- `getLeadName` prefers `full_name`, then `name`, then `first_name + last_name`, then `"N/A"`.
- `getLeadEmail`, `getLeadPhone` and `getLeadCompany` match fields containing `email`, `phone` and `company`.

### Search and filters (L464-L521, L1933-L1972, L2889-L2950)
- An effect builds `filteredLeads` from two inputs:
  - `appliedFilters`: forms (matched by form *name*) and start/end date (whole-day bounds)
  - `searchTerm`: name, email, phone, company or form name
- A filter dialog (page select, form checkboxes, date range) loads forms for the chosen page directly from Graph. When filters are applied and the chosen page differs from the current one, it switches page through `handlePageSelect`.
- Two click-outside handlers close the custom page and form dropdowns. They use the `data-dropdown` attribute.

### Export to CRM (L1974-L2575)
1. **`handleOpenImportDialog()`.**
   - Requires at least one selected lead.
   - Collects every `field_data` name across the selected leads (`extractAvailableFacebookFields`).
   - Pre-fills `fieldMappings` with `autoMapFields`, which uses pattern lists for name, email, phone, company, job title and source. `leadName` defaults to the contact-name match.
   - Loads funnels and owners, then opens the dialog.
2. **`fetchSalesFunnels()`.** Calls `GET /crm/funnels?skip=0&limit=100` and pre-selects the first funnel.
3. **`fetchOwners()`.**
   - Calls `GET /users?limit=1000` and maps the result to `{ id, name }`.
   - The default owner is the logged-in user, whose id comes from `garage_tok` (`userId`, `id` or `sub`), or else the first user.
   - If the call fails, the logged-in user is offered as "You (current user)".
4. **`handleImportLeads()`.** Requires a funnel, an owner and at least one selected lead. It then processes the selected leads one at a time:
   - **Mapping.** Reads mapped values. The option `"__dont_map__"` means skip the field. Lead Name, Contact Name and Email are required; a lead missing any of them is recorded as an error.
   - **Contact.** Calls `GET crm/searchcontact?q=<email|phone|name>` and reuses a contact whose email matches (case-insensitive) or whose phone matches after normalisation. If none matches, it calls `POST /crm/contacts` with `{ firstName, lastName, email, phoneNumber }`.
   - **Estimated value.** `calculateEstimatedValue(leadData)` looks for budget-style fields (`estimated_value`, `budget`, `investment`, ...). It rounds values up to 200,000 (up to 2 lakh) or 500,000 (up to 5 lakh), passes larger values through unchanged, and defaults to 200,000 when no value is found.
   - **Notes.** Start with `"Imported from Facebook Lead Form: <form>"`, then the mapped Notes field, then an "Additional Information" list of every unmapped non-empty field.
   - **Stage.** The first stage of the chosen funnel (`funnelStage` or `stages`, as a string or as `.name` / `.stage`), defaulting to `"Prospects"`.
   - **Lead.** Calls `POST /crm/leads` with:

     ```
     { contactId, leadName, estimatedValue, salesFunnel, stage, quantity: 1,
       pricing, negotiatedPricing, MaxDiscPrice, assignedTo: selectedOwnerId,
       source (default "Facebook Lead Ads"), notes, company, email, phone }
     ```

     `pricing`, `negotiatedPricing` and `MaxDiscPrice` are all set to the estimated value.
   - **After each successful lead:** call `addLeadNotification({ type: 'facebook_lead', ... })` for the bell dropdown. If a user email is known, also send `fetch('/api/notifications/lead-email', POST)` (see Notes).
   - **When all leads are done:** show success and failure counts as toasts and log the errors. If anything succeeded, dispatch `DEALS_CRM_STATS_REFRESH_EVENT` and `dispatchDealsLeadsRefresh()` so the CRM Leads tab refetches. Finally clear the selection and close the dialog.

### Rendering (L2577-L4904)
- **Not connected (L2578-L2887).** A header with the "Facebook Leads" type dropdown (CRM Leads / Facebook Leads), then a centred connect card with:
  - the inline SVG icons
  - a feature list
  - a "Connect with Facebook" button
  - a note explaining the "FB stable / FB short" label
  - an error box with extra JSSDK-setup steps when the error mentions `JSSDK`
- **Connected (L3000-L3606):**
  - the token-health corner label
  - a toolbar: type dropdown, custom Page dropdown, Form dropdown (with "All Forms"), search input, Refresh button, and "Export to CRM (n)" button
  - a status bar showing "Facebook Connected | n Pages | n Lead Forms | n Facebook Leads" and a Disconnect button
- **Filter dialog (L3607-L3727).** Built on shadcn `Dialog`, `Select`, `Checkbox` and `Input`.
- **Error, loading and table (L3729-L4106):**
  - an error banner
  - a "Fetching Facebook leads…" spinner (a local `@keyframes fb-spin`)
  - a "no lead forms" warning
  - a leads table with select-all and per-row checkboxes and the columns Name, Email, Phone, Company, Form Name and Created (`YYYY-MM-DD HH:mm` in local time)
- **Import dialog (L4108-L4902).** A hand-built modal (fixed overlay, z-index 1000) containing:
  - a custom funnel dropdown labelled "name (n stages)"
  - an owner dropdown (the current user is marked "(You)")
  - an 8-row field-mapping table (CRM field → native `<select>` of Facebook fields, with "Don't map")
  - a "Before importing" info box
  - Cancel and Import buttons. Import stays disabled until a funnel, an owner and the three required mappings are set.

## Exports
- `default FacebookLeadsIntegration({ activeTab = "facebook-leads", setActiveTab })`: the Facebook Leads tab component.
  - `activeTab` is used to detect switches back to this tab, which trigger a refresh of page tokens.
  - `setActiveTab(tab)` is called by the type dropdown with `"leads"` or `"facebook-leads"`. When it is absent, the component falls back to `router.push("/deals/leads")` (or `"/deals/leads?tab=facebook-leads"` in the connected header).

## Interfaces
- **Next.js API routes called (same origin, not `/backend`):**
  - `GET|POST|DELETE /api/facebook/session`: read, write or delete the httpOnly `fb_leads_session` cookie (`app/api/facebook/session/route.ts`).
  - `POST /api/facebook/exchange-token`: short-lived → long-lived token (`app/api/facebook/exchange-token/route.ts`).
  - `POST /api/facebook/refresh-token`: re-exchange a still-valid long-lived token. Returns `reason` = `invalid_token`, `expired` or `refresh_failed` on failure (`app/api/facebook/refresh-token/route.ts`).
  - `POST /api/notifications/lead-email`: there is no route handler for this in the repo (see Notes).
- **External CRM API.** `buildExternalUrl` hardcodes `https://uatapi.garage.app/api`, and requests are sent through `authenticatedFetch`. These calls do not go to this project's `/backend`:
  - `GET /users?limit=1000`: owner list.
  - `GET /crm/funnels?skip=0&limit=100`: sales funnels.
  - `GET /crm/searchcontact?q=...`: duplicate-contact lookup.
  - `POST /crm/contacts`: create contact.
  - `POST /crm/leads`: create lead.
- **External services:**
  - Facebook JS SDK (`connect.facebook.net`).
  - Facebook OAuth dialog.
  - Facebook Graph API `v23.0`, called directly from the browser with axios: `/app`, `/me`, `/me/permissions`, `/me/accounts`, `/me/businesses`, `/<business>/owned_pages`, `/<page>/leadgen_forms`, `/<form>/leads`, `/<page>/subscribed_apps`, `/<page>`.
- **Browser storage / cookies:**
  - localStorage `facebook_leads_integration`: the full session, including user and page access tokens.
  - sessionStorage `facebook_leads_integration_leads_cache`: the leads cache.
  - Reads localStorage `auth-token` and `garage_tok`, and the `auth-token` cookie.
  - httpOnly cookie `fb_leads_session`, written by the session route.
  - `addLeadNotification` writes to its own storage (see `utils/leadNotifications.ts`).
- **Window events:**
  - dispatches `DEALS_CRM_STATS_REFRESH_EVENT` (`"deals:crm-stats-refresh"`) and, through `dispatchDealsLeadsRefresh`, `"deals:leads-refresh"`
  - listens for window `focus`
  - adds a document `mousedown` listener while a dropdown is open
- **Background work:**
  - 60 s interval to re-sync the token-health label
  - 12 h interval for proactive token refresh
  - 100 ms timeout before the first auto-fetch of leads
  - all are cleared on unmount or when the token changes

## Dependencies
- **Internal:**
  - `lib/api-config.ts` (`buildExternalUrl`): builds the external CRM API URLs.
  - `utils/api.ts` (`authenticatedFetch`): authenticated fetch for the CRM calls.
  - `lib/deals-events.ts` (`DEALS_CRM_STATS_REFRESH_EVENT`, `dispatchDealsLeadsRefresh`): tell other Deals views to refetch after an import.
  - `utils/leadNotifications.ts` (`addLeadNotification`): bell-icon notification entries.
  - `components/ui/dialog.tsx`, `button.tsx`, `label.tsx`, `input.tsx`, `checkbox.tsx`, `select.tsx`, `dropdown-menu.tsx`: shadcn/Radix UI primitives.
- **Packages:**
  - `react`: state, effects, refs.
  - `axios`: Graph API calls and the Next.js token routes.
  - `js-cookie`: reads the `auth-token` cookie.
  - `jwt-decode`: decodes `garage_tok` for the user id, email and name.
  - `sonner`: toasts.
  - `lucide-react`: icons.
  - `next/navigation` (`useRouter`): fallback navigation.
  - `next-themes`: theme detection.
  - `@components/searchableSelect`: appears in the import list only as a commented-out import (L5) and is not used.

## Used by
- `app/(dashboard)/deals/leads/page.tsx` loads it with `next/dynamic` (`ssr: false`) and renders it inside the `facebook-leads` `TabsContent` (with `forceMount`), passing `activeTab` and `setActiveTab`.
- Users reach it at `/deals/leads` (Facebook Leads tab), or inside the workspace through the inline Deals app (`DealsApp.tsx` sets `window.__garageDealsInline`).

## Notes
- **Secrets and identifiers.**
  - The Facebook App ID is hardcoded at L623, L687, L1011 and in the help text at L2872. It is a public identifier, not a secret.
  - A commented-out "test token" helper at L1046-L1050 contains part of a Graph API Explorer access token in a comment. It should be removed.
  - The token routes this file calls (`app/api/facebook/exchange-token/route.ts` and `refresh-token/route.ts`) fall back to a hardcoded Facebook app secret when `FACEBOOK_APP_SECRET` is unset. That problem lives in those route files, not in this one.
- **Tokens in storage.** User and page access tokens are kept in plain localStorage and logged extensively to the console. `fetchFacebookSession` also logs `document.cookie`. Many `=== DEBUG ===` logs remain.
- **Email notification never fires (L2502).** `jwtDecode<JwtPayload>(userData)` is TypeScript generic syntax inside a `.jsx` file. It parses as the comparison `jwtDecode < JwtPayload > (userData)`, and `JwtPayload` is undefined. The resulting ReferenceError is swallowed by the surrounding try/catch, so `userEmail` stays empty and the email request is never sent. Even if it were sent, `/api/notifications/lead-email` has no route handler in this repo.
- **Backend sync depends on `garage_tok`.** `fetchFacebookSession` calls `jwtDecode(localStorage.garage_tok)` only for logging. If that key is missing, the call throws and every cookie sync silently degrades to localStorage only.
- **Dead code:**
  - `handleOAuthRedirectLogin` is never wired to a button, although the error text says "Use the OAuth redirect method by clicking the button above".
  - Nothing calls `handleOpenFilterDialog`, so the Filter dialog can never be opened.
  - `loadMoreLeads`, `refreshLeads`, `extractContactInfo` and the `loadAll=false` branch of `fetchLeads` are unused.
  - `fetchAllLeads` duplicates `fetchAllLeadsFromForms`.
- **Filter quirks, if the dialog is ever revived:**
  - The table renders `searchTerm ? filteredLeads : leads`, so applied form and date filters only take effect while a search term is entered.
  - The filter `Select` uses `<SelectItem value="">`, which recent Radix Select versions reject.
- **Select-all.** `handleSelectAll` toggles against all `leads`, but the header checkbox's checked state compares against the filtered list.
- **Duplicate detection.** The import dialog says duplicates are detected by email. In fact a contact is reused on either an email or a normalised phone match, and the CRM lead itself is always created; there is no duplicate check on the lead.
- **Cookie size.** The cookie route stores only a trimmed session when the payload is large. `mergeFacebookSession` exists specifically so that trimmed copy does not wipe the cached pages and forms.
- **Leads cap.** Leads are capped at 2000 per form. Fetching is sequential per form and per page, so Pages with many forms can take a while.
- **Webhook subscription.** Selecting a Page has a side effect on Facebook: it subscribes the Page's `leadgen` field to the app (`/subscribed_apps`).

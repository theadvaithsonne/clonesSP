# `app/(dashboard)/domains/page.tsx`

> Client-side "Domains" page: search domain availability, put domains in a cart, buy them through Razorpay, and manage owned domains (DNS records, lock, auto-renew, transfer auth code).

**Kind:** Next.js page · **Lines:** 1219 · **Route:** `/domains`

## Purpose
This page is meant to be the user-facing domain registrar for Garage (the in-app docs at `app/docs/content/chapters/03-office-setup.ts` describe `/domains` as "a full registrar surface"). It is a single self-contained client component (`"use client"`) that talks to a domain-reseller REST API through the typed wrappers in `lib/domain-api.ts`. The comments in that file say the reseller behind it is Name.com. Everything is local React state. No store, context or URL state is used.

## How it works

### State (L89-L131)
- **Search:** `searchQuery`, `searching`, `searchResults: DomainAvailability[]`.
- **Cart:** `cart: DomainAvailability[]`, `showCart`. The cart is in memory only and is lost on reload.
- **My domains:** `domains: Domain[]`, `loadingDomains`, `selectedDomain` (opening the manage dialog sets it).
- **Purchase:** `purchasing`, `showPurchaseDialog`, `purchaseYears` (1/2/3/5/10), and `contactInfo: DomainContact` (country defaults to `"US"`).
- **DNS:** `dnsRecords`, `loadingDns`, `showDnsDialog`, and `newDnsRecord` (defaults to `{ host: "", type: "A", answer: "", ttl: 300 }`).
- **Top-level tab:** `activeTab`, either `"search"` or `"my-domains"`.

### Razorpay SDK loading (L133-L142)
On mount the page adds `<script src="https://checkout.razorpay.com/v1/checkout.js" async>` to `document.body` and removes it on unmount. A `declare global` block types `window.Razorpay` as `any`.

### Loading owned domains (L144-L160)
`loadDomains` (a `useCallback`) calls `listDomains()` and stores `result.domains`. It runs on mount and again after any change: a successful payment, a lock toggle or an auto-renew toggle. The "Refresh" button on the My Domains card also calls it.

### Search (L162-L186)
`handleSearch` trims and lowercases the query. If the query already contains a dot, it checks only that exact name. If not, it calls `generateDomainVariations(query, POPULAR_TLDS.slice(0, 10))`, which turns the keyword into `.com`, `.net`, `.org`, `.io`, `.co`, `.app`, `.dev`, `.ai`, `.tech` and `.online` variants. It then sends the whole list to `searchDomains()`. Pressing Enter in the input also runs the search. In the results:
- Available names get a green row, the price per year (`formatDomainPrice(retailPrice)`) and an "Add to Cart" button. The button switches to "In Cart" and is disabled once the name is already in the cart.
- Taken names get a red row and the label "Taken".
- Premium names get a "Premium" badge.

### Cart and checkout (L188-L290, L649-L893)
- `addToCart` skips duplicates (matched on `domainName`). `removeFromCart` filters a name out. `cartTotal` is the sum of `retailPrice` over the cart.
- The cart dialog lists each item as "1 year registration" with its one-year price. "Proceed to Checkout" opens the purchase dialog.
- The purchase dialog collects the registration period and the registrant contact: first name, last name, email, phone (placeholder `+1.1234567890`, the Name.com phone format), address, city, state, postal code and country. The order summary shows `retailPrice × years` for each item and `cartTotal × purchaseYears` as the total.
- `handlePurchase` requires every contact field. It then loops over the cart in order:
  1. It calls `purchaseDomain({ domainName, years, contacts: { registrant } })`. The response includes a pending `domain._id` and a `razorpayOrder` (`id`, `amount`, `currency`).
  2. It builds Razorpay Checkout options: key from `NEXT_PUBLIC_RAZORPAY_KEY_ID`, amount and currency from the server order, and email and phone prefilled from the contact form.
  3. It waits up to 5 seconds (50 × 100 ms) for `window.Razorpay` to load. If the SDK still isn't available, it throws "Couldn't load the payment gateway". This guard is explained in a comment at L271-L273.
  4. It opens the Razorpay modal. The success `handler` calls `verifyDomainPayment({ domainId, razorpayOrderId, razorpayPaymentId, razorpaySignature })`, shows a success toast, removes the domain from the cart and reloads the domain list.
- The `finally` block clears `purchasing` and closes the purchase dialog right away, without waiting for the user to finish paying in the Razorpay modal.

### My Domains list (L538-L646)
Each owned domain shows:
- a status badge, coloured by `getDomainStatusColor`: active is green, pending is yellow, expired or failed is red, anything else is gray;
- a lock icon when `locked` is set;
- a refresh icon when `autoRenew` is on;
- "Expires in N days" from `getDaysUntilExpiry`: red under 30 days, yellow under 90, green otherwise.

The gear button sets `selectedDomain` and calls `loadDnsRecords(domain._id)`.

### Manage dialog (L895-L1122)
This dialog opens whenever `selectedDomain` is set and has three inner tabs:
- **Overview:** status, expiry date, auto-renew state, lock state, and the list of nameservers when there are any.
- **DNS Records:** a table with type, host (shown as `@` when empty), value and TTL, plus a delete button per row that calls `handleDeleteDnsRecord(record.id)` → `deleteDnsRecord`. "Add Record" opens the Add DNS Record dialog.
- **Settings:**
  - Auto-Renew toggle: `setAutoRenew(id, !autoRenew)`.
  - Domain Lock toggle: `setDomainLock(id, !locked)`.
  - "Copy Code": `getAuthCode(id)`, then copies the code to the clipboard with `navigator.clipboard.writeText`. The button is disabled while the domain is locked, and the handler also refuses with a toast.

### Add DNS Record dialog (L1124-L1214)
The form has a type select (A, AAAA, CNAME, MX, TXT, NS, SRV, CAA), host, value and TTL. A priority field appears only for MX and SRV. `handleCreateDnsRecord` requires a selected domain, a host and a value. It calls `createDnsRecord`, then reloads the records, resets the form and closes the dialog.

### Styling
The page uses a fixed dark palette (`#0b0b0d`, `#111116`, `#1a1a1f`, `#333`) with brand tokens (`bg-brand`, `text-brand-foreground`, and `color-mix` on hover). It uses no light-mode tokens. Toasts come from `sonner`.

## Exports
- `default DomainsPage()` - the page component. It takes no props.

## Interfaces
- **Backend endpoints called** (all through `api()` in `lib/api.ts`, which sends `Authorization: Bearer <token>`):
  - `GET /backend/domains` - list the user's domains.
  - `POST /backend/domains/search` - body `{ domains: string[] }`, check availability and price.
  - `POST /backend/domains/purchase` - create a pending domain and a Razorpay order.
  - `POST /backend/domains/verify-payment` - verify the Razorpay signature and finish registration.
  - `GET /backend/domains/:domainId/dns` - list DNS records.
  - `POST /backend/domains/:domainId/dns` - create a DNS record.
  - `DELETE /backend/domains/:domainId/dns/:recordId` - delete a DNS record.
  - `POST /backend/domains/:domainId/autorenew` - body `{ enabled }`.
  - `POST /backend/domains/:domainId/lock` - body `{ locked }`.
  - `GET /backend/domains/:domainId/authcode` - transfer auth code.
- **External services:** Razorpay Checkout. The script is loaded from `checkout.razorpay.com` and the payment modal runs in the browser.
- **Environment variables:** `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Razorpay public key id for Checkout. `NEXT_PUBLIC_API_URL` is used indirectly, through `lib/api.ts`.
- **Browser storage / cookies:** none directly. The auth token is read by `lib/api.ts` through `getToken()`.

## Dependencies
- **Internal:**
  - `lib/domain-api.ts` - typed API wrappers (search, purchase, verify, list, DNS, lock, auto-renew, auth code), the formatting helpers (`formatDomainPrice`, `getDaysUntilExpiry`, `getDomainStatusColor`, `generateDomainVariations`), `POPULAR_TLDS`, and the types `Domain`, `DomainAvailability`, `DomainContact`, `DnsRecord`.
  - `components/ui/{button,input,label,card,dialog,select,tabs,badge}.tsx` - shadcn/Radix building blocks.
- **Packages:**
  - `react` - state and effects.
  - `lucide-react` - icons.
  - `sonner` - toasts.
  - `framer-motion` - imported but never used (see Notes).

## Used by
No file imports this page. It is reached only by going to `/domains` (the `(dashboard)` route group does not appear in the URL). A search found no in-app link to `/domains`; only the docs chapter `app/docs/content/chapters/03-office-setup.ts` mentions it.

## Notes
- **The backend routes appear to be missing.** No router in `server/app.ts` is mounted at `/domains`, and no `server/routes` file defines `/search`, `/purchase`, `/:id/dns`, `/:id/authcode` and so on for domains. Name.com support on the server does exist, but in other forms: `server/services/namecom.ts`, `server/models/domainPurchaseRequest.model.ts`, and a domain-purchase-request flow in `server/routes/initialSetup.ts`. As written, every call on this page would likely fail (a 404 shown as an error toast). Check this before relying on the page.
- **Unused imports:**
  - From `lib/domain-api.ts`: `getDomainSuggestions`, `getDomainPricing`, `getDomain`, `syncDomain`, `updateDnsRecord`, `updateNameservers`, `renewDomain`, `verifyRenewalPayment`.
  - Icons: `Calendar`, `ExternalLink`, `AlertCircle`.
  - `motion` and `AnimatePresence` from `framer-motion`.

  Because of this, the page has no UI for renewal, nameserver edits, sync or editing a DNS record, even though the docs chapter describes those features.
- **Several Razorpay modals for one cart.** With more than one domain in the cart, the loop calls `purchaseDomain` and opens a new Razorpay modal for each domain without waiting for the previous payment. The user may get stacked modals, and a pending domain plus order is created on the server for each item even if the user abandons payment.
- **Currency mismatch:** prices are always formatted as USD (`formatDomainPrice` defaults to `"USD"`), while the amount actually charged and its currency come from the server's Razorpay order.
- **Theme colour:** `theme.color: "var(--brand)"` is passed to Razorpay, which expects a hex colour. The CSS variable is probably not resolved inside the Razorpay iframe.
- **Inconsistent wording and colours:** the cart dialog always says "1 year registration", even though the period is chosen later. The Overview status badge only uses green or yellow, so expired and failed domains show yellow there, unlike the list view.
- **TTL and priority parsing:** both use `parseInt` with no validation, so clearing the field yields `NaN`, which is then sent to the API. The DNS type select does not offer `ANAME`, although the `DnsRecord` type allows it.
- **Contact data:** only the registrant contact is sent. Admin, tech and billing contacts are left to the backend.

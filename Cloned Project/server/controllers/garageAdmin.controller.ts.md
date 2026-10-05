# `server/controllers/garageAdmin.controller.ts`

> The main Garage Admin back-office controller: it covers admin login by email OTP, admin invites, roles and per-page permissions, plus the organisation, founder, stakeholder, user, wallet, withdrawal, Unilevel Plus licence and platform-fee screens.

**Kind:** Express controller · **Lines:** 3992 · **Mounted at:** `/garage-admin` (browser: `/backend/garage-admin`)

## Purpose
The Garage Admin panel (`/garage-admin/*` in the Next.js app, also served on the dedicated admin domain through `middleware.ts`) is the platform operators' back office. This file holds the request handlers behind the core admin router `server/routes/garageAdmin.ts`. That router is mounted in `server/app.ts` at `app.use("/garage-admin", garageAdminRoutes)`. Many other `garageAdmin*` routers share the same prefix, and most of them are mounted before this one so their specific paths win.

The handlers do three kinds of work:
- **Admin identity and RBAC.** They log admins in with a one-time code sent by email, invite new admins, define roles and edit per-page access.
- **Read-only reports.** They build the companies table, the founder, stakeholder and user lists, user wallets, Unilevel Plus licence holders, an organisation's invoices and its catalogue.
- **Privileged actions that change money or the referral tree.** These are withdrawals, moving a member's upline, extending a user's welcome offer, platform-fee overrides and assigning an admin to an organisation.

Every handler replies with the `ok(...)` / `fail(...)` envelope from `server/utils/http.ts`.

## How it works

### Access model (enforced outside this file)
- `server/app.ts` puts `garageAdminPageGate` and `requireAdminVerified` (from `server/middleware/garageAdminAuth.ts`) on the whole `/garage-admin` prefix. The gate is page-level RBAC driven by `server/config/adminPages.ts`, and it reads each admin's permission map from their database record on every request.
- In the router, each route also uses `requireGarageAdminAuth`. Super-admin routes add `requireGarageSuperAdmin`, which requires `role === "garage-super-admin"`.
- The middleware sets `req.garageAdmin = { id, name, role, email, isSuperAdmin, permissions, gated, verified }`. The admin id is stored under **`id`**. This matters for two bugs described under Notes.
- Admin login JWTs carry the claims `{ garageAdminId, role, email }` and are signed by `signJwt` in `server/services/jwt.ts`.

### Validation schemas (L65-L88)
These zod schemas check request bodies:
- `inviteSchema`: email, name, and an optional free-text `role` (2-40 characters) and `permissions` record.
- `updateAdminAccessSchema`: optional `role` and `permissions`.
- `loginSchema`: email and a 6-character `code`.
- `requestOtpSchema`: email and `isResend`.

### Inviting admins: `inviteGarageAdmin` (L90-L250)
1. The handler checks for super-admin itself, as well as relying on the route guard.
2. The role defaults to `"garage-admin"`. A role name that `isReservedRoleName` rejects (the super-admin role) gets a 400 response, so the invite form cannot create a second unrestricted account.
3. `sanitizePagePermissions` drops any page key or level the client invented.
4. **Re-invite instead of 409.** If a `GarageAdminModel` record already exists for the email, the handler refreshes `invitedBy`, fills `name` only if it is empty and rewrites the role and permissions. It never rewrites them on a super-admin record. Otherwise it creates a new record with `pagePermissionsSet: true`.
5. It starts `syncAdminSupportMembership` from `server/services/supportChat.ts` without waiting for it. Every active admin is a member of every support chat.
6. It creates an OTP with purpose `"garage-admin-invite"` and emails an HTML invite (sender `EMAIL_FROM_NOTIFICATION`). The email contains the code and a link to `${FRONTEND_URL}/garage-admin/accept-invite?email=…&code=…`.
7. A mail failure does **not** fail the request. The response is 201 with `emailSent: false` and an `emailError` message, because the account and OTP already exist.

### Roles and the permission catalogue (L252-L480)
- `getAdminPageCatalogue` returns `ADMIN_PAGE_LEVELS`, `ADMIN_PAGE_GROUP_LABELS`, `ADMIN_PAGES` and `ADMIN_ROLE_PRESETS`. Any authenticated admin may read it, because it holds page names only.
- `createGarageAdminRole` upserts a `GarageAdminRole` keyed on `nameLower`. It rejects reserved names and sets `createdBy` only when inserting.
- `updateGarageAdminRole` renames a role definition and/or replaces its permission template.
  - It returns 404 if the role is missing and 409 if the new name belongs to a different role. Changing only the letter case of a name is allowed.
  - **Roles are templates, not live links.** Editing or renaming a role does not change admins who already hold the label, because each admin's access is stored on their own record.
- `deleteGarageAdminRole` deletes the definition only. Admins who hold the label keep it.
- `listGarageAdminRoles` groups all non-super admins by their `role` string and counts holders. Each role's permission map comes from the most recently updated admin holding it. It then adds `GarageAdminRole` definitions that nobody holds yet (`adminCount: 0`). The doc comment that describes this function sits higher up, above `createGarageAdminRole`.
- `updateGarageAdminAccess` (PATCH `/admins/:id/access`) re-labels one admin and/or rewrites their `pagePermissions`.
  - It refuses to edit super admins and rejects reserved role names.
  - Saving permissions sets `pagePermissionsSet = true`, so the legacy fallback in `resolvePagePermissions` no longer applies to that admin.
  - The change takes effect on the admin's next request, because the gate reads the record every time.

### Admin login (L482-L658)
- **Apple App Store review account (L490-L508).** `DEMO_ADMIN_EMAIL` is a hardcoded review email.
  - `ensureDemoAdmin()` creates its admin record on demand, limited to `pagePermissions: { users: "view" }`.
  - For this email, `requestGarageAdminOtp` sends no email and just returns success.
  - The fixed code itself lives in `STATIC_OTP_ACCOUNTS` in `server/services/otp.ts`, not in this file. The frontend switches to a demo mode with dummy data for this account.
- `requestGarageAdminOtp`:
  1. Returns 401 for an unknown email and 403 for a deactivated admin.
  2. Creates an OTP with purpose `"garage-admin-login"`.
  3. Emails it, using sender `EMAIL_FROM_RESEND_OTP` when `isResend` is set and `EMAIL_FROM_OTP` otherwise.
- `loginGarageAdmin`:
  1. Validates the body and runs the same existence and active checks.
  2. Verifies the code against purpose `"garage-admin-login"` and, if that fails, against `"garage-admin-invite"`. An invite code therefore also works as a login code.
  3. On success it sets `lastLoginAt`.
  4. It resets `verification.failedAttempts` to 0 with a direct `updateOne`. This only applies to admins who have step-up questions seeded (`verification.questions.0` exists).
  5. It re-syncs support-chat membership as a safety net.
  6. It returns `{ token, role, name, email, id, isSuperAdmin, permissions }`. The step-up "verified" claim is not in this token. It is added later by `POST /garage-admin/verify`, which is handled by a different router.

### Admin roster (L660-L779)
- `getGarageAdminProfile` returns the current admin's record with `invitedBy` populated and the resolved `permissions`. The dashboard re-fetches it whenever the layout mounts, so revoked pages disappear without waiting for a new login.
- `listGarageAdmins` returns all admins, or only active ones when `?activeOnly=true`.
  - When an admin record has no photo, it uses the `User.profilePicture` with the same email, looked up in one batched query.
  - It adds `isSuperAdmin`, the full `permissions` map and `isMe`, which compares each admin to `req.garageAdmin.id`.
  - The router serves it at both `/admins` and `/assignable-agents`, and filters the results by `?q=` through its `withListSearch` wrapper.
- `toggleGarageAdminActive` flips `isActive` atomically with an update pipeline (`$not: "$isActive"`) and then adds the admin to, or removes them from, the support chats.

### Companies table: `getAllOrganizations` (L781-L1247)
This handler returns **all** organisations, newest first, with no pagination.
- **Data fetching.** It runs ten enrichment queries in parallel with `Promise.all`:
  - `User` records of founders.
  - The assigned `GarageAdminModel` records.
  - The `OfficePlan` with slug `pro`.
  - Every `OfficeSubscription`, with the plan populated.
  - Office `Invoice`s: `metadata.type` in `office_subscription`/`office_upgrade`/`office_trial`, excluding the `starter` plan slug and the `office_free_plan` kind.
  - `Product` counts where status is `active`.
  - `ProductOrder` totals where payment status is `paid`: order count, amount sold in minor units and distinct customers.
  - Two `CommissionDistribution` aggregations: commission and platform-fee totals, and distinct affiliate recipients.
  - `User` member counts per organisation.

  A follow-up query loads each founder's referrer for the "Founder's Upline" column.
- **`?plan=paid|free` filter.** An organisation is "paid" if it has at least one invoice with status `paid` among the paid-plan invoices above. Everything else is "free". This is the same test used for `paymentsCount`, so an organisation's table and its Payments column always agree.
- **`status` per organisation:**
  - `"paid"`: has an active or authenticated, non-trial Pro subscription.
  - `"active"`: no such subscription, but at least one active product.
  - `"registered"`: neither.
- **Subscription lifecycle:**
  - The parent invoice is the one without a `parentInvoiceId`.
  - The handler also reports the last paid invoice, `paymentsCount`, `cycle` (equal to `paymentsCount`) and `totalCollectedUsd`, which sums `totalAmount / 100`.
  - `nextPaymentDate` comes from the subscription's `currentEnd`, falling back to the parent invoice's `nextDueDate`.
- **Other fields returned:**
  - `counts`: members, customers, affiliates and total orders.
  - `revenue`: `totalSoldUsd`, `platformFeePercentage` from `paymentConfig`, fees collected and commissions paid. `franchisePayoutsUsd` is always 0 on purpose, until the seller organisation can be attributed.
  - `assignedTo`, `kycStatus` (default `"not_requested"`) and `kycVerifiedAt`.

### Organisation detail and assignment (L1249-L1429)
- `getOrganizationById` returns the organisation, its `Floor`s sorted by level, and its users. Users match through either the legacy `organization` field or `organizations.organization`. Each user's `floorId` comes from their membership in this organisation when present.
- `assignAdminToOrganization` (super admin only) takes the body `{ adminId: string | null }`.
  - `null` removes `assignedAdminId`, `assignedAt` and `assignedBy`.
  - Otherwise it checks that the admin exists and is active, then sets `assignedAdminId` and `assignedAt` (plus `assignedBy`, but see Notes).

### Founders and stakeholders (L1431-L1670)
- `getAllFounders` lists users whose legacy `role` or any `organizations.role` is `founder`.
  - It enriches each founder with their upline, a `premiumSubscriptionsCount` (active, non-trial subscriptions on the Pro plan where the user is `founderId`) and `commercials`. The commercials are paid `office_subscription`/`office_upgrade` invoices excluding Starter; amounts are `/100`.
  - It returns only the organisations where the user is a founder.
- `getAllStakeholders` is the plain equivalent for the `stakeholder` role. It does no enrichment and returns all of the user's memberships.

### All Users: `listAllUsers` (L1672-L1987)
This handler is paginated with `skip` and `limit`. The default limit is 30 and the maximum is 100.
- **Filters (query parameters):**
  - By default it **hides users who have activated the $25 Unilevel Plus subscription** (`typeFlags.oneNetworkActivated`). `?includeActivated=true` shows everyone.
  - `search`: regex match on name, email or phone.
  - `fName` and `fLocation`: column filters, combined with AND.
  - `fActivated`: matches the words shown in the column ("activated" / "not activated" / yes / no / inactive).
  - `rootUserId`: restricts the list to that user's downline through the materialised `ancestors` array ("Open View").
- **Enrichment, per page:**
  - Upline users.
  - Active `UnilevelPlusPurchase` records.
  - Paid, non-cancelled `Invoice`s with an amount above zero, grouped by user **and currency**. They are converted to USD with `usdRates()`/`minorToUsd()` from `server/utils/invoiceMoney.ts` *before* being added together. This avoids summing paise with cents. Paid $0 onboarding invoices are excluded.
  - Paid `ProductOrder` counts.
  - `CommissionDistribution` totals where the user is the `customerId`.
- **24-hour welcome offer.** `comboWindowFor` and `comboWindowStatus` from `server/services/comboWindow.ts` compute the offer window.
  - The response reports `windowStartsAt`, `windowExpiresAt`, `windowOpen`, `secondsRemaining`, `completed` (Unilevel Plus bought inside the window) and `extendedByAdmin`.
  - It also reports `status`, where the shared `"open"` state is relabelled `"pending"` for backwards compatibility.

### User drill-downs and actions (L1989-L2620)
- `listUserPurchases` lists paid, non-cancelled invoices whose first line item is **not** a product, with page/limit pagination (default 25). Product invoices are excluded so they don't appear in both drawers. The organisation of each invoice is looked up in one batch.
- `listUserPurchasedProducts` lists paid `ProductOrder`s flattened to one row per line item, including digital assets and links.
- `extendUserOffer` takes the body `{ hours }`, an integer from 1 to 720.
  - It sets `offerExpiresAtOverride = now + hours`, along with `offerExtendedAt` and `offerExtendedByAdminId`.
  - It returns the recomputed window. The override never shortens a window, because `comboWindowFor` uses the later of the two expiry times.
- `getUserWalletsForAdmin` builds a read-only view of one user's wallets:
  - Store wallets (one per organisation), the affiliate wallet and Content Rewards wallets (one per organisation, from `listContentRewardsBalancesForUser`).
  - If the user has no per-organisation Content Rewards wallets, it shows a single row with the legacy balance from `getContentRewardsWalletBalance`.
  - Each row carries `withdrawableBalance` from `getWithdrawableBalanceCents` (the matured amount, using a Sunday-night cutoff) and the payout `WalletAccount`s for that slot. Content Rewards payout accounts are global per user (`orgId: null`).
  - It also returns the user's current upline and direct-referral count.
- `adminMoveUpline` takes the body `{ newReferrerId, moveCommissions? }`. It is the privileged version of `/affiliate/change-referrer`, without the profile-incomplete check.
  - **Checks, in order:** both ids are valid; the member exists; the target exists; the target is not the member; the target is not already the upline; the target is not inside the member's own downline (`isInMyDownline`, which prevents loops).
  - It sets `User.referredBy` and then calls `syncSupportUpline` without waiting.
  - **Commission sweep (opt-in).** If `moveCommissions` is true, it calls `applyUnilevelCommissionMove` from `server/services/uplineCommissionMove.ts` after the upline write. That function reverses and re-runs the member's Unilevel Plus commissions, which moves real money between wallets. If the sweep fails, the response still succeeds and reports `commissionMove: { status: "failed", reason }`.
  - Without the sweep, only future commissions are affected; the ledger is immutable.

### Withdrawals (L2622-L3000), super admin only
- `shapeWithdrawal` is the private formatter for admin views. It returns:
  - User, wallet label and organisation.
  - A snapshot of the payout account.
  - Gross amount, fee, `feePercent`, `adminOverride` details, `bankTransferFee` and `feeTier` (frequency, keep-$50 threshold, payout method).
  - `platformRetains`, which is the fee plus taxes and excludes the bank charge.
  - Taxes, net amount, status, receipt, transaction hash, proofs and rejection reason.
- `adminQuoteWithdrawal` prices a withdrawal without saving anything.
  - It uses `quoteWithdrawal` from `server/services/withdrawal.ts`, loaded with a dynamic import.
  - The payout method comes from the `WalletAccount`'s `accountType` when an `accountId` is given.
  - It accepts taxes (up to 10), `bankTransferFeeCents` and one-off `overrides` (`feePercent`, `releaseLockedFunds`, `reason`). Overrides are never written back to the member's saved preference.
- `adminInitiateWithdrawal` takes the same body plus a required `accountId`.
  - `store` and `content_rewards` withdrawals require an `orgId`.
  - It calls `initiateWithdrawal`, then emails the admin and the user without waiting.
  - Service errors that match `exceeds|not found|required|greater than 0|Insufficient` become 400 responses; anything else is a 500.
- `listWithdrawals` is paginated and defaults to `status=initiated`; `all` removes the status filter. It can search users by name, email or phone.
- `getWithdrawalStats` returns counts by status and the pending gross total.
- `adminCompleteWithdrawal` accepts `receiptUrl`, `txHash` and `proofs` (up to 10). It calls `completeWithdrawal` and emails the user.
- `adminRejectWithdrawal` accepts an optional `reason`. It calls `rejectWithdrawal`, which refunds the money according to the email copy, and notifies the user.

### Unilevel Plus licence holders (L3002-L3305)
`getAllUnilevelPlusLicenseHolders` starts from active `UnilevelPlusPurchase` records grouped by user. For each holder it adds:
- `ReserveLicense` counts (available, assigned, expired) and reserve dates and amounts.
- `totalSpent`: real purchases plus reserve spend. Purchases whose `paymentId` starts with `assigned_` are excluded.
- A purchase timeline and `fourLicenseMilestoneDate`, the date of the fourth licence.
- Directs split by whether each direct referral holds an active licence.
- Upline, organisations, and payment history from paid invoices that contain `unilevel_plus` line items.

Holders are sorted by purchased plus reserve licences, highest first.

### Platform fee overrides (L3307-L3453), super admin only
- `DEFAULT_PLATFORM_FEE_PERCENTAGE = 5`.
- `listPlatformFeeOverrides` lists every organisation with its effective fee: the override, or 5. It also reports `isHq` (set when `parent` exists) and who set the override.
- `setPlatformFeeOverride` accepts `feePercentage` from 0 to 50. It writes `paymentConfig.platformFeePercentage`, `platformFeeUpdatedAt` and `platformFeeUpdatedBy = req.garageAdmin.id`. It refuses with 401 if the id is missing.
  - The comment explains why: a null `platformFeeUpdatedBy` makes `resolvePlatformFeePercentage` ignore the override in favour of the plan default.
- `removePlatformFeeOverride` removes all three fields.

### User Wallets page: `listAllUserWallets` (L3455-L3729), super admin only
- It loads every active `StoreWallet`, every active `AffiliateWallet`, every `OrgRewardsWallet` and every `WalletAccount`, and combines them into rows in memory. `OrgRewardsWallet` balances are stored in cents and divided by 100.
- Query parameters: `q`, `type`, `sort` (`balance`/`name`/`activity`), `hasFunds=1`, `country`, `payout` (`any`/`yes`/`no`), `limit` (maximum 200) and `offset`.
- **Facets.** The `countries` facet and `payoutCounts` are counted *before* the country and payout filters are applied, so switching filters never leaves the admin on an empty list.
- Countries are matched in trimmed lower case, because `User.country` is free text.
- The comment says this design is sized for wallets in the low thousands.

### Organisation invoices and catalogue (L3731-L3991)
- `listInvoicesForOrganization` paginates (`limit` 1-100, default 25, plus `offset`) and can filter by `status` (an enum) and `type` (matched against `invoiceType`). It returns compact rows that show the name and type of the first line item.
- `listSellableItemsForOrganization` combines `Channel` (by `storeId`), `Workshop` (by `orgId`), `Course`, `Product`, `CallOffering` and `Service` (by `organizationId`).
  - The result is one list sorted newest first, with `kind`, price and status normalised across the models, plus `countsByKind`.

## Exports
The file has no default export. All exports are `async (req: Request, res: Response)` handlers.
- `inviteGarageAdmin` - creates an admin or re-invites one, and emails an OTP invite (super admin).
- `getAdminPageCatalogue` - returns page, level, group and preset catalogue.
- `createGarageAdminRole` - upserts a standalone role definition.
- `updateGarageAdminRole` - renames a role or replaces its template (`:name`).
- `deleteGarageAdminRole` - deletes a role definition (`:name`).
- `listGarageAdminRoles` - lists roles in use plus defined roles, with holder counts.
- `updateGarageAdminAccess` - sets one admin's role label and page permissions.
- `requestGarageAdminOtp` - emails a login OTP; handles the review account specially.
- `loginGarageAdmin` - verifies the OTP and issues the admin JWT and permissions.
- `getGarageAdminProfile` - returns the current admin's profile.
- `listGarageAdmins` - lists the admin roster (`?activeOnly=true`).
- `toggleGarageAdminActive` - flips `isActive` and syncs support chats.
- `getAllOrganizations` - companies table with status, subscription, revenue and counts (`?plan=`).
- `getOrganizationById` - organisation with floors and users.
- `assignAdminToOrganization` - assigns or clears the organisation's account-owner admin.
- `getAllFounders` - founders with upline, Pro-subscription count and commercials.
- `getAllStakeholders` - stakeholders list.
- `listAllUsers` - paginated user table with purchase, commission and offer columns.
- `listUserPurchases` - a user's paid non-product invoices.
- `listUserPurchasedProducts` - a user's paid product-order line items.
- `extendUserOffer` - extends or reopens the 24-hour welcome offer.
- `getUserWalletsForAdmin` - a user's wallets, withdrawable balances and payout accounts.
- `adminMoveUpline` - moves a member to a new upline, optionally moving their commissions.
- `adminQuoteWithdrawal` - prices a withdrawal without saving it.
- `adminInitiateWithdrawal` - creates a withdrawal and sends notifications.
- `listWithdrawals` - withdrawal queue.
- `getWithdrawalStats` - counts and pending amount.
- `adminCompleteWithdrawal` - marks a withdrawal paid, with proofs.
- `adminRejectWithdrawal` - rejects a withdrawal.
- `getAllUnilevelPlusLicenseHolders` - licence-holder report.
- `listPlatformFeeOverrides` - per-organisation fee list.
- `setPlatformFeeOverride` - sets an organisation's fee override.
- `removePlatformFeeOverride` - removes an organisation's fee override.
- `listAllUserWallets` - wallet list across all users.
- `listInvoicesForOrganization` - an organisation's invoice history.
- `listSellableItemsForOrganization` - an organisation's catalogue across item kinds.

## Interfaces
- **Endpoints served** (all under the browser path `/backend/garage-admin`, behind the mount-level `garageAdminPageGate` and `requireAdminVerified`; "auth" means `requireGarageAdminAuth`, "super" adds `requireGarageSuperAdmin`):
  - `POST /request-otp`, `POST /login` - no auth in the router.
  - `GET /profile`, `GET /admins`, `GET /assignable-agents`, `GET /admin-pages` - auth.
  - `POST /invite`, `PATCH /admins/:id/toggle`, `PATCH /admins/:id/access` - super.
  - `GET|POST /admin-roles`, `PATCH|DELETE /admin-roles/:name` - super.
  - `GET /organizations`, `GET /organizations/:id`, `GET /organizations/:id/invoices`, `GET /organizations/:id/sellable-items` - auth.
  - `POST /organizations/:id/assign-admin` - super.
  - `GET /founders`, `GET /stakeholders`, `GET /unilevel-plus-license-holders` - auth.
  - `GET /users`, `GET /users/:userId/wallets|purchases|products`, `POST /users/:userId/extend-offer`, `POST /users/:userId/move-upline` - auth.
  - `GET /user-wallets` - super.
  - `GET /withdrawals`, `GET /withdrawals/stats`, `POST /withdrawals/quote`, `POST /withdrawals`, `POST /withdrawals/:id/complete`, `POST /withdrawals/:id/reject` - super.
  - `GET /platform-fee-overrides`, `PUT|DELETE /platform-fee-overrides/:orgId` - super.
- **Database:**
  - Read and write: `GarageAdminModel`, `GarageAdminRole`, `Organization` (assignment and `paymentConfig` fee fields), `User` (`referredBy`, offer-override fields).
  - Read: `Floor`, `OfficePlan`, `OfficeSubscription`, `Invoice`, `Product`, `ProductOrder`, `CommissionDistribution`, `UnilevelPlusPurchase`, `ReserveLicense`, `Withdrawal`, `StoreWallet`, `AffiliateWallet`, `OrgRewardsWallet`, `WalletAccount`, `Channel`, `Workshop`, `Course`, `CallOffering`, `Service`.
  - Withdrawal writes and commission moves happen inside the services this file calls.
- **External services:** email through `sendMail` in `server/services/mailer.ts` (invites, login OTPs, and withdrawal notices sent by the withdrawal service).
- **Environment variables:** `FRONTEND_URL` - base URL for the accept-invite link (default `http://localhost:3000`).

## Dependencies
- **Internal:**
  - `server/config/adminPages.ts` - page catalogue, presets, reserved-role check, permission sanitising and resolving.
  - `server/services/otp.ts` - `createOtp` / `verifyOtp`.
  - `server/services/mailer.ts` - `sendMail` and the sender constants.
  - `server/services/jwt.ts` - `signJwt`.
  - `server/services/supportChat.ts` - `syncAdminSupportMembership`, `syncSupportUpline` (dynamic import).
  - `server/services/comboWindow.ts` - welcome-offer window maths.
  - `server/services/wallet.ts`, `server/services/contentRewardsWallet.ts`, `server/services/walletAccount.ts` - wallet balances and payout accounts.
  - `server/services/withdrawal.ts` - quote, initiate, complete, reject, withdrawable balance and notifications.
  - `server/services/affiliate.ts` - `isInMyDownline`, `getReferrerInfo`.
  - `server/services/uplineCommissionMove.ts` - `applyUnilevelCommissionMove` (dynamic import).
  - `server/utils/http.ts` - `ok` / `fail`.
  - `server/utils/invoiceMoney.ts` - `usdRates` / `minorToUsd`.
  - The models listed under Database. `NcWallet` and `CampaignWalletTransaction` are imported but never used.
- **Packages:**
  - `express` - Request and Response types.
  - `mongoose` - `Types.ObjectId`.
  - `zod` - input validation.

## Used by
- `server/routes/garageAdmin.ts` is the only importer. It is mounted at `/garage-admin` in `server/app.ts`, so the browser reaches it at `/backend/garage-admin/...`, and hosts listed in `BACKEND_HOSTS` reach it at `/garage-admin/...`.
- The router wraps `listGarageAdmins`, `getAllOrganizations`, `getAllFounders` and `getAllStakeholders` in `withListSearch`, which filters the returned `data` array by `?q=`.
- The callers are the Garage Admin pages of the Next.js app.

## Notes
- **Bug: wrong admin-id key (L1362, L2225).** The middleware stores the admin id as `req.garageAdmin.id`, but these two places read other keys:
  - `assignAdminToOrganization` reads `garageAdmin?.garageAdminId`, so `Organization.assignedBy` is never written.
  - `extendUserOffer` reads `garageAdmin?._id`, so `offerExtendedByAdminId` is never written and the log line shows `admin=?`.

  `setPlatformFeeOverride` had the same bug and was fixed (see its comment). The upload route in the router also reads `garageAdminId`.
- **`sendMail` arguments swapped (L541-L556).** `requestGarageAdminOtp` passes the plain-text line as the `html` argument and the HTML block as the `text` argument. `sendMail`'s signature is `(to, subject, html, text, from)`.
- **Secrets in logs.** `requestGarageAdminOtp` logs the generated OTP (L538). `loginGarageAdmin` logs the submitted code and other debug output (L570-L615). Anyone who can read the server logs can see login codes.
- **Hardcoded review login.** The review email is hardcoded at L490. Its fixed login code is configured in `server/services/otp.ts`. That account has `users: "view"` access only.
- **No self-protection on toggle.** `toggleGarageAdminActive` will deactivate any admin, including a super admin or the caller. Only the route's super-admin guard limits who can call it.
- **Currency handling is inconsistent:**
  - `listAllUsers` converts invoice amounts to USD per currency.
  - `getAllOrganizations` (`totalCollectedUsd`), `getAllFounders` (`commercials`), `listUserPurchases` (`amountUsd`) and the organisation revenue fields just divide minor units by 100 and label the result USD.
- **Possible crash.** `getAllUnilevelPlusLicenseHolders` calls `doc.paymentId.startsWith(...)`. That throws if any active purchase has no `paymentId`.
- **Unpaginated scans.** `getAllOrganizations`, `getAllFounders`, `getAllStakeholders`, `listAllUserWallets` and `listPlatformFeeOverrides` load whole collections into memory.
- **Fee default may differ from what is charged.** `listPlatformFeeOverrides` shows 5% for any organisation without an override. Checkout fee resolution may still apply a plan default instead; the comment mentions 10% for Starter organisations.
- **Money-moving endpoints.** `adminMoveUpline` with `moveCommissions: true`, and the withdrawal initiate and complete endpoints, change real balances. None of them can be undone from the UI.

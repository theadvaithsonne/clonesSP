// Central config for garage-admin page-level RBAC.
//
// A super admin can hand a named role (free text — "Support Agent",
// "Finance", anything) a per-page access level. Levels are:
//
//   none   → the page does not exist for this admin
//   view   → read-only (GET/HEAD)
//   manage → read + write (POST/PUT/PATCH/DELETE)
//
// Adding a new page is 2 things: add it to ADMIN_PAGES, and add a rule to
// ADMIN_PATH_RULES so its endpoints resolve to the key. The GarageAdmin
// schema builds its permission map off ADMIN_PAGES, so the model needs no
// change. Everything else — the gate middleware, the invite UI, the
// sidebar — is driven off this file.
//
// ── The super-admin boundary ────────────────────────────────────────────
// Anything a super admin alone may do is NOT in ADMIN_PAGES and must never
// be added. The gate is deny-by-default: a path under an admin prefix that
// resolves to no page key requires super admin. That means new routes are
// locked down until someone deliberately maps them, and it makes the
// super-only surface impossible to grant away through the UI — there is no
// checkbox that could express it.
//
// SUPER_ONLY_PATTERNS exists purely to make that explicit for endpoints
// that would otherwise be swallowed by a broader page rule (e.g. danger
// zone's DELETE /users/:id sitting under the `users` page prefix).

export const ADMIN_PAGE_LEVELS = ["none", "view", "manage"] as const;
export type AdminPageLevel = (typeof ADMIN_PAGE_LEVELS)[number];

export type AdminPageGroup =
  | "citizens"
  | "money"
  | "garagepay"
  | "networkchains"
  | "others";

export const ADMIN_PAGE_GROUP_LABELS: Record<AdminPageGroup, string> = {
  citizens: "Citizens",
  money: "Money & Bonuses",
  garagepay: "GaragePay",
  networkchains: "NetworkChains",
  others: "Others",
};

/**
 * An independently-grantable write on a page. Only pages with more than one
 * distinct write concern declare these — a single-write page just uses the
 * page's own `manage` level. An action grant is stored as a namespaced key
 * "<pageKey>:<actionKey>" in the same permission map (value "none"|"manage"),
 * so it reuses all the existing map machinery. Page-level `manage` is the
 * superset: holding it authorises every action on the page.
 */
export type AdminPageAction = {
  key: string;
  label: string;
  /** One-line description of the write it unlocks. */
  hint?: string;
};

export type AdminPage = {
  key: string;
  label: string;
  group: AdminPageGroup;
  /** What "manage" unlocks beyond reading. Empty = read-only page. */
  manageHint?: string;
  /** Sidebar route this page controls, if it has one. */
  href?: string;
  /**
   * Independent write actions on this page, each grantable on its own. Absent
   * = the page has one write concern (plain view/manage). See AdminPageAction.
   */
  actions?: AdminPageAction[];
};

/** Compose the storage/permission key for a page action. */
export function actionKey(page: string, action: string): string {
  return `${page}:${action}`;
}

/**
 * Assigning a support agent and marking the NVC chat both live on the User and
 * are surfaced from BOTH One Time Affiliates and NetworkChain Subs, so the two
 * pages declare the same action set. Kept as one constant so they can't drift.
 */
const ONE_TIME_AFFILIATE_ACTIONS: AdminPageAction[] = [
  {
    key: "assign-agent",
    label: "Assign support agent",
    hint: "Set or clear the support agent on an affiliate",
  },
  {
    key: "mark-nvc",
    label: "Mark NVC chat",
    hint: "Tick that an NVC chat has been created",
  },
];

export const ADMIN_PAGES: AdminPage[] = [
  // ── Citizens ─────────────────────────────────────────────────────────
  {
    key: "users",
    label: "Users",
    group: "citizens",
    href: "/garage-admin/users",
    manageHint: "Extend 24h offers, move upline",
    actions: [
      {
        key: "extend-offer",
        label: "Extend 24h offer",
        hint: "Re-open a member's welcome-offer window",
      },
      {
        key: "move-upline",
        label: "Move upline",
        hint: "Re-parent a member in the referral tree",
      },
    ],
  },
  {
    key: "founders",
    label: "Founders",
    group: "citizens",
    href: "/garage-admin/founders",
  },
  {
    key: "stakeholders",
    label: "Stakeholders",
    group: "citizens",
    href: "/garage-admin/stakeholders",
  },
  {
    key: "organizations",
    label: "Organizations & Companies",
    group: "citizens",
    href: "/garage-admin/organizations",
  },
  {
    key: "org_kyc",
    label: "Office KYC",
    group: "citizens",
    href: "/garage-admin/kyc",
    manageHint:
      "Request documents from an office, approve them, verify or send back",
  },
  {
    key: "categories",
    label: "Categories",
    group: "citizens",
    href: "/garage-admin/categories",
    manageHint: "Create, rename and delete org categories",
    actions: [
      {
        key: "edit-categories",
        label: "Create & rename",
        hint: "Add a category or rename one",
      },
      {
        key: "delete-category",
        label: "Delete",
        hint: "Delete a category and merge its orgs elsewhere",
      },
    ],
  },
  {
    key: "affiliate_guests",
    label: "Affiliate Guests",
    group: "citizens",
    href: "/garage-admin/affiliate-guests",
    manageHint: "Graduate a guest into a full member",
  },
  {
    key: "one_time_affiliates",
    label: "One Time Affiliates",
    group: "citizens",
    href: "/garage-admin/one-time-affiliates",
    // Shared with networkchain_subs — the same two routes back both pages, and
    // manage on EITHER page (or the matching action on either) authorises them.
    actions: ONE_TIME_AFFILIATE_ACTIONS,
  },
  {
    key: "networkchain_subs",
    label: "NetworkChain Subs",
    group: "citizens",
    href: "/garage-admin/networkchain-subs",
    actions: ONE_TIME_AFFILIATE_ACTIONS,
  },
  {
    key: "unilevel_plus_licenses",
    label: "Unilevel Plus Licenses",
    group: "citizens",
    href: "/garage-admin/unilevel-plus-licenses",
  },

  // ── Money ────────────────────────────────────────────────────────────
  {
    key: "store_wallets",
    label: "My Crypto Offices",
    group: "money",
    href: "/garage-admin/cryptobrand-offices",
    manageHint: "Top up a member's store wallet",
  },
  {
    key: "founder_sub_bonus",
    label: "Founder Sub Monthly Bonus",
    group: "money",
    manageHint: "Execute a payout run",
  },
  {
    key: "cryptosub_bonus",
    label: "Cryptosub Monthly Bonus",
    group: "money",
    manageHint: "Execute a payout run",
  },
  {
    key: "whitelabel_bonus",
    label: "Whitelabel Monthly Bonus",
    group: "money",
    manageHint: "Execute a payout run",
  },
  {
    key: "addon_renewals",
    label: "Addon Renewals",
    group: "money",
    manageHint: "Trigger whitelabel / cryptosub renewal ticks",
  },
  {
    // Read-only: paid sales per buyer per day (office plans, Unilevel Plus,
    // crypto white-label). No writes behind it, so `view` is the whole page.
    key: "daily_reports",
    label: "Daily Reports",
    group: "money",
    href: "/garage-admin/daily-reports",
  },

  // ── GaragePay ────────────────────────────────────────────────────────
  {
    key: "platform_coupons",
    label: "Platform Coupons",
    group: "garagepay",
    href: "/garage-admin/platform-coupons",
    manageHint: "Create, edit, activate and assign",
    actions: [
      {
        key: "edit-coupon",
        label: "Create & edit coupons",
        hint: "Add a coupon or change its details",
      },
      {
        key: "toggle-active",
        label: "Activate / deactivate",
        hint: "Turn a coupon on or off",
      },
      {
        key: "manage-assignments",
        label: "Assign & revoke",
        hint: "Assign a coupon to users or revoke it",
      },
    ],
  },
  {
    key: "garage_coupons",
    label: "Garage Coupons",
    group: "garagepay",
    manageHint: "Create, edit and delete",
    actions: [
      {
        key: "edit-coupons",
        label: "Create & edit",
        hint: "Add a coupon or change its details",
      },
      { key: "delete-coupon", label: "Delete", hint: "Deactivate a coupon" },
    ],
  },
  {
    key: "coupon_rules",
    label: "Coupon Rules",
    group: "garagepay",
    manageHint: "Create, edit and delete rules",
    actions: [
      {
        key: "edit-rules",
        label: "Create & edit",
        hint: "Add a rule or change one",
      },
      { key: "delete-rule", label: "Delete", hint: "Delete a rule" },
    ],
  },

  // ── Others ───────────────────────────────────────────────────────────
  // ── NetworkChains ────────────────────────────────────────────────────────
  // The NC console reached through the Garage panel. These were super-admin
  // only and unlisted, so no role could be granted them at all; they are here
  // so access is delegated like any other section.
  //
  // Read the caveat on the elevation gate before assuming these are enforced
  // per page: contacts-backend mints ONE token for the whole NC surface, so a
  // grant to any of them is what unlocks elevation. The levels below decide
  // what the console SHOWS, not what its API refuses.
  {
    key: "nc_users",
    label: "NC · Users",
    group: "networkchains",
    href: "/garage-admin/networkchains/users",
  },
  {
    key: "nc_earngpt",
    label: "NC · EarnGPT",
    group: "networkchains",
    href: "/garage-admin/networkchains/earngpt-learning",
  },
  {
    key: "nc_offerings",
    label: "NC · Offerings",
    group: "networkchains",
    href: "/garage-admin/networkchains/offerings",
  },
  {
    key: "nc_axons",
    label: "NC · Aixons",
    group: "networkchains",
    href: "/garage-admin/networkchains/axons",
  },
  {
    key: "nc_catchup",
    label: "NC · Catch Up",
    group: "networkchains",
    href: "/garage-admin/networkchains/meet",
  },
  {
    key: "nc_live_calls",
    label: "NC · Live Calls",
    group: "networkchains",
    href: "/garage-admin/networkchains/meet/live",
  },
  {
    key: "nc_subscriptions",
    label: "NC · Revenue",
    group: "networkchains",
    href: "/garage-admin/networkchains/subscriptions",
  },
  {
    key: "nc_funnels",
    label: "NC · Funnels",
    group: "networkchains",
    manageHint: "Edit the funnel library every affiliate adopts",
    href: "/garage-admin/networkchains/funnels",
  },
  {
    key: "nc_ai_cost",
    label: "NC · AI Cost",
    group: "networkchains",
    href: "/garage-admin/networkchains/ai-cost",
  },
  {
    key: "nc_sentry",
    label: "NC · Sentry",
    group: "networkchains",
    href: "/garage-admin/networkchains/sentry",
  },
  {
    key: "nc_posthog",
    label: "NC · Replays",
    group: "networkchains",
    href: "/garage-admin/networkchains/posthog",
  },
  {
    key: "support_tickets",
    label: "Support Tickets",
    group: "others",
    href: "/garage-admin/tickets",
    manageHint: "Reply and change ticket status",
    actions: [
      {
        key: "reply-ticket",
        label: "Reply to tickets",
        hint: "Post an admin reply on a ticket",
      },
      {
        key: "set-status",
        label: "Change status",
        hint: "Move a ticket through its statuses",
      },
    ],
  },
  {
    key: "support_chats",
    label: "Support Chats",
    group: "others",
    href: "/garage-admin/support-chats",
    manageHint: "Reply, tag, delete messages and add Taskroom tasks",
  },
  // Live login codes. Reading one is enough to log in as that user, so these
  // are read-only switches (off for everyone by default), every view is logged
  // (otp_code_access_logs), and codes for admin accounts are hidden from
  // everyone but super admins. Guarded per route in routes/auth.ts.
  {
    key: "otp_codes",
    label: "OTP Codes",
    group: "others",
    href: "/garage-admin/otp-codes",
  },
  {
    key: "phone_otp_codes",
    label: "Phone OTPs",
    group: "others",
    href: "/garage-admin/phone-otp-codes",
  },
  {
    key: "ai_providers",
    label: "Ai Providers",
    group: "others",
    href: "/garage-admin/ai-providers",
    manageHint: "Add and delete provider API keys",
    actions: [
      { key: "add-key", label: "Add key", hint: "Save a provider API key" },
      {
        key: "delete-key",
        label: "Delete key",
        hint: "Remove a provider API key",
      },
    ],
  },
  {
    key: "coworking_spaces",
    label: "Coworking Spaces",
    group: "others",
    href: "/garage-admin/coworking-spaces",
    manageHint: "Writes stay super-admin only",
  },
  {
    key: "coworking_bookings",
    label: "Coworking Bookings",
    group: "others",
    manageHint: "Approve or reject booking requests",
  },
  {
    key: "admin_notifications",
    label: "Notifications",
    group: "others",
    href: "/garage-admin/notifications",
    // `view` is genuinely useful on its own: reading which rules exist and
    // what they would mail is an audit question, separate from authoring one.
    manageHint: "Create rules and turn them on — an enabled rule sends real email",
  },
  // Not listed: /garage-admin/third-party-clients. Despite the URL it is a
  // FOUNDER surface (requireAuth + requireFounder), not a garage-admin one,
  // so it's bypassed by the gate rather than given a page key — see
  // GATE_BYPASS_PATTERNS.
];

export const ADMIN_PAGE_KEYS = ADMIN_PAGES.map((p) => p.key);

/**
 * Every valid "<pageKey>:<actionKey>" grant key, flattened from the pages that
 * declare actions. Used to keep unknown/garbage action keys out of a stored
 * permission map, the same way ADMIN_PAGE_KEYS does for page keys.
 */
export const ADMIN_ACTION_KEYS = ADMIN_PAGES.flatMap((p) =>
  (p.actions ?? []).map((a) => actionKey(p.key, a.key))
);

export function isAdminPageKey(value: unknown): boolean {
  return typeof value === "string" && ADMIN_PAGE_KEYS.includes(value);
}

export function isAdminActionKey(value: unknown): boolean {
  return typeof value === "string" && ADMIN_ACTION_KEYS.includes(value);
}

export function isAdminPageLevel(value: unknown): value is AdminPageLevel {
  return (
    typeof value === "string" &&
    (ADMIN_PAGE_LEVELS as readonly string[]).includes(value)
  );
}

/** All pages off. Always build fresh — never share a mutable literal. */
export function emptyPagePermissions(): Record<string, AdminPageLevel> {
  return Object.fromEntries(ADMIN_PAGE_KEYS.map((k) => [k, "none"])) as Record<
    string,
    AdminPageLevel
  >;
}

/**
 * `.lean()` reads skip sub-schema defaults and yield undefined, and old
 * rows predate any given page key. Always read a permission map through
 * this, never straight off the document.
 */
export function normalizePagePermissions(
  raw: unknown
): Record<string, AdminPageLevel> {
  const out = emptyPagePermissions();
  if (!raw || typeof raw !== "object") return out;
  for (const key of ADMIN_PAGE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (isAdminPageLevel(value)) out[key] = value;
  }
  // Per-action grants ("<page>:<action>"). Only carried when actually granted
  // (a missing key reads as "none"), so the map isn't padded with every
  // action for every admin. Page-level manage is the superset at check time,
  // so an action key is only meaningful alongside a page level below manage.
  for (const key of ADMIN_ACTION_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (isAdminPageLevel(value) && value !== "none") out[key] = value;
  }
  return out;
}

/** Keeps unknown/garbage keys out of what a super admin submits. */
export function sanitizePagePermissions(
  raw: unknown
): Record<string, AdminPageLevel> {
  return normalizePagePermissions(raw);
}

/**
 * What a garage-admin row that predates this feature is worth.
 *
 * Every admin who existed before page-RBAC shipped got the same five
 * read-only surfaces from the old non-super-admin sidebar (All
 * Organizations, Founders, Stakeholders, All Users, Unilevel Plus
 * Licenses). Reading an unset permission map as "all none" would log every
 * one of them into an empty console, so unset means *this*, not nothing.
 *
 * Kept as its own constant rather than pointing at the "garage-admin"
 * preset so that editing that preset later can't silently re-interpret
 * history.
 */
export const LEGACY_ADMIN_PERMISSIONS: Record<string, AdminPageLevel> = {
  ...emptyPagePermissions(),
  users: "view",
  founders: "view",
  stakeholders: "view",
  organizations: "view",
  unilevel_plus_licenses: "view",
  // Every admin worked the support chats before it became a grantable page;
  // admins still on the legacy map keep that.
  support_chats: "manage",
  // NC is deliberately absent — emptyPagePermissions() already makes every
  // nc_* key "none". A pre-RBAC admin row must not silently acquire the
  // NetworkChains console just because it was added to the catalogue; it has
  // to be granted on purpose.
};

/**
 * The one function that should decide what an admin actually holds.
 *
 * `wasSet` is GarageAdmin.pagePermissionsSet — false on every row written
 * before this feature, true the moment a super admin saves a map. The flag
 * exists because the map alone can't answer the question: mongoose fills
 * the sub-document's defaults in on hydration, so a legacy row and a row
 * deliberately set to all-"none" both read as all-"none".
 */
export function resolvePagePermissions(
  raw: unknown,
  wasSet: unknown
): Record<string, AdminPageLevel> {
  if (!wasSet) return { ...LEGACY_ADMIN_PERMISSIONS };
  return normalizePagePermissions(raw);
}

export function levelSatisfies(
  held: AdminPageLevel,
  required: AdminPageLevel
): boolean {
  if (required === "none") return true;
  if (required === "view") return held === "view" || held === "manage";
  return held === "manage";
}

/**
 * The one place the page/action rule is decided, so the gate, the per-route
 * guards and (mirrored) the frontend all agree:
 *
 *   - A READ (level "view") depends only on page view — actions are writes.
 *   - A WRITE (level "manage") passes on page-level manage (the superset)
 *     OR, when the route names an `action`, on that specific action grant.
 *
 * Satisfied by ANY of the candidate `pages` (shared routes list more than one).
 */
export function permissionsSatisfy(
  permissions: Record<string, AdminPageLevel>,
  pages: string[],
  level: AdminPageLevel,
  action?: string
): boolean {
  if (level !== "manage") {
    return pages.some((p) => levelSatisfies(permissions[p] || "none", level));
  }
  return pages.some(
    (p) =>
      levelSatisfies(permissions[p] || "none", "manage") ||
      (action != null &&
        levelSatisfies(permissions[actionKey(p, action)] || "none", "manage"))
  );
}

/** GET/HEAD is a read, everything else is a write. */
export function levelForMethod(method: string): AdminPageLevel {
  const m = (method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS" ? "view" : "manage";
}

// ── Path resolution ────────────────────────────────────────────────────

/** Unauthenticated by design — the login handshake itself. */
export const PUBLIC_ADMIN_PATHS = [
  "/garage-admin/login",
  "/garage-admin/request-otp",
  "/garage-admin/ensure-admin",
];

/**
 * Reachable by any authenticated admin regardless of permissions. Kept
 * deliberately tiny: an admin's own profile (the FE needs it to render
 * anything at all), the page catalogue, and the shared upload helper
 * that several managed pages post to.
 */
/**
 * Subtrees that sit under a gated prefix but are NOT garage-admin surfaces
 * — they authenticate a regular user or founder through
 * middleware/auth.ts. The gate steps aside entirely; each router's own
 * middleware still applies.
 *
 * Without this, a founder opening Third Party Clients (or a member loading
 * the public coworking list) would get 401 "Admin not found" — their token
 * is a user token, and the gate only understands admin ones.
 */
export const GATE_BYPASS_PATTERNS: RegExp[] = [
  // requireAuth + requireFounder (routes/thirdPartyAdmin.ts)
  /^\/garage-admin\/third-party-clients(\/|$)/,
  // requireAuth — the member-facing coworking listing that happens to live
  // under the admin router (routes/coworkingSpace.ts).
  /^\/garage-admin\/coworking-spaces\/public(\/|$)/,
];

/**
 * Prefixes any authenticated admin may reach, for route families too large
 * to list path by path in ALWAYS_ALLOWED_ADMIN_PATHS.
 *
 * (Support Chats used to live here — every admin could use them. It is now
 * the grantable `support_chats` page so a super admin decides who works the
 * chats; see ADMIN_PATH_RULES.)
 */
export const ALWAYS_ALLOWED_ADMIN_PATTERNS: RegExp[] = [];

export const ALWAYS_ALLOWED_ADMIN_PATHS = [
  "/garage-admin/profile",
  "/garage-admin/admin-pages",
  "/garage-admin/upload",
  // The Support Agent dashboard — inherently self-scoped (an admin only ever
  // sees the affiliates assigned to THEM), so any authenticated admin may read
  // it without holding a delegatable page.
  "/garage-admin/support/my-assignments",
];

/**
 * Endpoints that sit inside a mapped page's prefix but must stay super
 * admin only. Evaluated before ADMIN_PATH_RULES, so they win.
 *
 * Every one of these is also guarded by requireGarageSuperAdmin inside its
 * own router — this list is the belt to that pair of braces, and the thing
 * a reader can scan to see the boundary in one place.
 */
export const SUPER_ONLY_PATTERNS: { test: RegExp; methods?: string[] }[] = [
  // Admin management + the permission system itself. Granting either would
  // let a delegated admin promote themselves.
  { test: /^\/garage-admin\/invite$/ },
  { test: /^\/garage-admin\/admins(\/|$)/ },
  { test: /^\/garage-admin\/admin-roles(\/|$)/ },
  // Danger zone.
  { test: /^\/garage-admin\/users\/[^/]+\/delete-preview$/ },
  { test: /^\/garage-admin\/users\/[^/]+$/, methods: ["DELETE"] },
  { test: /^\/garage-admin\/users\/[^/]+\/complete-profile$/ },
  { test: /^\/garage-admin\/organizations\/[^/]+\/delete-preview$/ },
  { test: /^\/garage-admin\/organizations\/[^/]+$/, methods: ["DELETE"] },
  // Assigning an org to an admin is an access-control act.
  { test: /^\/garage-admin\/organizations\/[^/]+\/assign-admin$/ },
  // Stored payment methods — charging and refunding real cards.
  { test: /^\/garage-admin\/users\/[^/]+\/saved-cards(\/|$)/ },
  { test: /^\/garage-admin\/orgs(\/|$)/ },
  // Money out.
  { test: /^\/garage-admin\/withdrawals(\/|$)/ },
  // Payout instructions users set — read alongside the withdrawal queue.
  { test: /^\/garage-admin\/withdrawal-preferences(\/|$)/ },
  { test: /^\/garage-admin\/user-wallets(\/|$)/ },
  { test: /^\/garage-admin\/wallets(\/|$)/ },
  { test: /^\/garage-admin\/platform-fee-overrides(\/|$)/ },
  { test: /^\/garage-admin\/rank-bonus(\/|$)/ },
  { test: /^\/garage-admin\/auction-settlements(\/|$)/ },
  // NOTE: assigning a support agent (/networkchain-subs/:id/assign-agent and
  // /users/:id/assign-agent) is NO LONGER super-only. It is now grantable via
  // manage on One Time Affiliates or NetworkChain Subs — see the multi-page
  // rules in ADMIN_PATH_RULES.
  // (Live OTP codes used to be listed here as never grantable. They are now
  // the otp_codes / phone_otp_codes pages — view-only, logged, admin accounts'
  // codes hidden — guarded per route in routes/auth.ts.)
];

/**
 * path prefix → page key(s). First match wins, so order matters: put the
 * more specific prefix above the broader one.
 *
 * `page` may be a single key or a list. A list means "satisfied by the
 * required level on ANY of these pages" — used for write actions a person
 * can legitimately reach from more than one page. The gate can't tell which
 * table the request came from (the URL is identical), so holding manage on
 * either page is enough.
 *
 * `action` (optional) narrows a WRITE route to one independently-grantable
 * action on the page (see AdminPage.actions). When set, the gate passes if
 * the admin holds that action grant OR page-level manage (the superset). A
 * GET on such a route still resolves to plain page-view. Rules with an
 * `action` must precede the broad page rule they refine.
 */
export const ADMIN_PATH_RULES: {
  test: RegExp;
  page: string | string[];
  action?: string;
  /** Restrict this rule to these HTTP methods — used to give the same path a
   *  different action per verb (PATCH /:id = edit vs DELETE /:id = delete). */
  methods?: string[];
}[] = [
  // ── Shared cross-page user actions (must precede the broad /users rule) ──
  // Assigning a support agent and marking the NVC chat both live on the
  // User (assignedSupportAgentId / nvcChatCreatedAt), so the SAME action is
  // performed from both One Time Affiliates and NetworkChain Subs. Manage on
  // either page (or the matching action grant) authorises it. Listed here,
  // above `/garage-admin/users`, so these win over the generic `users` page.
  {
    test: /^\/garage-admin\/users\/[^/]+\/assign-agent$/,
    page: ["one_time_affiliates", "networkchain_subs"],
    action: "assign-agent",
  },
  {
    test: /^\/garage-admin\/networkchain-subs\/[^/]+\/assign-agent$/,
    page: ["one_time_affiliates", "networkchain_subs"],
    action: "assign-agent",
  },
  {
    test: /^\/garage-admin\/users\/[^/]+\/nvc-chat$/,
    page: ["one_time_affiliates", "networkchain_subs"],
    action: "mark-nvc",
  },
  // Per-action Users writes (also above the broad /users rule).
  {
    test: /^\/garage-admin\/users\/[^/]+\/extend-offer$/,
    page: "users",
    action: "extend-offer",
  },
  {
    test: /^\/garage-admin\/users\/[^/]+\/move-upline$/,
    page: "users",
    action: "move-upline",
  },
  // The assign picker's admin list — a lean read (GET → view), grantable to
  // the same managers so they can choose whom to assign without holding the
  // super-admin-only Admins page.
  {
    test: /^\/garage-admin\/assignable-agents(\/|$)/,
    page: ["one_time_affiliates", "networkchain_subs"],
  },

  // Citizens
  { test: /^\/garage-admin\/founders(\/|$)/, page: "founders" },
  { test: /^\/garage-admin\/stakeholders(\/|$)/, page: "stakeholders" },
  {
    test: /^\/garage-admin\/unilevel-plus-license-holders(\/|$)/,
    page: "unilevel_plus_licenses",
  },
  {
    test: /^\/garage-admin\/one-time-affiliates(\/|$)/,
    page: "one_time_affiliates",
  },
  {
    test: /^\/garage-admin\/affiliate-guests(\/|$)/,
    page: "affiliate_guests",
  },
  {
    test: /^\/garage-admin\/networkchain-subs(\/|$)/,
    page: "networkchain_subs",
  },
  // Categories — DELETE is its own action; POST/PATCH are edit.
  {
    test: /^\/garage-admin\/categories\/[^/]+$/,
    methods: ["DELETE"],
    page: "categories",
    action: "delete-category",
  },
  {
    test: /^\/garage-admin\/categories(\/|$)/,
    page: "categories",
    action: "edit-categories",
  },
  // Office KYC has its own console page (/garage-admin/kyc). Reading the
  // queue is view; requesting documents, approving, verifying and sending
  // back are manage. Holding "organizations" does NOT grant it — identity
  // documents are a narrower thing to hand out than an org listing.
  { test: /^\/garage-admin\/org-kyc(\/|$)/, page: "org_kyc" },
  { test: /^\/garage-admin\/organizations(\/|$)/, page: "organizations" },
  { test: /^\/garage-admin\/users(\/|$)/, page: "users" },

  // Money
  {
    test: /^\/garage-admin\/cryptobrand-offices(\/|$)/,
    page: "store_wallets",
  },
  { test: /^\/garage-admin\/store-wallets(\/|$)/, page: "store_wallets" },
  {
    test: /^\/garage-admin\/founder-sub-monthly-bonus(\/|$)/,
    page: "founder_sub_bonus",
  },
  {
    test: /^\/garage-admin\/cryptosub-monthly-bonus(\/|$)/,
    page: "cryptosub_bonus",
  },
  {
    test: /^\/garage-admin\/whitelabel-monthly-bonus(\/|$)/,
    page: "whitelabel_bonus",
  },
  { test: /^\/whitelabel-addon\/admin(\/|$)/, page: "addon_renewals" },
  { test: /^\/cryptosub-addon\/admin(\/|$)/, page: "addon_renewals" },
  { test: /^\/garage-admin\/daily-reports(\/|$)/, page: "daily_reports" },

  // GaragePay — per-action Platform Coupons writes (before the page rule).
  {
    test: /^\/garage-admin\/platform-coupons\/[^/]+\/(de)?activate$/,
    page: "platform_coupons",
    action: "toggle-active",
  },
  {
    test: /^\/garage-admin\/platform-coupons\/[^/]+\/assignments$/,
    page: "platform_coupons",
    action: "manage-assignments",
  },
  {
    test: /^\/garage-admin\/platform-coupons\/assignments\/[^/]+$/,
    page: "platform_coupons",
    action: "manage-assignments",
  },
  {
    test: /^\/garage-admin\/platform-coupons\/[^/]+$/,
    page: "platform_coupons",
    action: "edit-coupon",
  },
  {
    test: /^\/garage-admin\/platform-coupons$/,
    page: "platform_coupons",
    action: "edit-coupon",
  },
  {
    test: /^\/garage-admin\/platform-coupons(\/|$)/,
    page: "platform_coupons",
  },
  // Coupon rules — DELETE vs create/edit.
  {
    test: /^\/garage-admin\/coupon-rules\/[^/]+$/,
    methods: ["DELETE"],
    page: "coupon_rules",
    action: "delete-rule",
  },
  {
    test: /^\/garage-admin\/coupon-rules(\/|$)/,
    page: "coupon_rules",
    action: "edit-rules",
  },
  {
    test: /^\/garage-admin\/coupon-rule-items(\/|$)/,
    page: "coupon_rules",
    action: "edit-rules",
  },
  // Garage coupons — DELETE vs create/edit.
  {
    test: /^\/garage-admin\/coupons\/[^/]+$/,
    methods: ["DELETE"],
    page: "garage_coupons",
    action: "delete-coupon",
  },
  {
    test: /^\/garage-admin\/coupons(\/|$)/,
    page: "garage_coupons",
    action: "edit-coupons",
  },

  // Others — Support Chats. The console also reads/changes the board support
  // tasks go to, which lives under /tickets/support-board; it is reachable from
  // either page (the PUT is additionally super-admin-only in its router). Must
  // precede the /tickets/:id set-status rule, which would otherwise claim it.
  { test: /^\/garage-admin\/support-chats(\/|$)/, page: "support_chats" },
  {
    test: /^\/garage-admin\/tickets\/support-board(\/|$)/,
    page: ["support_chats", "support_tickets"],
  },
  // Others — per-action Support Tickets writes (before the page rule).
  {
    test: /^\/garage-admin\/tickets\/[^/]+\/messages$/,
    page: "support_tickets",
    action: "reply-ticket",
  },
  {
    test: /^\/garage-admin\/tickets\/[^/]+$/,
    page: "support_tickets",
    action: "set-status",
  },
  { test: /^\/garage-admin\/tickets(\/|$)/, page: "support_tickets" },
  // AI providers — add a key (POST /keys) vs delete one (DELETE /keys/:id).
  {
    test: /^\/ai-providers\/keys\/[^/]+$/,
    page: "ai_providers",
    action: "delete-key",
  },
  {
    test: /^\/ai-providers\/keys$/,
    page: "ai_providers",
    action: "add-key",
  },
  { test: /^\/ai-providers(\/|$)/, page: "ai_providers" },
  {
    test: /^\/garage-admin\/coworking-spaces(\/|$)/,
    page: "coworking_spaces",
  },
  {
    test: /^\/coworking-bookings\/admin(\/|$)/,
    page: "coworking_bookings",
  },
  // Admin notification rules. Without this the gate's deny-by-default would
  // resolve every endpoint here to super-admin only, and the page would be
  // ungrantable through the roles UI.
  {
    test: /^\/garage-admin\/notifications(\/|$)/,
    page: "admin_notifications",
  },
  // NetworkChains. The console itself talks to contacts-backend, not here —
  // this is the one garagenew endpoint an NC page needs. Deny-by-default
  // would otherwise resolve it super-only and break the funnel editor for
  // exactly the admins the nc_funnels grant is meant to admit. GET-only
  // resolver, no ids accepted, so "view" is the right level.
  {
    test: /^\/garage-admin\/library-affiliate$/,
    page: "nc_funnels",
  },
];

export type AdminPathVerdict =
  | { kind: "public" }
  | { kind: "any-admin" }
  | { kind: "super-only" }
  // `pages` is satisfied by the required level on ANY listed page (usually
  // just one). `action`, when present, names the independently-grantable
  // write this route maps to: a WRITE (level "manage") then passes on either
  // page-manage or that action grant; a read (level "view") ignores it and
  // needs only page view. See the notes on ADMIN_PATH_RULES.
  | {
      kind: "page";
      pages: string[];
      level: AdminPageLevel;
      action?: string;
    };

/**
 * Deny-by-default: a path that matches no page rule comes back
 * "super-only". New admin routes are therefore locked to super admins
 * until someone maps them here on purpose.
 */
export function resolveAdminPath(
  path: string,
  method: string
): AdminPathVerdict {
  const clean = (path || "/").split("?")[0].replace(/\/+$/, "") || "/";

  if (PUBLIC_ADMIN_PATHS.includes(clean)) return { kind: "public" };
  if (GATE_BYPASS_PATTERNS.some((rx) => rx.test(clean)))
    return { kind: "public" };
  if (ALWAYS_ALLOWED_ADMIN_PATHS.includes(clean)) return { kind: "any-admin" };
  if (ALWAYS_ALLOWED_ADMIN_PATTERNS.some((rx) => rx.test(clean)))
    return { kind: "any-admin" };

  const upper = (method || "GET").toUpperCase();
  for (const rule of SUPER_ONLY_PATTERNS) {
    if (!rule.test.test(clean)) continue;
    if (rule.methods && !rule.methods.includes(upper)) continue;
    return { kind: "super-only" };
  }

  for (const rule of ADMIN_PATH_RULES) {
    if (!rule.test.test(clean)) continue;
    // A method-scoped rule only applies to its verbs; otherwise fall through
    // to the next matching rule (e.g. DELETE /:id → delete action, while
    // PATCH /:id keeps matching the broader edit rule below it).
    if (rule.methods && !rule.methods.includes(upper)) continue;
    const pages = Array.isArray(rule.page) ? rule.page : [rule.page];
    return {
      kind: "page",
      pages,
      level: levelForMethod(upper),
      action: rule.action,
    };
  }

  return { kind: "super-only" };
}

// ── Presets ────────────────────────────────────────────────────────────
// Starting points the invite dialog offers. A preset is a code constant,
// not a database row — picking one stamps its levels onto the admin, and
// the super admin can tweak from there before sending.

export type AdminRolePreset = {
  id: string;
  role: string;
  description: string;
  permissions: Record<string, AdminPageLevel>;
};

function preset(
  overrides: Record<string, AdminPageLevel>
): Record<string, AdminPageLevel> {
  return { ...emptyPagePermissions(), ...overrides };
}


export const ADMIN_ROLE_PRESETS: AdminRolePreset[] = [
  {
    id: "garage-admin",
    role: "Admin",
    description:
      "The classic garage admin — read access to citizens data, nothing else.",
    permissions: preset({
      users: "view",
      founders: "view",
      stakeholders: "view",
      organizations: "view",
      unilevel_plus_licenses: "view",
    }),
  },
  {
    id: "support-agent",
    role: "Support Agent",
    description: "Works the ticket queue, can look up who they're helping.",
    permissions: preset({
      support_tickets: "manage",
      users: "view",
      organizations: "view",
    }),
  },
  {
    id: "finance",
    role: "Finance",
    description: "Runs coupons and reads wallet balances. No payouts.",
    permissions: preset({
      platform_coupons: "manage",
      garage_coupons: "manage",
      coupon_rules: "manage",
      store_wallets: "view",
      organizations: "view",
      daily_reports: "view",
    }),
  },
  {
    id: "read-only",
    role: "Read Only",
    description: "Sees every delegatable page, can change nothing.",
    permissions: preset(
      Object.fromEntries(ADMIN_PAGE_KEYS.map((k) => [k, "view"])) as Record<
        string,
        AdminPageLevel
      >
    ),
  },
];

/** Role names a super admin may not type — they mean something already. */
export const RESERVED_ROLE_NAMES = ["garage-super-admin", "super admin"];

export function isReservedRoleName(role: string): boolean {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();
  return RESERVED_ROLE_NAMES.includes(normalized);
}

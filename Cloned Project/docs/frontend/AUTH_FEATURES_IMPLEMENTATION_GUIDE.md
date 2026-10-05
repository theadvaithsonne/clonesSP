# Implementation Guide: Multi-Login, Affiliate Carry-Over, Email-or-Phone Login, and the Complete-Profile Prompt

A port-it-yourself guide to four features that ship in Garage HQ
(`garage-web-app-nextjs-v1` + `garagenew-backend`). Each section is written so
another app's developer can implement the same behaviour without reading this
codebase: the contract first, then the code, then the mistakes that were
actually made getting there.

The reference implementation is Next.js (App Router) + Express/Mongo, but only
Section 2's store-bounce is platform-specific. Everything else is ordinary
client-side state plus two HTTP endpoints.

**Contents**

- [0. Shared foundations](#0-shared-foundations)
- [1. Multi-login (several accounts, one browser)](#1-multi-login-several-accounts-one-browser)
- [2. Affiliate ID carry-over from a link into the mobile app](#2-affiliate-id-carry-over-from-a-link-into-the-mobile-app)
- [3. Email **or** phone number in one login field](#3-email-or-phone-number-in-one-login-field)
- [4. Complete-profile popup after registration](#4-complete-profile-popup-after-registration)
- [5. Build order, and a checklist](#5-build-order-and-a-checklist)

---

## 0. Shared foundations

All four features assume this much. If your app differs, the mapping is
mechanical — but read this section first, because the rest of the document
refers back to it.

### 0.1 One session, in known keys

```
localStorage["garage_tok"]     JWT for the live session
localStorage["garage_org_id"]  the active organization/tenant, if you have tenants
cookie      "auth-token"       same JWT, for server-rendered routes / API routes
```

Every consumer reads the token through **one** accessor. This is the single
most important precondition in the document — Section 1 works by swapping what
that accessor returns, and it can only do that if nothing bypasses it.

`lib/auth.ts`:

```ts
const KEY = "garage_tok";
const ORG_KEY = "garage_org_id";

export function saveToken(t: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, t);
  window.dispatchEvent(new CustomEvent("garage:token-change"));
}

export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(ORG_KEY);
  window.dispatchEvent(new CustomEvent("garage:logout"));
}
```

### 0.2 A JWT that carries identity

The token payload holds `userId`, and ideally `name`, `email`, `orgId`, `exp`.
Section 1 renders its account switcher straight from these claims, so a row can
appear without a network round-trip. If your JWT is opaque, you must store the
display fields alongside it instead — the ledger row in §1.3 already has slots
for them.

### 0.3 A passwordless OTP login

```
POST /auth/request-otp   { email }            -> { ok: true }
POST /auth/verify-otp    { email, code,
                           referralCode? }    -> { token, user: {...} }
```

The field is named `email` and carries **either** an email address or an E.164
phone number (Section 3). Keeping the wire name is deliberate: six independent
clients post it, and renaming it would have been a coordinated release.

### 0.4 A thin fetch wrapper that attaches the token

```ts
export async function api<T>(path: string, opts: RequestInit = {}, token?: string): Promise<T> {
  const auth = token ?? getToken() ?? undefined;
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(opts.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Server error (${res.status})`);
  return res.json();
}
```

---

## 1. Multi-login (several accounts, one browser)

**What the user gets:** a Gmail-style switcher. Sign in as more than one
person, move between them from the profile menu, and sign out of one without
signing out of the others.

### 1.1 The central idea

Do **not** teach your app that several sessions exist. That is a rewrite: every
cache, socket, store and server component would need an account dimension.

Instead:

> The existing session keys stay **THE ACTIVE SESSION**. A ledger of other
> accounts sits beside them. Switching = copy the chosen row into the session
> keys, then hard-navigate so the whole app rehydrates as that account.

Nothing else in the app has to know other accounts exist. In Garage HQ this
made multi-account a ~350-line change to a 200k-line app.

```
localStorage["garage_accounts"]         the ledger (array of StoredAccount)
localStorage["garage_tok"]              ← whichever row is active
sessionStorage["garage_adding_account"] per-tab "I am adding an account" flag
```

### 1.2 Why a *hard* navigation

`window.location.assign()`, never `router.push()`. On a SPA push, the outgoing
user's WebSocket, React Query cache, Zustand stores, in-flight requests and
server-rendered payloads all survive. A reload is the only way to be sure none
of it does. It costs one page load, on an action the user takes rarely.

### 1.3 The ledger — `lib/accounts.ts`

```ts
const REGISTRY_KEY = "garage_accounts";
const ADDING_KEY = "garage_adding_account"; // sessionStorage — per tab
const TOKEN_KEY = "garage_tok";             // duplicated from lib/auth to avoid an import cycle
const ORG_KEY = "garage_org_id";

export interface StoredAccount {
  userId: string;
  token: string;
  orgId: string | null;
  name?: string;          // shown in the switcher, so a row renders without a fetch
  email?: string;
  profilePicture?: string;
  lastUsedAt: number;     // most-recently-used first, like every account switcher
}

/** Minimal JWT payload decode — no verification; the server verifies. */
function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(
      atob(base64).split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    ));
  } catch { return null; }
}
```

**Expiry is a first-class question.** A ledger row outlives its token — nothing
prunes it when the JWT lapses — so "signed in" and "usable" stop being the same
thing the moment a second account exists.

```ts
export function isAccountExpired(a: StoredAccount, toleranceSeconds = 0): boolean {
  const exp = parseJwt(a.token)?.exp;
  if (typeof exp !== "number") return true;   // unparseable or no exp == unusable
  return Math.floor(Date.now() / 1000) >= exp - toleranceSeconds;
}
```

Reads and writes both swallow their errors. A corrupt or quota-full ledger must
never lock anyone out — worst case the switcher is empty and the live session
still works, because the live session lives in its own keys:

```ts
function readRegistry(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(REGISTRY_KEY) || "[]");
    return Array.isArray(arr) ? arr.filter((a) => a?.userId && a?.token) : [];
  } catch { return []; }
}

function writeRegistry(accounts: StoredAccount[]): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(accounts)); } catch {}
}

export function listAccounts(): StoredAccount[] {
  return [...readRegistry()].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
}
```

Recording an account. Note the `??` chain — never blank out a name you already
have with an `undefined` from a partial payload, or the switcher renders a row
that is a mystery to whoever reads it:

```ts
export function rememberAccount(params: {
  token: string; orgId?: string | null;
  name?: string; email?: string; profilePicture?: string;
}): StoredAccount[] {
  if (typeof window === "undefined" || !params.token) return listAccounts();
  const claims = parseJwt(params.token) || {};
  const userId = (claims.userId as string) || "";
  if (!userId) return listAccounts();

  const accounts = readRegistry();
  const existing = accounts.find((a) => a.userId === userId);
  const row: StoredAccount = {
    userId,
    token: params.token,
    orgId: params.orgId ?? (claims.orgId as string) ?? existing?.orgId ?? null,
    name: params.name ?? (claims.name as string) ?? existing?.name,
    email: params.email ?? (claims.email as string) ?? existing?.email,
    profilePicture: params.profilePicture ?? existing?.profilePicture,
    lastUsedAt: Date.now(),
  };
  writeRegistry([row, ...accounts.filter((a) => a.userId !== userId)]);
  return listAccounts();
}
```

Activating a row. **Return `null` rather than throwing, and check before you
tear anything down** — a failed switch that has already cleared the session
leaves the user signed out of everything:

```ts
export function activateAccount(userId: string): StoredAccount | null {
  const target = readRegistry().find((a) => a.userId === userId) ?? null;
  if (!target) return null;
  if (isAccountExpired(target)) { forgetAccount(userId); return null; }  // drop, don't activate
  localStorage.setItem(TOKEN_KEY, target.token);
  if (target.orgId) localStorage.setItem(ORG_KEY, target.orgId);
  else localStorage.removeItem(ORG_KEY);
  writeRegistry(readRegistry().map((a) =>
    a.userId === userId ? { ...a, lastUsedAt: Date.now() } : a));
  return target;
}

export function forgetAccount(userId: string): StoredAccount[] {
  writeRegistry(readRegistry().filter((a) => a.userId !== userId));
  return listAccounts();
}

/** The freshest remembered account that still works. Walking the list retires
 *  dead rows as a side effect, since activateAccount drops a lapsed one. */
export function activateNextUsableAccount(): StoredAccount | null {
  for (const c of listAccounts()) {
    const activated = activateAccount(c.userId);
    if (activated) return activated;
  }
  return null;
}
```

**Backfill for existing users.** Everyone already signed in when you ship this
has no ledger row. Seed one on first render of the switcher — idempotent, and a
no-op once they have a row:

```ts
export function seedFromLiveSession(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return listAccounts();
  const userId = (parseJwt(token)?.userId as string) || "";
  if (!userId || readRegistry().some((a) => a.userId === userId)) return listAccounts();
  return rememberAccount({ token, orgId: localStorage.getItem(ORG_KEY) });
}
```

### 1.4 Hook the ledger into the one choke point

Do **not** call `rememberAccount()` from each login screen — you will miss one.
Call it from `saveToken()`, which every sign-in path already goes through,
including the very first one:

```ts
// lib/auth.ts
export function saveToken(t: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, t);
  rememberAccount({ token: t, orgId: localStorage.getItem(ORG_KEY) });
  window.dispatchEvent(new CustomEvent("garage:token-change"));
}

export function saveOrgId(orgId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORG_KEY, orgId);
  // The row is what a later switch restores from, so it must carry the org the
  // user is actually in — otherwise switching away and back silently returns
  // them to whichever org they first signed into.
  const tok = localStorage.getItem(KEY);
  if (tok) rememberAccount({ token: tok, orgId });
}

export function clearToken() {
  if (typeof window === "undefined") return;
  const userId = getUserIdFromToken();
  localStorage.removeItem(KEY);
  localStorage.removeItem(ORG_KEY);
  if (userId) forgetAccount(userId);   // a session just signed out of must not stay on offer
  window.dispatchEvent(new CustomEvent("garage:logout"));
}
```

### 1.5 Adopting an account into app state — `lib/account-session.ts`

The ledger owns the session keys. This second module owns everything *else* the
app believes about who is signed in: the persisted user store and the cookies.
It is kept separate from `lib/auth` so that module — imported by the API
wrapper, and so by nearly everything — does not pull the store in behind it.

```ts
function adoptAccount(account: StoredAccount) {
  const user: Partial<User> = {
    userId: account.userId,
    email: account.email || "",
    name: account.name || "",
    organizationId: account.orgId || "",
    // Deliberately reset, not carried: role, impersonation fields, phone…
    // `setUser` MERGES onto the current user, so anything left unset here
    // silently keeps the previous account's value.
    role: "", phone: null, phoneVerified: undefined,
    originalUserId: undefined, impersonatedUserId: undefined, /* … */
  };
  useAuthStore.getState().setUser(null);   // clear first, so the merge can't carry a stale field
  useAuthStore.getState().setUser(user);
  Cookies.set("auth-token", account.token, { path: "/", secure: true, sameSite: "none", expires: 7 });
}

export function switchToAccount(userId: string, landing = "/workspace"): boolean {
  const activated = activateAccount(userId);
  if (!activated) return false;      // nothing torn down — caller should say so, not navigate
  adoptAccount(activated);
  sessionStorage.clear();            // per-tab flags belong to whoever set them
  window.location.assign(landing);
  return true;
}

/** Sign out of the account on screen, handing over to another if there is one. */
export function signOutActiveAccount(landing = "/"): void {
  const next = activateNextUsableAccount();   // clearToken() already dropped the outgoing row
  if (next) {
    adoptAccount(next);
    sessionStorage.clear();
    window.location.assign(landing);
    return;
  }
  useAuthStore.getState().setUser(null);
  Cookies.remove("auth-token", { path: "/" });
  Cookies.remove("user-data", { path: "/" });
  window.location.assign(landing);
}

export function signOutAllAccounts(landing = "/"): void {
  for (const a of listAccounts()) forgetAccount(a.userId);
  /* …then forgetLiveIdentity + navigate… */
}
```

> **This is the bug that will bite you.** A persisted store whose `setUser`
> merges will leak the outgoing account's `role` into the incoming one — a
> stakeholder switching to their founder account, or the reverse, with the
> wrong permissions. Enumerate every identity field explicitly and reset it.

### 1.6 The "Add account" flow

Your login screen almost certainly bounces an already-authenticated visitor
into the app. That is right for everyone except someone who came there
deliberately to add a second account. Hence a **per-tab** flag:

```ts
export function beginAddAccount()  { sessionStorage.setItem(ADDING_KEY, "1"); }
export function isAddingAccount()  { return sessionStorage.getItem(ADDING_KEY) === "1"; }
export function endAddAccount()    { sessionStorage.removeItem(ADDING_KEY); }
```

Three consumers:

```ts
// Login screen — in the "already authenticated, redirect away" effect:
if (isAddingAccount()) return;      // authenticated ON PURPOSE

// Verify/OTP screen — the moment the new session is live:
endAddAccount();

// The switcher's "Add account" button:
beginAddAccount();
window.location.assign("/login");
```

**Give them a way back.** Setting that flag makes the flow one-way: the sign-in
form is the whole screen, and every path off it requires completing a sign-in
the user may no longer want. Render an escape hatch that appears *only* in that
situation, so the ordinary login screen is untouched:

```tsx
export default function CancelAddAccount({ landing = "/workspace" }) {
  const router = useRouter();
  const [label, setLabel] = useState<string | null>(null);   // null renders nothing == SSR-safe default

  useEffect(() => {
    // BOTH conditions matter. The flag alone isn't enough: if the original
    // session lapsed while the user sat here, there is no account to go back
    // to and the button would bounce them straight back to /login.
    if (!isAddingAccount() || !isAuthenticated()) return;
    const jwt = getUserDataFromToken();
    setLabel(jwt.email || jwt.name || "your account");
  }, []);

  if (!label) return null;
  return (
    <button onClick={() => { endAddAccount(); router.replace(landing); }}>
      ← Back to <span>{label}</span>
    </button>
  );
}
```

Nothing was torn down on the way in — "Add account" only sets a flag and
navigates — so the original account is still live and simply resumes.

### 1.7 The switcher UI

```tsx
export default function AccountSwitcher({ landing = "/workspace", onAction }) {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // localStorage is unreadable during SSR and the first client render, so this
  // resolves on mount. Seeding first means a pre-existing user sees their own row.
  useEffect(() => {
    setAccounts(seedFromLiveSession());
    setActiveId(activeUserId());
  }, []);

  const doSwitch = (userId: string) => {
    onAction?.();                                     // let the host popover close first
    if (!switchToAccount(userId, landing)) {
      setAccounts(listAccounts());                    // activateAccount already dropped it
      setError("That account was signed out. Sign in again to use it.");
    }
  };

  const doForget = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation(); e.preventDefault();          // the row itself switches — don't do both
    setAccounts(forgetAccount(userId));
  };
  // … render rows (avatar / name / email, check on the active one, × on the others)
  // … plus an "Add account" row calling beginAddAccount()
}
```

### 1.8 Design decisions worth copying — or deliberately not

| Decision | Why | When to differ |
|---|---|---|
| Active account shared across tabs | The session already lived in `localStorage`; the app already assumed one identity per browser | If a long-lived thing (a live call, a recording) must not change identity underneath itself, pin the active account **per tab** in `sessionStorage` instead. NetworkChain's web app does exactly this. |
| Tokens stored in plain `localStorage` | Same exposure the single-session app already had — XSS that can read one token can read the ledger | If you need better, keep only refresh handles in the ledger and re-mint on switch |
| Hard navigation on switch | Guarantees no cross-account state leak | Never differ here unless you have proven every cache is account-scoped |
| Lapsed row is deleted, not activated | Activating it hands the app a session that 401s every request | — |
| Sign-out hands over to the next account | Matches every other multi-account app; only the last sign-out signs you out | — |

---

## 2. Affiliate ID carry-over from a link into the mobile app

**The problem.** Someone taps `https://my.example.app/login?ref=aff_x` on a
phone that does not have your app. They land on a store listing, install, and
the store launches the app **with no URL at all**. The affiliate who invited
them is gone, and the signup that follows credits nobody.

This is *deferred deep linking*. There is no single API for it; it needs two
different mechanisms plus a web interstitial that drives them.

### 2.1 The shape of the solution

```
  ┌─ mobile browser ─────────────────────────────────────────┐
  │ /login?ref=aff_x                                         │
  │   1. read ref from URL (accept every spelling you issue)  │
  │   2. try to open the app:  myapp://?ref=aff_x             │
  │      (Android: intent://…#Intent;…;S.browser_fallback_url)│
  │   3. app didn't take over within ~1.5s                    │
  │      → POST /public/install-intent  (park it, iOS + all)  │
  │      → redirect to store, with Play `referrer=` (Android) │
  └───────────────────────────────────────────────────────────┘
                              ↓ install
  ┌─ native app, FIRST launch ────────────────────────────────┐
  │   A. Android: Play Install Referrer  → exact, preferred   │
  │   B. any:     POST /public/install-intent/claim → approx  │
  │   → split into { ref, route }; ref goes to a sticky store  │
  │     and is spent at signup                                │
  └───────────────────────────────────────────────────────────┘
```

Two sources, tried in order of confidence:

- **Android — Play Install Referrer.** Play forwards an arbitrary `referrer`
  string through the install and hands it back to the app. **Exact, not a
  guess.** Needs no server involvement.
- **Everything else (and iOS especially) — a parked intent.** iOS has no
  equivalent, so the web parks the link server-side against a coarse device
  fingerprint and the app claims it back on first launch. **Approximate by
  nature.**

### 2.2 Web half — building the links

```ts
// lib/installIntent.ts
export type InstallOS = "ios" | "android";

/**
 * The in-app link to hand across the install. A referral link names an
 * affiliate but no destination, so it degrades to the bare `/?ref=` form.
 * Returns null for anything not shaped like a code we issue, so a hand-edited
 * URL can't park arbitrary text.
 */
export function refInstallLink(code?: string | null): string | null {
  if (!code || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) return null;
  return `/?ref=${encodeURIComponent(code)}`;
}

/** Play requires ONE url-encoded value and truncates past 1000 chars. Make it
 *  a query string so the app parses it with its ordinary reader. */
export function playReferrer(link: string): string {
  return new URLSearchParams({
    utm_source: "web", utm_medium: "affiliate_link", link,
  }).toString();
}
```

### 2.3 Web half — the fingerprint

Deliberately coarse. No canvas or font probing, nothing that survives a browser
restart. The IP does the heavy lifting (hashed server-side, never sent from
here); these fields only break ties between phones on the same network.

```ts
function fingerprint(os: InstallOS) {
  const ua = navigator.userAgent || "";
  const osVersion =
    /(?:iPhone )?OS (\d+[._]\d+(?:[._]\d+)?)/.exec(ua)?.[1] ||   // Safari: "OS 17_5_1"
    /Android (\d+(?:\.\d+)*)/.exec(ua)?.[1] || null;             // Android: "Android 14"
  return {
    app: "hq" as const,          // which app is parking — see §2.7
    platform: os,
    osVersion,
    // Logical (CSS) pixels — matches what React Native's Dimensions reports,
    // so both sides describe the same phone with the same numbers.
    screen: `${window.screen.width}x${window.screen.height}`,
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } })(),
    locale: navigator.language || null,
  };
}

export async function registerInstallIntent(os: InstallOS, link: string): Promise<void> {
  try {
    await fetch(`${API_URL}/public/install-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, ...fingerprint(os) }),
      keepalive: true,   // the navigation below tears this page down; the browser still finishes it
    });
  } catch { /* attribution is best-effort — NEVER block the store bounce */ }
}
```

Sent with a bare `fetch`, not your authenticated wrapper: this is a public
endpoint and there is no reason to attach whatever bearer token happens to be
in storage.

### 2.4 Web half — the interstitial

```tsx
const APP_SCHEME = "myapp";
const ANDROID_PACKAGE = "com.example.myapp";
const APP_LAUNCH_FALLBACK_MS = 1500;

// Read query params CLIENT-SIDE ONLY. Touching window.location during render
// de-optimizes the whole Next.js tree at build time.
const [referCode, setReferCode] = useState<string | null>(null);
useEffect(() => {
  const sp = new URLSearchParams(window.location.search);
  // Accept EVERY spelling you have ever issued. Reading only one silently lost
  // the affiliate on every link that used the other.
  setReferCode(sp.get("referCode") || sp.get("ref"));
}, []);

const installLink = useMemo(() => refInstallLink(referCode), [referCode]);

const storeUrl = useMemo(() => {
  const base = platform === "ios" ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
  if (platform !== "android" || !installLink) return base;
  return `${base}&referrer=${encodeURIComponent(playReferrer(installLink))}`;
}, [platform, installLink]);

const intentUrl = useMemo(() => {
  const path = installLink ? installLink.replace(/^\/+/, "") : "";
  // No fallback for an ordinary visitor — Chrome must NOT auto-redirect
  // someone who merely opened a URL to a store listing they didn't ask for.
  const fallback = installLink ? `S.browser_fallback_url=${encodeURIComponent(storeUrl)};` : "";
  return `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};${fallback}end`;
}, [installLink, storeUrl]);

const appSchemeUrl = `${APP_SCHEME}://${installLink ? installLink.replace(/^\/+/, "") : ""}`;
const appLink = platform === "android" ? intentUrl : appSchemeUrl;
```

The launch effect, which is where the care lives:

```tsx
useEffect(() => {
  if (!mounted || previewMode || excluded || platform === "other" || !appLink) return;
  if (attemptedRef.current) return;     // a REF, not state — setting state would re-run
  attemptedRef.current = true;          //   the effect and cancel the pending redirect

  // No referral to carry: original behaviour, unchanged. Attempt the app and
  // stop. The card below offers the store by hand.
  if (!installLink) { window.location.href = appLink; return; }

  let handed = false;
  const goToStore = () => {
    if (handed) return;
    handed = true;
    void registerInstallIntent(platform, installLink);  // NOT awaited — keepalive fetch
    window.location.replace(storeUrl);
  };

  // The tab going hidden means the OS handed off to the app: there is no
  // install to defer, and bouncing to the store now would both interrupt them
  // and leave a decoy intent for the next person on this network.
  const cancel = () => { if (document.hidden) handed = true; };
  document.addEventListener("visibilitychange", cancel);
  window.addEventListener("pagehide", cancel);

  // On real Android the intent:// navigation resolves this itself. The timer
  // is for iOS, and for anything that only SPOOFS a mobile UA (desktop
  // DevTools emulation, some embedded webviews) and would sit here forever.
  const timer = window.setTimeout(goToStore, APP_LAUNCH_FALLBACK_MS);
  window.location.href = appLink;

  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", cancel);
    window.removeEventListener("pagehide", cancel);
  };
}, [mounted, previewMode, excluded, platform, appLink, installLink, storeUrl]);
```

**Also: name the inviter on this screen.** On a phone the interstitial *replaces
the page*, so whatever "X invited you" card your desktop login renders is never
seen — at the one moment the referral is worth something, the visitor gets an
anonymous "install our app" wall. Resolve the code to a name and show it, and
change the body copy from "Garage is optimized for mobile…" to "Continue in the
app to accept the invite and set up your account." Fail silently: a code that
doesn't resolve to a real name leaves the card out rather than rendering an
empty one or the raw code.

### 2.5 Backend — park

```ts
// Only links matching a known grammar are stored. This is written by a browser
// and read back by an app: untrusted on BOTH ends.
const INSTALL_LINK_RE = /^\/(hq|store|product|…)\/[A-Za-z0-9_-]+(\?[\w=&%.\-]*)?$|^\/\?ref=[A-Za-z0-9_%-]{1,64}$/;

router.post("/install-intent", async (req, res) => {
  const parsed = z.object({ link: z.string().min(2).max(2000), ...fingerprintShape }).safeParse(req.body);
  // Always 202, always fast: this must never delay the store navigation.
  if (!parsed.success) return res.status(202).json({ success: true });
  if (!INSTALL_LINK_RE.test(parsed.data.link)) return res.status(202).json({ success: true });

  const fp = fingerprintFrom(req, parsed.data);        // adds ipHash + userAgent server-side
  if (!fp) return res.status(202).json({ success: true });

  // Cheap abuse ceiling. One phone writes one intent per bounce; an office
  // behind one NAT might make a handful. Well past that, stop — extra rows
  // couldn't be told apart at claim time anyway, so they only poison matches.
  const recent = await InstallIntent.countDocuments({
    ipHash: fp.ipHash, createdAt: { $gte: new Date(Date.now() - MATCH_WINDOW_MS) },
  });
  if (recent >= 30) return res.status(202).json({ success: true });

  const affiliateId = /[?&]ref=([^&]+)/.exec(parsed.data.link)?.[1] ?? null;
  await recordIntent({ link: parsed.data.link, affiliateId, fp });
  return res.status(202).json({ success: true });
});
```

IP is hashed with a salt and never round-tripped:

```ts
export function hashIp(ip?: string | null) {
  return ip ? crypto.createHash("sha256").update(ip + IP_HASH_SALT).digest("hex") : null;
}
export function clientIp(req: any) {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || null;
}
```

### 2.6 Backend — claim

`ipHash + platform + app` is a hard filter. Scoring only breaks ties among
devices behind the same NAT:

```ts
function score(candidate: any, fp: Fingerprint): number {
  let s = 0;
  // Safari reports "17_5"; the app reports "17.5.1". Major version only — a
  // point release can land between the tap and the launch.
  const major = (v: string) => String(v).replace(/_/g, ".").split(".")[0];
  if (fp.osVersion && candidate.osVersion && major(fp.osVersion) === major(candidate.osVersion)) s += 3;
  if (fp.screen && candidate.screen && fp.screen === candidate.screen) s += 3;
  if (fp.timezone && candidate.timezone && fp.timezone === candidate.timezone) s += 1;
  if (fp.locale && candidate.locale && fp.locale === candidate.locale) s += 1;
  return s;   // nothing is REQUIRED to match: a browser reporting no timezone must still claim
}

/** Null when the best two candidates are indistinguishable. Crediting the
 *  wrong affiliate is worse than crediting none — a wrong credit is invisible
 *  and unrecoverable, a missed one just falls back to an unattributed signup.
 *  The same link twice is NOT ambiguous: either row sends them to one place. */
function pickUnambiguous(candidates: any[], fp: Fingerprint) {
  if (!candidates.length) return null;
  const ranked = candidates.map((c) => ({ c, s: score(c, fp) })).sort((a, b) => b.s - a.s);
  if (ranked.length > 1 && ranked[1].s === ranked[0].s && ranked[1].c.link !== ranked[0].c.link) return null;
  return ranked[0].c;
}
```

```ts
export const MATCH_WINDOW_MS   = 60 * 60 * 1000;      // 1h — past this, an install is unrelated
export const RECLAIM_WINDOW_MS = 3 * 60 * 60 * 1000;  // a claimed row stays answerable this long

router.post("/install-intent/claim", async (req, res) => {
  // `link: null` is the NORMAL case for an organic install. Never an error.
  const parsed = z.object({ ...fingerprintShape, reclaim: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.json({ success: true, link: null });
  const fp = fingerprintFrom(req, parsed.data);
  if (!fp) return res.json({ success: true, link: null });
  return res.json({ success: true, link: await claimIntent(fp, { reclaim: !!parsed.data.reclaim }) });
});
```

### 2.7 App half — first launch

```ts
const STATE_KEY = "myapp.deferredLink.v1";
const ROUTE_KEY = "myapp.deferredLink.route.v1";
const ROUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESOLVE_WINDOW_MS = 60 * 60 * 1000;   // matches the backend's match window
const MAX_ATTEMPTS = 3;

interface DeferredState {
  firstLaunchAt: number;   // anchors the retry window
  attempts: number;
  done: boolean;           // resolved, exhausted, or timed out — module is inert after
}
```

A first launch with no network must not silently burn the one attempt — so
retry, but **only inside the window and only a few times**, because the
overwhelmingly common answer is "this was an organic install, there is no link"
and you must not keep asking forever.

```ts
async function linkFromInstallReferrer(): Promise<string | null> {   // Android only
  if (Platform.OS !== "android") return null;
  try {
    // Required LAZILY: a missing native module (an older build, Expo Go) must
    // degrade to the fingerprint path, not crash the app on launch.
    const { PlayInstallReferrer } = require("react-native-play-install-referrer");
    const referrer: string = await new Promise((resolve, reject) =>
      PlayInstallReferrer.getInstallReferrerInfo((info: any, err: unknown) =>
        err || !info?.installReferrer ? reject(err) : resolve(info.installReferrer)));
    // Organic installs come back as "utm_source=google-play&utm_medium=organic".
    const link = queryValue(referrer, "link");
    return link && link.startsWith("/") ? link : null;
  } catch { return null; }
}

async function linkFromInstallIntent(reclaim = false): Promise<string | null> {
  try {
    const res = await apiClient.post("/public/install-intent/claim",
      { ...fingerprint(), ...(reclaim ? { reclaim: true } : {}) }, { skipAuth: true });
    return res?.link || null;
  } catch { return null; }
}
```

The app-side fingerprint **must describe the phone the same way the web does**:

```ts
function fingerprint() {
  const { width, height } = Dimensions.get("screen");   // logical points == the web's CSS pixels
  return {
    app: "hq" as const,
    platform: Platform.OS === "ios" ? "ios" : "android",
    osVersion: Device.osVersion ?? null,
    screen: `${Math.round(width)}x${Math.round(height)}`,
    timezone, locale,   // from Intl, in a try/catch — no full-ICU build is survivable
  };
}
```

Persist the recovered **route** separately from the ref, with its own long TTL.
An invitee who installs, sees the login screen, and comes back tomorrow would
otherwise land on the home screen with no trace of what they were invited to:

```ts
async function savePendingDeferredRoute(route: string) {
  await AsyncStorage.setItem(ROUTE_KEY, JSON.stringify({ route, savedAt: Date.now() }));
}
export async function getPendingDeferredRoute(): Promise<string | null> { /* …TTL check… */ }
export async function clearPendingDeferredRoute(): Promise<void> { /* once redeemed */ }
```

The **ref** goes to a sticky store (`captureAffiliateRef`) and is spent at
signup — nothing downstream needs to know it arrived this way.

### 2.8 Spending the ref

Whatever path the code arrived by, it ends up as one field on verify:

```ts
POST /auth/verify-otp { email, code, referralCode: "aff_x" }
```

```ts
let referrerId: string | undefined;
if (referralCode) {
  const referrer = await User.findOne({ affiliateId: referralCode });
  if (referrer) referrerId = referrer._id.toString();
}
// …only on user CREATION:
if (referrerId) { userData.referredBy = referrerId; userData.referredBySource = "affiliate"; }
```

On the web, also `localStorage.setItem("referral_code", code)` when the code
first appears on the URL — a cheap belt-and-braces copy for anything that needs
it after a navigation.

### 2.9 Gotcha index for Section 2

| Symptom | Cause |
|---|---|
| Affiliate lost on *some* links only | Reading one param spelling. Accept `ref` **and** `referCode` (and any other you've issued). |
| Every mobile visitor thrown to the store | You set `S.browser_fallback_url` unconditionally. Only set it when there's a referral. |
| Store bounce fires even though the app opened | Missing the `visibilitychange`/`pagehide` cancel. Also leaves a decoy intent for the next device on that network. |
| Intent never parked | `registerInstallIntent` awaited before navigating, so the request was cancelled. Use `keepalive` and don't await. |
| Nothing ever claims on iOS | Fingerprints drifted between web and app. `screen` must be logical pixels on both; `osVersion` compared on major only. |
| Wrong affiliate credited | You picked a candidate when two scored equally. Return null. |
| Shop install redeems an HQ referral | Missing the `app` discriminator on both park and claim. |
| Redirect fires twice | Single-run guard held in state instead of a ref. |

---

## 3. Email **or** phone number in one login field

**What the user gets:** one input. Type an address, get an emailed code; start
typing digits and a country picker appears, get a code by SMS **and** WhatsApp.

### 3.1 The rule that makes it safe

> **Never infer a country code.**

A bare 10-digit number prefixed with your most common country code resolves to
a *different real person's account*, or sends their OTP to a stranger's
handset. In this codebase, a delivery-side helper that did exactly that left
**349 accounts holding an assumed-Indian number nobody stated.**

So: a bare number is **rejected** with `country_code_required`, and the country
picker in the login field supplies the code. Guessing is acceptable when
*delivering* to a number already on file; it is never acceptable when deciding
*who someone is*.

### 3.2 Wire format

Keep the field name. `{ email: "user@example.com" }` and
`{ email: "+919876543210" }` both post to the same endpoints. Renaming it
across every client is a coordinated release you do not need.

### 3.3 Client classifier — `lib/identifier.ts`

The client classifier exists **for the UI, not for trust**. The backend
classifies again and is the authority.

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export type IdentifierMode = "email" | "phone" | "unknown";

export function detectMode(raw: string): IdentifierMode {
  const v = (raw || "").trim();
  if (!v) return "unknown";
  if (v.includes("@")) return "email";        // decisive — no phone number has one
  if (/[a-zA-Z]/.test(v)) return "email";     // before the digit rule, so "9to5@…" reads as email
  // Deliberately NOT an exact charset match. An earlier version demanded every
  // character be phone-ish, so one stray keystroke ("63955=") threw the field
  // back to email mode and swapped the control out mid-type. A junk character
  // makes the number invalid at submit — it must not change what the user is
  // evidently doing.
  if (/^[+0-9]/.test(v)) return "phone";
  return "unknown";
}
```

### 3.4 The two things people actually type

```
"09876543210"    the habitual trunk 0.  Naive prefix → "+9109876543210". Not a real number.
"919876543210"   pasted WITH the code, no "+".  Naive prefix → "+91919876543210".
                 That doubled country code had to be repaired out of 27 accounts.
```

Length rules cannot fix this — an Indian mobile legitimately starts with 9, so
`91…` is genuinely ambiguous. Build every plausible reading and let
**libphonenumber** decide:

```ts
export function toPhoneIdentifier(raw: string, dialCode: string): string {
  const typed = (raw || "").trim();
  const dial = String(dialCode || "").replace(/^\+/, "").replace(/\D/g, "");
  const digits = (typed || "").replace(/\D/g, "").slice(0, 15);   // E.164 max
  if (!digits) return `+${dial}`;

  // An explicit "+" means the user STATED their country, so the picker's code
  // is never applied on top — that is what produced "+91+12048812505" and
  // "+34 34642227423" in stored data. But a stated code can still be doubled
  // ("+971 971551077547", on two real accounts), so offer a de-duped fallback.
  const candidates = typed.startsWith("+")
    ? [`+${digits}`, dedupeLeadingCode(digits)]
    : [`+${dial}${digits}`, `+${digits}`];       // most-literal first

  for (const c of candidates) {
    const parsed = parsePhoneNumberFromString(c);
    // `.number` is libphonenumber's CANONICAL E.164, not the string handed to
    // it — it strips national trunk prefixes on the way, which is what turns
    // "+91" + "09876543210" into "+919876543210" instead of burying the 0
    // mid-number. Validity alone can't choose: both readings can be "valid"
    // while only one canonicalises correctly.
    if (parsed?.isValid()) return parsed.number;
  }
  // Nothing valid yet — probably mid-type. Return the literal reading so the
  // field round-trips rather than jumping under the user.
  return candidates[0];
}

/** "971971551077547" -> "+971551077547" when a code is repeated back-to-back. */
function dedupeLeadingCode(digits: string): string {
  for (let len = 1; len <= 3; len++) {
    const code = digits.slice(0, len);
    if (digits.slice(len).startsWith(code)) return `+${code}${digits.slice(len * 2)}`;
  }
  return `+${digits}`;
}

export function buildIdentifier(mode: IdentifierMode, raw: string, dialCode: string): string {
  return mode === "phone" ? toPhoneIdentifier(raw, dialCode) : (raw || "").trim().toLowerCase();
}
export function isValidPhoneInput(raw: string, dialCode: string): boolean {
  return parsePhoneNumberFromString(toPhoneIdentifier(raw, dialCode))?.isValid() === true;
}
```

**Splitting a stored number back apart — longest dial code first, or `+1`
swallows `+91` and an Indian number comes back as American.** This bug was
written three separate times in this codebase before it was centralised:

```ts
export function splitE164(e164: string, dialCodes: string[]) {
  const v = String(e164 || "").trim();
  if (!v.startsWith("+")) return null;
  const digits = v.slice(1).replace(/\D/g, "");
  const sorted = [...dialCodes].map((d) => d.replace(/^\+/, "")).sort((a, b) => b.length - a.length);
  for (const d of sorted) if (digits.startsWith(d)) return { dial: d, local: digits.slice(d.length) };
  return null;
}
```

### 3.5 The login form

```tsx
const [email, setEmail] = useState("");                       // holds EITHER identifier
const [phoneCountry, setPhoneCountry] = useState<ICountry | null>(null);
const mode = detectMode(email);

// Follow a pasted "+CC…" with the picker. Without this the flag can say India
// while the field holds a US number — the control contradicts the value, and
// the user has no reason to trust which one is being sent.
useEffect(() => {
  const iso = countryOfTyped(email);
  if (iso && iso !== phoneCountry?.isoCode) {
    const match = findCountryByIso(iso);
    if (match) setPhoneCountry(match);
  }
}, [email, phoneCountry?.isoCode]);

async function handleSubmit(e?: React.FormEvent) {
  e?.preventDefault();
  const identifier = buildIdentifier(mode, email, dialOf(phoneCountry));

  if (mode === "email" && !isValidEmail(email)) return toast.error("Enter a valid email address");
  // Checked against libphonenumber for the SELECTED country, not a digit count
  // — "09876543210" and "919876543210" are both the right length and both
  // wrong, and both are things people type constantly.
  if (mode === "phone" && !isValidPhoneInput(email, dialOf(phoneCountry)))
    return toast.error("Enter a valid phone number for the selected country");

  await api("/auth/request-otp", { method: "POST", body: JSON.stringify({ email: identifier }) });
  toast.success(mode === "phone" ? "Code sent to your phone!" : "OTP sent to your email!");

  const params = new URLSearchParams();
  params.set("email", identifier);   // param name unchanged; value is either kind
  router.push(`/verify?${params}`);
}
```

On the verify screen, **only lowercase when it actually is an email** — a phone
number has no case, and lowercasing is what makes `A@b.com` and `a@b.com`
resolve to one account:

```ts
const raw = (sp.get("email") || "").trim();
const isPhone = raw.startsWith("+");
const email = isPhone ? raw : raw.toLowerCase();
```

And a display formatter, because the country code's length can't be read off
the string (`+1…`, `+91…`, `+971…` are all possible) — so don't try. Treat the
last 10 digits as the subscriber number:

```ts
export function formatIdentifier(value: string): string {
  const v = (value || "").trim();
  if (!v.startsWith("+")) return v;
  const digits = v.slice(1).replace(/\D/g, "");
  if (digits.length <= 10) return `+${digits}`;
  const cc = digits.slice(0, digits.length - 10), local = digits.slice(-10);
  return `+${cc} ${local.slice(0, 5)} ${local.slice(5)}`;   // "+91 98765 43210"
}
```

### 3.6 One country picker, not four

Extract it. In this codebase the same dropdown existed in four near-identical
copies which had drifted — two defaulted to `+91`, one to `+1`, and each had
its own search predicate. **A login field that guesses the wrong country sends
someone's OTP to a stranger.**

```ts
export function dialOf(c: ICountry | null, fallback = "91") {
  return c?.phonecode?.replace(/^\+/, "") || fallback;
}
export function allDialCodes(): string[] {   // feed this to splitE164
  return Country.getAllCountries().map((c) => c.phonecode.replace(/^\+/, ""));
}
```

Positioning contract, if you copy the pattern: the dropdown renders against the
nearest *positioned ancestor* so it can span the full field width, therefore the
caller must mark the field wrapper `relative` and must **not** put
`overflow-hidden` on it — that clips the list to the input's height, which is
exactly how it shipped broken the first time. Click-outside is a ref
containment check on `mousedown`; a full-screen overlay div sits between the
dropdown and the field and swallows the first click back into the input.

### 3.7 Backend — `services/identifier.ts`

**This is the only place the decision is made.** ~61 identity lookups classify
through here rather than sniffing for `"@"` locally.

```ts
export type Identifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string }                              // always E.164
  | { kind: "invalid"; reason: "empty" | "country_code_required" | "malformed" };

export function classifyIdentifier(raw: unknown): Identifier {
  const value = String(raw ?? "").trim();
  if (!value) return { kind: "invalid", reason: "empty" };
  if (value.includes("@")) {
    return EMAIL_RE.test(value) ? { kind: "email", email: value.toLowerCase() }
                                : { kind: "invalid", reason: "malformed" };
  }
  if (!/^[+0-9()\-.\s]+$/.test(value)) return { kind: "invalid", reason: "malformed" };
  if (!value.startsWith("+")) return { kind: "invalid", reason: "country_code_required" };
  const parsed = parsePhoneNumberFromString(value);
  return parsed?.isValid() ? { kind: "phone", phone: parsed.number }
                           : { kind: "invalid", reason: "malformed" };
}

/** The query that finds the user. Invalid matches NOTHING rather than
 *  everything — it must never widen a query into "any user". */
export function identifierQuery(id: Identifier): FilterQuery<any> {
  if (id.kind === "email") return { email: id.email };
  if (id.kind === "phone") return { phone: id.phone };
  return { _id: null };
}

export function identifierValue(id: Identifier): string {
  return id.kind === "email" ? id.email : id.kind === "phone" ? id.phone : "";
}
```

### 3.8 Backend — request-otp

The OTP is keyed on the **canonical identifier itself**, not on a resolved
user, so the endpoint still needs no account to exist and request/verify agree
without a lookup on either side.

```ts
router.post("/request-otp", async (req, res) => {
  const { email: rawIdentifier, purpose = "login", isResend = false } =
    z.object({ email: z.string().min(1), /* … */ }).parse(req.body);   // NOT z.string().email()

  const id = classifyIdentifier(rawIdentifier);
  if (id.kind === "invalid") return res.status(400).json({ ok: false, error: identifierError(id) });
  const key = identifierValue(id);

  if (id.kind === "email") {
    const code = await createOtp(key, purpose);
    await sendMail(key, "Your OTP", `Your OTP is <b>${code}</b> (valid 10 minutes)`);
    return res.json({ ok: true });
  }

  // ── Phone branch ──
  // Throttle, phone ONLY. Every SMS costs money; an unthrottled endpoint that
  // texts any number on request is an open drain on the provider balance. The
  // only cooldown otherwise is a 60s timer in the browser, which an attacker
  // simply doesn't run. The existing OtpCode row IS the throttle state — it
  // has timestamps and there is one row per (key, purpose). No new model.
  const RESEND_COOLDOWN_MS = 60_000;
  const existing = await OtpCode.findOne({ email: key, purpose }).select("updatedAt").lean();
  if (existing?.updatedAt) {
    const waited = Date.now() - new Date(existing.updatedAt).getTime();
    if (waited < RESEND_COOLDOWN_MS)
      return res.status(429).json({ ok: false,
        error: `Please wait ${Math.ceil((RESEND_COOLDOWN_MS - waited) / 1000)}s before requesting another code` });
  }

  const code = await createOtp(key, purpose);

  // Both channels attempted INDEPENDENTLY: one provider being down must not
  // swallow a code the other delivered.
  const delivered: string[] = [], failures: string[] = [];
  if (smsReady)      { try { await sendOtpSms(id.phone, code);      delivered.push("sms"); }      catch (e) { failures.push(`sms: ${e}`); } }
  if (whatsappReady) { try { await sendOtpWhatsapp(id.phone, code); delivered.push("whatsapp"); } catch (e) { failures.push(`whatsapp: ${e}`); } }

  if (delivered.length === 0) {
    // Drop the throttle row: nothing was sent, so the next attempt must not be
    // told to wait for a code that never arrived.
    await OtpCode.deleteMany({ email: key, purpose }).catch(() => undefined);
    return res.status(502).json({ ok: false, error: "Failed to send OTP" });
  }
  res.json({ ok: true });
});
```

Wrap the handler in `try/catch` and convert `ZodError` to a 400 JSON body. Under
Express 5 an escaped ZodError becomes a 500 with an **HTML** body, which every
JSON client surfaces as a bare "Server error (500)".

### 3.9 Backend — verify-otp and account creation

```ts
const id = classifyIdentifier(rawIdentifier);
if (id.kind === "invalid") return res.status(400).json({ error: identifierError(id) });
const identifier = identifierValue(id);        // MUST match the key request-otp stored under

const ok = await verifyOtp(identifier, code, "login");
if (!ok) return res.status(400).json({ error: "Invalid OTP" });

let user = await User.findOne(identifierQuery(id));
if (!user) {
  // Signing up by PHONE stamps phoneVerified: true — passing the OTP on that
  // handset IS the proof of possession. The account has no email at all,
  // which needs a PARTIAL unique index on `email`, not a plain one.
  const userData = id.kind === "phone"
    ? { phone: id.phone, phoneVerified: true }
    : { email: id.email };
  // …referredBy (§2.8), org seeding, save…
}
```

> Long-standing bug this fixes: the old code looked the **user** up with the
> raw body value while the OTP store lowercased its key — so `A@b.com`
> verified fine and then missed the account. Both sides must go through the
> same canonicaliser.

### 3.10 Schema changes you will need

- `email` — **partial** unique index (`{ email: { $exists: true, $type: "string" } }`),
  so phone-only accounts can exist.
- `phone` — indexed, stored **only** in E.164.
- `phoneVerified` — boolean.
- Any existing rows holding a non-E.164 or guessed-country number: migrate or
  quarantine them before you start matching logins on `phone`.

---

## 4. Complete-profile popup after registration

**What the user gets:** a brand-new account lands wherever they were headed,
with a profile modal over the top that can't be dismissed until the required
fields — including a verified phone number — are filled.

### 4.1 The design rule

> The prompt **rides on** the destination. It never replaces it.

A first-time buyer who clicked a specific course still lands on that course,
with the modal over it. Redirecting them to a profile page instead loses the
item — which is the one thing the whole signup flow exists to preserve. Closing
the modal leaves them on that content rather than bouncing them anywhere.

Mechanically: a `?completeProfile=true` query param on whatever URL they were
already going to.

### 4.2 The signal

The OTP verify response doesn't report profile state, so the *join* response is
the signal. Whatever endpoint completes registration returns
`needsProfileCompletion`:

```ts
const joinRes = await api<{ ok: boolean; token: string; needsProfileCompletion?: boolean }>(
  "/guest-auth/public-join", { method: "POST", body: JSON.stringify({ … }) });

const needsProfile = !!joinRes.needsProfileCompletion
  || (data.user as { profileComplete?: boolean }).profileComplete === false;

router.push(withCompleteProfile(safeRedirect(sp.get("redirect"), "/workspace"), needsProfile));
```

```ts
export function withCompleteProfile(destination: string, needsProfile: boolean): string {
  if (!needsProfile) return destination;
  try {
    const url = new URL(destination, "https://placeholder.invalid");   // relative-safe
    url.searchParams.set("completeProfile", "true");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `${destination}${destination.includes("?") ? "&" : "?"}completeProfile=true`;
  }
}
```

**Sanitise `redirect` while you're here.** It arrives on the URL and is handed
straight to `router.push` the moment a login succeeds. Left open,
`/login?redirect=https://evil.example` is a phishing hand-off wearing your real
login as its front door:

```ts
export function safeRedirect(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;   // "//evil.example" is ABSOLUTE
  if (typeof window === "undefined") return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
```

### 4.3 Opening it — the layout effect

```tsx
// This only OPENS the prompt. It deliberately does NOT navigate or clear the
// rest of the query, so any other landing effect still runs and the target
// content keeps loading behind the modal.
const completeProfileHandledRef = useRef(false);
useEffect(() => {
  if (completeProfileHandledRef.current) return;
  if (searchParams.get("completeProfile") !== "true") return;
  completeProfileHandledRef.current = true;
  setIsFirstTimeUser(true);
  setIsProfileOpen(true);
}, [searchParams]);
```

### 4.4 One component, two modes

Don't build a separate onboarding modal. Take the profile editor you already
have and give it an `isFirstTimeUser` prop. In first-time mode it:

| | Normal | First-time |
|---|---|---|
| Backdrop / Esc closes | yes | **no** (`onClick={isFirstTimeUser ? undefined : onClose}`) |
| Tabs, account settings, danger zone | shown | hidden |
| Phone verification block | only if a number exists | always shown |
| Phone must be **verified** to save | no | **yes** |
| On save | toast | `onProfileComplete()` → welcome modal |

```tsx
<ProfilePopover
  isOpen={isProfileOpen}
  onClose={() => { setIsProfileOpen(false); setIsFirstTimeUser(false); }}
  user={{
    id: meId, email: me.email, name: me.name,
    // From the AUTH user, not the member/org row — the member record has no
    // phone fields at all, so reading them there made this always false and
    // re-asked people who had already verified.
    phone: authUser?.phone ?? null,
    phoneVerified: !!authUser?.phoneVerified,
  }}
  isFirstTimeUser={isFirstTimeUser}
  onProfileComplete={() => {
    setIsFirstTimeUser(false);
    setIsProfileOpen(false);
    toast.success("Profile completed successfully!");
    setShowWelcomeModal(true);
  }}
/>
```

### 4.5 Validation that helps instead of blocking

**Keep the submit button enabled on an incomplete form.** A dead button tells
you nothing, and the field it's waiting on is usually scrolled out of view.
Instead, compute what's missing *in the order the form presents it*, so the
first miss is also the topmost one — then scroll to it and say so:

```tsx
const missingFields = useMemo(() => {
  const out: { field: string; label: string }[] = [];
  if (!profileData.name?.trim()) out.push({ field: "name", label: "your full name" });
  if (!phoneLocal.trim())        out.push({ field: "phone", label: "your phone number" });
  if (isFirstTimeUser && !phoneIsVerified)
                                 out.push({ field: "phone", label: "phone verification — tap Send OTP" });
  if (!profileData.country?.trim()) out.push({ field: "country", label: "your country" });
  if (!profileData.city?.trim())    out.push({ field: "city", label: "your city" });
  if (!profileData.state?.trim())   out.push({ field: "state", label: "your state" });
  return out;
}, [profileData, phoneLocal, isFirstTimeUser, phoneIsVerified]);

const attemptSave = () => {
  if (isSubmitting) return;
  const miss = missingFields[0];
  if (!miss) return void saveProfile();

  // Both layouts (mobile sheet + desktop dialog) render the same field twice,
  // so pick whichever copy is actually on screen — offsetParent is null for
  // the hidden one.
  const visible = Array.from(document.querySelectorAll<HTMLElement>(`[data-field="${miss.field}"]`))
    .find((el) => el.offsetParent !== null);
  visible?.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => visible?.focus({ preventScroll: true }), 350);   // after the scroll settles, or the browser yanks focus back
  toast.error(missingFields.length > 1
    ? `Still needed: ${miss.label} (+${missingFields.length - 1} more)`
    : `Still needed: ${miss.label}`);
};
```

### 4.6 Phone verification inside the modal

```tsx
// The exact E.164 string that was verified, so EDITING the number re-locks the gate.
const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
  user?.phoneVerified && user?.phone ? user.phone : null);

const phoneE164 = `+${selectedPhoneCountry?.phonecode || "1"}${phoneLocal.trim()}`;
const phoneIsVerified = !!verifiedPhone &&
  verifiedPhone.replace(/\s+/g, "") === phoneE164.replace(/\s+/g, "");

useEffect(() => { setPhoneOtpCode(""); },              // editing invalidates a prior code
          [phoneLocal, selectedPhoneCountry?.phonecode]);

const handleSendOtp = async () => {
  await api("/auth/phone/request-otp", {
    method: "POST",
    // BOTH channels: the backend defaults to SMS alone for older clients, and
    // attempts each independently so one provider failing can't swallow a
    // code the other delivered.
    body: JSON.stringify({ phone: phoneE164, channel: "both" }),
  });
  toast.success("OTP sent by WhatsApp and SMS");
  setVerifyDialogOpen(true);
};

const handleVerifyOtp = async () => {
  const data = await api<{ phone: string; phoneVerified: boolean }>("/auth/phone/verify-otp", {
    method: "POST", body: JSON.stringify({ phone: phoneE164, code: phoneOtpCode.trim() }),
  });
  setVerifiedPhone(data?.phone || phoneE164);
  setVerifyDialogOpen(false);
  // Publish to the auth store too — the dashboard's "Verify your phone" nudge
  // hides on user.phoneVerified, and without this it keeps nagging someone who
  // just verified here.
  updateUser({ phone: data?.phone || phoneE164, phoneVerified: true });
};
```

If you have more than one phone-verification entry point (a profile modal, a
dismissible banner, a checkout sheet), **they must stay in sync**: all pass
`channel: "both"`, all use the same country picker, all use `splitE164` with
longest-code-first when prefilling from a stored number.

### 4.7 Saving

```ts
await api(`/profile${orgId ? `?orgId=${orgId}` : ""}`, {
  method: "PUT",
  body: JSON.stringify({
    userId: user.id, name, country, state, city, postalCode,
    phone: formattedPhone,
    isFirstTimeUser,          // lets the backend flip profileComplete
  }),
});
onClose();
if (isFirstTimeUser && onProfileComplete) onProfileComplete();
```

### 4.8 Other entry points

Any flow that creates an account should be able to raise the same prompt by
navigating to `/somewhere?completeProfile=true`. In this codebase the guest-join
flows do exactly that. One param, one effect, one component — no second
onboarding path to keep in sync.

### 4.9 Gotcha index for Section 4

| Symptom | Cause |
|---|---|
| Modal re-asks users who already verified | Reading `phone`/`phoneVerified` off the member/org record instead of the auth user. |
| Modal never appears for deep-linked signups | The verify response doesn't carry profile state — read it from the join response. |
| Modal appears but the target content is gone | The effect navigated or stripped the query. It must only set state. |
| Modal reopens on every re-render | No `useRef` guard; `searchParams` changes identity on re-render. |
| "Verify your phone" banner nags after verifying in the modal | Verification result never published to the shared auth store. |
| Gate passes with an unverified number | `verifiedPhone` compared loosely, or not re-locked when the number is edited. |

---

## 5. Build order, and a checklist

The four features are independent, but there is a cheapest order:

1. **Section 3** (email-or-phone) — it is the foundation. Sections 1 and 4 both
   assume a canonical identifier and a working OTP.
2. **Section 4** (complete-profile) — small, and it is what makes a phone-only
   signup produce a usable account.
3. **Section 1** (multi-login) — self-contained, once §0.1's single token
   accessor is real.
4. **Section 2** (affiliate carry-over) — largest surface (web + backend +
   native app + store console), and it is the only one that needs a store
   release to test end to end.

### Pre-flight

- [ ] Every consumer reads the token through **one** accessor. Grep for direct
      `localStorage.getItem("<your token key>")` and fix each hit.
- [ ] Your user store's `setUser` merge semantics are understood — §1.5.
- [ ] `libphonenumber-js` and a country dataset are available client **and**
      server side.
- [ ] `email` has a partial (not plain) unique index — §3.10.
- [ ] Your app's custom URI scheme and Android package id are registered and
      match the store URL's `id=` param.

### Post-ship verification

- [ ] Sign in as A, add B, switch A→B→A. Confirm role, org and avatar all
      change; confirm nothing from A appears while B is active.
- [ ] Let B's token expire, then try to switch to it. Expect a message, not a
      signed-out app.
- [ ] Sign out of B while A exists — A must still be signed in.
- [ ] Open "Add account", then Cancel. You must land back on A.
- [ ] Log in with `09876543210`, `919876543210`, `+919876543210` and
      `+91 98765 43210`. All four must resolve to **one** account.
- [ ] Log in with a bare 10-digit number and no picker selection — must be
      refused, never guessed.
- [ ] Tap a `?ref=` link on a phone **with** the app: app opens, no store
      bounce, no parked intent.
- [ ] Tap the same link **without** the app: store opens; after install the
      first launch recovers the ref; the signup credits the right affiliate.
- [ ] A brand-new account deep-linked to a specific item lands **on that item**
      with the profile modal over it.

# Garage estate — feature status report

**Date:** 10 September 2026
**Scope:** four cross-cutting auth/onboarding features across every Garage web
app, mobile app and backend, plus the app-icon refresh.

Findings below are from reading the code, not from running the apps. Where a
feature is marked present, the wiring was checked — a file existing is not the
same as a feature working, and that distinction changed the verdict twice
(see [False positives](#false-positives)).

---

## Contents

- [The four features](#the-four-features)
- [Status matrix](#status-matrix)
- [Feature 1 — Multi-login](#feature-1--multi-login)
- [Feature 2 — Affiliate carry-over](#feature-2--affiliate-carry-over)
- [Feature 3 — Email-or-phone login](#feature-3--email-or-phone-login)
- [Feature 4 — Complete-profile prompt](#feature-4--complete-profile-prompt)
- [False positives](#false-positives)
- [Open defects](#open-defects)
- [App icons](#app-icons)
- [What shipped this session](#what-shipped-this-session)

---

## The four features

1. **Multi-login** — several accounts signed in at once, with a switcher.
2. **Affiliate carry-over** — an affiliate ID on a link survives the hop from a
   mobile browser, through an app-store install, into the app, and is spent as
   `referralCode` at OTP verify.
3. **Email-or-phone login** — one field that accepts either, backed by
   `lib/identifier.ts`.
4. **Complete-profile prompt** — a gate raised after registration when the
   profile is incomplete.

All clients authenticate against **garagenew-backend** (`test.garage.app`), so
features 2–4 are server-side complete for everyone; the gaps below are all
client-side.

---

## Status matrix

**Web**

| App | Repo | 1. Multi-login | 2. Affiliate | 3. Email-or-phone | 4. Profile |
|---|---|---|---|---|---|
| Garage HQ Web | `garage-web-app-nextjs-v1` | ✅ | ✅ | ✅ | ✅ |
| Networkchain Web | `contact-frontend` | ✅ | ✅ | ✅ | ✅ |
| Garage Shop Web | `garage-store` | ✅ | ✅ | ✅ | ✅ |
| Garage HIFI founders | `garage-seller-hifi-web-app-nextjs-v1` | ✅ | ❌ | ✅ | ⚠️ |
| Garage OTC buyer | `garage-otc-buyer` | ✅ | ❌ | ✅ | ⚠️ |
| Garage HIFI buyer | `my-crypto-brand-web-app-nextjs-v1` | ✅ | ❌ | ✅ | ⚠️ |

**Mobile**

| App | Repo | 1. Multi-login | 2. Affiliate | 3. Email-or-phone | 4. Profile |
|---|---|---|---|---|---|
| Garage HQ | `garage-chat` | ✅ | ✅ | ✅ | ✅ |
| Networkchain | `networkchain` | ✅ | ✅ | ✅ | ✅ |
| Garage Shop | `garage-store-app` | ✅ | ✅ | ✅ | ✅ |
| Garage Admin | `garage-admin-app` | ⚠️ | ❌ | ✅ | ➖ |
| Garage Franchise | `garage-franchise-app` | ❌ | ❌ | ✅ | ❌ |
| Garage IRL | `garage-pay-seller` | ❌ | ❌ | ➖ phone-only | ✅ |

**Backends**

| Backend | Repo | Role |
|---|---|---|
| Garage HQ | `garagenew-backend` | **The auth realm.** Owns `services/identifier.ts`, `/profile/status`, `/public/install-intent`, and `referralCode` on `/auth/verify-otp`. All four features are server-complete here. |
| Networkchain | `contacts-backend` | Domain only — no auth. Delegates to Garage. |
| Garage Shop | `garage-store-backend-nodejs-v1` | Domain only. Carries an unused email-only `/auth` route — see [Open defects](#open-defects). |

Legend: ✅ implemented · ⚠️ implemented with caveats · ❌ missing · ➖ n/a or by design

`garage-pay-app` (GaragePay) is **discontinued** and excluded throughout.

---

## Feature 1 — Multi-login

**Architecture, everywhere it exists.** The app's existing session keys stay as
*the active session*; a **ledger** sits beside them holding the other accounts.
Switching copies a ledger row into those keys and reloads. Nothing downstream —
API clients, sockets, contexts — has to learn that multiple users exist.

Two rules earn their keep:

- **Tokens are credentials, not labels.** On mobile they stay in the keychain
  under a per-account key, never in the AsyncStorage ledger. Filing the whole
  ledger in SecureStore instead is wrong twice over: Android warns past 2048
  bytes per value, and several JWTs plus metadata clear that easily.
- **Remembered ≠ usable.** A ledger row is written once; the JWT inside expires
  on its own schedule. Activation must refuse a lapsed row and drop it, or the
  app gets a session that 401s every request.

**Where it lives per app:** HQ Web → sidebar user menu (`MainSidebar`);
Shop Web → bottom-nav sheet, sidebar popover and avatar menu; Shop Mobile →
Account tab sheet; HIFI/OTC → topbar and profile menu; Admin → app drawer.

**Garage Admin caveat.** Its ledger is otherwise complete (per-account tokens,
upsert/touch/remove/clear) but has **no expiry awareness** — no
`isAccountExpired`. Switching into a lapsed account hands the app a dead
session. Missing `beginAddAccount` is *not* a gap on mobile: navigating to
sign-in is sufficient, since the outgoing account is already in the ledger.

**Garage Franchise and Garage IRL have no multi-account at all.**

---

## Feature 2 — Affiliate carry-over

**This is the weakest feature in the estate.** Present only in the three
original apps and their mobile counterparts:

- Web capture of `?ref=` / `?referCode=`, persisted stickily.
- A store bounce that parks an install intent (`POST /public/install-intent`)
  plus the Play referrer on Android.
- First app launch claims the intent back and stores the ref.
- The ref is spent as `referralCode` at `/auth/verify-otp`.

**Absent in all six newer apps** — HIFI founders, OTC buyer, HIFI buyer, Admin,
Franchise, IRL. No install-intent, no store bounce, no `?ref=` capture.

Two near-misses that are **not** implementations:

- `garage-seller-hifi/lib/auth-flow.ts` has `verifyOtp(identifier, code,
  referralCode)` — but **no caller anywhere passes one**. Dangling plumbing.
- `garage-seller-hifi/app/(dashboard)/affiliates/page.tsx` *generates*
  affiliate links; it does not capture inbound ones.

**Judgement:** for Admin and Franchise this is plausibly n/a — nobody shares an
affiliate link to install an internal tool. For the three consumer-facing
HIFI/OTC webs it is a genuine gap.

---

## Feature 3 — Email-or-phone login

**The healthiest feature in the estate — implemented everywhere.**

All apps carry `lib/identifier.ts` including the hard-won helpers
`toPhoneIdentifier`, `dedupeLeadingCode`, `splitE164` and `countryOfTyped`.
These are not decoration; each encodes a real repair:

- The habitual trunk `0` (`09876543210`), which naive prefixing turns into
  `+9109876543210`.
- A number pasted *with* its country code but no `+` (`919876543210`), which
  naive prefixing doubles into `+91919876543210` — repaired out of 27 real
  accounts.
- A stated code doubled (`+971 971551077547`) — found on two accounts.
- `splitE164` matching the **longest** dial code first, or `+1` swallows `+91`
  and an Indian number reads as American. That bug was written three separate
  times before the helper existed.

**Drift check:** the three HIFI/OTC webs are 15 code-lines off the canonical
copy; the two Expo apps ~75–80 (React Native differences). No behavioural
divergence found.

**Garage IRL is phone-only by design** — its login comment states the identity
field is a phone number, appropriate for a point-of-sale seller app. It still
uses `toPhoneIdentifier` and a country picker, so the normalisation is correct;
it simply doesn't offer email.

**The rule that must not be broken:** the country is *stated*, never guessed.
The backend deliberately refuses a bare number rather than assume a country.
Guessing is what mislabelled 349 stored numbers.

---

## Feature 4 — Complete-profile prompt

**Two different mechanisms are in use, and they are not equivalent.**

**The full gate** (HQ Web, NC Web, Shop Web, and all three original mobile
apps) asks the backend: `GET /profile` → `profileComplete`. It is raised right
after OTP verify *and* on a cold start of a restored session, so someone who
closes the tab half-way is asked again. It is deliberately **fail-open** — a
status check that errors never gates, because being unable to ask is not a
reason to lock someone out.

**The narrow trigger** (HIFI founders, OTC buyer, HIFI buyer) uses a local
`isProfileIncomplete(user)` that returns true **only when the email is missing
or invalid**. It is a coherent companion to phone login — sign up by phone,
we need an email — but it is *not* the backend flag.

> **Consequence:** a user who signs up by **email** and never fills in name,
> phone or address is **never prompted** in those three apps. Whether that
> matters is a product call; it may be exactly right for a seller console.

**Ordering rule, everywhere it applies:** the referrer must be written
*before* the profile is completed. The backend gates
`/affiliate/change-referrer` on `profileComplete === false`, so the other order
is rejected every time.

**Garage Franchise has no profile prompt.** **Garage Admin's is not one** —
see below.

---

## False positives

Two things look like implementations in a filename scan and are not. Both were
caught by reading the code.

1. **`garage-franchise-app/lib/services/vaults/accounts.ts`** is bank and
   crypto **payout accounts** for withdrawals. Nothing to do with multi-login.
2. **`garage-admin-app/components/admin/complete-profile-dialog.tsx`** takes an
   `AdminUserListItem` and calls `completeUserProfile(user)`. It is an admin
   tool for filling in **other people's** profiles, not a self-gate. (HQ Web's
   `components/garage-admin/CompleteProfileDialog.tsx` is the same thing.)

---

## Open defects

Ranked by user impact.

| # | Where | Defect |
|---|---|---|
| 1 | **Shop Web** | Account switcher renders initials forever. `rememberActiveAccount()` passes only JWT claims, which carry no picture, and nothing else ever populates it. Same bug that was fixed in HQ Web; the fix was not ported. |
| 2 | **HQ Web + Shop Web** | A lapsed token logs the user out of **every** account. Route guards ask `isAuthenticated()`, which only reads the *active* account, so one dead token strands a good second session. NC Web solves this with `switchAwayFromExpiredActive()`; the primitive exists in both apps (`activateNextUsableAccount`) but is only wired to sign-out, never to the expired-on-load path. |
| 3 | **HQ Web + Shop Web** | Cross-tab identity swap. The active account is shared across tabs via localStorage, so switching in tab A leaves tab B rendering A's UI while its API calls go out as B. A deliberate trade-off — NC Web pins per-tab instead — but a real hazard. |
| 4 | **Garage Admin** | Ledger has no expiry awareness (see Feature 1). |
| 5 | **Shop Mobile + HQ Mobile + NC Mobile** | No per-account `/auth/me` avatar backfill. Each account records its own picture while active, so a failed fetch or a picture changed elsewhere leaves a stale or blank row. HQ Web now backfills; mobile does not. |
| 6 | **HQ Web** | Switcher rows are plain buttons inside a Radix dropdown — no arrow-key navigation, unlike the sibling menu items. |
| 7 | **Shop Web backend** | `garage-store-backend-nodejs-v1/src/routes/auth.ts` has its own email-only OTP route (`z.string().email()`) that nothing appears to call. Confirm it is dead before someone extends it. |
| 8 | **All** | No tests on any ledger logic, in any app. |

---

## App icons

Six logos were applied across six mobile apps. `garage-pay-app` is
discontinued and was skipped.

| App | `app.json` name | Logo |
|---|---|---|
| `garage-chat` | Garage HQ | Garage HQ (door) |
| `networkchain` | NetworkChain | NetworkChains (infinity) |
| `garage-store-app` | Garage Shop | Garage Shop (play mark) |
| `garage-admin-app` | Garage Admin | Garage Dashboards |
| `garage-franchise-app` | Garage Franchise | Garage Franchise |
| `garage-pay-seller` | GarageIRL | Garage IRL (cart) |

Each result was verified against its source tile by perceptual hash, not by
filename — worth doing, since Shop and IRL were initially mapped backwards.

**Not a file copy.** Three targets want different things:

- `icon.png` — full-bleed as supplied. iOS only rounds corners.
- `android-icon-foreground` — **four of the six marks span past Android's
  adaptive safe zone** (Garage IRL's cart reaches 9%–91%; the safe zone is
  ~17%–83%). Dropped in full-bleed the launcher would shave the cart's handle
  and wheels, so the mark is *scaled* to fit. Field dropped to transparency;
  the background layer supplies the black.
- `splash-icon` — never masked, but splash backgrounds differ (`#ffffff` on
  HQ's light mode, `#181818` on Franchise, `#0E0B08` on Shop), so a black tile
  would read as a square. Transparent.

The black field is removed by treating `max(r,g,b)` as coverage and
un-premultiplying, keeping anti-aliased curves clean rather than muddied.

Deliberate skips: NetworkChain's `splash-blank.png` is a deliberate blank;
Garage Admin has no monochrome icon configured (it uses
`backgroundColor: "#000000"`), so none was created.

### Release requirement

**Icons need a native build. An OTA will not apply them.** They are baked into
the binary at prebuild (Android `res/mipmap-*`, iOS `AppIcon.appiconset`);
EAS Update only ships the JS bundle. For anything already in the stores this
means a full submit-and-review cycle.

> **`networkchain` needs an extra step.** Its `android/` is committed,
> *including generated* `mipmap-*/ic_launcher_*.webp` (still 432×432, stale).
> Building as-is would silently ship the old icon. Run
> `npx expo prebuild --platform android` first. Its `ios/` is gitignored and
> regenerates on its own. The other five are managed workflow and pick the new
> assets up automatically.

**Runtime-version note:** `garage-chat`, `networkchain` and `garage-store-app`
pin `runtimeVersion` explicitly, so a new build keeps serving existing OTA
branches. `garage-admin-app`, `garage-franchise-app` and `garage-pay-seller`
use `policy: "appVersion"` — bumping `version` there forks the runtime, and
existing OTA updates stop reaching the new build until you publish to it.

---

## What shipped this session

| Repo | Change | State |
|---|---|---|
| `garage-web-app-nextjs-v1` | Multi-login; switcher moved to sidebar menu; per-account avatar backfill | pushed |
| `garage-store` | Multi-login; email-or-phone across 4 entry points; complete-profile gate | pushed |
| `garage-store-app` | Multi-login; complete-profile sheet | pushed + **production OTA live** |
| 6 mobile repos | New app icons | committed, **not pushed, not built** |

Two incidental fixes found on the way:

- **`garage-store/app/checkout`** resent *and verified* against whatever was in
  the email field rather than the address the code was issued to. Editing it
  behind the OTP sheet verified against the wrong address. Now uses
  `otpSentTo`, which was already being recorded and then ignored.
- **`libphonenumber-js` in `garage-store`** was resolving only by hoisting out
  of `react-phone-number-input`. The build would have broken the day that
  package moved. Now a direct dependency.

### Not verified against a live backend

None of this session's work was exercised against a running backend — no real
phone OTP, no real `PUT /profile`. Shapes are ported from apps that do work
against the same host, but a smoke test on one real signup per app is worth
doing before relying on it.

---

## See also

`AUTH_FEATURES_IMPLEMENTATION_GUIDE.md` in this repo — a port-it-yourself guide
to all four features, written so another app's developer can implement them
without reading this codebase. Note it predates the avatar backfill, so its
Feature 1 section would build a switcher that renders initials forever.

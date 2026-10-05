# `components/welcome/Welcome.tsx`

> React component `Welcome`.

**Kind:** React component · **Lines:** 1097 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Image`×2 (next/image), `Bat246Title`×2 (components/welcome/Bat246AuthChrome.tsx), `WelcomeLogo`×2 (components/welcome/WelcomeLogo.tsx), `Bat246Landing` (components/welcome/Bat246Landing.tsx), `Bat246LeftPanel` (components/welcome/Bat246AuthChrome.tsx), `AnimatePresence` (framer-motion), `WelcomeCard` (components/welcome/WelcomeCard.tsx), `ArrowLeft` (lucide-react), `CancelAddAccount` (components/shared/CancelAddAccount.tsx), `CountryCodePicker` (components/ui/country-code-picker.tsx), `Mail` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx), `ArrowRight` (lucide-react), `Bat246PoweredBy` (components/welcome/Bat246AuthChrome.tsx)

**Hooks used:** `useState`×8, `useEffect`×7, `useRef`×2, `useRouter` (next/navigation), `useSearchParams` (next/navigation), `useWhitelabelContext` (lib/whitelabel-context.tsx), `useIsBat246Domain` (lib/bat246Office.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Welcome` | component | `Welcome()` | 93 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/webinar/for-org/${BAT246_ORG_ID}` (L163)
  - `GET /backend/affiliate/referrer-info?affiliateId=${encodeURIComponent(
        referralCode
      )}&light=1` (L253)
  - `GET /backend/public/sellable-items/${encodeURIComponent(
          deeplinkItemType
        )}/${encodeURIComponent(deeplinkItemId)}` (L289)
  - `GET /backend/public/hq-organizations/${encodeURIComponent(deeplinkOrgId)}` (L324)
  - `POST /backend/guest-auth/public-join` (L402)
  - `POST /backend/auth/request-otp` (L494)
- **Browser storage / cookies:** `referral_code` (localStorage: set)
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `components/ui/country-code-picker.tsx` — `CountryCodePicker`, `dialOf`, `findCountryByIso`
  - `lib/identifier.ts` — `detectMode`, `buildIdentifier`, `isValidEmail`, `isValidPhoneInput`, `countryOfTyped`
  - `components/welcome/Bat246Landing.tsx` — `Bat246Landing (default)`
  - `lib/whitelabel-context.tsx` — `useWhitelabelContext`
  - `lib/auth.ts` — `getUserDataFromToken`, `isAuthenticated`, `saveOrgId`, `saveToken`
  - `lib/accounts.ts` — `isAddingAccount`
  - `lib/bat246Office.ts` — `defaultHomeFor`, `isBat246OrgId`, `resolveHomeFor`, `useIsBat246Domain`
  - `components/welcome/Bat246AuthChrome.tsx` — `BAT246_AUTH_BUTTON_CLASS`, `BAT246_AUTH_BACK_CLASS`, `BAT246_AUTH_BUTTON_ICON_CLASS`, `BAT246_AUTH_DISCLAIMER_CLASS`, `BAT246_AUTH_INPUT_ROW_CLASS`, `BAT246_AUTH_INPUT_TEXT_CLASS`, `BAT246_AUTH_SUBTITLE_CLASS`, `Bat246LeftPanel`, … +2
  - `lib/utils.ts` — `cn`
  - `components/shared/CancelAddAccount.tsx` — `CancelAddAccount (default)`
  - `lib/deeplink.ts` — `forwardDeeplinkParams`, `isDeeplinkIntent`, `safeRedirect`, `withCompleteProfile`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/welcome/WelcomeLogo.tsx` — `WelcomeLogo`
  - `components/welcome/WelcomeCard.tsx` — `WelcomeCard`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `next` — `useRouter`, `useSearchParams`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `country-state-city` — `ICountry`
  - `sonner` — `toast`
  - `lucide-react` — `LogIn`, `Video`, `Building`, `Rocket`, `Search`, `Shield`, …

## Used by

- `components/welcome/index.ts`

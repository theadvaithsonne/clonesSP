# `lib/brand-color-context.tsx`

> React provider that paints the app chrome in the current office's accent colour by resolving its branding colours and writing `--brand`, `--brand-2` and `--brand-foreground` CSS variables on `<html>`.

**Kind:** frontend library · **Lines:** 213

## Purpose
Every organisation can set `branding.primaryColor` / `secondaryColor` (written by the white-label branding step via `PUT /org/:orgId/branding`). Originally those colours applied only on a custom white-label domain. This provider applies them on the main app too (for example my.garage.app), for whichever office is selected, so the top tab bar, left sidebar and right panel take the office's colour instead of Garage yellow. The `brand` Tailwind colour in `app/globals.css` reads these variables.

## How it works
### Colour helpers
- `GARAGE_BRAND = "#FBD10D"` and `GARAGE_BRAND_2 = "#FBA70A"` are the Garage defaults.
- `normalizeHex` accepts a string with or without `#`, returns an upper-case `#RRGGBB` or `null` (only 6-digit hex is accepted).
- `luminance` computes WCAG relative luminance; `foregroundFor(hex)` returns black text above 0.35 and white below, so dark accents (navy, maroon) stay readable.

### Resolving colours (`load`)
1. **White-label domain** (`useWhitelabelOptional()` reports `isWhitelabel`): wait until it has finished loading, then use its `primaryColor` (fallback Garage yellow) and `secondaryColor` (fallback = primary). No extra request; logged-out visitors could not make one anyway.
2. **No selected org or no token:** use the Garage defaults.
3. **Otherwise:** if this org's colours are in the module-level `cache` (a `Map` keyed by org id), apply them immediately to avoid a yellow flash, then fetch `/org/:orgId/branding`. The primary falls back to Garage yellow; the secondary falls back to the primary (a one-colour brand renders flat, same rule as `lib/whitelabel.ts`), except an org still on Garage yellow keeps `GARAGE_BRAND_2` so untouched offices look unchanged. Result is cached and applied.
4. On a fetch error, keep cached colours if any, else apply the defaults: branding is cosmetic and must never blank the chrome.

### Effects
- Runs `load` on mount and whenever white-label inputs change.
- Re-runs `load` on window events `garage:org-change`, `garage:token-change`, `garage:logout` (all fired by `lib/auth.ts`) and `garage:branding-change` (fired by `notifyBrandingChanged`), so switching office, signing in/out or saving branding repaints without a reload.
- Writes the three CSS variables on `document.documentElement` whenever the colours change.

It deliberately does **not** touch `--primary`, because `.deals-primary-scope` re-points `--primary` to purple for a subtree and the chrome must keep the office colour underneath.

## Exports
- `BrandColorProvider({ children })` - the provider; mount once high in the tree.
- `useBrandColors(): BrandColors` - read `{ brand, brand2, brandForeground, isLoaded }`; `isLoaded` is false until colours are resolved. Outside a provider it returns the Garage defaults.
- `notifyBrandingChanged(orgId?: string | null): void` - drop that org from the cache and fire `garage:branding-change`; call after saving branding.
- `getBrandHex(): string` - the live `--brand` value as a hex string (Garage yellow on the server or if unset), for widgets that need a plain colour string, such as the Razorpay `theme.color` and Stripe `colorPrimary`.
- `GARAGE_BRAND`, `GARAGE_BRAND_2` - default colours.
- `BrandColors` (interface).

## Interfaces
- **Backend endpoints called:** `GET /backend/org/:orgId/branding` - served by `server/routes/org.ts` (mounted at `/org`, `requireAuth`); reads `branding.primaryColor` / `branding.secondaryColor`.
- **Browser events:** listens for `garage:org-change`, `garage:token-change`, `garage:logout`, `garage:branding-change`; dispatches `garage:branding-change`.
- **Browser storage:** reads `garage_tok` and `garage_org_id` via `lib/auth.ts`.

## Dependencies
- **Internal:** `lib/api.ts` - authenticated fetch; `lib/auth.ts` - `getOrgId`, `getToken`; `lib/whitelabel-context.tsx` - `useWhitelabelOptional` for white-label domain colours.
- **Packages:** `react` - context, state and effects.

## Used by
`app/(dashboard)/layout.tsx` (mounts the provider), `components/checkout/StripeCardForm.tsx`, `components/dashboard/ArticlesPage.tsx`, `ChannelPaymentModalNew.tsx`, `ContentRewardsPage.tsx`, `CoursesPage.tsx`, `ManagementPage.tsx`, `PaymentMethodsPanel.tsx`, `ProductsPage.tsx`, `TopUpStoreWalletSheet.tsx`, `WalletPageNew.tsx`, `WhitelabelBrandingStep.tsx`, `WorkshopsPage.tsx` (all in `components/dashboard/`), `components/dashboard/inlineApps/events/EventDetailView.tsx`, `components/shared/ManageOrgPopover.tsx`, `components/shared/SellablePublishedModal.tsx`, `components/webinar/SessionNotStartedCard.tsx`.

## Notes
- Concurrent loads are not cancelled: if the org changes while a request is in flight, a slower earlier response could briefly apply the previous office's colours.
- The cache is per tab and per page load.

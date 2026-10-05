# `lib/admin/product.ts`

> Client-side shared state for the admin observability pages: which product (NetworkChains, Garage, Garage Store, Admin App, Pay Buyer, Pay Seller) and which device (All/Web/Mobile) is selected, persisted in localStorage and synced across pages and tabs.

**Kind:** frontend library · **Lines:** 235

## Purpose
The admin console's PostHog session-replay page and Sentry issues page both filter by "product". This module is the single registry of those products and the switch state they share, so flipping the product on one page carries over to the other. It also owns a secondary "device" switch used to narrow replays to web or mobile clients.

## How it works
### Product registry (`ADMIN_PRODUCTS`, L26-L109)
Each entry has:
- `id` - must match the `@product` tag that the backend's `SENTRY_PROJECTS` configuration attaches to each Sentry project; the Sentry page shows only the projects tagged with the selected id.
- `label` / optional `short` - full name for prose, short name for the crowded header switch.
- `family` - `"networkchains"` or `"garage"`, used to group the switch.
- `apps` - PostHog `app` super-property values that the product's clients register. All products share one PostHog project, so recordings are filtered server-side by these values. A recording whose `app` matches no product appears in no tab, so a new client surface must be added here when it ships.
- optional `platforms` - only set when the product's platforms are fully known. It controls whether the device switch is shown, not how recordings are filtered. Admin App lists web and mobile; Pay Buyer and Pay Seller are mobile-only Expo apps. Omitted means every device option is offered (the comments explain an earlier per-product table wrongly hid Garage mobile).

### Device options
`ADMIN_DEVICES` is All/Web/Mobile. `appsFor()` returns only app names; device filtering is meant to use PostHog's automatic `$lib` property instead of a per-product table. `devicesFor()` trims the device list to `all` plus the product's declared platforms. `hasDeviceChoice()` is false when only two options remain (single-platform product), and the device switch component then hides itself.

### Persistence and sync hooks
- localStorage keys: `nc_admin_product` (default `"networkchains"`) and `nc_admin_device` (default `"all"`).
- `useAdminProduct()` and `useAdminDevice()` start with the default value and read localStorage only after mount, so server and client render the same initial markup. They listen for the `storage` event (other tabs) and custom window events `admin-product-changed` / `admin-device-changed` (same tab).
- Setting a product also clears an incompatible device: if the stored device is not offered for the new product, it is reset to `"all"` and `admin-device-changed` is fired. Otherwise a hidden "Web" filter could stay pinned on a mobile-only product and show an empty list with no visible control.
- `getStoredDevice()` (private) also clamps the stored device against the current product for the same reason.
- `getStoredProduct()` returns `"networkchains"` during SSR or when the stored value is not a known id.

## Exports
- `type AdminProduct` - union of the six product ids.
- `ADMIN_PRODUCTS` - product registry described above.
- `getStoredProduct(): AdminProduct` - validated stored product, falling back to `"networkchains"`.
- `type AdminDevice` - `"all" | "web" | "mobile"`.
- `ADMIN_DEVICES: { id; label }[]` - the three device options.
- `appsFor(product): string[]` - PostHog `app` values for a product (empty if unknown).
- `devicesFor(product): typeof ADMIN_DEVICES` - device options worth offering for a product.
- `hasDeviceChoice(product): boolean` - whether to show the device switch.
- `useAdminProduct(): [AdminProduct, (p) => void]` - shared, persisted product selection.
- `useAdminDevice(): [AdminDevice, (d) => void]` - shared, persisted device selection.

## Interfaces
- **Browser storage / cookies:** localStorage `nc_admin_product`, `nc_admin_device`; window events `admin-product-changed`, `admin-device-changed`, `storage`.
- **External services:** none directly; the values drive PostHog and Sentry queries made by the consuming pages.

## Dependencies
- **Packages:** `react` - `useState`, `useEffect` for the hooks.

## Used by
- `app/garage-admin/(admin-dashboard)/networkchains/posthog/page.tsx` - `useAdminProduct`, `useAdminDevice`, `appsFor` for the replay filter.
- `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx` - `useAdminProduct`, `ADMIN_PRODUCTS` to pick Sentry projects.
- `components/nc-admin/product-switch.tsx` - renders the product switch.
- `components/nc-admin/device-switch.tsx` - renders the device switch, hidden when `hasDeviceChoice` is false.
- `app/garage-admin/(admin-dashboard)/networkchains/ai-cost/page.tsx` also reads `ADMIN_PRODUCTS`.

## Notes
- Marked `"use client"`; the hooks touch `window` and `localStorage`.
- The `localStorage` calls in the setters and getters are not wrapped in try/catch, so a browser that blocks storage would throw there.
- Keep product `id`s in step with the backend `SENTRY_PROJECTS` tags and `apps` in step with what each client registers in PostHog.

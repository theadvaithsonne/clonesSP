# `components/checkout/CurrencySelector.tsx`

> A USD/INR picker for an ecommerce cart: it fetches a server-priced preview of the cart in the chosen currency, shows the order summary, and returns the chosen currency and preview to the parent.

**Kind:** React component · **Lines:** 313

## Purpose
This is a step in the multi-store ecommerce cart checkout. The buyer chooses the currency they want to pay in before the invoice is created. All prices come from `POST /backend/api/ecommerce/cart/preview`. The footer says "Totals authoritative on the server. Conversion locked at invoice creation", so the frontend only displays numbers and never computes them.

## How it works
- **State:**
  - `selected`: the chosen currency, `"USD" | "INR"`, starting at `defaultCurrency`.
  - `previews`: a cache of previews keyed by currency.
  - `loading`: the currency currently being fetched.
  - `error`.
- **Cache reset:** `itemsKey` is a sorted JSON string of `[productId, quantity]` pairs. When it or `couponCode` changes, the cache is cleared.
- **Fetching:** when the selected currency has no cached preview, the component posts `{ items, displayCurrency, couponCode }` to `/backend/api/ecommerce/cart/preview` (Bearer token when logged in). It caches the response, or shows `data.error`. A `cancelled` flag ignores responses that arrive after a newer request.
- **Rendering:**
  - Two currency cards with a flag, label and the total for that currency (or "Calculating…" / "—"). An exchange-rate hint "1 USD ≈ X INR" shows when the preview carries `exchangeRate`.
  - An amber warning listing `inventoryIssues` (first 8 characters of the product id, requested vs available).
  - An order summary: line items with quantity and vendor, subtotal, discount with the applied coupon code, and total.
- **Confirm:** the Pay button is disabled while loading, when there is no preview, or when there are inventory issues. Clicking it calls `onConfirm(selected, preview)`.
- **Formatting:** `formatAmount` divides minor units by 100 and formats with `₹`/`en-IN` or `$`/`en-US`.

## Exports
- `CurrencySelector({ items, defaultCurrency?, couponCode?, onConfirm, disabled? })`: named component.
- `CartItemInput`: `{ productId, quantity }`.
- `PreviewedLineItem`: one priced line. Fields: `title`, `vendor`, `storeId`, `organizationId`, native and converted prices.
- `CartPreview`: the preview response. Fields: `lineItems`, `subtotal`, `discount`, `discountReason`, `total`, `displayCurrency`, `exchangeRate`, `inventoryIssues`, `appliedCouponCode`.

## Interfaces
- **Backend endpoints called:** `POST /backend/api/ecommerce/cart/preview` prices the cart in a display currency (served by `server/routes/ecommerceInvoice.ts`, which is mounted at `/api/ecommerce`).
- **Browser storage / cookies:** the auth token via `getToken()` (optional).

## Dependencies
- **Internal:**
  - `components/ui/button.tsx`: the Pay button.
  - `lib/utils.ts`: `cn`.
  - `lib/api.ts`: `API_URL`.
  - `lib/auth.ts`: `getToken`.
- **Packages:** `react`, `lucide-react` (spinner and shield icons).

## Used by
No file in the project imports it, so it appears unused. Its types may still serve as a reference for the cart-preview response shape.

## Notes
- Only USD and INR are supported here. `PaymentMethodSelector` has since moved to the wider `CHECKOUT_FIAT_CURRENCIES` list.
- The fetch effect lists `previews` as a dependency and returns early when the preview is already cached, so it does not loop.

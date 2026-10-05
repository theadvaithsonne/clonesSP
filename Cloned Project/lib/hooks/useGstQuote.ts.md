# `lib/hooks/useGstQuote.ts`

> A checkout hook that asks the backend how much GST applies to a founder-sold item for this buyer, so the total shown always matches the amount actually charged.

**Kind:** React hook · **Lines:** 111

## Purpose
GST on items sold by founders (channels, courses, workshops, products) depends on the **buyer's** country: shipping address, then profile country, then payment currency. Only the server can resolve that. The checkout pages used to apply 18% client-side whenever `currency === "INR"`, so a buyer with an Indian profile paying in USD saw a different total from what they were charged. This hook asks the backend, which uses the same helpers as the charge path, so the displayed and charged totals cannot drift. All money in and out is in the smallest unit (paise or cents).

## How it works
- With `enabled === false` or no `itemId`, `quote` is reset to `null` and no request is made (for example for free items).
- Otherwise it `POST`s to `/checkout/gst-quote` with `{ itemType, itemId, quantity }`, plus `email`, `subtotalMinor` and `shippingCountry` only when provided. No auth header is sent; the email lets the server look up the buyer's profile country before they log in.
- A response with `success: true` is stored as the `GstQuote`. On any failure `quote` stays `null`; callers then show **no** GST line rather than inventing a figure.
- The effect reruns when any input changes; a `cancelled` flag stops a stale response from overwriting a newer one.

## Exports
- `useGstQuote(opts)` - returns `{ quote: GstQuote | null, loading: boolean }`. Options:
  - `itemType` - `"channel" | "course" | "workshop" | "product"`;
  - `itemId?` - the item to quote;
  - `quantity?` - default 1;
  - `email?` - the buyer's email once known;
  - `subtotalMinor?` - per-unit price after coupon, in the smallest unit (omit to use the listed price);
  - `shippingCountry?` - for physical goods; outranks the profile country;
  - `enabled?` - default true.
- `type GstQuote` - `{ applies, inclusive, rate, base, tax, total, currency, buyerRegion: "IN" | "INTL", regionSource: "shipping" | "billing" | "profile" | "payment_currency", buyerCountry }`. `base`, `tax` and `total` cover the whole line (requested quantity); `inclusive` means the listed price already contained the tax.

## Interfaces
- **Backend endpoints called:** `POST /backend/checkout/gst-quote` (`server/routes/gstQuote.ts`, mounted at `/checkout`, no auth) - GST computation for a buyer and item.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL` (backend base, `NEXT_PUBLIC_API_URL`).
- **Packages:** `react` - state and effects.

## Used by
- `app/checkout/channel/[channelId]/ChannelCheckoutPage.tsx`
- `app/checkout/course/[courseId]/CourseCheckoutPage.tsx`
- `app/checkout/product/[productId]/ProductCheckoutPage.tsx`
- `app/checkout/workshop/[workshopId]/WorkshopCheckoutPage.tsx`
- `components/dashboard/ChannelPaymentModalNew.tsx`

## Notes
- The quote is display-only; the charge path recomputes GST server-side. Do not send the client's quote back as the amount to charge.
- `loading` is not reset when the hook is disabled while a request is in flight, because the cancelled request skips its `setLoading(false)`.

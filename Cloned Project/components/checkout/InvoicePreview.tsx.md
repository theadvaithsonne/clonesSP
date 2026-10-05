# `components/checkout/InvoicePreview.tsx`

> A compact invoice summary card (line items, totals breakdown, and the amount charged when the payment currency differs) shown above the payment methods in checkout.

**Kind:** React component · **Lines:** 305

## Purpose
`CheckoutPaymentStep` renders this card so the buyer can see what they are paying for before choosing a method. It also defines `InvoiceData`, the TypeScript shape of the invoice returned by `GET /backend/api/invoices/:id`, which `CheckoutPaymentStep` reuses. The component is display-only.

## How it works
- **Currency rule:** every itemised amount and the total are formatted in `invoice.itemCurrency`, never `paymentCurrency`. The backend (`services/invoice.ts::selectPaymentMethod`) keeps invoice amounts in the item currency and converts only the Razorpay order amount. Reading `paymentCurrency` once rendered USD cents as rupees (the 2026-08-03 bug noted in the code).
- **Line items:** image or initial-letter tile, name, "Qty: n x unit price" when the quantity is above 1, a vendor chip (multi-HQ ecommerce lines), and the line total in the item's `originalCurrency`.
- **Breakdown:** subtotal, discount with coupon tag, GST (preferred over generic tax), Apple fee and shipping. This block appears only when at least one of those values is non-zero. The Total row gets a top border in the same case.
- **Converted total (`conversionDisplay`, L92-L129):** shown only when `currencyConversion` exists, its currencies differ, and `fromCurrency` equals `itemCurrency`.
  - The backend always stores the legacy USD↔INR pair's `exchangeRate` as the USD→INR rate, whichever direction the conversion ran. So USD→INR multiplies, INR→USD divides, and the rate label always reads "1 USD = X INR".
  - For other fiat targets (`isFiatCurrency`), the rate is stored from→to and multiplied, and the label shows 4 decimals when the rate is below 0.1.
  - Unknown currencies return `null` rather than show a nonsense number.
  - The result is shown as an amber rate line plus an "Amount charged (CUR) ≈ …" row.

## Exports
- `InvoicePreview({ invoice }: { invoice: InvoiceData })`: named component.
- `InvoiceData`: invoice shape. Fields:
  - `_id`, `invoiceNumber`, `invoiceType`, `status`, `organizationId`;
  - `lineItems` (with optional `organizationId`/`storeId`/`vendor`);
  - `subtotal`, `discount`, `tax`, `shippingCost`, `totalAmount`, `itemCurrency`, `paymentCurrency`, `currencyConversion`;
  - recurring fields, `couponCode`, `cashbackCodeId`, customer fields, `createdAt`, `expiresAt`;
  - optional `gst`, `appleFee`, `paymentSource`.

## Dependencies
- **Internal:**
  - `lib/checkout-currencies.ts`: `formatMinor`, `isFiatCurrency`.
  - `lib/utils.ts`: `cn`.
- **Packages:** `lucide-react` (Receipt and Tag icons).

## Used by
`components/checkout/CheckoutPaymentStep.tsx`, which shows it unless `showInvoicePreview={false}` and imports the `InvoiceData` type.

## Notes
- The USD/INR `exchangeRate` direction quirk is a backend data convention. Fix it in both places if it ever changes, or this card will show amounts off by a factor of about 90².
- The source contains literal `—` / `₹` escape sequences inside a comment. This is cosmetic only.

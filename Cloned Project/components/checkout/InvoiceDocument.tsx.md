# `components/checkout/InvoiceDocument.tsx`

> Renders a full, receipt-style invoice: seller branding and address, bill-to block, dates, line-item table and a totals breakdown with GST and Apple fee rows.

**Kind:** React component · **Lines:** 512

## Purpose
This is the "real invoice" view shown on the public invoice page (`/invoice/[invoiceId]`) and inside the post-purchase thank-you card. It is more formal than `InvoicePreview`, the compact summary shown above the payment methods. It shows a From and Bill To layout, GSTIN, issued, paid and due timestamps, and a status badge. It is pure presentation: it takes the invoice and organisation objects as props and fetches nothing.

## How it works
- **Currency:** totals are formatted in `invoice.itemCurrency` with `formatMinor` from `lib/checkout-currencies.ts` (amounts are minor units). Each line item uses its own `originalCurrency`.
- **Status badge:** `getStatusConfig(status)` maps statuses to a label, icon and colours:
  - `paid` shows "Paid".
  - `draft` and `pending` show "Unpaid".
  - `cancelled`, `expired`, `failed` and `refunded` show their own labels.
  - Any other value is shown as-is.
  - Recurring invoices append `· {recurringPeriod}`.
- **Seller block (From):**
  - The name is `billingDetails.legalName`, then `name`, then "Seller".
  - `buildAddressLines()` prefers `billingDetails.billingAddress` (line1, line2, city/state/pincode), falls back to the organisation's own `city`/`state`/`postalCode`/`country`, and uses `location` as a last resort.
  - GSTIN is shown when present.
- **Buyer block (Bill To):**
  - The name is `customerName`, then `shippingAddress.fullName`, then the email local-part, then "Customer". The email fallback covers older invoices created before the backend stored `customerName`.
  - The shipping address is shown when present.
- **Dates:**
  - "Issued" uses `formatDateTime(createdAt)` (date plus time).
  - The second column shows "Paid on" (`paidAt`) for paid invoices. Otherwise it shows "Due", using `expiresAt` before `nextDueDate`, because on recurring child invoices `nextDueDate` is the following cycle.
- **Totals:**
  - The subtotal row appears only when there is a discount, tax, shipping or Apple fee.
  - Discount shows the coupon code.
  - GST, from the `gst` block with rate and "included" marker, replaces the generic Tax row when present.
  - An Apple fee row and a shipping row follow, then the bold total.
- **Header:** the seller icon (or a FileText placeholder), name and `@slug`, plus an optional Download button that calls `onDownload`.

## Exports
- `InvoiceDocument({ invoice, fromOrganization?, onDownload? })`: named component.
- `InvoiceDocumentData`: invoice shape. Main fields:
  - `invoiceNumber`, `status`, optional `userId`/`organizationId`;
  - `lineItems`, `subtotal`, `discount`, `tax`, `shippingCost`, `totalAmount`, `itemCurrency`, `paymentCurrency`, `currencyConversion`;
  - recurring fields, `couponCode`, customer fields, `shippingAddress`, dates, `invoiceShortUrl`;
  - optional `gst`, `appleFee` and `paymentSource` (`web`/`ios`/`android`).
- `FromOrganization`: seller organisation shape (`name`, `icon`, `slug`, location fields, `billingDetails` with `gstin`, `legalName`, `billingAddress`).

## Dependencies
- **Internal:**
  - `lib/checkout-currencies.ts`: `formatMinor`, currency-aware minor-unit formatting.
  - `lib/utils.ts`: `cn`.
- **Packages:** `lucide-react` (icons).

## Used by
- `app/invoice/[invoiceId]/InvoicePayPage.tsx`, the public invoice-pay page at `/invoice/[invoiceId]`.
- `components/checkout/ProductThankYouCard.tsx`, which imports only the `FromOrganization` type.

## Notes
- The `userId` and `organizationId` doc comments note that `GET /backend/api/invoices/:id` always returns them, and that `InvoicePayPage` uses `userId` to detect a stale localStorage token.
- `currencyConversion` and `paymentCurrency` are part of the type but are not rendered here. Only item-currency amounts are shown.

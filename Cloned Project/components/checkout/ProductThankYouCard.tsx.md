# `components/checkout/ProductThankYouCard.tsx`

> The post-purchase "thank you" card, configured by the founder: it either auto-opens a redirect URL or shows a branded message with up to five next-step link buttons.

**Kind:** React component · **Lines:** 228

## Purpose
Founders can attach a `thankYouPage` configuration to a sellable item (product, course and more; the type is `ThankYouPage` from `lib/feed-api.ts`). After a successful invoice payment, `InvoicePayPage` renders this card so the buyer lands on the founder's next steps instead of a bare receipt. Per the header comment, the parent renders it only at the moment of success, so refreshing an already-paid invoice does not show it again.

## How it works
- **Auto-redirect mode (`page.autoRedirect` with `page.redirectUrl`):**
  - An effect calls `window.open(redirectUrl, "_blank", "noopener,noreferrer")` exactly once. A `useRef` guard covers StrictMode double effects and re-mounts.
  - If a popup blocker stops it, a console warning is logged.
  - The card shows the founder's title and message (defaults: "Payment complete — opening your next step…" and a "click below" hint), a manual "Continue" link to the same URL, and an "Invoice X has been paid" footer.
- **Manual mode:**
  - A header that mirrors `InvoiceDocument`: the organisation icon (or a FileText placeholder), its name and `@slug`, and a "Payment complete" tag.
  - The title (default "Thank you for your purchase!") and message (default "Please check your mail for next steps.").
  - `page.sections`, keeping only sections that have `heading`, `buttonLabel` and `buttonUrl`. They render as alternating dark and brand-tinted rows, each with an external link button (`target="_blank" rel="noopener noreferrer"`).
- **Optional link back:** an `onGoToWorkspace` text button, and a footer "Invoice X • Keep this page as your receipt".

## Exports
- `default ProductThankYouCard({ page, fromOrganization, invoiceNumber, onGoToWorkspace? })`. Props:
  - `page: ThankYouPage`;
  - `fromOrganization: FromOrganization | null` (type from `InvoiceDocument.tsx`);
  - `invoiceNumber: string`;
  - `onGoToWorkspace?: () => void`.
- `PostPurchaseThankYouCard`: re-export of the default under a name that is not product-specific, so new call sites can use it without the file being renamed (which keeps git history).

## Interfaces
- **External services:** opens founder-supplied URLs in new tabs. It makes no backend calls.

## Dependencies
- **Internal:**
  - `lib/feed-api.ts`: the `ThankYouPage` type.
  - `components/checkout/InvoiceDocument.tsx`: the `FromOrganization` type.
  - `lib/utils.ts`: `cn`.
  - `components/ui/button.tsx`: imported but unused.
  - `components/checkout/ProductThankYouCard.tsx`: the file re-exports from itself.
- **Packages:** `react` (`useEffect`, `useRef`), `lucide-react` (icons).

## Used by
`app/invoice/[invoiceId]/InvoicePayPage.tsx` (the `/invoice/[invoiceId]` page), plus the file's own self re-export. No other file imports `PostPurchaseThankYouCard` yet.

## Notes
- The redirect and section URLs are founder-controlled and opened without validation. Their safety depends on the backend validating `thankYouPage` URLs when they are saved.
- `slug` is read through an `as any` cast, although `FromOrganization` already declares `slug`.
- There is a stray `eslint-disable-next-line` comment after the re-export, which does nothing.

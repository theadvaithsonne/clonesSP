# `components/checkout/CryptoPaymentPanel.tsx`

> An inline panel that shows the buyer where and how much crypto to send for an invoice: a QR code, the deposit address, the exact amount, a live expiry countdown and a "Get new address" button once the address expires.

**Kind:** React component · **Lines:** 306

## Purpose
This is the UI for the in-house crypto checkout, which replaced NOWPayments' hosted page. When a buyer chooses crypto and a chain/coin, `POST /backend/api/invoices/:id/select-payment` returns a deposit request. `CheckoutPaymentStep` then renders this panel with it. The panel is display-only and never calls the backend itself. Detecting payment happens server-side: backend watchers flip the invoice to paid, and the parent polls the invoice.

## How it works
- **Expiry clock:** `expiresAt` is parsed once with `useMemo`. If it cannot be parsed, it falls back to now + 15 minutes. A 1-second `setInterval` updates `nowMs`. From that it works out `msRemaining`, `isExpired` and `isNearExpiry` (60 seconds or less left). `formatCountdown` renders `m:ss`.
- **QR code:** `qrImageUrl()` builds an image URL on the external `api.qrserver.com` service (220 px, margin 8). The QR encodes only the raw address. Wallet URI schemes such as `tron:<addr>?amount=` are deliberately avoided because wallet support for them is uneven; the buyer copies the amount separately.
- **Copy buttons:** the address and amount buttons use `navigator.clipboard.writeText`, show a check icon for 1.6 s and toast. If copying fails, a toast asks the buyer to copy manually.
- **Active state:**
  - a coin and chain badge plus the countdown (shown red near expiry);
  - a prominent "{chainName} network only" warning, because sending on the wrong network is the most common way funds are lost;
  - the QR code, the address, and the large amount with "Send EXACTLY this amount" (the backend matches deposits by exact atomic units, with no tolerance);
  - a "waiting for your payment" spinner and a reassurance that the tab can be closed.
- **Expired state:** an "Address expired" badge and a message that funds already sent will still be credited. If `onRegenerate` was supplied, it also shows a "Get new address" button. That button calls the parent's async callback and shows a spinner while `regenerating`.
- The `chain` prop is accepted but not used yet (`void chain`); it is reserved for per-chain icons.

## Exports
- `CryptoPaymentPanel(props: CryptoPaymentPanelProps)`: named component.
- `CryptoPaymentPanelProps`: interface with these fields:
  - `address`;
  - `amount` (display string, e.g. `"1.000423"`);
  - `coin` (`USDT`/`USDC`/`ETH`/`BTC`/`POL`);
  - `chain` (`tron`/`polygon`/`bsc`/`ethereum`/`bitcoin`);
  - `chainName`;
  - `expiresAt: string | Date`;
  - `onRegenerate?: () => Promise<void> | void`.

## Interfaces
- **External services:** `https://api.qrserver.com/v1/create-qr-code/` renders the QR image. The deposit address is sent to this third party.
- **Background work:** a 1-second interval timer for the countdown, cleared on unmount.

## Dependencies
- **Internal:** `lib/utils.ts` for `cn` (class merging).
- **Packages:** `react` (state and effects), `lucide-react` (icons), `sonner` (copy toasts).

## Used by
`components/checkout/CheckoutPaymentStep.tsx` only. The parent's `onRegenerate` posts `select-payment` again with the same chain/coin.

## Notes
- The amount string must be shown exactly as the backend returns it. Rounding it would break the backend's exact-amount match.
- The comment suggests swapping the QR service for `qrcode.react` to remove the third-party dependency.

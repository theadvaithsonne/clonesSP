# `components/bat246/modals/LayawayModal.tsx`

> "Send B2 Coins" modal: shows how many BAT246 B2 Coins the user can send, and lets them send coins to an office member or ask an eligible member to give coins to someone.

**Kind:** React component · **Lines:** 495

## Purpose
B2 Coins are BAT246's internal credit (the "Layaway" system) that members can pass to each other to pay for entries. A user's sendable total comes from two sources: coins already in their wallet (received from earlier gives) and pool-based "giving power" earned from qualifying board positions. This modal is the main UI for spending that total or for requesting coins from someone who has them. It opens from a board's Layaway toolbar button and from the B2 Coin Wallet page.

## How it works

### Module-level pieces (L1-L120)
- `getToken()` reads `localStorage.garage_tok` (SSR-safe).
- `PRODUCT_OPTIONS` hardcodes two `bat246_entry` product ids, labelled "$650 Board Entry" and "$160 POD Entry". The labels are display-only; the server derives the real price from the id.
- `Pool` / `Eligibility` interfaces describe the `/my-eligibility` response: per-pool `cap`, `alreadyGiven`, `remaining`, `detail`, plus totals and `isAlanK` (the BAT246 admin account, which has unlimited supply).
- `fmt(n)` formats numbers with up to 2 decimals.
- `LayawaySuccessToast` / `showLayawaySuccessToast(message)` render a custom sonner toast (top-right, 4 s) in the modal's dark/yellow style, with a dismiss button and a progress bar that shrinks over `TOAST_DURATION_MS` via a CSS width transition started on the next animation frame.
- `ChosenPersonRow` shows a selected person (name and email, truncated so long values cannot push the clear button off a narrow screen) with an X to clear.

### State and data loading (L126-L181)
- `fetchAll()` loads `GET /bat246/layaway/my-eligibility` and `GET /bat246/layaway/my-wallet` in parallel, storing `eligibility` and `walletBalance` (`wallet.balance`, default 0). It then picks the default tab: "send" if the user is the admin or has more than 0.004 to send, otherwise "request". On failure both values are set to null. It runs once on mount and again after a successful send.
- Form state shared by both tabs: `recipient`, `mode` ("amount" or "product"), `amount`, `productId`, `note`, `eligiblePerson`, `submitting`, `error`. `resetForm()` clears it.

### Derived values (L192-L212, L270-L271)
- `maxSendable` = infinity for the admin, otherwise `walletBalance + eligibility.totalRemaining`; null while loading.
- `hasAnythingToSend` = admin, or `maxSendable > 0.004`.
- `amountTooHigh` flags a typed amount above `maxSendable` (0.004 tolerance, never for the admin).
- `canSend` needs a recipient, a positive amount or a chosen product, and not `amountTooHigh`. `canRequest` needs an eligible person, a recipient and an amount or product. A product-mode send is not checked against `maxSendable` client-side; the server enforces it.

### Actions (L214-L268)
- `handleSend()` POSTs `{ recipientUserId, amount }` or `{ recipientUserId, productId }` to `/bat246/layaway/give`. On success it toasts the server-computed `data.amount`, resets the form and re-fetches balances; on failure it shows `data.error`.
- `handleRequest()` POSTs `{ eligibleUserId, recipientUserId, note?, amount | productId }` to `/bat246/layaway/request` and toasts `data.request.amount`. It does not re-fetch, since a request does not move coins until the other person accepts.

### Render (L273-L444)
- Portaled to `document.body` as a `z-[20000]` overlay with padding so it stays off the screen edges on phones.
- Summary card: "Unlimited - admin access" for the admin; otherwise the total available, split into "from your balance" and "giving power" chips, plus one chip per pool showing its `detail` and remaining amount.
- Send/Request tab bar, hidden for the admin (who only ever sends).
- Send panel: a hint when there is nothing to send, a recipient picker (`/bat246/layaway/recipients/search`), `AmountOrProduct`, an "Up to $X available" / "Only $X available to send" line in amount mode, and the Send button.
- Request panel: explanatory text, an "Ask" picker against `/bat246/layaway/eligible-people` (with remaining amounts shown), a "To give it to" recipient picker, `AmountOrProduct`, an optional note and the Send Request button.

### `AmountOrProduct` (L446-L494)
Internal component: two toggle buttons ("Coin Amount" / "For a Product"), then either a numeric input or one button per `PRODUCT_OPTIONS` entry.

## Exports
- `LayawayModal({ board?, onClose }: { board?: BoardData; onClose: () => void })` - the modal. `board` is accepted but never read, so the modal can also open from pages without a board.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/bat246/layaway/my-eligibility` - `requireAuth`; pool-based giving power (`computeLayawayEligibility`).
  - `GET /backend/bat246/layaway/my-wallet` - `requireAuth`; received B2 Coin balance and history (`getMyB2CoinWallet`).
  - `POST /backend/bat246/layaway/give` - `requireAuth`; `giveB2Coins` resolves the amount (from the product if given), checks the recipient is an office member, rejects amounts above wallet plus giving power, records a `Bat246B2CoinTransaction`, debits the wallet first and then the pools, credits the recipient, and returns `{ ok, eligibility, amount, breakdown }`.
  - `POST /backend/bat246/layaway/request` - `requireAuth`; `createLayawayRequest` stores a request (model `Bat246LayawayRequest`) and returns `{ ok, request }`.
  - Search endpoints via `LayawayUserSearch`: `GET /backend/bat246/layaway/recipients/search`, `GET /backend/bat246/layaway/eligible-people`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `components/bat246/modals/LayawayUserSearch.tsx` - person pickers and the `LayawayPickedUser` type; `components/bat246/types.ts` - `BoardData` type.
- **Packages:** `react` - state/effects; `react-dom` - `createPortal`; `sonner` - `toast.custom`, `toast.dismiss`; `lucide-react` - icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx` (when `openModal === "layaway"`).
- `app/(dashboard)/games/bat246/B2CoinWallet/page.tsx` (route `/games/bat246/B2CoinWallet`), its "Transact" button.

## Notes
- The two product ids are hardcoded here and duplicated in `SnapBackLoanModal.tsx` and elsewhere in the app; changing the entry products means updating every copy.
- `fetchAll` does not check `res.ok`; an error response simply yields no eligibility and a zero balance.
- The admin (`isAlanK`) is decided by the server, not by this component.

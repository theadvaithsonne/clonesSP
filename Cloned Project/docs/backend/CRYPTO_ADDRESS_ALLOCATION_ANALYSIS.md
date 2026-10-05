# Crypto invoices — per-invoice unique deposit addresses

## Context

Today's crypto invoice-pay flow uses **one fixed platform address per (chain, currency)** and disambiguates concurrent invoices by tail-jittering the expected amount:

- Founder picks USDT-Polygon → we return the shared address `0xPLAT…` + expected atomic amount `<usd-cents * 10⁴> + tail(invoiceId)` where `tail = sha256(invoiceId) % 99899 + 100`.
- Poller sweeps every N seconds via Etherscan V2 for that chain, matches incoming transfers on `(chain, expectedAmountAtomic)` to a pending `CryptoPaymentRequest`, and settles the invoice.
- The tail is what makes two simultaneous $50 invoices distinguishable — one asks $50.001543, the other $50.007821.

The founder wants a cleaner model: **allocate a unique deposit address per invoice** so an overpayment / re-send from the same customer still resolves to the right invoice, and the amount tail can go away.

## Locked decisions

1. **Per-invoice address** — each `CryptoPaymentRequest` gets its own deposit address when the customer commits to (chain, currency). Two customers paying at the same time see two different addresses.
2. **Address expiry** — 24h payment window (configurable via `CRYPTO_INVOICE_TTL_MINUTES`). If the window elapses unfunded, the request expires and the address is **shelved forever, never recycled**. Recycling adds sweep + reallocation state for zero cost benefit (see stack pick — allocation is free).
3. **Drop the amount tail** — address IS the identifier. `expectedAmountAtomic` becomes just `usd-cents → atomic` with no jitter. Over- or under-payment is handled explicitly (see §5).
4. **Detection = webhook + poller** — webhook is the fast path (~10s latency). The existing poller stays as reconciliation (5-10 min) to catch missed / dropped webhooks. Both settle by looking up the destination address, no more amount matching.
5. **Provider = self-hosted HD wallet** (see next section for the survey and why). Zero vendor fees, unlimited addresses, no per-address cost. Trade-off: WE own the private key material, needs a KMS story.

## Provider survey

Comparing the three options: Fireblocks, BitGo, self-hosted. Numbers below are as of Aug 2026 (sources: Fireblocks pricing page, BitGo billing methodology, and TRON energy calculators).

| Option | Fixed cost / mo | Sweep / gas burden | Setup effort | Custody risk on us |
|---|---|---|---|---|
| **Fireblocks** Essentials | $999/mo (6-mo min) or ~$36k/yr enterprise | Fireblocks manages gas + auto-consolidates | 2–3 weeks (SDK + vault setup + webhook + compliance review) | Low — MPC keys, they carry insurance |
| **BitGo** Wallet-as-a-Service | Requires $1M assets under custody + $1M/mo txn floor. Above $100k AUC: 5 bps/mo. | Auto-forwarding smart-contract addresses on EVM. Non-EVM (Tron) needs manual consolidation API calls. | 2–3 weeks | Low — regulated qualified custodian |
| **Self-hosted HD wallet** (BIP32 seed + `hdkey` + `ethers.js` + `tronweb`) | $0 vendor cost | **Ours to run** — every sweep costs gas we pay: Polygon ~$0.001/sweep, BSC ~$0.05, Tron ~$2 per sweep (or $0 if we stake ~5000 TRX for energy) | 3–5 days | **All on us** — seed leak = every deposit stealable |

### Plain-English deep dive — what each option actually looks like

Same customer flow across all three: buyer picks USDT-Polygon, we hand them an address, they pay, we settle the invoice, we later cash out. The differences are in who does the operational work between "customer sends coins" and "money in our treasury."

#### Option A — Fireblocks

1. On sign-up you get a "workspace" and create a "vault account" for each chain (Polygon, BSC, Tron). Vaults are Fireblocks-hosted; the private keys are split across their MPC nodes — nobody, not even Fireblocks, has the whole key.
2. When our buyer commits to crypto, we call Fireblocks: "give me a fresh USDT-Polygon deposit address." Fireblocks internally derives one under the vault and returns it. Costs nothing per address.
3. Buyer sends USDT to that address. Fireblocks watches the chain, fires a `transaction.status.updated` webhook at our backend (with the destination address, amount, tx hash, confirmations). Latency: seconds.
4. Fireblocks routinely sweeps deposits into a "master" vault on a schedule you configure. They pay the gas from a "gas station" account you pre-fund with TRX / MATIC / BNB. We don't touch private keys, don't run wallets, don't build a sweeper.
5. To cash out to a bank / external wallet, we submit a withdrawal in Fireblocks' console, wait for policy approvals we've configured, they broadcast.
6. **What we pay for**: the $999/mo entry tier, plus gas we pre-fund. **What we don't do**: manage keys, build a sweeper, worry about seed leaks.
7. **Realistic to buy today**: no — Fireblocks won't sign a $12k/yr customer unless our expected crypto volume already justifies that spend. And a 6-mo commitment is a big first bite.

#### Option B — BitGo

1. Similar shape: create a wallet per coin (USDT-Polygon, USDT-BSC, USDT-Tron) in the BitGo console. BitGo's "TSS" architecture splits the key three ways — you hold one share, BitGo one, a backup one.
2. Per-invoice address minting via API — for EVM chains, BitGo returns a "forwarder contract address" that AUTO-forwards any incoming deposit into your main wallet root address the moment it lands. No sweeper to build on Polygon/BSC. For Tron, you have to call BitGo's `consolidate` API periodically to move funds off receive addresses to the root.
3. Deposit detection via BitGo's webhooks. Same schema pattern (address, amount, tx hash).
4. Withdrawals need co-signing — you sign with your key share, BitGo counter-signs, that's the whole security story.
5. **What we pay for**: BitGo starts at $1M assets-under-custody minimum — meaning if we don't keep at least $1M of USDT-etc parked in their wallets, they either won't onboard or bill a floor fee. Their public billing page describes 5 bps/mo on AUC above $100k, plus percentage transaction fees.
6. **Realistic to buy today**: no — the $1M AUC floor is a non-starter until crypto volume grows a lot. This is a "call us in a year" option.

#### Option C — Self-hosted HD wallet (RECOMMENDED for now)

**What "HD wallet" means in one paragraph.** You generate ONE secret (a 12- or 24-word BIP39 seed phrase). From that one secret, a standard math tree lets you derive an unlimited number of child key pairs at deterministic positions — path #0, #1, #2, and so on. Each child key pair converts to a public address on whichever chain you want (EVM chains all use the same format; Tron uses a different format but from the same seed with a different path). So one backed-up seed = infinite addresses across every chain, all recoverable from that one phrase. This is how MetaMask and every hardware wallet already work under the hood.

**End-to-end flow, step by step:**

1. **One-time setup (ops).** Generate a fresh BIP39 12-word mnemonic on an offline machine. Write it down on paper (2 copies, physically separated). Encrypt the digital copy with our KMS (AWS KMS / GCP Secret Manager) and store the ciphertext in the secret store our backend already uses for Razorpay etc. Backend reads it at boot into RAM, never writes it anywhere else. If the seed ever leaks, we generate a new one and drain old addresses to fresh ones — a bad night, but survivable.

2. **Per-chain address counter.** A small DB collection stores "for chain X, the next unused derivation index is N." Every time we need a new address, we atomically bump this counter. That's the ONLY thing we need in the DB for allocation — atomicity is the whole security guarantee against giving two invoices the same address.

3. **Buyer commits to crypto.** They pick USDT-Polygon on the checkout. Our `select-payment-method` route:
   - Bumps the Polygon counter (say it returns index 431).
   - Derives address #431 in the seed's Polygon tree — a pure math operation, no network call.
   - Writes a new `CryptoPaymentRequest` with `{invoiceId, chain:polygon, address:0x…, expiresAt: 24h out}`.
   - Returns the address + amount + expiry to the frontend.

4. **Buyer sends USDT to that address.** It lands as a normal Polygon transaction. The `to` field is our derived address. On-chain, that address doesn't exist as a "wallet" — it's just a public key hash — but if funds arrive there, we control them because we can derive the private key from the seed + index 431.

5. **We hear about the deposit two ways:**
   - **Fast path (WebSocket listener).** Our backend keeps an open WebSocket to a Polygon RPC endpoint (Alchemy / QuickNode free tier). It subscribes to `Transfer` events on the USDT contract, filtered by `to ∈ our-address-set`. When a matching event lands, we settle the invoice within ~10 seconds.
   - **Slow path (polling reconciliation).** The existing 5-10 min poller still runs and re-queries Etherscan/similar in case a WS event was missed.
   - Same webhook-handler code services both paths, deduped by tx hash.

6. **Settlement.** We look up the `CryptoPaymentRequest` by address, mark the invoice paid, credit the seller, distribute commissions. If the amount was more than expected, credit the excess to the buyer's store wallet as a top-up. If less, keep the invoice open and record a partial credit.

7. **Money is still sitting in derived address #431.** It's ours (we can spend it), but every subsequent deposit lands in different addresses (#432, #433…) which are also ours but each one is on its own "island." To actually USE these funds we have to **sweep** them into a treasury address. This is the biggest ops piece and the piece Fireblocks/BitGo do for us:
   - Every N hours (or when a derived address balance crosses a threshold, e.g. $100 USDT), a **sweeper job** picks addresses with balances, signs a transfer transaction from each one to a central "hot wallet" address we control, and broadcasts.
   - **The sweeper needs the private key online** to sign — this is the tradeoff of self-custody. Same seed the allocator uses, same in-RAM HDNode. If the box is compromised at sweep time, so are the sweep destinations.
   - **Gas budget.** Each sweep costs the chain's gas: Polygon ~$0.001, BSC ~$0.05, Tron ~$2 per sweep (or effectively $0 if we stake ~5000 TRX ≈ $1500 up front to get free daily energy). Every derived address needs a small "gas float" pre-funded on Tron just to be able to move USDT — this is Tron's quirk, not ours.
   - **Batching.** Wait for 10-20 deposits to accumulate before sweeping to amortize the fixed setup cost per address (especially on Tron where the first sweep from a "fresh" address costs 2× the recurring rate).

8. **Withdrawing / cashing out** from the hot wallet to a bank or an exchange OTC desk is a manual ops task — same as today.

**What we pay for**: $0 vendor. Real costs are (a) engineering time to build allocator + WS listener + sweeper (3-5 days), (b) sweep gas fees (~pennies on EVM, ~$2/sweep on Tron unless we stake), (c) ongoing seed-management discipline. **What we own**: the seed, the sweeper reliability, the key-leak blast radius.

**Where self-hosted is genuinely dangerous:**
- If the mnemonic leaks (backend RCE, sloppy CI, dev laptop), an attacker who reads it can compute every derived private key we've ever used or will use, drain every deposit that hasn't been swept yet, and every deposit that arrives later on any of those addresses. Fireblocks / BitGo's MPC design makes this failure mode ~impossible.
- The sweeper is a piece of infra we now own — if it stops running (memory leak, RPC provider outage, missed deploys), funds pile up at derived addresses but the invoice is already settled from the buyer's POV. Days of missed sweeps = eventually a scramble to sweep dozens of addresses under manual supervision.
- Regulators / auditors / prospective enterprise customers may want a "who holds the keys" answer. "We do, in RAM, backed by KMS" is a defensible but not enterprise-grade answer.

**Where self-hosted is genuinely fine for us right now:**
- Volume is small (crypto invoices are a tiny share of total invoices today).
- The security burden is orders of magnitude cheaper than $999/mo Fireblocks bills over a year and a half.
- We already handle sensitive secrets (Razorpay keys, Agora certs, DB passwords) — the seed slots into the same discipline.
- Migration to Fireblocks / BitGo later is a straight swap of the allocator + settlement modules — the invoice model, poller, settlement flow stay identical.

### Recommendation

**Ship self-hosted HD** for the next 6-12 months. Cap total unswept crypto float at, say, $10k across all chains with an alert — if we ever cross it we accelerate the Fireblocks / BitGo conversation because the risk becomes proportional to a vendor's monthly floor fee. Design the allocator + settlement so we can swap providers later without touching invoice or commission code.

---

## Design

### 1. Seed + key management

- New env var: `CRYPTO_WALLET_MNEMONIC` (BIP39 12-word). Loaded once at boot, converted to a `HDNode` (kept in-process — never written to logs or DB).
- In production: mnemonic lives in KMS-encrypted secret manager (whatever we already use for Razorpay/Stream secrets). Boot pulls plaintext into RAM, KMS never contacted again during the process lifetime.
- Derive at boot; keep the HDNode as a module singleton in a new `src/services/cryptoWallet.ts`. Guard: if env var missing, crypto invoice-pay is disabled the same way `NOWPAYMENTS_API_KEY` used to gate it (see the fix we shipped for the broken gate; same shape, new key).

### 2. Address derivation

New module: `src/services/cryptoAddressAllocator.ts`.

Exports one function:
```ts
async function allocateAddress(chain: SupportedChain): Promise<{
  address: string;
  derivationIndex: number;
}>
```

Backing state: new collection `CryptoAddressCounter` — one row per chain with a monotonically-incrementing `nextIndex`. `findOneAndUpdate({chain}, {$inc: {nextIndex: 1}}, {new: true, upsert: true})` returns the next slot atomically. Derivation:
- **EVM (polygon, bsc, ethereum…)** — path `m/44'/60'/0'/0/{index}`, pubkey → checksummed address via `ethers.utils.computeAddress` + `ethers.utils.getAddress`.
- **Tron (tron)** — path `m/44'/195'/0'/0/{index}`, pubkey → Tron address via `tronweb.utils.transaction.getAddressFromPubkey` (or equivalent — pubkey → keccak → last 20 bytes → base58check with `0x41` prefix).

The counter is DB-backed (not derived from `CryptoPaymentRequest` count) because we NEVER want to reuse an index — a slow query that reads the max index has a race that would hand two requests the same address. Atomic `$inc` on a dedicated doc is the only safe primitive.

### 3. `CryptoPaymentRequest` schema changes

**File:** `src/models/cryptoPaymentRequest.model.ts`

Add fields:
- `derivationIndex: Number` — the HD tree index. Required for new rows.
- `addressExpiresAt: Date` — `createdAt + CRYPTO_INVOICE_TTL_MINUTES` (default 1440 = 24h). Required for new rows.
- `status: "pending" | "paid" | "expired" | "needs_review"` — already exists; new terminal state `"expired"` for the TTL sweep.
- `swept: Boolean`, `sweepTxHash: String`, `sweptAt: Date` — used by the funds sweeper (§7).

Add indexes:
- `{ platformAddress: 1 }` **unique, partial** on `status: {$in: ["pending", "needs_review"]}` — the fast lookup for webhook + poller. Partial so a shelved / paid address doesn't block a hypothetical future reuse (we never reuse in practice — just future-proofing).
- `{ addressExpiresAt: 1, status: 1 }` — the sweeper cron picks pending rows past their TTL.
- `{ status: 1, swept: 1 }` — the funds sweeper's target list.

**Removed / deprecated:**
- The `tail`-based `expectedAmountAtomic` derivation → `expectedAmountAtomic = usdCentsToAtomic(usdCents, chain)` (no jitter). Existing helpers `usdCentsAndTailToAtomic` stay for backwards-compat lookup of legacy rows but are NOT called on new writes.
- Old shared platform addresses in `src/config/cryptoWallets.ts` remain **only** as fallback for legacy `CryptoPaymentRequest` rows created before this ship — the poller still needs to recognize incoming deposits to those addresses to settle already-issued invoices.

### 4. Allocation flow — `select-payment-method` → address minted

**File:** `src/routes/invoice.ts::select-payment-method`

Today: the endpoint records the chosen chain+currency but doesn't mint anything — the address the customer sees comes back on the next `/invoices/:id/crypto` fetch. Change:

1. When the customer picks `paymentMethod: "crypto"` + chain + currency, IMMEDIATELY:
   - Reject if `resolveBuyerGstRegion(...)` says India (unchanged — we shipped that gate already).
   - Compute chain/currency support via `SUPPORTED_CHAINS` (unchanged).
   - Call `allocateAddress(chain)` — returns `{address, derivationIndex}`.
   - Compute `expectedAmountAtomic` from the invoice's USD cents, no tail.
   - Upsert a `CryptoPaymentRequest` with `{invoiceId, chain, currency, platformAddress: address, derivationIndex, expectedAmountAtomic, addressExpiresAt: now + TTL, status: "pending"}`.
   - If chain is Tron, fire-and-forget a `sendGasFloat(address, CRYPTO_TRON_GAS_FLOAT_TRX)` call so the address can pay its own USDT-transfer energy at sweep time. (EVM chains only need the float if we choose to also pre-fund; on Polygon it's basically free.)
2. Return the address + expiry timestamp + expected amount in the response, so the FE renders "send X USDT to this address before HH:MM" in one round-trip.
3. Idempotency — if the invoice already has a pending non-expired `CryptoPaymentRequest` for the same (chain, currency), return that existing row instead of minting a new address.

**FE change:** `PaymentMethodSelector.tsx` / `CheckoutPaymentStep.tsx` already read `paymentChannel: "crypto"` — no change to the gate. The QR + copy-address panel now shows the per-invoice address + a countdown to `addressExpiresAt`. If the user leaves the page and returns after expiry, they see a "regenerate address" CTA that hits `select-payment-method` again.

### 5. Settlement — webhook primary, poller fallback, both address-keyed

**File:** `src/services/cryptoPaymentPoller.ts` — refactor the match logic.

Current match: `find pending CryptoPaymentRequest where chain=X and expectedAmountAtomic=Y`. New match: `find pending CryptoPaymentRequest where platformAddress=Z and status in ["pending","needs_review"]`.

- **Address-only match** — the address is the invoice identifier now.
- **Overpayment** — settle the invoice as paid; the excess amount is credited to the buyer's store-wallet with a `WalletTransaction` `{kind: "crypto_overpayment_credit", dedupeKey: sha256(txHash)}` and a note on the invoice.
- **Underpayment** — invoice stays `pending`. The partial deposit is recorded as `WalletTransaction {kind: "crypto_partial_credit"}` and the customer can top up. (This is a genuine UX improvement over today, where an underpayment silently sits in the shared address forever.)
- **Late payment (past `addressExpiresAt`)** — the address is still ours (shelved, not recycled), so the deposit still credits the buyer's wallet with `kind: "crypto_late_credit"`. The invoice does NOT auto-settle because it's already `expired`; ops can manually reconcile.
- **Legacy rows** — if match on `platformAddress` fails, fall back to the old `(chain, expectedAmountAtomic)` match for `CryptoPaymentRequest` rows without a `derivationIndex` field. Sunset the fallback after all pre-migration requests time out (~30 days).

**New webhook endpoint:** `POST /crypto/deposit-notify` (mounted with an HMAC-shared-secret guard, `X-Signature: hmac-sha256(rawBody, CRYPTO_DEPOSIT_WEBHOOK_SECRET)`). Same payload shape whether we swap to Cobo/Fireblocks later or roll our own listener:
```ts
{ chain: SupportedChain, address: string, amountAtomic: string, txHash: string, confirmations: number }
```
Handler: same match + settle path the poller uses. Deduped by `txHash` via a `WalletTransaction.metadata.txHash` unique-partial index.

**Self-hosted webhook source** — because we're not using a provider, the "webhook" is actually just our own listener that watches the mempool/blocks:
- For **EVM chains** (Polygon, BSC): a per-chain WebSocket subscription (`wss://polygon-rpc.com` or Alchemy-style provider) to `newHeads` + a filter for `Transfer(from, to, value)` events on the USDT/USDC contract where `to ∈ known-address-set`. On match, hit our own `/crypto/deposit-notify` internally.
- For **Tron**: TronGrid doesn't do WebSockets reliably — keep the existing HTTP poller as the primary detection channel there. Same 5-10 min latency as today.

Wire this listener in a new lightweight process — a boot hook inside the existing backend process is fine (spins up a WS per chain on server start, restarts on disconnect). No separate deploy target.

### 6. Address-TTL sweeper (cron)

New cron in the existing cron worker: every 5 minutes, `updateMany({status: "pending", addressExpiresAt: {$lt: now}}, {$set: {status: "expired"}})`. That's it — the address stays claimed in the counter (not recycled), the DB just marks the request dead. FE polling picks up `status: "expired"` and shows the "regenerate" state.

### 7. Funds sweeper — moving deposits into treasury

This is the piece Fireblocks / BitGo would do for us. Since we're self-hosting, it's ours.

Two things need to exist:
- A **hot wallet** address per chain — an ordinary address we control (derived at seed index 0, or a totally separate address if we want the treasury key rotation-independent from the receive tree). This is where all deposits get pooled.
- A **sweeper cron** that runs every 15 min (configurable). For each chain, it:
  1. Reads the balance of each derived receive address that has a settled `CryptoPaymentRequest` and isn't already flagged `swept`.
  2. Batches addresses whose balance ≥ `CRYPTO_SWEEP_MIN_ATOMIC` (default $50 USDT to amortize gas — configurable per chain).
  3. For each address in the batch: derives its private key from the seed + index, builds a USDT transfer tx from that address to the chain's hot wallet, signs, broadcasts.
  4. Records the sweep tx hash on the `CryptoPaymentRequest` (`swept: true`, `sweepTxHash`, `sweptAt`) so we never sweep the same address twice.

**Tron-specific gotcha — energy pre-funding.** Every derived Tron address needs a small TRX balance BEFORE it can send USDT (the transfer costs ~65k energy = ~6.5 TRX = ~$2 per sweep unless we stake for free energy). Two options:
- **Cheap short-term**: send ~10 TRX to each derived Tron address at allocation time (a "gas float"). Adds ~$3 cost per Tron invoice regardless of whether it settles.
- **Cheap long-term**: stake ~5000 TRX (~$1500) on a dedicated staking address, delegate its daily energy allocation to the sweeper. Cover ~1 sweep/day for free forever. Only worth it if we do >1 Tron invoice/day sustained.
- Ship the cheap short-term option first (simpler code), stake later once Tron volume justifies it.

**EVM gas float.** Polygon and BSC gas is trivial (~$0.001 and ~$0.05 per sweep respectively), but each derived EVM address still needs a tiny native-coin balance to pay gas at sweep time. Same "gas float" pattern: send $0.10 of MATIC / BNB to each derived EVM address at allocation. On Polygon that's basically free.

**Failure modes:**
- Sweep tx broadcast fails → retry with backoff, alert on 3 consecutive failures for the same address.
- Sweep tx broadcasted but not confirmed within 10 min → re-check on-chain; if truly missing, resign with higher gas and re-broadcast. Never mark `swept: true` until confirmation.
- Hot wallet gets drained (compromised or intentional withdrawal) → the sweeper doesn't care, still funnels deposits into it. Alerting on hot-wallet balance drop separately.
- Total unswept balance breaches a threshold (`CRYPTO_UNSWEPT_ALERT_USD`, default $10k) → page ops. This is our tripwire for "time to move to Fireblocks/BitGo."

**Ops dashboard (later).** A simple `/garage-admin/crypto-treasury` page listing: total balance per chain, unswept float per chain, recent sweeps with tx-hash links to the block explorer, alert thresholds. Not in this ship — a follow-up once the sweeper is live and we want visibility.

### 8. Config knobs

New env vars:
- `CRYPTO_WALLET_MNEMONIC` — BIP39 seed, mandatory for HD-derived addresses to work.
- `CRYPTO_INVOICE_TTL_MINUTES` — default 1440 (24h).
- `CRYPTO_DEPOSIT_WEBHOOK_SECRET` — HMAC key for the internal webhook route.
- `CRYPTO_WS_RPC_URL_POLYGON`, `CRYPTO_WS_RPC_URL_BSC` — WebSocket RPC endpoints for the address-watcher.
- `CRYPTO_HOT_WALLET_ADDRESS_{POLYGON,BSC,TRON}` — the treasury destination the sweeper drains into.
- `CRYPTO_SWEEP_MIN_USD` — default 50 (skip sweeping addresses with balance under this).
- `CRYPTO_UNSWEPT_ALERT_USD` — default 10000 (pages ops when total unswept float exceeds this).
- `CRYPTO_TRON_GAS_FLOAT_TRX` — default 10 (TRX auto-sent to each new derived Tron address so it can pay its own USDT-transfer energy at sweep time).
- `CRYPTO_EVM_GAS_FLOAT_USD` — default 0.10 (native-coin equivalent auto-sent to each new derived EVM address for sweep gas).
- `CRYPTO_HD_ENABLED_CHAINS` — comma-separated allowlist for the Phase 2 rollout (e.g. `polygon,bsc`).

Extend the boot-time gate in `cryptoPaymentPoller.ts` — today it warns if `NOWPAYMENTS_API_KEY` missing; new gate should refuse crypto invoice-pay if `CRYPTO_WALLET_MNEMONIC` is unset (and warn if the WS URLs are missing — fall back to poller-only).

## Migration sequence

Ship in three phases so we don't break any invoice mid-flight:

1. **Phase 1 (dark-launch derivation).** Deploy the HD wallet, allocator, counter collection, new schema fields (all optional). No behaviour change yet — new invoices still get the shared address via the existing path. Verify allocator produces valid addresses on all four chains by dry-run script.
2. **Phase 2 (per-chain rollout, feature-flagged).** Flip a per-chain flag (`CRYPTO_HD_ENABLED_CHAINS=polygon`) that causes `select-payment-method` to allocate a unique address for that chain only. Poller keeps both match paths (address-first, amount-tail fallback). Roll out chain-by-chain: Polygon → BSC → Tron (Tron last because we can't do WS there).
3. **Phase 3 (retire amount-tail).** After 30 days of clean settlements on all chains, remove `usdCentsAndTailToAtomic` from write paths (keep the read path forever for legacy rows). Drop the tail from the shared-address config.

## Files to touch

**Backend — new:**
- `src/services/cryptoWallet.ts` — HDNode singleton loaded from `CRYPTO_WALLET_MNEMONIC`.
- `src/services/cryptoAddressAllocator.ts` — `allocateAddress(chain)`, backed by `CryptoAddressCounter`.
- `src/models/cryptoAddressCounter.model.ts` — one row per chain, monotonic `nextIndex`.
- `src/services/cryptoAddressWatcher.ts` — EVM WebSocket listener wired at boot for supported chains.
- `src/services/cryptoFundsSweeper.ts` — the 15-min cron that batches derived-address balances into hot wallets.
- `src/services/cryptoGasFloat.ts` — sends the initial TRX / MATIC / BNB float to a new derived address so it can pay its own sweep-gas later.
- `src/routes/cryptoDepositWebhook.ts` — HMAC-guarded `POST /crypto/deposit-notify` route.
- `src/scripts/derive-test-addresses.ts` — dry-run helper that derives + prints the first 5 addresses per chain from a supplied mnemonic (for the Phase 1 verification step).

**Backend — modified:**
- `src/models/cryptoPaymentRequest.model.ts` — add `derivationIndex`, `addressExpiresAt`, `"expired"` status, `swept/sweepTxHash/sweptAt` fields; new indexes.
- `src/routes/invoice.ts::select-payment-method` — call `allocateAddress`, upsert `CryptoPaymentRequest` with unique address, return address + expiry.
- `src/services/cryptoPaymentRequest.ts` — drop tail jitter on new writes; introduce `usdCentsToAtomic` (no tail).
- `src/services/cryptoPaymentPoller.ts` — address-first match; legacy amount-tail fallback for pre-migration rows.
- `src/config/cryptoWallets.ts` — keep shared addresses (fallback only); add per-chain HD-enabled flag reader.
- `src/services/wallet.ts` — extend `WalletTransaction.metadata.kind` union with `crypto_overpayment_credit`, `crypto_partial_credit`, `crypto_late_credit`.
- Boot script (`src/index.ts` or equivalent) — spin up address watcher + funds sweeper; warn if `CRYPTO_WALLET_MNEMONIC` missing.

**Frontend — modified:**
- `components/checkout/CheckoutPaymentStep.tsx` — surface `addressExpiresAt` (countdown), show "regenerate address" CTA when expired.
- `components/checkout/PaymentMethodSelector.tsx` — no change (already gates on `paymentChannel: "crypto"`).

## Guardrails

- **Seed protection is EXISTENTIAL.** If the mnemonic leaks, every future customer deposit is stealable and every past deposit's private key is derivable. Store in KMS, never in git, never log the HDNode, and enforce access via IAM. Rotation = new seed + full re-derivation (existing pending rows keep their old addresses until they expire).
- **Counter atomicity.** `findOneAndUpdate($inc)` is the ONLY way to allocate. Never derive from `count()` or `max(derivationIndex)` — the race is a same-address collision.
- **Legacy compatibility.** The poller keeps the amount-tail match path forever (or until we manually verify zero pre-migration `CryptoPaymentRequest` rows remain). Don't remove until we've swept.
- **Rate limit the allocator.** A malicious guest hitting `select-payment-method` in a loop could burn thousands of indices. Add a per-invoice check: max 3 pending non-expired requests per invoice at any time.
- **India gate preserved.** `resolveBuyerGstRegion` still short-circuits before allocator runs — no burned indices for Indian buyers who never see crypto tabs.
- **Address enumeration is public.** Deriving `m/44'/60'/0'/0/{index}` addresses in order means anyone can predict the next N of our deposit addresses. That's OK for a payment processor (addresses are meant to receive), but be aware: never store non-payment value on these derived addresses.
- **WS reliability.** The EVM listener MUST auto-reconnect on disconnect. Track `lastBlockSeen` per chain and on reconnect, scan from that block to `latestBlock` so we don't miss deposits in a gap. Alert if `lastBlockSeen` falls > 100 blocks behind chain tip.

## Verification

1. **BE build** — `cd garagenew-backend && npm run build` clean.
2. **Derivation smoke test.** Run `src/scripts/derive-test-addresses.ts` with a throwaway mnemonic; assert the first Polygon / BSC / Tron addresses match what MetaMask + TronLink produce for the same seed at the same paths. If mismatch → derivation path bug, do NOT ship.
3. **Allocator concurrency.** Fire 100 concurrent `allocateAddress("polygon")` calls; assert 100 distinct addresses returned and `CryptoAddressCounter.nextIndex` incremented exactly 100.
4. **`select-payment-method` happy path.** Buyer picks USDT-Polygon on a $50 invoice. Response includes a unique 0x… address and an `addressExpiresAt` 24h out. Re-fetch = same address (idempotent). Second buyer on a different invoice at the same time gets a different 0x… address.
5. **Webhook settle.** Simulate a `POST /crypto/deposit-notify` with the allocated address, matching amount, valid HMAC. Assert invoice moves to `paid`, `WalletTransaction` written with `dedupeKey: sha256(txHash)`. Fire the same webhook twice → second call no-ops (dedupe).
6. **Poller reconciliation.** Skip the webhook step; let the poller run. Same settle behaviour, ~5-10 min slower. Legacy amount-tail row still settles via the fallback path — verify explicitly with a hand-crafted pre-migration `CryptoPaymentRequest` doc.
7. **Overpayment.** Buyer sends $60 to a $50 address. Invoice settles as paid; `WalletTransaction {kind: "crypto_overpayment_credit", amountUsdCents: 1000}` lands in buyer's store wallet.
8. **Underpayment.** Buyer sends $30 to a $50 address. Invoice stays `pending`; `WalletTransaction {kind: "crypto_partial_credit", amountUsdCents: 3000}` lands; FE shows "still $20 remaining".
9. **Expiry sweeper.** Set `CRYPTO_INVOICE_TTL_MINUTES=1`, mint a request, wait 2 min. Cron marks it `expired`. FE shows regenerate CTA. Re-hit `select-payment-method` returns a NEW address (old counter index shelved forever).
10. **Late deposit to shelved address.** Send a deposit to an `expired` address. Assert deposit credits buyer wallet as `crypto_late_credit`, invoice does NOT auto-settle. Ops row shows up in a manual reconcile view (or a Slack alert).
11. **Funds sweeper end-to-end.** Fund a derived address on Polygon testnet with 100 USDT + a bit of MATIC. Trigger sweeper. Assert USDT moves from derived → hot wallet, `CryptoPaymentRequest.swept: true` + `sweepTxHash` written. Fire sweeper again → same address is skipped (already swept).
12. **India gate.** Buyer with Indian shipping address hits `select-payment-method` with `paymentMethod: "crypto"`. Assert 403 + no counter increment.
13. **WS reconnect.** Kill the Polygon RPC connection mid-run; assert the listener reconnects, backfills from `lastBlockSeen`, and no deposits within the gap are missed. Alert fires if backlog > 100 blocks.

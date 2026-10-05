// Payment-request service for the in-house crypto flow. Three surfaces:
//   createRequest — called when a customer picks Pay-with-crypto on an
//     invoice. Generates a unique amount-tail, persists the request,
//     returns everything the FE needs to render the payment panel.
//   findPendingByAmount — poller hot path. Given a chain + atomic
//     amount observed on-chain, returns the matching pending request
//     (or null when the amount doesn't correlate to any outstanding
//     request; also flips both to `needs_review` on collision).
//   markMatched — flips a request to matched, marks the invoice paid,
//     runs existing fulfillInvoice (which credits the seller in USD).
import crypto from "crypto";
import { Types } from "mongoose";
import {
  CryptoPaymentRequest,
  type ICryptoPaymentRequest,
  type CryptoChain,
  type CryptoCoin,
} from "../models/cryptoPaymentRequest.model";
import { Invoice } from "../models/invoice.model";
import { fulfillInvoice } from "./invoice";
import { getChainConfig } from "../config/cryptoWallets";
import {
  allocateAddress,
  isHdChainEnabled,
} from "./cryptoAddressAllocator";
import { env } from "../config/env";

// Crypto payment requests deliberately have NO customer-facing expiry:
// crypto txs settle asynchronously (miner queue, mempool congestion,
// wallet UX delays, customer walking away for coffee) and a 15-min
// window was killing legitimate late-settling payments. Set `expiresAt`
// 100 years out so every `expiresAt > now` filter downstream (matcher,
// idempotency, sweeper) remains structurally correct without a schema
// change. The `expireStaleRequests` daily sweep continues to run and
// simply matches nothing — safe to keep so we don't lose the machinery
// if we ever reintroduce expiry for policy reasons.
//
// Collision math consequence: the amount-tail derivation has 99,900
// slots. Without a TTL, ALL open pending requests compete for those
// slots. At today's volume this is safe; if concurrent pending requests
// ever exceed ~1000 the collision-flip-to-needs_review path (see
// findPendingByAmount below) will start firing.
const PAYMENT_WINDOW_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/**
 * Compute a stable, unique amount-tail for a given invoice.
 *
 * Range: 100..99_999 atomic units = 0.0001..0.099999 USDT/USDC
 * (max ~10¢ extra). Deterministic — same invoice always → same tail,
 * so FE reloads don't spawn duplicates.
 *
 * We deliberately start at 100 (0.0001) rather than 0 so the customer
 * visibly sees "weird cents" and can't accidentally send the round
 * amount. The upper bound is capped at ~10¢ so that:
 *   - A $1 invoice asks for at most $1.10 (10% max, not 100%)
 *   - A $100 invoice asks for at most $100.10 (0.1% max)
 *   - The customer perceives it as a rounding oddity, not a bait-and-switch
 *
 * Collision math with ~99,900 possible tails (no TTL — see
 * PAYMENT_WINDOW_MS above; requests stay pending until paid or manually
 * cancelled). The concurrent-pending-set is the whole open population,
 * not a rolling 15-min window:
 *   - 20 concurrent  → birthday paradox ≈ 0.4% collision
 *   - 100 concurrent → ≈ 5%
 *   - 500 concurrent → ≈ 71% — starts hurting
 * When a collision does happen the caller flips both to `needs_review`
 * and admin correlates by tx hash + timestamp. Widen the tail range
 * (e.g. 1_000..999_999 → 999k slots) if concurrent pending crosses ~200.
 */
function computeAmountTailAtomic(invoiceId: string): bigint {
  const hash = crypto.createHash("sha256").update(invoiceId).digest("hex");
  // First 8 hex chars = 32 bits of entropy. Mod into [0, 99_900),
  // then shift up by 100 so we're always ≥ 100 atomic (≥ 0.0001 unit).
  const tailRaw = parseInt(hash.slice(0, 8), 16);
  return BigInt(100 + (tailRaw % 99_900));
}

/** Combine the invoice's USD-cent base with the disambiguation tail
 *  into a coin's atomic amount.
 *
 *  Two-step conversion so we can honor `displayDecimals` — the largest
 *  decimals a wallet UI can render + accept as sender input:
 *
 *    1. Build the amount in DISPLAY units. Both the base cents and the
 *       tail live here, so the sender-facing "X.YYYYYY USDT" number is
 *       always at most `displayDecimals` places past the point.
 *    2. Scale up to the on-chain atomic unit if `decimals >
 *       displayDecimals` — pure zero-padding on the right.
 *
 *  For TRC-20 / ERC-20 / Polygon USDT (decimals = displayDecimals = 6):
 *  shift = 0, so this reduces to the historical
 *  `usdCents × 10^(decimals-2) + tail` formula — no behavior change.
 *
 *  For BEP-20 USDT (decimals=18, displayDecimals=6): shift=12.
 *  $10.099999 → 10_099_999 (display atomic) × 10^12
 *              → 10_099_999_000_000_000_000 wei on-chain, which every
 *  BEP-20 wallet renders as "10.099999 USDT" cleanly.
 */
function usdCentsAndTailToAtomic(
  usdCents: number,
  tailAtomicDisplay: bigint,
  coinDecimals: number,
  displayDecimals: number,
): bigint {
  // Base in display atomic: cents × 10^(displayDecimals − 2).
  const baseScale = BigInt(10) ** BigInt(displayDecimals - 2);
  const displayAtomic = BigInt(usdCents) * baseScale + tailAtomicDisplay;
  // If the on-chain unit is wider than the display unit, zero-pad the
  // low-order digits so wallets never round out the tail bytes.
  const shift = BigInt(coinDecimals - displayDecimals);
  return shift > 0n ? displayAtomic * 10n ** shift : displayAtomic;
}

/**
 * Human-readable amount, e.g. 1000423n → "1.000423" for a 6-decimal coin.
 *
 * When `displayDecimals` is smaller than `decimals` (e.g. BEP-20 USDT
 * where the token is 18-decimal but wallets show 6), we truncate the
 * low-order zero-padding so the sender sees "10.099999" — the exact
 * string every wallet UI will let them key in — rather than
 * "10.099999000000000000". The truncation is safe because
 * usdCentsAndTailToAtomic already put the significant digits at exactly
 * `displayDecimals` positions past the point; anything beyond is zeros.
 */
function atomicToDisplay(
  atomic: bigint,
  decimals: number,
  displayDecimals?: number,
): string {
  const displayDec = displayDecimals ?? decimals;
  const div = BigInt(10) ** BigInt(decimals);
  const whole = atomic / div;
  const frac = atomic % div;
  const fracStr = frac.toString().padStart(decimals, "0");
  // Slice off the trailing zero-padding when displayDec < decimals.
  const shownFrac = fracStr.slice(0, displayDec);
  return `${whole}.${shownFrac}`;
}

export interface CreateCryptoRequestResult {
  requestId: string;
  chain: CryptoChain;
  coin: CryptoCoin;
  chainName: string;
  coinName: CryptoCoin;
  address: string;
  amount: string; // Display form, e.g. "1.000423"
  amountAtomic: string;
  decimals: number;
  expiresAt: Date;
  contractAddress: string;
}

/**
 * Create (or reuse) a pending payment request for an invoice.
 *
 * Reuses when: an existing `pending` request already exists for this
 * (invoice, chain, coin) tuple AND hasn't expired. This makes the
 * endpoint idempotent — a FE reload doesn't spawn a fresh row and the
 * customer keeps seeing the same address + amount + countdown.
 *
 * `amountInUsdCents` MUST be passed by the caller. USDT/USDC are
 * treated as 1:1 with USD, so the crypto amount is always derived
 * from the USD-cents equivalent of the invoice — never from
 * `invoice.totalAmount` directly (which lives in the invoice's
 * `itemCurrency` smallest unit, e.g. paise for INR invoices).
 * Passing INR paise here would ask the customer for 23 USDT on a
 * ₹23 invoice.
 */
export async function createRequest(
  invoiceId: string,
  chain: CryptoChain,
  coin: CryptoCoin,
  amountInUsdCents: number
): Promise<CreateCryptoRequestResult> {
  const cfg = getChainConfig(chain, coin);
  if (!cfg) {
    throw new Error(
      `Chain/coin not supported or platform wallet unconfigured: ${chain}/${coin}`
    );
  }
  if (!Number.isFinite(amountInUsdCents) || amountInUsdCents <= 0) {
    throw new Error(
      `createRequest requires a positive amountInUsdCents (got ${amountInUsdCents})`
    );
  }

  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  if (invoice.status === "paid") {
    throw new Error(`Invoice ${invoiceId} is already paid`);
  }

  // ─── HD-derived path ────────────────────────────────────────────
  // When the mnemonic is set AND this chain is in
  // CRYPTO_HD_ENABLED_CHAINS, allocate a unique address for every
  // request. Address IS the identifier — no amount-tail, no birthday-
  // paradox collisions, no needs_review path. Legacy chains (or
  // chains not yet rolled out) fall through to the shared-address
  // block below with zero behavior change.
  if (isHdChainEnabled(chain)) {
    return createHdDerivedRequest({
      invoiceId,
      chain,
      coin,
      amountInUsdCents,
      cfg,
    });
  }

  // Compute the fresh expected amount up-front so we can compare it
  // against any existing pending row's amount. The tail derivation is
  // deterministic per invoiceId, so the ONLY reason two same-invoice
  // requests would have different `expectedAmountAtomic` values is a
  // base-amount change (e.g. the caller upstream started converting
  // INR → USD after previously passing paise-as-cents — commit
  // ebcb8cb). If bases diverge, reusing the old row silently asks the
  // customer for the wrong amount and the poller never matches.
  const displayDecimals = cfg.displayDecimals ?? cfg.decimals;
  const tailAtomic = computeAmountTailAtomic(invoiceId);
  const expectedAtomic = usdCentsAndTailToAtomic(
    amountInUsdCents,
    tailAtomic,
    cfg.decimals,
    displayDecimals,
  );
  const expectedDisplay = atomicToDisplay(
    expectedAtomic,
    cfg.decimals,
    displayDecimals,
  );
  const expectedAtomicStr = expectedAtomic.toString();

  // Idempotency: reuse a live pending request ONLY when its expected
  // amount matches what we'd mint fresh. A repeat FE load with the
  // same base preserves the countdown; a stale pre-fix row gets
  // expired and superseded so a fresh row goes out with the correct
  // amount.
  const now = new Date();
  const existing = await CryptoPaymentRequest.findOne({
    invoiceId: new Types.ObjectId(invoiceId),
    chain,
    coin,
    status: "pending",
    expiresAt: { $gt: now },
  });
  if (existing) {
    if (existing.expectedAmountAtomic === expectedAtomicStr) {
      return {
        requestId: existing._id.toString(),
        chain: existing.chain,
        coin: existing.coin,
        chainName: cfg.chainName,
        coinName: existing.coin,
        address: existing.platformAddress,
        amount: existing.expectedAmountDisplay,
        amountAtomic: existing.expectedAmountAtomic,
        decimals: cfg.decimals,
        expiresAt: existing.expiresAt,
        contractAddress: cfg.contractAddress,
      };
    }
    // Amount drift — the row is misconfigured. Expire it so the
    // poller's findPendingByAmount (which filters expiresAt > now)
    // stops considering it, and continue to the create branch below.
    await CryptoPaymentRequest.updateOne(
      { _id: existing._id, status: "pending" },
      { $set: { status: "expired" } },
    );
    console.warn(
      `[cryptoPaymentRequest] Expired stale pending row ${existing._id} (was ${existing.expectedAmountAtomic}, now expects ${expectedAtomicStr}) — creating fresh request for invoice ${invoiceId}`,
    );
  }

  const created = await CryptoPaymentRequest.create({
    invoiceId: new Types.ObjectId(invoiceId),
    chain,
    coin,
    platformAddress: cfg.platformAddress,
    expectedAmountAtomic: expectedAtomicStr,
    expectedAmountDisplay: expectedDisplay,
    expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MS),
    status: "pending",
  });

  return {
    requestId: created._id.toString(),
    chain: created.chain,
    coin: created.coin,
    chainName: cfg.chainName,
    coinName: created.coin,
    address: created.platformAddress,
    amount: created.expectedAmountDisplay,
    amountAtomic: created.expectedAmountAtomic,
    decimals: cfg.decimals,
    expiresAt: created.expiresAt,
    contractAddress: cfg.contractAddress,
  };
}

/**
 * HD-derived request creation. One unique deposit address per invoice
 * (allocated fresh from CRYPTO_WALLET_MNEMONIC via the atomic counter);
 * the amount is the round USD-cents equivalent — no tail jitter. The
 * settlement side matches on address, not amount.
 *
 * Idempotency: if a still-pending HD-derived row already exists for
 * (invoice, chain, coin) that hasn't hit its addressExpiresAt yet, we
 * return it as-is. A FE reload gets the same address + amount + count-
 * down and doesn't burn a new counter index.
 */
async function createHdDerivedRequest(params: {
  invoiceId: string;
  chain: CryptoChain;
  coin: CryptoCoin;
  amountInUsdCents: number;
  cfg: ReturnType<typeof getChainConfig>;
}): Promise<CreateCryptoRequestResult> {
  const { invoiceId, chain, coin, amountInUsdCents, cfg } = params;
  if (!cfg) throw new Error("createHdDerivedRequest: missing chain config");

  const displayDecimals = cfg.displayDecimals ?? cfg.decimals;

  // Amount computation forks by coin type:
  //   USD-pegged (USDT/USDC): 1:1, no rate lookup. Round USD-cents →
  //   token atomic units directly.
  //   Native (ETH, BTC): USD-priced → coins at LIVE FX. Rate captured
  //   at mint and stamped on the request so reconciliation can
  //   reconstruct it. If CoinGecko is unreachable we throw — the
  //   caller (select-payment-method) surfaces a 500 and the buyer
  //   retries. Better than locking in a stale rate on a moving market.
  let roundAtomic: bigint;
  let usdPerCoinAtMint: number | undefined;
  if (cfg.isNative) {
    // Native FX-priced coins: ETH on Ethereum, BTC on Bitcoin. Rate
    // captured at mint via CoinGecko; anything else on the native
    // path is a config error.
    if (coin !== "ETH" && coin !== "BTC" && coin !== "POL") {
      throw new Error(
        `createHdDerivedRequest: native coin ${coin} not supported by FX service yet`,
      );
    }
    const { usdCentsToNativeAtomic } = await import("./cryptoFxRate");
    const conv = await usdCentsToNativeAtomic(
      amountInUsdCents,
      coin,
      cfg.decimals,
    );
    roundAtomic = conv.atomic;
    usdPerCoinAtMint = conv.usdPerCoin;
  } else {
    // No tail — round amount only. Address disambiguates.
    roundAtomic = usdCentsAndTailToAtomic(
      amountInUsdCents,
      0n,
      cfg.decimals,
      displayDecimals,
    );
  }

  const roundDisplay = atomicToDisplay(roundAtomic, cfg.decimals, displayDecimals);
  const roundAtomicStr = roundAtomic.toString();

  const now = new Date();
  // Hardcoded to 15 min per Shorupan (2026-09-22). Deliberately not
  // env-driven so a deploy-time typo can't silently restore the old
  // 24h window. If ops-tunable behavior is ever needed again, re-add
  // an env read here — the previous env slot has been removed.
  const INVOICE_TTL_MINUTES = 15;
  const ttlMs = INVOICE_TTL_MINUTES * 60 * 1000;

  // Idempotency: reuse an existing HD-derived pending row for the same
  // (invoice, chain, coin) that hasn't expired.
  const existing = await CryptoPaymentRequest.findOne({
    invoiceId: new Types.ObjectId(invoiceId),
    chain,
    coin,
    status: "pending",
    isHdDerived: true,
  });
  if (existing) {
    const stillFresh =
      !existing.addressExpiresAt || existing.addressExpiresAt.getTime() > now.getTime();
    if (stillFresh && existing.expectedAmountAtomic === roundAtomicStr) {
      return {
        requestId: existing._id.toString(),
        chain: existing.chain,
        coin: existing.coin,
        chainName: cfg.chainName,
        coinName: existing.coin,
        address: existing.platformAddress,
        amount: existing.expectedAmountDisplay,
        amountAtomic: existing.expectedAmountAtomic,
        decimals: cfg.decimals,
        expiresAt: existing.addressExpiresAt || existing.expiresAt,
        contractAddress: cfg.contractAddress,
      };
    }
    // Amount drift OR expired — retire the old row and allocate fresh.
    await CryptoPaymentRequest.updateOne(
      { _id: existing._id, status: "pending" },
      { $set: { status: "expired" } },
    );
    console.warn(
      `[cryptoPaymentRequest] Superseded HD row ${existing._id} (was ${existing.expectedAmountAtomic}, now ${roundAtomicStr}) — allocating fresh for invoice ${invoiceId}`,
    );
  }

  const derived = await allocateAddress(chain);
  const addressExpiresAt = new Date(now.getTime() + ttlMs);

  const created = await CryptoPaymentRequest.create({
    invoiceId: new Types.ObjectId(invoiceId),
    chain,
    coin,
    platformAddress: derived.address,
    derivationIndex: derived.derivationIndex,
    isHdDerived: true,
    addressExpiresAt,
    // Keep the legacy `expiresAt` far in the future so any code path
    // that still filters on it (findPendingByAmount, older idempotency
    // checks) continues to consider this row live. `addressExpiresAt`
    // is the real user-facing deadline for HD rows.
    expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MS),
    expectedAmountAtomic: roundAtomicStr,
    expectedAmountDisplay: roundDisplay,
    status: "pending",
    // Native coins (ETH/BTC): the USD-per-coin rate captured at mint.
    // Undefined for USD-pegged USDT/USDC.
    ...(usdPerCoinAtMint !== undefined ? { usdPerCoinAtMint } : {}),
  });

  return {
    requestId: created._id.toString(),
    chain: created.chain,
    coin: created.coin,
    chainName: cfg.chainName,
    coinName: created.coin,
    address: created.platformAddress,
    amount: created.expectedAmountDisplay,
    amountAtomic: created.expectedAmountAtomic,
    decimals: cfg.decimals,
    expiresAt: addressExpiresAt,
    contractAddress: cfg.contractAddress,
  };
}

/**
 * HD settlement fast-path. Given an incoming transfer's destination
 * address, look up the pending request that owns that address.
 *
 * Address is globally unique (partial-unique index on `platformAddress`
 * for status ∈ {pending, needs_review}), so at most one row can match.
 * Returns null when no pending HD-derived request owns this address —
 * caller falls back to the amount-based match (legacy shared-address
 * rows) or treats as an unmatched deposit.
 */
export async function findPendingByAddress(
  chain: CryptoChain,
  toAddress: string,
): Promise<ICryptoPaymentRequest | null> {
  if (!toAddress) return null;
  // Address casing: EVM is checksum-mixed but canonically equal under
  // lowercase; Tron is base58 and case-sensitive. The
  // cryptoPaymentPoller normalises before calling us.
  const match = await CryptoPaymentRequest.findOne({
    chain,
    platformAddress: toAddress,
    status: { $in: ["pending", "needs_review"] },
  });
  return match || null;
}

/**
 * Poller hot path. Given an incoming transaction on `chain` with
 * `atomicAmount`, look up the matching pending request.
 *
 * Returns:
 *   - the request when exactly one pending request matches
 *   - null when no pending request matches (unmatched payment — admin queue)
 *   - null when 2+ requests collide (both flipped to needs_review)
 */
export async function findPendingByAmount(
  chain: CryptoChain,
  atomicAmount: string
): Promise<ICryptoPaymentRequest | null> {
  const matches = await CryptoPaymentRequest.find({
    chain,
    expectedAmountAtomic: atomicAmount,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Collision — flip all matched rows to needs_review and return null
  // so the poller doesn't auto-fulfill anything ambiguous.
  await CryptoPaymentRequest.updateMany(
    { _id: { $in: matches.map((m) => m._id) } },
    { $set: { status: "needs_review" } }
  );
  console.warn(
    `[cryptoPaymentRequest] Amount collision on ${chain} @ ${atomicAmount}: ${matches.length} pending requests flipped to needs_review`
  );
  return null;
}

/**
 * Mark a pending request as matched, then run the standard invoice
 * fulfillment (which credits the seller's store wallet in USD and
 * distributes commissions — same code path as any other payment).
 *
 * Idempotent: if the request was already matched, does nothing. Safe
 * to retry from the poller on transient failure.
 */
export async function markMatched(params: {
  requestId: string;
  txHash: string;
  fromAddress?: string;
}): Promise<void> {
  const { requestId, txHash, fromAddress } = params;

  // Atomic transition: only flip if still pending. Prevents double
  // fulfillment if the poller races itself on retry.
  const request = await CryptoPaymentRequest.findOneAndUpdate(
    { _id: new Types.ObjectId(requestId), status: "pending" },
    {
      $set: {
        status: "matched",
        matchedTxHash: txHash,
        matchedAt: new Date(),
        matchedFromAddress: fromAddress,
      },
    },
    { new: true }
  );
  if (!request) {
    // Already matched (or expired/needs_review). Nothing to do.
    return;
  }

  // Now flip the invoice and run standard fulfillment.
  const invoice = await Invoice.findById(request.invoiceId);
  if (!invoice) {
    console.error(
      `[cryptoPaymentRequest] Invoice ${request.invoiceId} not found for matched request ${request._id}`
    );
    return;
  }
  if (invoice.status !== "paid") {
    invoice.status = "paid";
    invoice.paidAt = new Date();
    invoice.paymentPlatform = "crypto_wallet";
    invoice.metadata = {
      ...(invoice.metadata || {}),
      cryptoPaymentRequestId: request._id.toString(),
      cryptoChain: request.chain,
      cryptoCoin: request.coin,
      cryptoTxHash: txHash,
    };
    await invoice.save();
  }

  // fulfillInvoice handles commission distribution, seller USD credit,
  // per-itemType fulfillment, and (per the on-payment chain trigger we
  // shipped earlier) the next-child generation for recurring invoices.
  try {
    await fulfillInvoice(invoice, `crypto_${txHash}`);
    console.log(
      `[cryptoPaymentRequest] Matched + fulfilled invoice ${invoice.invoiceNumber} via ${request.chain}/${request.coin} tx ${txHash}`
    );
  } catch (err) {
    // Payment IS recorded (invoice.status = paid). Fulfillment failure
    // is a separate concern — log loudly so ops can retry via the
    // existing fulfillInvoice re-run path.
    console.error(
      `[cryptoPaymentRequest] fulfillInvoice failed for ${invoice.invoiceNumber} (payment recorded, fulfillment pending):`,
      err
    );
  }
}

/**
 * Sweep expired pending requests to `expired`. Runs daily. Not strictly
 * necessary for correctness (the pending filter in findPendingByAmount
 * already excludes them) but keeps admin queries tidy.
 */
export async function expireStaleRequests(): Promise<number> {
  const res = await CryptoPaymentRequest.updateMany(
    { status: "pending", expiresAt: { $lte: new Date() } },
    { $set: { status: "expired" } }
  );
  return res.modifiedCount || 0;
}

// In-house crypto payment request. Created when a customer picks
// "Pay with crypto" on an invoice; the amount-tail is unique per
// invoice so our chain poller can correlate an incoming on-chain
// transaction back to the right invoice.
//
// Statuses:
//   pending — waiting for the customer to send. Expires after 15 min.
//   matched — poller matched an incoming tx to this request; the
//             invoice has been marked paid and fulfillInvoice ran.
//   expired — expiresAt passed with no match. Payments arriving after
//             expiry land in the admin "unmatched" queue (no auto-match).
//   needs_review — two `pending` requests collided on the same expected
//             amount (should be ~1x/year at our scale). Admin picks apart
//             by tx hash / timestamp.
import { Schema, model, Types } from "mongoose";

export type CryptoChain = "tron" | "polygon" | "bsc" | "ethereum" | "bitcoin";
// "POL" is Polygon's native gas coin (renamed from MATIC in Sep 2024 —
// same on-chain token, new ticker). Treated as a native-priced invoice
// coin like ETH/BTC: USD-priced at mint via CoinGecko ("matic-network"),
// paid to the same 0x hot-wallet that receives USDT/USDC on Polygon.
export type CryptoCoin = "USDT" | "USDC" | "ETH" | "BTC" | "POL";
export type CryptoPaymentRequestStatus =
  | "pending"
  | "matched"
  | "expired"
  | "needs_review";

export interface ICryptoPaymentRequest {
  _id: Types.ObjectId;
  invoiceId: Types.ObjectId;
  chain: CryptoChain;
  coin: CryptoCoin;
  platformAddress: string;
  // Amount in the coin's atomic units (USDT/USDC on TRC-20/ERC-20 = 6
  // decimals, so 1_000000 = $1.00). Stored as string because 1M-scaled
  // integers can exceed 32-bit safely, and we want to preserve exact
  // equality semantics for the poller's Mongo lookup.
  expectedAmountAtomic: string;
  // Human-readable version cached for the FE (e.g. "1.000423" USDT).
  // The poller never reads this — it compares atomic strings.
  expectedAmountDisplay: string;
  expiresAt: Date;
  status: CryptoPaymentRequestStatus;
  matchedTxHash?: string;
  matchedAt?: Date;
  matchedFromAddress?: string;
  // ─── HD-derived deposit-address fields (self-hosted wallet) ─────
  // Present only on requests minted after the HD flag was flipped on
  // for the chain. Legacy rows leave these unset and settle via the
  // shared-address + amount-tail fallback in cryptoPaymentPoller.
  /** BIP44 index that derived `platformAddress` from CRYPTO_WALLET_MNEMONIC. */
  derivationIndex?: number;
  /** Marks HD-derived rows explicitly (defensive; presence of derivationIndex is the same signal). */
  isHdDerived?: boolean;
  /** When the address stops accepting on-time payments. TTL cron flips
   *  pending → expired past this timestamp. Deposits after expiry still
   *  credit the buyer's wallet but don't auto-settle the invoice. */
  addressExpiresAt?: Date;
  /** Funds-sweeper bookkeeping — has this derived address been drained
   *  into the treasury hot wallet? */
  swept?: boolean;
  sweptAt?: Date;
  sweepTxHash?: string;
  /**
   * Set when real crypto lands at this row's deposit address but the
   * payment could NOT settle the invoice (underpayment). The row stays
   * unmatched, so without this marker the admin sweeper — which filters
   * `status: "matched"` — would never list it and the funds would be
   * stranded on-chain with no UI path to recover them.
   */
  fundsReceivedAt?: Date;
  fundsReceivedTxHash?: string;
  fundsReceivedAtomic?: number;
  /**
   * Leftover-gas recovery bookkeeping. After an ERC-20/TRC-20 sweep the
   * deposit address still holds the native coin it was pre-funded with
   * to pay its own gas; `recoverLeftoverNative` drains that remainder
   * to the treasury and stamps the result here.
   *
   * These were previously written by the sweeper but NOT declared on
   * the schema, so Mongoose silently stripped them on save — every
   * recovery looked like it had never run, and there was no way to
   * tell a successful recovery from one that never fired. Declaring
   * them is what makes that observable.
   */
  nativeRecoveryTxHash?: string;
  nativeRecoveredAmount?: number;
  nativeRecoveryFailedReason?: string;
  nativeRecoveryAttemptedAt?: Date;
  /** For native-coin invoices (ETH, BTC): the live USD-per-coin rate
   *  captured at mint time and used to compute `expectedAmountAtomic`.
   *  Stamped so reconciliation can reconstruct the FX applied.
   *  Undefined for USD-pegged USDT/USDC (rate is 1 by definition). */
  usdPerCoinAtMint?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CryptoPaymentRequestSchema = new Schema<ICryptoPaymentRequest>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    chain: {
      type: String,
      enum: ["tron", "polygon", "bsc", "ethereum", "bitcoin"],
      required: true,
    },
    coin: {
      type: String,
      enum: ["USDT", "USDC", "ETH", "BTC", "POL"],
      required: true,
    },
    platformAddress: { type: String, required: true },
    expectedAmountAtomic: { type: String, required: true },
    expectedAmountDisplay: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "matched", "expired", "needs_review"],
      default: "pending",
      required: true,
    },
    matchedTxHash: String,
    matchedAt: Date,
    matchedFromAddress: String,
    // HD-derived deposit-address fields (see interface docstring).
    derivationIndex: { type: Number },
    isHdDerived: { type: Boolean },
    addressExpiresAt: { type: Date },
    swept: { type: Boolean },
    sweptAt: { type: Date },
    sweepTxHash: { type: String },
    fundsReceivedAt: { type: Date },
    fundsReceivedTxHash: { type: String },
    fundsReceivedAtomic: { type: Number },
    nativeRecoveryTxHash: { type: String },
    nativeRecoveredAmount: { type: Number },
    nativeRecoveryFailedReason: { type: String },
    nativeRecoveryAttemptedAt: { type: Date },
    usdPerCoinAtMint: { type: Number },
  },
  { timestamps: true }
);

// Poller hot path: find pending requests for a chain by exact atomic
// amount. Compound index gives Mongo an index-only lookup.
CryptoPaymentRequestSchema.index({
  chain: 1,
  expectedAmountAtomic: 1,
  status: 1,
});

// Sweeper hot path: expire stale pending requests once per day.
CryptoPaymentRequestSchema.index({ expiresAt: 1, status: 1 });

// HD address settlement fast-path — the WebSocket listener + poller
// look up the pending request by destination address. Partial-unique
// so historical `matched`/`expired` rows can share an address in the
// (rare) case of index re-derivation across a seed rotation.
CryptoPaymentRequestSchema.index(
  { platformAddress: 1 },
  {
    partialFilterExpression: {
      status: { $in: ["pending", "needs_review"] },
    },
  },
);

// TTL sweeper — expire pending HD-derived requests past
// addressExpiresAt (only present on HD-derived rows).
CryptoPaymentRequestSchema.index({ addressExpiresAt: 1, status: 1 });

// Funds sweeper — target list per chain, only settled unswept rows.
CryptoPaymentRequestSchema.index({ status: 1, swept: 1, chain: 1 });
// Second sweeper source: unmatched rows that nonetheless received
// funds on-chain (underpayments). Covers the `fundsReceivedAt` branch
// of the /pending query.
CryptoPaymentRequestSchema.index({ fundsReceivedAt: 1, swept: 1, chain: 1 });

export const CryptoPaymentRequest = model<ICryptoPaymentRequest>(
  "CryptoPaymentRequest",
  CryptoPaymentRequestSchema
);

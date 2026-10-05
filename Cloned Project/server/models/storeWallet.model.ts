import { Schema, model } from "mongoose";

const StoreWalletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    // Cryptobrand multi-currency wallets: USD is the "parent" — the
    // wallet every commission service still credits and every legacy
    // caller reads. Non-USD siblings (INR, ETH, BTC — driven by
    // config/cryptobrandCurrencies.ts) hold `parentWalletId` pointing
    // at the USD wallet for the same (userId, orgId). Undefined on
    // legacy USD-only wallets and on non-cryptobrand orgs.
    parentWalletId: {
      type: Schema.Types.ObjectId,
      ref: "StoreWallet",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastTransactionAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Uniqueness now scoped per-currency. Previously `{userId,orgId}` was
// unique which literally prevented multi-currency wallets from
// coexisting. The migration script in
// `src/scripts/migrate-store-wallet-currency-index.ts` drops the old
// index at deploy time.
StoreWalletSchema.index(
  { userId: 1, orgId: 1, currency: 1 },
  { unique: true },
);

// Index for efficient org-level queries (e.g., list all wallets in org)
StoreWalletSchema.index({ orgId: 1, balance: -1 });

// ─── USD-default safety net for legacy currency-less lookups ─────
//
// Cryptobrand orgs auto-provision four sibling wallets per member
// (USD parent + INR / ETH / BTC). The unique index above is on
// {userId, orgId, currency} — a currency-less `findOne({userId, orgId})`
// still returns ONE doc (whichever the index happens to sort first
// under load — usually the alphabetical first, i.e. BTC), silently
// misrouting USD credits onto the BTC ledger.
//
// This middleware intercepts findOne / findOneAndUpdate queries that
// filter by both userId AND orgId but omit currency, and pins them to
// currency: "USD". Historical contract of every legacy caller in the
// codebase was "operate on the org's USD wallet"; this preserves that
// intent automatically.
//
// Skipped:
//   - Queries that already specify currency (respect caller intent).
//   - Queries that use _id, $or, or missing userId/orgId (edge shapes
//     we can't safely reason about — leave to the caller).
//   - `.find()` — the multi-wallet enumerator (getAllUserWallets etc.)
//     legitimately wants all currencies for a (user, org) pair.
//
// This is a SAFETY NET, not the primary defense. Prefer explicit
// `currency: "USD"` at call sites when writing new code.
function pinCurrencyToUsdIfMissing(this: any, next: () => void) {
  const filter = this.getFilter ? this.getFilter() : this._conditions;
  if (!filter || typeof filter !== "object") return next();
  // Already specified — respect caller intent.
  if (filter.currency !== undefined) return next();
  // Only pin when both userId AND orgId are present AND scalar. Skip
  // $or / $in / _id-based lookups.
  if (filter._id || filter.$or || filter.$and) return next();
  const uid = filter.userId;
  const oid = filter.orgId;
  if (!uid || !oid) return next();
  if (typeof uid === "object" && !(uid instanceof (require("mongoose") as any).Types.ObjectId)) {
    return next();
  }
  if (typeof oid === "object" && !(oid instanceof (require("mongoose") as any).Types.ObjectId)) {
    return next();
  }
  this.setQuery({ ...filter, currency: "USD" });
  next();
}
StoreWalletSchema.pre("findOne", pinCurrencyToUsdIfMissing);
StoreWalletSchema.pre("findOneAndUpdate", pinCurrencyToUsdIfMissing);

export const StoreWallet = model("StoreWallet", StoreWalletSchema);

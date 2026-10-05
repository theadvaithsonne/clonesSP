import { Schema, model } from "mongoose";

const WalletTransactionSchema = new Schema(
  {
    // Wallet reference - one of these will be set
    storeWalletId: {
      type: Schema.Types.ObjectId,
      ref: "StoreWallet",
      index: true,
    },
    affiliateWalletId: {
      type: Schema.Types.ObjectId,
      ref: "AffiliateWallet",
      index: true,
    },

    // Wallet type for easier querying
    walletType: {
      type: String,
      enum: ["store", "affiliate"],
      required: true,
      index: true,
    },

    // User and org context
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    }, // Required for store wallet transactions, optional for affiliate

    // Transaction details
    type: {
      type: String,
      enum: ["credit", "debit", "transfer", "commission", "withdrawal"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0, // No minimum — territory commissions can be sub-cent (e.g.
              // 15% of a $0.05 platform fee = $0.0075). Other writers in this
              // codebase still round to 2 decimals before writing, so the
              // legacy "no dust" intent is preserved at the caller side.
    },
    currency: {
      type: String,
      default: "USD",
    },

    // Balance tracking
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },

    // Description and notes
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Related entity tracking
    relatedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    }, // Who initiated/received (e.g., founder who credited, referral who earned commission)
    relatedTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "WalletTransaction",
    }, // For transfers - links to opposite side

    // Metadata for extensibility
    metadata: {
      type: Schema.Types.Mixed,
    },

    // Status for future use (e.g., pending withdrawals)
    status: {
      type: String,
      enum: ["completed", "pending", "failed", "reversed"],
      default: "completed",
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
WalletTransactionSchema.index({ userId: 1, walletType: 1, createdAt: -1 });
WalletTransactionSchema.index({ storeWalletId: 1, createdAt: -1 });
WalletTransactionSchema.index({ affiliateWalletId: 1, createdAt: -1 });
WalletTransactionSchema.index({ orgId: 1, type: 1, createdAt: -1 });
WalletTransactionSchema.index({ relatedUserId: 1, createdAt: -1 });

// Idempotency guard for credits that may legitimately be replayed (retries,
// reconciliation crons). Callers that set `metadata.dedupeKey` get an
// at-most-once credit enforced by the database rather than by application
// logic. Partial so the overwhelming majority of transactions, which carry no
// dedupeKey, are unaffected and don't collide on null.
WalletTransactionSchema.index(
  { "metadata.dedupeKey": 1 },
  {
    unique: true,
    partialFilterExpression: { "metadata.dedupeKey": { $exists: true } },
  }
);

// Multi-currency convert / transfer-multi rows share a
// `metadata.transferGroupId`. `GET /wallet/store/transfer/:transferGroupId`
// queries by it to reconstruct a movement's shape (both legs at once)
// — used by the OTC desk's 409 DUPLICATE_DEDUPE_KEY recovery path.
// Partial-indexed so legacy rows that never carried the field don't
// bloat the index.
WalletTransactionSchema.index(
  { "metadata.transferGroupId": 1 },
  {
    partialFilterExpression: { "metadata.transferGroupId": { $exists: true } },
  }
);

// Validation: ensure exactly one wallet reference is provided
WalletTransactionSchema.pre("validate", function (next) {
  const hasStoreWallet = !!this.storeWalletId;
  const hasAffiliateWallet = !!this.affiliateWalletId;

  if (hasStoreWallet === hasAffiliateWallet) {
    return next(
      new Error("Transaction must reference exactly one wallet type")
    );
  }

  if (hasStoreWallet && this.walletType !== "store") {
    return next(
      new Error("Wallet type must be 'store' for store wallet transactions")
    );
  }

  if (hasAffiliateWallet && this.walletType !== "affiliate") {
    return next(
      new Error(
        "Wallet type must be 'affiliate' for affiliate wallet transactions"
      )
    );
  }

  next();
});

export const WalletTransaction = model(
  "WalletTransaction",
  WalletTransactionSchema
);

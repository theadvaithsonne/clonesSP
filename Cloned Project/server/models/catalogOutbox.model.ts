import mongoose, { Schema, Document } from "mongoose";

/**
 * Durable outbox for catalog change events.
 *
 * Schema post-hooks across the 7 sellable/office models call
 * `enqueueCatalogChange` which upserts a row keyed by `(itemType, itemId)`.
 * Rapid edits collapse into a single pending row — we don't pile up duplicate
 * webhook deliveries.
 *
 * The dispatcher (`catalogOutbox.dispatcher.ts`) drains pending rows on a 2s
 * interval, signs the payload, POSTs to NetworkChainApi, and either marks
 * `sent` (TTL-expired after 24h) or schedules a retry. After 12 attempts a
 * row enters `dead` — the hourly NC reconciler will catch the change there.
 */

export type CatalogOutboxStatus = "pending" | "in_flight" | "sent" | "dead";
export type CatalogOutboxOp = "upsert" | "delete";

export type CatalogOutboxItemType =
  | "product"
  | "storeproduct"
  | "course"
  | "workshop"
  | "channel"
  | "service"
  | "call"
  | "office"
  // A referral-reward job posting. Unlike every type above it has no price —
  // the affiliate earns `reward.amount` in USD on a successful hire — so the
  // sell gate and the earning both read a different field. See the `job` entry
  // in internal-catalog.
  | "job";

export interface ICatalogOutbox extends Document {
  itemType: CatalogOutboxItemType;
  itemId: string;
  op: CatalogOutboxOp;
  attemptCount: number;
  nextAttemptAt: Date;
  status: CatalogOutboxStatus;
  lastError?: string;
  /** Set when status transitions to "sent" — used by TTL index. */
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CatalogOutboxSchema = new Schema<ICatalogOutbox>(
  {
    itemType: {
      type: String,
      required: true,
      enum: [
        "product",
        "storeproduct",
        "course",
        "workshop",
        "channel",
        "service",
        "call",
        "office",
        "job",
      ],
    },
    itemId: { type: String, required: true },
    op: {
      type: String,
      required: true,
      enum: ["upsert", "delete"],
      default: "upsert",
    },
    attemptCount: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    status: {
      type: String,
      required: true,
      enum: ["pending", "in_flight", "sent", "dead"],
      default: "pending",
    },
    lastError: { type: String },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

// One pending/in_flight/sent row per (itemType, itemId). Rapid mutations
// collapse via upsert in catalogOutbox.service.ts.
CatalogOutboxSchema.index(
  { itemType: 1, itemId: 1 },
  { unique: true, name: "catalog_outbox_item_unique" },
);

// Dispatcher's pull index.
CatalogOutboxSchema.index({ status: 1, nextAttemptAt: 1 });

// Auto-reap successful deliveries. 24 h covers idempotency window on the
// receiver side, which is also 24 h via Redis SETNX EX 86400.
CatalogOutboxSchema.index(
  { sentAt: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24,
    partialFilterExpression: { status: "sent" },
    name: "catalog_outbox_sent_ttl",
  },
);

export const CatalogOutbox = mongoose.model<ICatalogOutbox>(
  "CatalogOutbox",
  CatalogOutboxSchema,
);

import mongoose, { Schema, Document } from "mongoose";

/**
 * A snapshot of the full USD→X exchange-rate table at a point in time,
 * backing the public FX service (`/public/fx/*`, `src/fx/fxService.ts`).
 *
 * Persisted (rather than only in-process memo) so:
 *  - a fresh server boot / restart doesn't need to re-hit the upstream
 *    provider before it can serve rates.
 *  - conversions are reproducible/auditable against a historical `asOf`.
 *
 * `rates` is the provider's native direction (1 USD = rates[X] units of
 * X). `fxService.getRateTable()` pivots to a non-USD base on read.
 *
 * Ported from contacts-backend's `src/models/fxRate.model.ts`; renamed
 * `FxRateSnapshot` file to disambiguate from any per-transaction FX rate
 * models, and widened `source` to include the frankfurter.dev fallback
 * hop (`"cached-alt"`) that contacts-backend's version doesn't have.
 */
export interface IFxRateSnapshot extends Document {
  base: "USD";
  rates: Record<string, number>;
  fetchedAt: Date;
  source: "live" | "cached-alt" | "fallback";
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

const fxRateSnapshotSchema = new Schema<IFxRateSnapshot>(
  {
    base: { type: String, required: true, default: "USD" },
    // Mixed map of currency code -> rate. Mongoose `Map` keeps it
    // flexible as we add currencies without a schema migration.
    rates: {
      type: Map,
      of: Number,
      required: true,
    },
    fetchedAt: { type: Date, required: true, index: true },
    source: { type: String, enum: ["live", "cached-alt", "fallback"], required: true },
    provider: { type: String, required: true },
  },
  { timestamps: true },
);

// Latest-snapshot lookups sort by fetchedAt descending.
fxRateSnapshotSchema.index({ fetchedAt: -1 });

export const FxRateSnapshot = mongoose.model<IFxRateSnapshot>(
  "FxRateSnapshot",
  fxRateSnapshotSchema,
);

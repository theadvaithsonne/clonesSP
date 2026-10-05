import { Schema, model, Types } from "mongoose";

/**
 * One row per successful "pay the $650 Board Entry / $160 POD Entry with
 * B2 Coins" purchase — the dynamically-updated tracking record product
 * asked for so who-bought-what-with-coins is queryable without scraping
 * Invoice metadata. Written best-effort at the end of
 * payEntryProductWithB2Coins() (bat246Layaway.service.ts); a failure to
 * write this row never fails the purchase itself, same fire-and-forget
 * convention fulfillInvoice() already uses for its own side records.
 *
 * Deliberately separate from bat246B2CoinTransaction.model.ts — that
 * model's `toUserId` is required (it's a person-to-person gift ledger);
 * a product purchase has no recipient, just a spend against your own
 * wallet balance.
 */
const Bat246B2CoinProductPurchaseSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    // "board" = the $650 Board Entry product, "pod" = the $160 POD Entry
    // product — which of the two known entry products this was.
    productLabel: { type: String, enum: ["board", "pod"], required: true },
    // Dollars, taken straight off the invoice's own totalAmount — never
    // re-derived a second time.
    amount: { type: Number, required: true, min: 0 },
    invoiceId: { type: Types.ObjectId, ref: "Invoice", required: true, unique: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export const Bat246B2CoinProductPurchase = model(
  "bat246B2CoinProductPurchases",
  Bat246B2CoinProductPurchaseSchema
);

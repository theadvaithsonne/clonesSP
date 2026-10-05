import { Schema, model } from "mongoose";

// Singleton doc — exactly one row ever exists. Controls the global on/off
// switch for Lost Money payment distribution on the admin Paid List page.
// Read by bat246LostMoneyAutoPay.service.ts on every real Bat246 sale —
// paused means the automatic 3% drip does nothing at all that sale.
const Bat246LostMoneyPaymentSettingsSchema = new Schema(
  {
    paymentsEnabled: { type: Boolean, default: true },
    updatedByEmail: { type: String, default: "" },

    // Every paused interval, so the 90-Day Waiting Period countdown can
    // freeze while payments are stopped (confirmed: paused days should not
    // count toward someone's 90 days). resumedAt is null while a pause is
    // still ongoing. See computeEligibleInfo() in bat246LostMoney.routes.ts.
    pauseHistory: {
      type: [{ pausedAt: { type: Date, required: true }, resumedAt: { type: Date, default: null } }],
      default: [],
    },
  },
  { timestamps: true }
);

export const Bat246LostMoneyPaymentSettings = model(
  "bat246LostMoneyPaymentSettings",
  Bat246LostMoneyPaymentSettingsSchema
);

import { Schema, model, Types } from "mongoose";

// Admin-managed Paid List — one row per person, not per payout event.
// "Add" either creates this row (first payment) or, if the person is
// already on the list, tops up their running total (repeat payment).
const Bat246LostMoneyPaidSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    userId: { type: Types.ObjectId, ref: "User", default: null }, // linked Garage account, if picked from the search
    email: { type: String, default: "" },
    claimId: { type: Types.ObjectId, ref: "bat246LostMoneyClaims", default: null }, // set when added via claim approval

    reportedLoss: { type: String, default: "" }, // static, set once when the row is created (from the claim, or typed by admin)
    approvedAmount: { type: Number, required: true }, // ceiling approved to repay — set once when the row is created

    totalPaid: { type: Number, required: true, default: 0 }, // cumulative, but only jumps in whole completed $300 rounds (see roundAccumulated) — this is what public visibility/reordering key off of
    lastPaymentAmount: { type: Number, default: 0 }, // most recent single payment
    lastPaymentAt: { type: Date, default: null },

    order: { type: Number, default: 0 }, // admin-controlled display sequence, reorderable

    // Automated 3%-of-sale drip (bat246LostMoneyAutoPay.service.ts): real money
    // already deposited into this person's wallet toward their current round,
    // not yet counted in totalPaid/public visibility until it reaches the round
    // target (min($300, approvedAmount - totalPaid)).
    roundAccumulated: { type: Number, default: 0 },
    // totalPaid has reached approvedAmount — skip this person in the auto-pay
    // rotation going forward (they stay visible on the public list as history).
    fullyRepaid: { type: Boolean, default: false },

    // 90-day waiting period gate. Two states:
    //   - field absent entirely       → legacy row, created before this
    //     feature existed. Treated as already-active/no-wait so nothing
    //     already running the auto-pay rotation gets silently paused.
    //   - present, value null         → new row, deliberately parked in the
    //     "90 Days Waiting Period" grid. Not eligible for auto-pay yet.
    //   - present, a real Date        → admin has manually clicked
    //     "Move to Lineup" — now in the "No Wait Lineup" grid and eligible.
    // No schema default on purpose — see bat246LostMoney.routes.ts /
    // bat246LostMoneyAutoPay.service.ts for how "absent" vs "null" is
    // queried (MongoDB's `{field: null}` normally matches both, so those
    // call sites use `$exists` explicitly to keep the two apart).
    movedToLineupAt: { type: Date },
  },
  { timestamps: true }
);

export const Bat246LostMoneyPaid = model("bat246LostMoneyPaid", Bat246LostMoneyPaidSchema);

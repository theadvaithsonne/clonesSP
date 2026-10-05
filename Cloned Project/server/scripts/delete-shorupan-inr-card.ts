/**
 * Detach the Indian card (•••• 4009) from shorupan's Stripe Customer +
 * remove from paymentProfile.stripe.methods so he can re-save it via
 * the new mandate-enabled SetupIntent flow (zero-OTP INR reuse).
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/delete-shorupan-inr-card.ts
 */
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { detachPaymentMethod } from "../services/stripe";

const EMAIL = "shorupan@gmail.com";
const TARGET_LAST4 = "4009"; // the ICICI Indian card

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const user: any = await User.findOne({ email: EMAIL })
    .select("_id paymentProfile")
    .lean();
  if (!user) throw new Error("User not found");

  const methods = user.paymentProfile?.stripe?.methods || [];
  const target = methods.find((m: any) => m.last4 === TARGET_LAST4);
  if (!target) {
    console.log(`No card with last4 ${TARGET_LAST4} found on user.`);
    console.log(
      `Existing methods: ${methods.map((m: any) => `${m.brand} ${m.last4}`).join(", ") || "(none)"}`,
    );
    await mongoose.disconnect();
    return;
  }

  console.log(
    `Detaching ${target.brand} •••• ${target.last4} (${target.id}) from Stripe…`,
  );
  try {
    await detachPaymentMethod(target.id);
    console.log("  ✓ Stripe side detached");
  } catch (e: any) {
    // If already detached (e.g. rerun), Stripe returns 400 — pruning
    // the user doc is still safe.
    console.log(`  (Stripe detach: ${e.message} — continuing with local prune)`);
  }

  const pull = await User.updateOne(
    { _id: new Types.ObjectId(String(user._id)) },
    { $pull: { "paymentProfile.stripe.methods": { id: target.id } } },
  );
  console.log(`  ✓ User doc pruned (modified=${pull.modifiedCount})`);

  // If the removed card was the default and other cards remain,
  // promote the most-recently-added one so the FE picker still has a
  // preferred default.
  const after: any = await User.findById(user._id)
    .select("paymentProfile.stripe.methods")
    .lean();
  const remaining = (after?.paymentProfile?.stripe?.methods || []) as any[];
  if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
    remaining.sort(
      (a, b) =>
        new Date(b.addedAt || 0).getTime() -
        new Date(a.addedAt || 0).getTime(),
    );
    await User.updateOne(
      {
        _id: new Types.ObjectId(String(user._id)),
        "paymentProfile.stripe.methods.id": remaining[0].id,
      },
      { $set: { "paymentProfile.stripe.methods.$.isDefault": true } },
    );
    console.log(
      `  ✓ Promoted ${remaining[0].brand} •••• ${remaining[0].last4} to default`,
    );
  }

  console.log(
    `\nDone. Shorupan can now re-save the Indian card via the settings page or a fresh INR checkout — new save will authorize the RBI e-mandate for zero-OTP reuse.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

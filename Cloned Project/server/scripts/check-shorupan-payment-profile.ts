import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";
import { razorpay } from "../services/razorpay";

const EMAIL = "shorupan@gmail.com";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const user: any = await User.findOne({ email: EMAIL })
    .select("_id email paymentProfile")
    .lean();
  if (!user) return;

  console.log(`\n─── User doc ─────────────────────────────────────────────`);
  console.log(`  _id: ${user._id}`);
  console.log(`  paymentProfile.razorpay: ${JSON.stringify(user.paymentProfile?.razorpay, null, 2)}`);
  console.log(`  paymentProfile.stripe:   ${JSON.stringify(user.paymentProfile?.stripe, null, 2)}`);

  // ─── Most-recent Razorpay-paid invoices (last 2h) ────────────────────
  console.log(`\n─── Recent Razorpay invoices for user (last 2h) ─────────`);
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentRp = await Invoice.find({
    userId: user._id,
    paymentPlatform: "razorpay",
    createdAt: { $gte: since },
  })
    .select("invoiceNumber status razorpayOrderId razorpayPaymentId createdAt paidAt itemCurrency paymentCurrency totalAmount")
    .sort({ createdAt: -1 })
    .lean();

  console.log(`  Found ${recentRp.length} razorpay invoice(s)`);
  for (const inv of recentRp) {
    console.log(
      `    - ${inv.invoiceNumber}  status=${inv.status}  ${inv.itemCurrency}/${inv.paymentCurrency}  order=${(inv as any).razorpayOrderId || "-"}  payment=${(inv as any).razorpayPaymentId || "-"}  created=${inv.createdAt}`,
    );
  }

  // Deep-dive the most recent PAID one (has a payment id we can inspect)
  const target = recentRp.find((r: any) => r.razorpayPaymentId) || recentRp[0];
  if (target) {
    console.log(`\n═══ Deep-dive ${target.invoiceNumber} ═══`);
    if ((target as any).razorpayOrderId) {
      try {
        const o: any = await razorpay.orders.fetch((target as any).razorpayOrderId);
        console.log(`  ── Razorpay Order side ──`);
        console.log(`    id:           ${o.id}`);
        console.log(`    status:       ${o.status}`);
        console.log(`    amount:       ${o.amount} ${o.currency}`);
        console.log(`    amount_paid:  ${o.amount_paid}`);
        console.log(`    notes:        ${JSON.stringify(o.notes, null, 2)}`);
      } catch (e: any) {
        console.log(`  (fetch order failed: ${e.message})`);
      }
    }
    if ((target as any).razorpayPaymentId) {
      try {
        const p: any = await razorpay.payments.fetch((target as any).razorpayPaymentId);
        console.log(`  ── Razorpay Payment side ──`);
        console.log(`    id:            ${p.id}`);
        console.log(`    status:        ${p.status}`);
        console.log(`    method:        ${p.method}`);
        console.log(`    customer_id:   ${p.customer_id || "(none)"}`);
        console.log(`    token_id:      ${p.token_id || "(none)"}`);
        console.log(`    card_id:       ${p.card_id || "(none)"}`);
        console.log(`    card:          ${JSON.stringify(p.card, null, 2)}`);
      } catch (e: any) {
        console.log(`  (fetch payment failed: ${e.message})`);
      }
    }
  }

  // ─── Any tokens on Razorpay side, even if user doc is null? ──────────
  if (user.paymentProfile?.razorpay?.customerId) {
    console.log(`\n─── Tokens on Razorpay side for our customer ────────────`);
    try {
      const t: any = await (razorpay.customers as any).fetchTokens(
        user.paymentProfile.razorpay.customerId,
      );
      console.log(`  ${(t?.items || []).length} token(s)`);
      for (const it of t?.items || []) {
        console.log(`    - ${it.id} method=${it.method} card=${JSON.stringify(it.card)}`);
      }
    } catch (e: any) {
      console.log(`  (fetchTokens failed: ${e.message})`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

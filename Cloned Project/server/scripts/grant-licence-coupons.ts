/**
 * One-off grant: push the three reward coupons to the two licence cohorts.
 *
 *   A · bought 4+ licences        → FOUNDERSOFFICE3  (12 cycles Office Pro free)
 *                                 → GETNETWORKCHAINS (3 cycles NetworkChain free)
 *   B · bought 1 licence BEFORE the free-month launch, plus everyone holding
 *       2–3 licences              → NETWORKCHAINS1   (1 cycle NetworkChain free)
 *
 * Nobody is granted the same thing twice. Three independent layers:
 *
 *   1. The cohorts are disjoint by construction (4+ vs 1 vs 2–3).
 *   2. Anyone who already received a free NetworkChain month, or already used
 *      one of these codes, is excluded here before we call anything.
 *   3. `assignCoupon` is itself idempotent — an existing `active` or `used`
 *      CouponAssignment is a no-op that deliberately does NOT re-notify, so a
 *      re-run cannot double-assign or double-email.
 *
 * Granting goes through `assignCoupon` rather than writing CouponAssignment
 * directly, so the recipient email, the in-app notification and that
 * idempotency all come along for free.
 *
 * Usage:
 *   npx tsx src/scripts/grant-licence-coupons.ts                 # dry run
 *   FRONTEND_URL=https://my.garage.app \
 *     npx tsx src/scripts/grant-licence-coupons.ts --confirm     # writes + emails
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const CONFIRM = process.argv.includes("--confirm");
/**
 * `--only=someone@example.com` restricts the run to one recipient.
 *
 * Sending 100+ emails is not reversible, so the first real send should be one
 * you can open and read. Everything else — cohorts, exclusions, dedup — behaves
 * identically; this only narrows who is actually granted.
 */
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "")
  .split("=")[1]
  ?.toLowerCase();

/**
 * The day the free first month started — the earliest `combo_free_first_month`
 * invoice. "Bought before we started giving 1 month free" means before this.
 */
const FREE_MONTH_LAUNCH = new Date("2026-06-24T00:00:00Z");

const CODES = {
  office12: "FOUNDERSOFFICE3",
  nc3: "GETNETWORKCHAINS",
  nc1: "NETWORKCHAINS1",
} as const;

type Grant = { userId: string; email: string; code: string; why: string };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  console.log(`DB: ${db.databaseName}   mode: ${CONFIRM ? "CONFIRM (writes + emails)" : "DRY RUN"}\n`);

  // Emails are sent by assignCoupon and every CTA is built from FRONTEND_URL.
  // Sending 80+ mails whose links point at a dev box is not recoverable — you
  // cannot un-send them — so refuse rather than "warn and continue".
  const feUrl = process.env.FRONTEND_URL || "";
  if (CONFIRM && /localhost|127\.0\.0\.1/.test(feUrl)) {
    console.error(
      `REFUSING: FRONTEND_URL is "${feUrl}". Every emailed link would be dead.\n` +
        `Re-run as: FRONTEND_URL=https://my.garage.app npx tsx src/scripts/grant-licence-coupons.ts --confirm`,
    );
    process.exit(1);
  }
  if (CONFIRM) console.log(`links will point at: ${feUrl}\n`);

  const coupons = Object.fromEntries(
    await Promise.all(
      Object.values(CODES).map(async (code) => [
        code,
        await db.collection("platformcoupons").findOne({ code }),
      ]),
    ),
  ) as Record<string, any>;
  for (const [code, c] of Object.entries(coupons)) {
    if (!c) throw new Error(`Coupon ${code} not found — refusing to run`);
  }

  // ── Licences per user: summed quantity across PAID unilevel_plus invoices ──
  const lic = await db
    .collection("invoices")
    .aggregate([
      { $match: { "lineItems.0.itemType": "unilevel_plus", status: "paid" } },
      {
        $project: {
          userId: 1,
          qty: {
            $ifNull: [
              "$metadata.quantity",
              { $ifNull: [{ $arrayElemAt: ["$lineItems.quantity", 0] }, 1] },
            ],
          },
          at: { $ifNull: ["$paidAt", "$createdAt"] },
        },
      },
      { $group: { _id: "$userId", lic: { $sum: "$qty" }, first: { $min: "$at" } } },
    ])
    .toArray();

  // ── Exclusions ────────────────────────────────────────────────────────────
  const gotFreeMonth = new Set(
    (
      await db.collection("invoices").distinct("userId", {
        $or: [
          { "metadata.kind": "combo_free_first_month" },
          { "metadata.comboCompletedAt": { $exists: true } },
        ],
      })
    ).map(String),
  );
  const usedNc = new Set(
    (
      await db
        .collection("invoices")
        .distinct("userId", { couponCode: { $in: [CODES.nc3, CODES.nc1] } })
    ).map(String),
  );
  const usedOffice = new Set(
    (await db.collection("invoices").distinct("userId", { couponCode: CODES.office12 })).map(
      String,
    ),
  );

  const emailOf = new Map<string, string>();
  for (const u of await db
    .collection("users")
    .find({ _id: { $in: lic.map((r: any) => r._id) } })
    .project({ email: 1 })
    .toArray())
    emailOf.set(String(u._id), u.email || "(no email)");

  // ── Cohorts ───────────────────────────────────────────────────────────────
  const grants: Grant[] = [];
  const skipped: string[] = [];

  for (const r of lic) {
    const id = String(r._id);
    const email = emailOf.get(id) || "(unknown)";
    if (!emailOf.get(id) || email === "(no email)") {
      skipped.push(`${id} — no email on file`);
      continue;
    }

    if (r.lic >= 4) {
      // Cohort A — both coupons.
      usedOffice.has(id)
        ? skipped.push(`${email} — already used ${CODES.office12}`)
        : grants.push({ userId: id, email, code: CODES.office12, why: `${r.lic} licences` });
      usedNc.has(id)
        ? skipped.push(`${email} — already used a NetworkChain coupon`)
        : grants.push({ userId: id, email, code: CODES.nc3, why: `${r.lic} licences` });
      continue;
    }

    // Cohort B — 1 licence bought before the launch, or any 2–3 licence holder.
    const inB = (r.lic === 1 && r.first < FREE_MONTH_LAUNCH) || r.lic === 2 || r.lic === 3;
    if (!inB) continue;

    if (gotFreeMonth.has(id)) {
      skipped.push(`${email} — already had a free NetworkChain month`);
    } else if (usedNc.has(id)) {
      skipped.push(`${email} — already used a NetworkChain coupon`);
    } else {
      grants.push({
        userId: id,
        email,
        code: CODES.nc1,
        why: r.lic === 1 ? "1 licence, pre-launch" : `${r.lic} licences`,
      });
    }
  }

  const scoped = ONLY ? grants.filter((g) => g.email.toLowerCase() === ONLY) : grants;
  if (ONLY) {
    console.log(`--only=${ONLY} → ${scoped.length} of ${grants.length} grants\n`);
    grants.length = 0;
    grants.push(...scoped);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const byCode = grants.reduce<Record<string, Grant[]>>((a, g) => {
    (a[g.code] ||= []).push(g);
    return a;
  }, {});
  for (const [code, list] of Object.entries(byCode)) {
    console.log(`── ${code}  →  ${list.length} users`);
    list.forEach((g) => console.log(`     ${g.email.padEnd(38)} ${g.why}`));
    console.log("");
  }
  console.log(`excluded (${skipped.length}):`);
  skipped.forEach((s) => console.log(`     ${s}`));

  // Same user must never appear twice for the same code.
  const dupes = grants
    .map((g) => `${g.userId}:${g.code}`)
    .filter((k, i, a) => a.indexOf(k) !== i);
  console.log(`\nduplicate (user, coupon) pairs in this batch: ${dupes.length}`);
  if (dupes.length) throw new Error("Refusing — duplicates present");

  if (!CONFIRM) {
    console.log(`\nDRY RUN — nothing written. ${grants.length} grants would be made.`);
    await mongoose.disconnect();
    return;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  const { assignCoupon } = await import("../services/couponAssignment");
  // `assignedBy` must be a real user id. This is the same account behind the
  // 46 existing garage-admin assignments — the platform owner, per
  // PLATFORM_USER_EMAIL in scripts/migrate-sweep-locked-earnings.ts.
  //
  // The TYPE stays "system" rather than "garage_admin": the email greets a
  // system grant as "Garage sent you a reward", which is what this is, versus
  // "Garage Admin" for an individual admin acting on one account.
  const PLATFORM_EMAIL = process.env.PLATFORM_USER_EMAIL || "shorupan@gmail.com";
  const platformUser = await db.collection("users").findOne({ email: PLATFORM_EMAIL });
  if (!platformUser) {
    throw new Error(
      `Platform user ${PLATFORM_EMAIL} not found — needed as assignedBy. Set PLATFORM_USER_EMAIL.`,
    );
  }

  let ok = 0;
  const failed: string[] = [];
  for (const g of grants) {
    try {
      await assignCoupon({
        userId: g.userId,
        couponId: String(coupons[g.code]._id),
        couponSource: "platform",
        assignedBy: String(platformUser._id),
        assignedByType: "system",
        reason: `Thanks for your support — ${g.why}`,
      } as any);
      ok++;
      console.log(`  ✓ ${g.code}  ${g.email}`);
      // Resend allows 10 requests/second and each grant fires one email.
      // A tight loop burns through that in a second and the overflow comes
      // back 429 — which does NOT fail the grant, because the send is
      // fire-and-forget, so the coupon lands with no email and the
      // idempotency guard then refuses to retry it. Pace the loop instead.
      await new Promise((r) => setTimeout(r, 150));
    } catch (err: any) {
      failed.push(`${g.code} ${g.email}: ${err?.message ?? err}`);
      console.error(`  ✗ ${g.code}  ${g.email}: ${err?.message ?? err}`);
    }
  }
  console.log(`\nassigned ${ok}/${grants.length}`);
  if (failed.length) console.log(`failures:\n  ${failed.join("\n  ")}`);

  /**
   * Let the emails finish before closing the connection.
   *
   * `assignCoupon` fires `notifyAssignedReward` with `void` — deliberately, so
   * a mail failure can never roll back an assignment. But that means the send
   * is still in flight when this function returns, and disconnecting here kills
   * it mid-query: the first run of this script created the assignment and sent
   * NOTHING, because mongoose closed while notifyAssignedReward was still
   * reading the user and the coupon.
   *
   * There is no handle to await, so drain on a timer — generous, since the cost
   * of waiting is seconds and the cost of not waiting is a silent no-email
   * grant that the idempotency guard then refuses to retry.
   */
  const drainMs = Math.min(60_000, 2_000 + ok * 400);
  console.log(`\nwaiting ${Math.round(drainMs / 1000)}s for the emails to flush...`);
  await new Promise((r) => setTimeout(r, drainMs));

  const { UserNotification } = await import("../models/userNotification.model");
  const notified = await UserNotification.countDocuments({
    type: "coupon_gift",
    createdAt: { $gte: new Date(Date.now() - drainMs - 120_000) },
  });
  console.log(`coupon_gift notifications written in this window: ${notified}`);
  if (ok > 0 && notified === 0) {
    console.log(
      "WARNING: assignments landed but nothing notified — check RESEND_API_KEY and the notify gate.",
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

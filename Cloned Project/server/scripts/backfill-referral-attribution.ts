import "dotenv/config";
import mongoose from "mongoose";

/**
 * Manual referral-attribution repair.
 *
 * For each `{buyerEmail, affiliateEmail}` pair below:
 *   1. Look up both users.
 *   2. If the buyer's `referredBy` is NOT already the affiliate, update it +
 *      stamp `referredBySource: "affiliate"`.
 *   3. Fire the "you've onboarded X" notification email to the affiliate
 *      (via services/welcomeEmail.notifyReferrerOfNewSignup). Even when
 *      attribution was already correct (e.g. sbolla4), this recovers a
 *      previously-swallowed notification.
 *
 * Idempotent: re-running only fires the notification (which is a no-op if
 * the mail service dedups) and never downgrades an existing correct
 * attribution.
 *
 * DRY_RUN=1 to preview.
 */
const DRY_RUN = process.env.DRY_RUN === "1";

const PAIRS: Array<{ buyer: string; affiliate: string; note?: string }> = [
  {
    buyer: "saisvas@gmail.com",
    affiliate: "techworldsdata@gmail.com",
    note: "Prasanna's article affiliate link — was misattributed to Shorupan",
  },
  {
    buyer: "sbolla4@gmail.com",
    affiliate: "techworldsdata@gmail.com",
    note: "Attribution was correct; only re-firing the missed notification email",
  },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { User } = await import("../models/user.model");
  const { notifyReferrerOfNewSignup } = await import(
    "../services/welcomeEmail"
  );

  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes / no mails)" : "LIVE"}\n`);

  let repaired = 0;
  let notified = 0;
  let unchanged = 0;
  let missing = 0;

  for (const pair of PAIRS) {
    const [buyer, affiliate] = await Promise.all([
      User.findOne({ email: new RegExp("^" + esc(pair.buyer) + "$", "i") }),
      User.findOne({
        email: new RegExp("^" + esc(pair.affiliate) + "$", "i"),
      })
        .select("_id email")
        .lean<any>(),
    ]);

    if (!buyer) {
      console.log(`✗ SKIP  ${pair.buyer}  — buyer not found`);
      missing++;
      continue;
    }
    if (!affiliate) {
      console.log(`✗ SKIP  ${pair.buyer}  — affiliate ${pair.affiliate} not found`);
      missing++;
      continue;
    }

    const currentReferrerId = buyer.referredBy
      ? String(buyer.referredBy)
      : null;
    const targetReferrerId = String(affiliate._id);
    const currentSource = (buyer as any).referredBySource;

    const label = `${pair.buyer.padEnd(38)} → ${pair.affiliate}`;

    // Step 1: attribution fix
    if (currentReferrerId === targetReferrerId) {
      console.log(
        `✓ OK    ${label}  already attributed correctly (source=${currentSource || "unset"})`,
      );
      unchanged++;
      // Also normalize the source so future affiliate calls don't try to
      // overwrite this.
      if (currentSource !== "affiliate" && !DRY_RUN) {
        (buyer as any).referredBySource = "affiliate";
        await buyer.save();
      }
    } else {
      const fromLabel = currentReferrerId
        ? `${currentReferrerId} (${currentSource || "unset"})`
        : "(unset)";
      console.log(
        `→ FIX   ${label}  currently: ${fromLabel}${DRY_RUN ? " [dry-run]" : ""}`,
      );
      if (!DRY_RUN) {
        buyer.referredBy = affiliate._id;
        (buyer as any).referredBySource = "affiliate";
        await buyer.save();
      }
      repaired++;
    }

    // Step 2: fire the notification email (recovers missed notifications).
    if (DRY_RUN) {
      console.log(`        [dry-run] would notify ${pair.affiliate}`);
    } else {
      try {
        await notifyReferrerOfNewSignup(
          String(buyer._id),
          String(affiliate._id),
          null,
        );
        console.log(`        ✉  notified ${pair.affiliate}`);
        notified++;
      } catch (err) {
        console.error(`        ✗ notification failed:`, err);
      }
    }

    if (pair.note) console.log(`        note: ${pair.note}\n`);
  }

  console.log(`\n═══ SUMMARY ═══`);
  console.log(`  Attribution fixed:   ${repaired}`);
  console.log(`  Already correct:     ${unchanged}`);
  console.log(`  Notifications sent:  ${notified}${DRY_RUN ? " (dry-run)" : ""}`);
  console.log(`  Missing (skipped):   ${missing}`);

  await mongoose.disconnect();
})();

function esc(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

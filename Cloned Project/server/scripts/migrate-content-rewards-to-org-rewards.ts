/**
 * Migration: NcWallet (global per-user Content Rewards) → OrgRewardsWallet (per-(user,org)).
 *
 * For each user with content-rewards activity, reconstruct per-org balances
 * by walking historical ledgers, then seed OrgRewardsWallet rows. NcWallet
 * is left untouched (NetworkChains still uses it for its own purposes;
 * Garage just stops reading it).
 *
 * Reconstruction (cents, signed sum per org):
 *   +  CampaignWalletTransaction (relatedUserId = user, type = "debit",
 *      status = "completed")  →  attributed to that row's orgId.
 *   +  WalletTransaction (userId = user, walletType = "content_rewards",
 *      type = "credit")  →  attributed to the row's orgId when present;
 *      otherwise to the SENDER's orgId in metadata; otherwise FIFO across
 *      the per-org earnings buckets accumulated so far.
 *   −  WalletTransaction (userId = user, walletType = "content_rewards",
 *      type ∈ {"transfer","debit","withdrawal"})  →  same orgId attribution,
 *      FIFO when missing.
 *
 * Validation: sum(per-org-balance) is compared against NcWallet.balance for
 * each user. Tolerated drift ±2¢ (rounding from float USD ↔ cents in the
 * legacy CampaignWalletTransaction.amount). Larger drift surfaces in the
 * impact summary as `mismatch` and is NOT seeded — fix attribution rules
 * for that pattern and re-run.
 *
 * Safety: idempotent. Re-runs skip users who already have any OrgRewardsWallet
 * row. Run with --apply to actually write; default is dry-run.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-content-rewards-to-org-rewards.ts            # dry-run
 *   npx ts-node src/scripts/migrate-content-rewards-to-org-rewards.ts --apply    # write
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { NcWallet } from "../models/ncWallet.model";
import { OrgRewardsWallet } from "../models/orgRewardsWallet.model";
import { CampaignWalletTransaction } from "../models/campaignWalletTransaction.model";
import { WalletTransaction } from "../models/walletTransaction.model";

const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");
const DRIFT_TOLERANCE_CENTS = 2;

interface PerOrgRow {
  earningsCents: number;
  withdrawnCents: number;
  balanceCents: number;
}

interface UserReport {
  userId: string;
  ncBalanceCents: number;
  perOrg: Map<string, PerOrgRow>;
  perOrgBalanceSumCents: number;
  driftCents: number;
  status: "ok" | "mismatch" | "skipped_existing" | "seeded" | "would_seed";
  notes: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const usdToCents = (usd: number) => Math.round(usd * 100);
const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

async function reconstructForUser(userId: Types.ObjectId, nc: any): Promise<UserReport> {
  const report: UserReport = {
    userId: String(userId),
    ncBalanceCents: nc?.balance || 0,
    perOrg: new Map(),
    perOrgBalanceSumCents: 0,
    driftCents: 0,
    status: "ok",
    notes: [],
  };

  // 1) Campaign payouts → earnings attributed to each row's orgId.
  const payouts = await CampaignWalletTransaction.find({
    relatedUserId: userId,
    type: "debit",
    status: "completed",
  })
    .select("orgId amount createdAt")
    .lean();
  for (const p of payouts as any[]) {
    if (!p.orgId) {
      report.notes.push(`payout ${p._id || ""} missing orgId — skipped`);
      continue;
    }
    const k = String(p.orgId);
    const row =
      report.perOrg.get(k) ||
      ({ earningsCents: 0, withdrawnCents: 0, balanceCents: 0 } as PerOrgRow);
    row.earningsCents += usdToCents(p.amount || 0);
    row.balanceCents += usdToCents(p.amount || 0);
    report.perOrg.set(k, row);
  }

  // 2) WalletTransaction rows scoped to content_rewards for this user.
  const walletRows = await WalletTransaction.find({
    userId,
    walletType: "content_rewards",
  })
    .sort({ createdAt: 1 })
    .lean();

  // Helper to FIFO-debit across the per-org buckets the user has accumulated.
  const fifoDebit = (amountCents: number, reason: string) => {
    let remaining = amountCents;
    // Drain in insertion order — older orgs first.
    for (const [k, row] of report.perOrg) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, row.balanceCents);
      row.balanceCents -= take;
      row.withdrawnCents += take;
      remaining -= take;
      report.perOrg.set(k, row);
    }
    if (remaining > 0) {
      report.notes.push(
        `FIFO debit of ${formatCents(amountCents)} (${reason}) exhausted buckets by ${formatCents(
          remaining
        )} — possible data drift`
      );
    }
  };

  for (const t of walletRows as any[]) {
    const isCredit =
      t.type === "credit" ||
      (t.type === "transfer" && (t.metadata?.destination === undefined));
    const isOutflow =
      t.type === "withdrawal" ||
      t.type === "debit" ||
      (t.type === "transfer" && t.metadata?.destination !== undefined);
    const amountCents = usdToCents(t.amount || 0);

    // Resolve the org this row should be attributed to.
    const rowOrgId: string | undefined = t.orgId
      ? String(t.orgId)
      : t.metadata?.destinationOrgId
      ? String(t.metadata.destinationOrgId)
      : t.metadata?.senderOrgId
      ? String(t.metadata.senderOrgId)
      : undefined;

    if (isCredit) {
      const k = rowOrgId || "_unattributed";
      const row =
        report.perOrg.get(k) ||
        ({ earningsCents: 0, withdrawnCents: 0, balanceCents: 0 } as PerOrgRow);
      row.balanceCents += amountCents;
      // Not a "campaign earning" if it came from a peer send, but we still
      // count it toward totalEarnings on the per-org row for parity with the
      // OrgRewardsWallet schema.
      row.earningsCents += amountCents;
      report.perOrg.set(k, row);
      continue;
    }

    if (isOutflow) {
      if (rowOrgId) {
        const row = report.perOrg.get(rowOrgId);
        if (row && row.balanceCents >= amountCents) {
          row.balanceCents -= amountCents;
          row.withdrawnCents += amountCents;
          report.perOrg.set(rowOrgId, row);
        } else {
          // Bucket too small or missing — FIFO the deficit.
          if (row) {
            const partial = row.balanceCents;
            row.balanceCents = 0;
            row.withdrawnCents += partial;
            report.perOrg.set(rowOrgId, row);
            fifoDebit(amountCents - partial, `outflow tx ${t._id || ""}`);
          } else {
            fifoDebit(amountCents, `outflow tx ${t._id || ""} missing org bucket`);
          }
        }
      } else {
        fifoDebit(amountCents, `outflow tx ${t._id || ""} missing orgId`);
      }
    }
  }

  // If we have any "_unattributed" credit bucket, surface it as a note —
  // it'll still be seeded under that key, but admins should review.
  if (report.perOrg.has("_unattributed")) {
    const v = report.perOrg.get("_unattributed")!;
    report.notes.push(
      `unattributed credit bucket: balance ${formatCents(v.balanceCents)}, earnings ${formatCents(
        v.earningsCents
      )} — these will NOT be seeded (no orgId)`
    );
    report.perOrg.delete("_unattributed");
  }

  report.perOrgBalanceSumCents = [...report.perOrg.values()].reduce(
    (sum, r) => sum + r.balanceCents,
    0
  );
  report.driftCents = report.perOrgBalanceSumCents - report.ncBalanceCents;

  if (Math.abs(report.driftCents) > DRIFT_TOLERANCE_CENTS) {
    report.status = "mismatch";
  }

  return report;
}

async function seedForUser(report: UserReport, userId: Types.ObjectId): Promise<void> {
  for (const [orgIdStr, row] of report.perOrg) {
    if (row.balanceCents <= 0 && row.earningsCents <= 0 && row.withdrawnCents <= 0)
      continue;
    await OrgRewardsWallet.findOneAndUpdate(
      { userId, orgId: new Types.ObjectId(orgIdStr) },
      {
        $setOnInsert: {
          userId,
          orgId: new Types.ObjectId(orgIdStr),
          balance: Math.max(0, row.balanceCents),
          totalEarnings: row.earningsCents,
          totalWithdrawn: row.withdrawnCents,
          transactions: [
            {
              type: "credit",
              amount: Math.max(0, row.balanceCents),
              balanceAfter: Math.max(0, row.balanceCents),
              source: "migration_seed",
              description: "Migration seed from NcWallet/CampaignWalletTransaction history",
              createdAt: new Date(),
            },
          ],
        },
      },
      { upsert: true, new: true }
    );
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(
    `[migrate-cr] ${APPLY ? "APPLY MODE" : "DRY RUN"} — connected to MongoDB`
  );

  const summary = {
    usersScanned: 0,
    usersOk: 0,
    usersMismatch: 0,
    usersSkippedExisting: 0,
    usersSeeded: 0,
    totalCentsToSeed: 0,
    biggestDriftCents: 0,
    biggestDriftUser: "",
  };

  const nc = NcWallet.find({}).cursor();
  const mismatches: UserReport[] = [];

  for await (const wallet of nc) {
    summary.usersScanned++;
    if (summary.usersScanned % 100 === 0) {
      console.log(`[migrate-cr] scanned ${summary.usersScanned}…`);
    }

    const userId = (wallet as any).userId as Types.ObjectId;
    if (!userId) continue;

    // Idempotency: skip users who already have any OrgRewardsWallet row.
    const exists = await OrgRewardsWallet.exists({ userId });
    if (exists) {
      summary.usersSkippedExisting++;
      continue;
    }

    const report = await reconstructForUser(userId, wallet);

    if (report.status === "mismatch") {
      summary.usersMismatch++;
      mismatches.push(report);
      if (Math.abs(report.driftCents) > Math.abs(summary.biggestDriftCents)) {
        summary.biggestDriftCents = report.driftCents;
        summary.biggestDriftUser = report.userId;
      }
      if (VERBOSE) {
        console.log(
          `  MISMATCH user=${report.userId} drift=${formatCents(
            report.driftCents
          )} ncBal=${formatCents(report.ncBalanceCents)} perOrg=${formatCents(
            report.perOrgBalanceSumCents
          )}`
        );
        for (const n of report.notes) console.log(`    note: ${n}`);
      }
      continue;
    }

    if (report.perOrg.size === 0) {
      // User has an NcWallet row but no reconstructable per-org activity
      // — nothing to seed. Likely an NC-only user (Garage CR never touched).
      summary.usersOk++;
      continue;
    }

    summary.totalCentsToSeed += report.perOrgBalanceSumCents;

    if (APPLY) {
      await seedForUser(report, userId);
      summary.usersSeeded++;
      report.status = "seeded";
    } else {
      report.status = "would_seed";
    }
    summary.usersOk++;
  }

  console.log("\n[migrate-cr] === SUMMARY ===");
  console.log(`  users scanned          : ${summary.usersScanned}`);
  console.log(`  users skipped (existing): ${summary.usersSkippedExisting}`);
  console.log(`  users reconciled (ok)  : ${summary.usersOk}`);
  console.log(`  users mismatched       : ${summary.usersMismatch}`);
  console.log(
    `  users ${APPLY ? "seeded" : "WOULD seed"}    : ${
      APPLY ? summary.usersSeeded : summary.usersOk
    }`
  );
  console.log(
    `  total balance to seed  : ${formatCents(summary.totalCentsToSeed)}`
  );
  if (summary.biggestDriftCents !== 0) {
    console.log(
      `  biggest drift          : ${formatCents(summary.biggestDriftCents)} (user ${
        summary.biggestDriftUser
      })`
    );
  }
  if (mismatches.length > 0) {
    console.log("\n[migrate-cr] first 10 mismatches (rerun with --verbose for full):");
    for (const m of mismatches.slice(0, 10)) {
      console.log(
        `  ${m.userId}  drift=${formatCents(m.driftCents)}  nc=${formatCents(
          m.ncBalanceCents
        )}  perOrg=${formatCents(m.perOrgBalanceSumCents)}`
      );
    }
  }
  if (!APPLY) {
    console.log("\n[migrate-cr] DRY RUN complete. Re-run with --apply to seed.");
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[migrate-cr] fatal:", err);
  process.exit(1);
});

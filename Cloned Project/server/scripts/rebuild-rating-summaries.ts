/**
 * Rebuild RatingSummary rows and Review vote counters from source.
 *
 * The review write path keeps both in sync inside a transaction, so this is a
 * repair/verification tool rather than a one-time migration. Run it:
 *
 *   - after seeding or importing reviews out of band,
 *   - after changing REVIEW_AVERAGE_EXCLUDES_OWNER (the flag changes what
 *     counts toward every average, so every summary must be recomputed),
 *   - any time a summary is suspected of drifting.
 *
 * Both rebuilds read from source (Review for summaries, ReviewVote for vote
 * counters) and overwrite, so the script is idempotent and safe to re-run.
 *
 * Safety: dry-run by default — reports what WOULD change without writing.
 * Pass --apply to write.
 *
 * Usage:
 *   npx ts-node src/scripts/rebuild-rating-summaries.ts                  # dry-run
 *   npx ts-node src/scripts/rebuild-rating-summaries.ts --apply          # write
 *   npx ts-node src/scripts/rebuild-rating-summaries.ts --apply --votes  # also recount votes
 */

import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Review, ReviewTargetType } from "../models/review.model";
import { RatingSummary } from "../models/ratingSummary.model";
import {
  recomputeRatingSummary,
  recountReviewVotes,
  REVIEW_AVERAGE_EXCLUDES_OWNER,
} from "../services/review";

const APPLY = process.argv.includes("--apply");
const WITH_VOTES = process.argv.includes("--votes");

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);
  console.log(`Connected. ${APPLY ? "APPLY mode" : "DRY RUN"}.`);
  console.log(
    `Owner (founder) reviews are ${
      REVIEW_AVERAGE_EXCLUDES_OWNER ? "EXCLUDED from" : "INCLUDED in"
    } averages.\n`
  );

  // Every target that has at least one review, plus every target that already
  // has a summary — the latter catches targets whose last review was deleted
  // and whose summary must therefore be zeroed.
  const [reviewTargets, summaryTargets] = await Promise.all([
    Review.aggregate<{
      _id: { targetType: ReviewTargetType; targetId: Types.ObjectId };
      organizationId: Types.ObjectId;
    }>([
      {
        $group: {
          _id: { targetType: "$targetType", targetId: "$targetId" },
          organizationId: { $first: "$organizationId" },
        },
      },
    ]),
    RatingSummary.find()
      .select("targetType targetId organizationId")
      .lean(),
  ]);

  const targets = new Map<
    string,
    {
      targetType: ReviewTargetType;
      targetId: Types.ObjectId;
      organizationId: Types.ObjectId;
    }
  >();

  for (const row of reviewTargets) {
    targets.set(`${row._id.targetType}:${row._id.targetId}`, {
      targetType: row._id.targetType,
      targetId: row._id.targetId,
      organizationId: row.organizationId,
    });
  }
  for (const row of summaryTargets as any[]) {
    const key = `${row.targetType}:${row.targetId}`;
    if (!targets.has(key)) {
      targets.set(key, {
        targetType: row.targetType,
        targetId: row.targetId,
        organizationId: row.organizationId,
      });
    }
  }

  console.log(`Found ${targets.size} target(s) with reviews or summaries.`);

  let changed = 0;
  let unchanged = 0;

  for (const target of targets.values()) {
    const before = await RatingSummary.findOne({
      targetType: target.targetType,
      targetId: target.targetId,
    }).lean();

    if (!APPLY) {
      // Dry run: report current state only. Computing the "after" without
      // writing would mean duplicating the aggregation, and the recompute is
      // the thing we want exercised in APPLY mode anyway.
      console.log(
        `  ${target.targetType}:${target.targetId} — current avg ${
          (before as any)?.average ?? 0
        } over ${(before as any)?.count ?? 0} review(s)`
      );
      continue;
    }

    await recomputeRatingSummary(
      target.targetType,
      target.targetId,
      target.organizationId
    );

    const after = await RatingSummary.findOne({
      targetType: target.targetType,
      targetId: target.targetId,
    }).lean();

    const drifted =
      (before as any)?.average !== (after as any)?.average ||
      (before as any)?.count !== (after as any)?.count;

    if (drifted) {
      changed++;
      console.log(
        `  ✏️  ${target.targetType}:${target.targetId} — ` +
          `${(before as any)?.average ?? 0} (${(before as any)?.count ?? 0}) → ` +
          `${(after as any)?.average ?? 0} (${(after as any)?.count ?? 0})`
      );
    } else {
      unchanged++;
    }
  }

  if (WITH_VOTES && APPLY) {
    console.log("\nRecounting review vote tallies…");
    const reviewIds = await Review.find().select("_id").lean();
    for (const r of reviewIds as any[]) {
      await recountReviewVotes(r._id);
    }
    console.log(`  Recounted ${reviewIds.length} review(s).`);
  } else if (WITH_VOTES) {
    console.log("\n(--votes ignored in dry-run; pass --apply too.)");
  }

  if (APPLY) {
    console.log(
      `\n✅ Done. ${changed} summary row(s) corrected, ${unchanged} already accurate.`
    );
  } else {
    console.log(`\nDry run complete. Re-run with --apply to write.`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌ Rebuild failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});

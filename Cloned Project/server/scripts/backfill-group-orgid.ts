/**
 * Backfill `orgId` on legacy `groups` documents.
 *
 * Background: `orgId` used to be optional on the Group schema, and the
 * create route only stamped it when the client happened to pass
 * `?orgId=`. Groups created without it were saved with no org at all.
 *
 * The list endpoints papered over this by matching
 * `{ orgId: null }` / `{ orgId: { $exists: false } }` in addition to the
 * requested org — which meant every org-less group showed up in *every*
 * org the member switched into, including brand-new ones.
 *
 * Those endpoints are now strictly org-scoped, so org-less groups would
 * simply disappear from the sidebar. This script assigns each one an org
 * before that happens.
 *
 * Resolution order for a group's org:
 *   1. The creator's org membership shared by the most group members
 *      (the org the group was almost certainly created in).
 *   2. The creator's primary `organization`.
 * Groups where neither resolves are reported and left alone — they need
 * a human decision.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-group-orgid.ts          # dry run
 *   npx tsx src/scripts/backfill-group-orgid.ts --apply  # write
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

import { env } from "../config/env";
import { User } from "../models/user.model";

dotenv.config();

const APPLY = process.argv.includes("--apply");

/** Every org id a user belongs to, primary org first. */
function orgIdsForUser(user: any): string[] {
  const ids: string[] = [];
  const primary = user?.organization?.toString();
  if (primary) ids.push(primary);
  for (const m of (user?.organizations as any[]) || []) {
    const id = m?.organization?.toString();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function main() {
  if (!env.MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("No db handle");
    process.exit(1);
  }

  const col = db.collection("groups");
  const orphanFilter = {
    $or: [{ orgId: null }, { orgId: { $exists: false } }],
  };

  const total = await col.countDocuments(orphanFilter);
  console.log(`Groups with no orgId: ${total}`);
  if (total === 0) {
    await mongoose.disconnect();
    return;
  }

  const orphans = await col.find(orphanFilter).toArray();

  // Preload every user referenced by these groups in one round trip.
  const userIds = new Set<string>();
  for (const g of orphans) {
    if (g.createdBy) userIds.add(g.createdBy.toString());
    for (const m of (g.members as any[]) || []) {
      if (m?.userId) userIds.add(m.userId.toString());
    }
  }
  const users = await User.find({
    _id: { $in: [...userIds].map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("organization organizations")
    .lean();
  const userById = new Map(users.map((u: any) => [u._id.toString(), u]));

  let resolved = 0;
  const unresolved: { id: string; name: string }[] = [];

  for (const g of orphans) {
    const creator = userById.get(g.createdBy?.toString() || "");
    const creatorOrgs = orgIdsForUser(creator);

    let chosen: string | null = null;

    if (creatorOrgs.length === 1) {
      chosen = creatorOrgs[0];
    } else if (creatorOrgs.length > 1) {
      // Creator is in several orgs — pick the one the most members share.
      const tally = new Map<string, number>();
      for (const m of (g.members as any[]) || []) {
        const member = userById.get(m?.userId?.toString() || "");
        for (const org of orgIdsForUser(member)) {
          if (creatorOrgs.includes(org)) {
            tally.set(org, (tally.get(org) || 0) + 1);
          }
        }
      }
      const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
      // Fall back to the creator's primary org on a tie or no overlap.
      chosen =
        ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1])
          ? ranked[0][0]
          : creatorOrgs[0];
    }

    if (!chosen) {
      unresolved.push({ id: g._id.toString(), name: g.name });
      continue;
    }

    resolved++;
    if (APPLY) {
      await col.updateOne(
        { _id: g._id },
        { $set: { orgId: new mongoose.Types.ObjectId(chosen) } }
      );
    } else {
      console.log(`  ${g.name} (${g._id}) -> org ${chosen}`);
    }
  }

  console.log(`\nResolved: ${resolved}/${total}`);
  if (unresolved.length) {
    console.log(
      `Unresolved (creator has no org — assign manually): ${unresolved.length}`
    );
    for (const u of unresolved) console.log(`  ${u.name} (${u.id})`);
  }
  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

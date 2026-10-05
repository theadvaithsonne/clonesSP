// src/scripts/backfill-downline-tree.ts
// One-off, re-runnable backfill for the downline-table denormalized fields on
// User: ancestors[], depth, legNumber, directsCount, downlineCount, typeFlags.
// Builds the whole referral forest in memory, computes each field, and bulk-
// writes. Idempotent — running it again just recomputes the same values (also
// self-heals any drift from missed enroll/type hooks).
//
//   Run (dev):  DRY_RUN=1 npx tsx src/scripts/backfill-downline-tree.ts
//   Run (apply):          npx tsx src/scripts/backfill-downline-tree.ts

import "dotenv/config";
import mongoose from "mongoose";

const DRY_RUN = process.env.DRY_RUN === "1";
const BATCH = 1000;

async function main() {
  // autoIndex:false — user.model declares a unique partial index on `phone`
  // that production was never built with; syncing indexes on connect would
  // try to create it against live data. This script only recomputes
  // denormalised fields.
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });
  const { User } = await import("../models/user.model");
  const { computeTypeFlagsBulk } = await import("../services/downlineTypeFlags");

  console.log(`[backfill-downline] connected. DRY_RUN=${DRY_RUN ? "1" : "0"}`);

  // 1) Load the minimal tree shape for every user.
  type Node = {
    id: string;
    parent: string | null;
    createdAt: number;
    children: string[];
    ancestors: string[];
    depth: number;
    legNumber: number | null;
    directsCount: number;
    downlineCount: number;
  };
  const nodes = new Map<string, Node>();
  const cursor = User.find({})
    .select("_id referredBy createdAt")
    .lean()
    .cursor();
  for await (const u of cursor as any) {
    const id = String(u._id);
    nodes.set(id, {
      id,
      // A user whose referredBy is null/missing OR points at themselves (a
      // self-referring top user, e.g. the network founder) is a ROOT. Without the
      // self check the self-loop is unreachable and its whole subtree is skipped.
      parent: u.referredBy && String(u.referredBy) !== id ? String(u.referredBy) : null,
      createdAt: u.createdAt ? new Date(u.createdAt).getTime() : 0,
      children: [],
      ancestors: [],
      depth: 0,
      legNumber: null,
      directsCount: 0,
      downlineCount: 0,
    });
  }
  console.log(`[backfill-downline] loaded ${nodes.size} users`);

  // 2) Wire children (drop dangling parents → treat as root).
  const roots: string[] = [];
  for (const n of nodes.values()) {
    if (n.parent && nodes.has(n.parent)) nodes.get(n.parent)!.children.push(n.id);
    else n.parent = null;
  }
  for (const n of nodes.values()) if (n.parent === null) roots.push(n.id);

  // 3) BFS from roots: ancestors, depth, legNumber (signup order among siblings),
  //    directsCount. Cycle-safe via visited set.
  const visited = new Set<string>();
  const queue: string[] = [...roots];
  for (const r of roots) visited.add(r);
  while (queue.length) {
    const id = queue.shift()!;
    const n = nodes.get(id)!;
    n.directsCount = n.children.length;
    const kids = n.children
      .map((cid) => nodes.get(cid)!)
      .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
    kids.forEach((child, i) => {
      if (visited.has(child.id)) return; // cycle guard
      visited.add(child.id);
      child.ancestors = [...n.ancestors, n.id];
      child.depth = child.ancestors.length;
      child.legNumber = i + 1;
      queue.push(child.id);
    });
  }
  const orphaned = nodes.size - visited.size;
  if (orphaned > 0) console.warn(`[backfill-downline] ${orphaned} users unreachable (cycles?) — left at depth 0`);

  // 4) downlineCount = subtree size. Process deepest-first so children are done.
  const byDepthDesc = [...nodes.values()].sort((a, b) => b.depth - a.depth);
  for (const n of byDepthDesc) {
    if (n.parent && nodes.has(n.parent)) {
      const p = nodes.get(n.parent)!;
      p.downlineCount += n.downlineCount + 1;
    }
  }

  // 5) typeFlags in chunks.
  const allIds = [...nodes.keys()];
  const typeMap = new Map<string, { oneNetworkActivated: boolean; networkChainsSub: boolean; founderSub: boolean }>();
  for (let i = 0; i < allIds.length; i += BATCH) {
    const chunk = allIds.slice(i, i + BATCH);
    const m = await computeTypeFlagsBulk(chunk);
    for (const [k, v] of m) typeMap.set(k, v);
  }
  console.log(`[backfill-downline] computed typeFlags for ${typeMap.size} users with a membership`);

  // 6) Bulk write.
  const EMPTY = { oneNetworkActivated: false, networkChainsSub: false, founderSub: false };
  let written = 0;
  let ops: any[] = [];
  const flush = async () => {
    if (!ops.length) return;
    if (!DRY_RUN) await User.bulkWrite(ops, { ordered: false });
    written += ops.length;
    ops = [];
    process.stdout.write(`\r[backfill-downline] written ${written}/${nodes.size}`);
  };
  for (const n of nodes.values()) {
    ops.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(n.id) },
        update: {
          $set: {
            ancestors: n.ancestors.map((a) => new mongoose.Types.ObjectId(a)),
            depth: n.depth,
            legNumber: n.legNumber,
            directsCount: n.directsCount,
            downlineCount: n.downlineCount,
            typeFlags: typeMap.get(n.id) ?? EMPTY,
          },
        },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  process.stdout.write("\n");

  console.log(
    `[backfill-downline] done. roots=${roots.length} written=${written}${DRY_RUN ? " (DRY_RUN — nothing persisted)" : ""}`
  );
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-downline] fatal:", err);
  process.exit(1);
});

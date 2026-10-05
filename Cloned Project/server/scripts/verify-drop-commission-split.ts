/**
 * DB-FREE verification of the drop-creator commission carve-out
 * (`applyDropCreatorSplit` in services/commission.ts).
 *
 * This does NOT touch Mongo — it exercises the pure repartition helper the real
 * distributeCommissions() uses, asserting the invariants that matter for money:
 *   - creator gets exactly splitPct% of the ORIGINAL pool,
 *   - levels share the remaining (100-splitPct)%,
 *   - Σ(all recipients) === original pool to the penny (so seller/platform are
 *     provably unaffected),
 *   - no-upline / no-pool / bad id → no split (creator earns nothing).
 *
 * Run:  npx tsx src/scripts/verify-drop-commission-split.ts
 */
import { Types } from "mongoose";
import { applyDropCreatorSplit } from "../services/commission";

type Rec = {
  userId: any;
  level: number;
  percentage: number;
  amount: number;
  role?: "upline" | "drop_creator";
};

const CREATOR = new Types.ObjectId().toString();
const round2 = (n: number) => Math.round(n * 100) / 100;
let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function levels(...amts: number[]): Rec[] {
  return amts.map((amount, i) => ({
    userId: new Types.ObjectId(),
    level: i + 1,
    percentage: 0,
    amount,
  }));
}

// ── Case 1: worked example — ₹100 sale, L1 10% (₹10), L2 5% (₹5), pool ₹15 ──
{
  console.log("Case 1: worked example (pool 15 = L1 10 + L2 5), split 25%");
  const c = levels(10, 5);
  const pool = 15;
  const applied = applyDropCreatorSplit(c, pool, CREATOR, 25);
  const creator = c.find((r) => r.role === "drop_creator")!;
  const l1 = c[0];
  const l2 = c[1];
  const sum = round2(c.reduce((s, r) => s + r.amount, 0));
  check("split applied", applied);
  check("creator = 25% of pool (3.75)", creator?.amount === 3.75, `got ${creator?.amount}`);
  check("L1 scaled to 7.50", l1.amount === 7.5, `got ${l1.amount}`);
  check("L2 scaled to 3.75", l2.amount === 3.75, `got ${l2.amount}`);
  check("Σ recipients === original pool (15)", sum === pool, `got ${sum}`);
  check("creator level 0 + role drop_creator", creator.level === 0 && creator.role === "drop_creator");
}

// ── Case 2: no upline → pool 0 → no split, creator earns nothing ──
{
  console.log("Case 2: empty upline (pool 0) → no split");
  const c: Rec[] = [];
  const applied = applyDropCreatorSplit(c, 0, CREATOR, 25);
  check("not applied", applied === false);
  check("no recipients added", c.length === 0);
}

// ── Case 3: invalid creator id → no split ──
{
  console.log("Case 3: invalid creator id → no split");
  const c = levels(10, 5);
  const applied = applyDropCreatorSplit(c, 15, "not-an-objectid", 25);
  check("not applied", applied === false);
  check("levels untouched", c.length === 2 && c[0].amount === 10 && c[1].amount === 5);
}

// ── Case 4: invariant sweep — random pools/levels/splits keep Σ == pool ──
{
  console.log("Case 4: invariant sweep (Σ recipients === pool, exactly)");
  // Deterministic pseudo-random (no Math.random — banned in some contexts).
  let seed = 987654321;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let worst = 0;
  for (let t = 0; t < 5000; t++) {
    const nLevels = 1 + Math.floor(rnd() * 5);
    const amts: number[] = [];
    for (let i = 0; i < nLevels; i++) amts.push(round2(rnd() * 200));
    const pool = round2(amts.reduce((s, a) => s + a, 0));
    if (pool <= 0) continue;
    const splitPct = 1 + Math.floor(rnd() * 98); // 1..98
    const c = levels(...amts);
    applyDropCreatorSplit(c, pool, CREATOR, splitPct);
    const sum = round2(c.reduce((s, r) => s + r.amount, 0));
    const creator = c.find((r) => r.role === "drop_creator")!;
    worst = Math.max(worst, Math.abs(sum - pool));
    if (Math.abs(sum - pool) > 0.005) {
      check(`sweep t=${t} Σ==pool`, false, `pool ${pool} sum ${sum} split ${splitPct}%`);
      break;
    }
    // creator ≈ splitPct% of pool within a cent of rounding
    if (Math.abs(creator.amount - round2((pool * splitPct) / 100)) > 0.005) {
      check(`sweep t=${t} creator share`, false, `pool ${pool} split ${splitPct}% creator ${creator.amount}`);
      break;
    }
  }
  check("5000 random pools: Σ recipients === pool (max drift ≤ 0.005)", worst <= 0.005, `max drift ${worst}`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED ✅" : `\n${failures} CHECK(S) FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);

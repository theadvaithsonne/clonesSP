// src/services/rankBonus/qualify.ts
//
// Computes everyone's rank in a single O(n) pass over the referral tree.
//
// The key insight: a node's rank depends only on what its CHILDREN's subtrees
// contain, never on its parent or siblings. So if we process deepest-first,
// every child is already resolved when we reach the parent and no iteration is
// needed.
//
// Rules (see NETWORKCHAIN_RANK_BONUS_PLAN.md):
//   Bronze   = you are active AND >= 5 direct referrals are active
//   Silver   = 1 Bronze  in each of 4 distinct legs
//   Gold     = 1 Silver  in each of 5 distinct legs
//   Diamond  = 1 Gold    in each of 6 distinct legs
//   Platinum = 1 Diamond in each of 10 distinct legs
//
// A "leg" is one direct referral's entire subtree. Upline claiming is UNCAPPED,
// so a leg only needs an existence check — no claiming or compression
// bookkeeping. (Modelling showed uncapped and compressed produce identical
// results in every realistic tree, because Bronze requires 5 DIRECTS and each
// person has exactly one referrer.)
//
// Every rank above Bronze also requires Bronze, so an inactive user can never
// hold any rank regardless of what sits beneath them.

import { IRankPlan, RANK_KEYS, RankKey } from "../../models/rankPlan.model";

/** Ordinal: Bronze=0 … Platinum=4. -1 means unranked. */
export type RankOrdinal = number;

export interface QualifyInput {
  /** Every user in the tree. */
  users: Array<{ _id: any; referredBy?: any }>;
  /** userIds holding an active paid subscription at snapshot time. */
  active: Set<string>;
  plan: IRankPlan;
}

export interface QualifiedUser {
  userId: string;
  rank: RankKey;
  rankOrdinal: RankOrdinal;
  selfActive: boolean;
  activeDirects: number;
  totalDirects: number;
  /** How many distinct legs held at least one holder of each rank. */
  legsWithRank: Record<string, number>;
}

export interface QualifyResult {
  qualified: QualifiedUser[];
  evaluated: number;
  byRank: Record<string, number>;
  /** Users unreachable from any root — cycles or broken referredBy. */
  orphaned: number;
}

export function qualifyTree(input: QualifyInput): QualifyResult {
  const { users, active, plan } = input;

  const requiredActiveDirects = plan.tiers[0].requiredActiveDirects || 5;
  // legsNeeded[r] = distinct legs containing a holder of rank r-1, for r >= 1.
  const legsNeeded: number[] = plan.tiers.map((t) => t.requiredLegs || 0);

  // ── Build the forest ─────────────────────────────────────────────────────
  const children = new Map<string, string[]>();
  const ids: string[] = [];
  const parentOf = new Map<string, string | null>();

  for (const u of users) {
    const id = String(u._id);
    ids.push(id);
    // A user whose referredBy is missing OR points at themselves is a ROOT.
    // The self-referrer case is real (the network founder) and without this
    // check their entire subtree becomes unreachable.
    const raw = u.referredBy ? String(u.referredBy) : null;
    const parent = raw && raw !== id ? raw : null;
    parentOf.set(id, parent);
  }
  for (const id of ids) {
    const p = parentOf.get(id);
    if (!p) continue;
    // Ignore edges to users outside the loaded set (deleted parents).
    if (!parentOf.has(p)) {
      parentOf.set(id, null);
      continue;
    }
    let arr = children.get(p);
    if (!arr) {
      arr = [];
      children.set(p, arr);
    }
    arr.push(id);
  }

  // ── Depth-order via BFS from roots, with a cycle guard ───────────────────
  // Computed here rather than trusting User.depth, which can be stale if the
  // backfill hasn't run since a re-parent.
  const order: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const id of ids) if (!parentOf.get(id)) queue.push(id);

  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    for (const c of children.get(id) || []) {
      if (!visited.has(c)) queue.push(c);
    }
  }
  const orphaned = ids.length - visited.size;

  // ── Single pass, deepest-first ───────────────────────────────────────────
  // `order` is root-first (BFS), so reversing gives deepest-first. Every child
  // is resolved before its parent.
  const subtreeMax = new Map<string, RankOrdinal>(); // max rank in node's subtree, incl. self
  const qualified: QualifiedUser[] = [];
  const byRank: Record<string, number> = {};
  for (const k of RANK_KEYS) byRank[k] = 0;

  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const kids = children.get(id) || [];

    const selfActive = active.has(id);
    let activeDirects = 0;
    for (const c of kids) if (active.has(c)) activeDirects++;

    // How many distinct legs contain a holder of rank >= r.
    const legsWith: number[] = new Array(RANK_KEYS.length).fill(0);
    let maxBelow: RankOrdinal = -1;
    for (const c of kids) {
      const m = subtreeMax.get(c);
      if (m === undefined || m < 0) continue;
      if (m > maxBelow) maxBelow = m;
      for (let r = 0; r <= m; r++) legsWith[r]++;
    }

    // Bronze gates everything: inactive, or fewer than 5 active directs, and
    // you hold no rank at all no matter what is beneath you.
    let ordinal: RankOrdinal = -1;
    if (selfActive && activeDirects >= requiredActiveDirects) {
      ordinal = 0; // Bronze
      // Climb while the next rank's leg requirement is met by holders of the
      // rank directly below it.
      for (let r = 1; r < RANK_KEYS.length; r++) {
        if (legsWith[r - 1] >= legsNeeded[r]) ordinal = r;
        else break;
      }
    }

    subtreeMax.set(id, Math.max(ordinal, maxBelow));

    if (ordinal >= 0) {
      const legsWithRank: Record<string, number> = {};
      for (let r = 0; r < RANK_KEYS.length; r++) {
        legsWithRank[RANK_KEYS[r]] = legsWith[r];
      }
      const rank = RANK_KEYS[ordinal];
      byRank[rank]++;
      qualified.push({
        userId: id,
        rank,
        rankOrdinal: ordinal,
        selfActive,
        activeDirects,
        totalDirects: kids.length,
        legsWithRank,
      });
    }
  }

  return { qualified, evaluated: ids.length, byRank, orphaned };
}

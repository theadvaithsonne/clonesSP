/**
 * bat246Leaderboard.service.ts
 * Handles Leaderboard tier assignments and per-entry payouts.
 *
 * Tier rules (all require crossedHp = true):
 *   T (Triple)    — 2+ green cards + 1 gold  → $100/entry, cap $50k
 *   H (Homerun)   — 5+ total cards + 1 gold  → $200/entry, cap $100k
 *   G (Grand Slam)— 7+ total cards + 1 gold  → $300/entry, cap $300k
 *
 * Each board has exactly 1 slot per tier. Slot assignment is a per-board
 * CASCADE (assignLbSlots, corrected 2026-08-22 — see bat246_leaderboard.md
 * for the full spec and worked examples), triggered exactly once per board:
 * right after it's created as a split's child, for the ONE player who just
 * "crossed home plate" on the parent board. LB payouts (payLbHolders) run
 * on every entry instead, independent of when slots are (re)assigned, and
 * reduce Alan K's share of the $650/$160 sale.
 */

import { Types } from "mongoose";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { directCreditStoreWallet } from "./bat246Wallet.util";

type Tier = "T" | "H" | "G";

const LB_PER_ENTRY: Record<Tier, number> = { T: 100, H: 200, G: 300 };
const LB_CAP:       Record<Tier, number> = { T: 50_000, H: 100_000, G: 300_000 };
const LB_TIER_KEY:  Record<Tier, string> = { T: "triple", H: "homeRun", G: "grandSlam" };
const NEXT_TIER:    Record<Tier, Tier | null> = { T: "H", H: "G", G: null };

async function getOrgId(): Promise<string | null> {
  const { Product } = require("../../models/product.model");
  const product = await Product.findOne({ tags: "bat246_entry" }).select("organizationId").lean() as any;
  return product?.organizationId?.toString() ?? null;
}

/**
 * Pay T/H/G holders for a new board entry.
 * Returns the total amount paid (used to reduce Alan K's saleAmount).
 */
export async function payLbHolders(boardId: string): Promise<number> {
  const board = await Bat246Board.findById(boardId).select("leaderBoard trackingNumber").lean() as any;
  if (!board?.leaderBoard?.length) return 0;

  const orgId = await getOrgId();
  if (!orgId) return 0;

  let totalPaid = 0;

  for (const row of board.leaderBoard as Array<{ tier: string; playerId: any; earningsOnBoard: number }>) {
    if (!row.playerId) continue;

    const tier = row.tier as Tier;
    const cap      = LB_CAP[tier];
    const perEntry = LB_PER_ENTRY[tier];
    const tierKey  = LB_TIER_KEY[tier];

    const player = await Bat246Player.findById(row.playerId)
      .select(`userId minorLeague.lbEarnings`)
      .lean() as any;
    if (!player?.userId) continue;

    const currentEarned: number = player.minorLeague?.lbEarnings?.[tierKey] ?? 0;

    if (currentEarned >= cap) {
      // Cap hit — vacate the slot
      await Bat246Board.updateOne(
        { _id: boardId, "leaderBoard.tier": tier },
        { $set: { "leaderBoard.$.playerId": null, "leaderBoard.$.qualifiedAt": null, "leaderBoard.$.earningsOnBoard": 0 } }
      );
      continue;
    }

    const toPay = Math.min(perEntry, cap - currentEarned);

    await directCreditStoreWallet(
      player.userId.toString(),
      orgId,
      toPay,
      `Bat246 LB ${tier} bonus (board ${board.trackingNumber})`
    );

    await Promise.all([
      Bat246Player.updateOne(
        { _id: row.playerId },
        { $inc: { [`minorLeague.lbEarnings.${tierKey}`]: toPay } }
      ),
      Bat246Board.updateOne(
        { _id: boardId, "leaderBoard.tier": tier },
        { $inc: { "leaderBoard.$.earningsOnBoard": toPay } }
      ),
    ]);

    totalPaid += toPay;
  }

  return totalPaid;
}

/** Does this card count meet (at least) the given tier's own bar? Gold is always mandatory. */
function meetsTierCards(cardsEarned: any, tier: Tier): boolean {
  const ce = cardsEarned ?? {};
  const gold  = ce.gold  ?? 0;
  const green = ce.green ?? 0;
  const total = gold + (ce.black ?? 0) + (ce.brown ?? 0) + green; // gray excluded — does not count for LB
  if (gold < 1) return false;
  if (tier === "G") return total >= 7;
  if (tier === "H") return total >= 5;
  return green >= 2; // T
}

/** Still under this tier's lifetime $ cap (i.e. actually able to earn more from it)? */
function underCap(lbEarnings: any, tier: Tier): boolean {
  const earned: number = lbEarnings?.[LB_TIER_KEY[tier]] ?? 0;
  return earned < LB_CAP[tier];
}

/** Highest tier this player both qualifies for (by cards) AND isn't already capped out of. */
function bestEligibleTier(cardsEarned: any, lbEarnings: any): Tier | null {
  for (const tier of ["G", "H", "T"] as const) {
    if (meetsTierCards(cardsEarned, tier) && underCap(lbEarnings, tier)) return tier;
  }
  return null;
}

/**
 * Called exactly once per board, right after it's created as a split's
 * child — for the ONE player who just "crossed home plate" (graduated OFF
 * the parent board when it split; see bat246Split.service.ts's runPhase2
 * step d — this is the PARENT's old Home Plate occupant, NOT the 3rd Base
 * player who becomes the new Home Plate on the children; that player
 * hasn't exited yet, so doesn't count here).
 *
 * Per-board cascade (corrected 2026-08-22 — see bat246_leaderboard.md for
 * the full spec, worked examples, and what this replaces):
 *   1. The graduate enters at the HIGHEST tier they both qualify for by
 *      card count and aren't already capped out of (bestEligibleTier). A
 *      no-op if they qualify for nothing at all (missing Gold, or under
 *      every threshold).
 *   2. If that tier is empty, they simply take it — done.
 *   3. If occupied, they take it anyway, displacing the incumbent. The
 *      displaced player is checked against the NEXT tier up: if their own
 *      cards meet that tier's bar AND they're still under its cap, they
 *      get promoted there too — displacing whoever's in THAT tier, and the
 *      same check repeats one tier higher.
 *   4. The chain ends the moment a displaced player doesn't qualify (or is
 *      capped) for the next tier up — they're knocked off this board's
 *      leaderboard entirely — or when someone is displaced from Grand Slam,
 *      which has no tier above it to promote into.
 *
 * Entirely scoped to this one board — never compares against, or is
 * affected by, any other board's leaderboard. Trophies (permanent, never
 * lost) are awarded for every tier that gets a new occupant this pass.
 */
export async function assignLbSlots(boardId: string, graduatePlayerId: string | Types.ObjectId): Promise<void> {
  const [board, graduate] = await Promise.all([
    Bat246Board.findById(boardId).select("leaderBoard trackingNumber").lean() as any,
    Bat246Player.findById(graduatePlayerId).select("minorLeague.cardsEarned minorLeague.lbEarnings").lean() as any,
  ]);
  if (!board?.leaderBoard?.length || !graduate) return;

  const entryTier = bestEligibleTier(graduate.minorLeague?.cardsEarned, graduate.minorLeague?.lbEarnings);
  if (!entryTier) return; // doesn't qualify for any tier — no-op, nothing on the board changes

  const rowsByTier = new Map<Tier, any>((board.leaderBoard as any[]).map((r) => [r.tier as Tier, r]));

  // Walk the cascade, collecting every (tier, newOccupant) placement to write.
  const placements: { tier: Tier; playerId: Types.ObjectId }[] = [];
  let incomingPlayerId = new Types.ObjectId(graduatePlayerId.toString());
  let currentTier: Tier = entryTier;

  while (true) {
    placements.push({ tier: currentTier, playerId: incomingPlayerId });

    const displacedId = rowsByTier.get(currentTier)?.playerId?.toString() ?? null;
    if (!displacedId) break; // slot was vacant — chain ends, nobody to re-place

    const nextTier = NEXT_TIER[currentTier];
    if (!nextTier) break; // displaced from Grand Slam — knocked off, nowhere higher to go

    const displacedPlayer = await Bat246Player.findById(displacedId)
      .select("minorLeague.cardsEarned minorLeague.lbEarnings").lean() as any;
    const canPromote =
      !!displacedPlayer &&
      meetsTierCards(displacedPlayer.minorLeague?.cardsEarned, nextTier) &&
      underCap(displacedPlayer.minorLeague?.lbEarnings, nextTier);

    if (!canPromote) break; // doesn't qualify (or is capped) for the next tier — knocked off, chain ends

    incomingPlayerId = new Types.ObjectId(displacedId);
    currentTier = nextTier;
  }

  const now = new Date();
  for (const { tier, playerId } of placements) {
    await Bat246Board.updateOne(
      { _id: boardId, "leaderBoard.tier": tier },
      {
        $set: {
          "leaderBoard.$.playerId": playerId,
          "leaderBoard.$.qualifiedAt": now,
          // Fresh occupant — this board's running display total restarts at 0
          // rather than inheriting whatever the previous occupant had earned.
          "leaderBoard.$.earningsOnBoard": 0,
        },
      }
    );
  }

  // Trophies Distribution — landing on an LB slot earns that tier's permanent
  // trophy (awardTrophy is idempotent; repeat occupancies are no-ops).
  // Fire-and-forget: trophy bookkeeping never blocks slot assignment.
  const { awardTrophy } = await import("./bat246Trophy.service");
  for (const { tier, playerId } of placements) {
    awardTrophy(playerId, tier, boardId, (board as any).trackingNumber).catch((err: any) =>
      console.error(`[bat246 trophies] award ${tier} failed:`, err.message)
    );
  }
}

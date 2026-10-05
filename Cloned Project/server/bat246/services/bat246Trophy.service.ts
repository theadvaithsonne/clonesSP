/**
 * bat246Trophy.service.ts — Trophies Distribution
 *
 * A player earns a permanent trophy (T / H / G) the first time they occupy the
 * corresponding leaderboard tier on any board. Trophies are:
 *   - awarded once, ever (atomic guard — no duplicates, no races)
 *   - never removed (kept even after the LB slot is vacated on cap hit)
 *
 * Award paths:
 *   1. awardTrophy()                    — called from assignLbSlots() whenever a slot is filled
 *   2. checkAndAwardTrophiesByCards()   — called at every cardsEarned increment site;
 *                                          awards any tier the player's current card
 *                                          counts qualify for, independent of crossedHp,
 *                                          board-slot occupancy, or earnings caps
 *   3. distributeTrophies()             — sweep over all boards' leaderBoard rows; awards any
 *                                          missing trophies (backfill / safety net, idempotent)
 */

import { Types } from "mongoose";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";

export type TrophyTier = "T" | "H" | "G";

/**
 * Award a trophy to a player — idempotent.
 * The update only matches when the trophy is not already set, so concurrent
 * calls / repeat occupancies can never double-award.
 * Returns true when the trophy was newly awarded.
 */
export async function awardTrophy(
  playerId: string | Types.ObjectId,
  tier: TrophyTier,
  boardId?: string | Types.ObjectId,
  boardTrackingNo?: string
): Promise<boolean> {
  const result = await Bat246Player.updateOne(
    {
      _id: new Types.ObjectId(playerId.toString()),
      $or: [
        { [`trophies.${tier}`]: null },
        { [`trophies.${tier}`]: { $exists: false } },
      ],
    },
    {
      $set: {
        [`trophies.${tier}`]: {
          earnedAt: new Date(),
          boardId: boardId ? new Types.ObjectId(boardId.toString()) : null,
          boardTrackingNo: boardTrackingNo ?? null,
        },
      },
    }
  );
  const awarded = result.modifiedCount > 0;
  if (awarded) {
    console.log(`[bat246 trophies] Awarded ${tier} trophy to player ${playerId}${boardTrackingNo ? ` (board ${boardTrackingNo})` : ""}`);
  }
  return awarded;
}

/**
 * Award every trophy tier a player's current card counts qualify for —
 * independent of crossedHp, board-slot occupancy, or earnings caps (those
 * still gate the separate paid leaderboard slot in bat246Leaderboard.service.ts,
 * this only concerns the permanent trophy badge). Uses the same thresholds as
 * tierFor() in bat246Leaderboard.service.ts, but checks all three tiers
 * independently rather than returning only the single highest one, so a
 * player can hold T, H, and G simultaneously the moment their cards justify it.
 */
export async function checkAndAwardTrophiesByCards(
  playerId: string | Types.ObjectId,
  boardId?: string | Types.ObjectId,
  boardTrackingNo?: string
): Promise<TrophyTier[]> {
  const player = await Bat246Player.findById(playerId).select("minorLeague.cardsEarned").lean() as any;
  const ce = player?.minorLeague?.cardsEarned ?? {};
  const gold  = ce.gold ?? 0;
  const green = ce.green ?? 0;
  const total = gold + (ce.black ?? 0) + (ce.brown ?? 0) + green; // gray excluded — same as tierFor()

  const qualifies: Record<TrophyTier, boolean> = {
    T: gold >= 1 && green >= 2,
    H: gold >= 1 && total >= 5,
    G: gold >= 1 && total >= 7,
  };

  const awardedTiers: TrophyTier[] = [];
  for (const tier of ["T", "H", "G"] as const) {
    if (!qualifies[tier]) continue;
    const awarded = await awardTrophy(playerId, tier, boardId, boardTrackingNo);
    if (awarded) awardedTiers.push(tier);
  }
  return awardedTiers;
}

/**
 * Sweep every board's leaderBoard rows and award any missing trophies to the
 * current occupants. Fully idempotent — safe to run any number of times.
 * Covers boards in any lifecycle state where an LB row can hold a player.
 */
export async function distributeTrophies(): Promise<{ scannedBoards: number; awarded: number }> {
  const boards = await Bat246Board.find({
    "leaderBoard.playerId": { $ne: null },
  })
    .select("leaderBoard trackingNumber status")
    .lean() as any[];

  let awarded = 0;
  for (const board of boards) {
    for (const row of (board.leaderBoard ?? []) as Array<{ tier?: string; playerId?: any }>) {
      if (!row?.playerId || !row.tier) continue;
      if (row.tier !== "T" && row.tier !== "H" && row.tier !== "G") continue;
      const ok = await awardTrophy(row.playerId, row.tier as TrophyTier, board._id, board.trackingNumber);
      if (ok) awarded++;
    }
  }

  return { scannedBoards: boards.length, awarded };
}

import { Types } from "mongoose";
import { Bat246Board } from "../models/bat246Board.model";
// Types still used by getBoardMovements, setPenciling, setPrePick
import { Bat246Player } from "../models/bat246Player.model";
import { createBat246Player } from "./bat246PlayerId.util";
import { resolveCountryOrigin } from "./bat246Country.util";
import { Bat246Movement } from "../models/bat246Movement.model";
import { Bat246PositionReservation } from "../models/bat246PositionReservations.model";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { Bat246SalesCredit } from "../models/bat246SalesCredit.model";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { assignDistributorId } from "./bat246DistributorId.util";
import { Bat246PlacementNotification } from "../models/bat246PlacementNotifications.model";
import { User } from "../../models/user.model";
import { splitBoardPhase1 } from "./bat246Split.service";
import { transferAtBatPayment, transferAtBatPaymentToThirdBase } from "./bat246Wallet.util";
import { buildGreenCardBack, buildGoldCardBack, buildNoCardCardBack } from "./bat246CardBack.util";
import { checkAndAwardTrophiesByCards } from "./bat246Trophy.service";
import { Bat246OfficeInvite } from "../models/bat246OfficeInvite.model";
import { isValidAffiliateId } from "../../utils/affiliateId";

/**
 * Resolves who should be recorded as a user's BAT246 referrer, trying each
 * source in order of trust and falling through only when the previous one
 * has nothing:
 *   1. `explicitRef` — a `bat246Ref` value the caller already has (usually
 *      from a URL query param on the current request). Trusted as-is.
 *   2. The durable record already on this user's own `Bat246Distributor`
 *      row (`bat246RefUserId`), if one exists — set once, by whichever of
 *      these flows got there first, and never overwritten.
 *   3. `Bat246OfficeInvite` — a durable, EMAIL-keyed record written the
 *      moment Alan/an admin sends the "+ Invite to become Bat246
 *      Distributor" email (see `POST /bat246/office-invite`), before the
 *      prospect even has an account. Covers every case where the prospect
 *      never carries `bat246Ref` through to signup/checkout at all — closed
 *      the browser mid-flow, forwarded the email, signed up a different
 *      way, whatever — because it's tied to their email, not a URL or
 *      session.
 *   4. `fallbackRef` — a house default the link carried (gotobigwin.com's
 *      JOIN NOW sends Alan K here when the visitor arrived with no one's
 *      referral link). Last on purpose: as an `explicitRef` it used to
 *      beat a real inviter's Bat246OfficeInvite record.
 * A ref may be a userId or an affiliate id (`aff_…`) — gotobigwin.com's
 * shareable links are webinar invites, which carry the sharer's affiliate
 * id. Either form resolves to a userId; anything else, or the user's own
 * id, is ignored rather than trusted.
 * Returns `undefined` if none of them have anything, same as before
 * this helper existed — callers that already handle "no referrer" keep
 * working unchanged.
 */
export async function resolveBat246Ref(opts: {
  explicitRef?: string | null;
  fallbackRef?: string | null;
  email?: string | null;
  userId?: string | Types.ObjectId | null;
}): Promise<string | undefined> {
  const self = opts.userId?.toString();
  const toReferrerUserId = async (ref?: string | null) => {
    const id = await refToUserId(ref);
    return id && id !== self ? id : undefined;
  };

  const explicit = await toReferrerUserId(opts.explicitRef);
  if (explicit) return explicit;

  if (opts.userId) {
    const dist = await Bat246Distributor.findOne({ userId: opts.userId })
      .select("bat246RefUserId")
      .lean() as any;
    if (dist?.bat246RefUserId) return dist.bat246RefUserId.toString();
  }

  if (opts.email) {
    const invite = await Bat246OfficeInvite.findOne({ email: opts.email.trim().toLowerCase() })
      .select("inviterUserId")
      .lean() as any;
    if (invite?.inviterUserId) return invite.inviterUserId.toString();
  }

  return toReferrerUserId(opts.fallbackRef);
}

async function refToUserId(ref?: string | null): Promise<string | undefined> {
  const value = ref?.trim();
  if (!value) return undefined;
  if (/^[a-f0-9]{24}$/i.test(value)) return value;
  if (!isValidAffiliateId(value)) return undefined;
  const user = await User.findOne({ affiliateId: value }).select("_id").lean() as any;
  return user?._id?.toString();
}

// Shared helper: after an AT BAT slot is filled via manual/reservation placement,
// check whether the board is now full (8/8) and trigger the split if so.
// Mirrors the check in addAtBatFromPurchase / addFromGenericInvite / promoteDugoutAfterPP
// (bat246Entry.service.ts) — those cover the purchase/invite flow, this covers
// the admin "Place Now" / reservation placement flow.
async function maybeTriggerSplitAfterAtBatFill(boardId: string, position: string) {
  if (!position.startsWith("atBat-")) return;

  const refreshed = await Bat246Board.findById(boardId).lean() as any;
  const atBatFilled = (refreshed?.atBat ?? []).filter(Boolean).length;

  if (atBatFilled >= 8 && refreshed?.status === "active") {
    splitBoardPhase1(boardId).catch((err) =>
      console.error("[bat246] split trigger failed:", err.message)
    );
  }
}

const SLOT_EMAIL_PATHS = [
  "homePlate.playerEmail",
  "thirdBase.playerEmail",
  "secondBaseA.playerEmail",
  "secondBaseB.playerEmail",
  "firstBase.playerEmail",
  "atBat.playerEmail",
  "dugout.playerEmail",
  "onDeckCircle.playerEmail",
  "pod.playerEmail",
] as const;

// Position keys shown on board cards (excludes homePlate)
export const POSITION_KEYS = [
  "thirdBase", "secondBaseA", "secondBaseB",
  "1stA", "1stB", "1stC", "1stD",
  "atBat-0", "atBat-1", "atBat-2", "atBat-3", "atBat-4", "atBat-5", "atBat-6", "atBat-7",
] as const;

function slotForPosition(board: any, key: string): any {
  if (key === "thirdBase" || key === "secondBaseA" || key === "secondBaseB") return board[key];
  if (key.startsWith("1st")) return board.firstBase?.["ABCD".indexOf(key[3])] ?? null;
  return board.atBat?.[Number(key.split("-")[1])] ?? null;
}

// Attaches a `positions` summary (filled/blank/reserved + expiry) and strips raw slot data
async function withPositionSummary(boards: any[]) {
  if (boards.length === 0) return boards;

  const reservations = await Bat246PositionReservation.find({
    boardId: { $in: boards.map(b => b._id) },
    status: "active",
    expiresAt: { $gt: new Date() },
  }).select("boardId position expiresAt").lean();

  const resMap = new Map<string, Date>();
  for (const r of reservations as any[]) resMap.set(`${r.boardId}_${r.position}`, r.expiresAt);

  return boards.map(b => {
    const { thirdBase, secondBaseA, secondBaseB, firstBase, atBat, ...rest } = b;
    const positions = POSITION_KEYS.map(key => {
      const slot = slotForPosition(b, key);
      if (slot?.playerId) return { key, status: "filled" as const };
      const expiresAt = resMap.get(`${b._id}_${key}`);
      if (expiresAt) return { key, status: "reserved" as const, expiresAt };
      return { key, status: "blank" as const };
    });
    return { ...rest, positions };
  });
}

// Same constant every Bat246 admin route file hardcodes independently —
// not consolidated, matching the established pattern (see ALAN_K_EMAIL
// comment in bat246Permission.service.ts).
const ALAN_K_EMAIL = "redbaron2020@mail.com";

// Boards with mode "test" (developer-only) are filtered out unless the caller
// passes includeTest — see bat246TestMode.ts for who is allowed.

export async function getBoards(filterEmail?: string, isAdmin = false, includeTest = false) {
  const query: any = { status: { $in: ["pending", "active", "stalled", "splitting"] } };
  if (!isAdmin) query.hidden = { $ne: true };
  if (!includeTest) query.mode = { $ne: "test" };
  if (filterEmail) {
    query["$or"] = SLOT_EMAIL_PATHS.map(path => ({ [path]: filterEmail }));
  }
  const boards = await Bat246Board.find(query)
    .select("boardNumber trackingNumber title status hidden warpCount protectionPeriodEnd minorLeagueAmount leaderBoard inviteProductId createdAt thirdBase secondBaseA secondBaseB firstBase atBat")
    .sort({ createdAt: 1 })
    .lean();
  return withPositionSummary(boards);
}

export async function getCompletedBoards(filterEmail?: string, isAdmin = false, includeTest = false) {
  const query: any = { status: { $in: ["completed", "split"] } };
  if (!isAdmin) query.hidden = { $ne: true };
  if (!includeTest) query.mode = { $ne: "test" };
  if (filterEmail) {
    query["$or"] = SLOT_EMAIL_PATHS.map(path => ({ [path]: filterEmail }));
  }
  const boards = await Bat246Board.find(query)
    .select("boardNumber trackingNumber title status hidden warpCount protectionPeriodEnd minorLeagueAmount leaderBoard inviteProductId createdAt splitAt thirdBase secondBaseA secondBaseB firstBase atBat")
    .sort({ createdAt: -1 })
    .lean();
  return withPositionSummary(boards);
}

export async function getBoardById(id: string, callerEmail?: string | null, includeTest = false) {
  const board = await Bat246Board.findById(id).lean();
  if (!board) return null;
  if ((board as any).hidden && callerEmail?.toLowerCase() !== ALAN_K_EMAIL) return null;
  if ((board as any).mode === "test" && !includeTest) return null;

  // Join leaderBoard playerIds → player name + earnings
  const lbPlayerIds = board.leaderBoard
    .map((row: any) => row.playerId)
    .filter(Boolean);

  const lbPlayers = await Bat246Player.find({ _id: { $in: lbPlayerIds } })
    .select("userId nickname email minorLeague.lbEarnings minorLeague.lbLevel minorLeague.totalBCs minorLeague.cardsEarned countryResidence countryOrigin")
    .lean();

  const playerMap = new Map(lbPlayers.map((p: any) => [p._id.toString(), p]));
  const LB_TIER_KEY: Record<string, string> = { T: "triple", H: "homeRun", G: "grandSlam" };

  // Build entryNo lookup from all board slots (used for hotBox + leaderboard display)
  const entryNoMap = new Map<string, string>();
  const allSlots: any[] = [
    board.homePlate, board.thirdBase, board.secondBaseA, board.secondBaseB,
    ...(board.firstBase || []), ...(board.atBat || []),
    ...(board.dugout || []), ...(board.onDeckCircle || []),
    ...((board as any).pod || []),
  ];
  for (const slot of allSlots) {
    if (slot?.playerId && slot?.entryNo) {
      entryNoMap.set(slot.playerId.toString(), slot.entryNo);
    }
  }

  // Join slot + leaderboard playerIds → distributorId (via Player.userId → Bat246Distributor)
  // and earned trophies (T/H/G booleans), mutating the slot objects in place
  // since they're the same references nested inside `board`.
  const slotPlayerIds = [...new Set(allSlots.filter((s) => s?.playerId).map((s) => s.playerId.toString()))];
  const distIdSourceIds = [...new Set([...slotPlayerIds, ...lbPlayerIds.map((id: any) => id.toString())])];
  let distMap = new Map<string, string>();
  let lbUserMap = new Map<string, string | undefined>();
  if (distIdSourceIds.length) {
    const distSourcePlayers = await Bat246Player.find({ _id: { $in: distIdSourceIds } }).select("userId trophies").lean();
    const playerUserMap = new Map(distSourcePlayers.map((p: any) => [p._id.toString(), p.userId?.toString()]));
    const trophyMap = new Map(distSourcePlayers.map((p: any) => [p._id.toString(), p.trophies ?? null]));
    lbUserMap = playerUserMap;
    const distUserIds = [...new Set(distSourcePlayers.map((p: any) => p.userId?.toString()).filter(Boolean))];
    const dists = await Bat246Distributor.find({ userId: { $in: distUserIds } }).select("userId distributorId").lean();
    distMap = new Map(dists.map((d: any) => [d.userId.toString(), d.distributorId]));
    for (const slot of allSlots) {
      if (!slot?.playerId) continue;
      const uId = playerUserMap.get(slot.playerId.toString());
      const distId = uId ? distMap.get(uId) : null;
      if (distId) slot.distributorId = distId;
      const tr = trophyMap.get(slot.playerId.toString());
      if (tr && (tr.G || tr.H || tr.T)) {
        slot.trophies = { G: !!tr.G, H: !!tr.H, T: !!tr.T };
      }
    }
  }

  const leaderBoard = board.leaderBoard.map((row: any) => {
    const player = row.playerId ? playerMap.get(row.playerId.toString()) : null;
    const tierKey = LB_TIER_KEY[row.tier] ?? "triple";
    const uId = row.playerId ? lbUserMap.get(row.playerId.toString()) : null;
    return {
      tier: row.tier,
      playerId: row.playerId,
      playerName: player ? (player.nickname || player.email) : null,
      distributorId: uId ? (distMap.get(uId) ?? null) : null,
      entryNo: row.playerId ? (entryNoMap.get(row.playerId.toString()) ?? null) : null,
      earnings: player ? (player.minorLeague?.lbEarnings?.[tierKey] ?? 0) : 0,
      earningsOnBoard: row.earningsOnBoard ?? 0,
      totalBCs: player ? (player.minorLeague?.totalBCs ?? 0) : 0,
      cardsEarned: player ? (player.minorLeague?.cardsEarned ?? null) : null,
      qualifiedAt: row.qualifiedAt,
      countryResidence: player ? (player.countryResidence ?? null) : null,
      countryOrigin: player ? (player.countryOrigin ?? null) : null,
    };
  });

  // Join hotBox playerIds → player name
  const hbPlayerIds = board.hotBox.map((h: any) => h.playerId).filter(Boolean);
  const hbPlayers = await Bat246Player.find({ _id: { $in: hbPlayerIds } })
    .select("nickname email")
    .lean();
  const hbMap = new Map(hbPlayers.map((p: any) => [p._id.toString(), p]));

  const hotBox = board.hotBox.map((h: any) => ({
    cardType: h.cardType,
    playerId: h.playerId,
    playerName: h.playerId ? (hbMap.get(h.playerId.toString()) as any)?.nickname ?? null : null,
    entryNo: h.playerId ? (entryNoMap.get(h.playerId.toString()) ?? null) : null,
    assignedAt: h.assignedAt,
  }));

  // Fold any leftover On-Deck Circle entries (legacy split data) into the dugout
  const dugout = [...(board.dugout ?? []), ...((board as any).onDeckCircle ?? [])];

  return { ...board, leaderBoard, hotBox, dugout, onDeckCircle: [] };
}

// Alan-K-only toggle — the actual admin gate is in the controller (checks
// callerEmail === ALAN_K_EMAIL before calling this). Kept as a plain
// unguarded setter here, same trust boundary as every other admin service
// function in this file (assignSlot, activateBoard, etc.) — controller owns
// auth, service owns the write.
export async function setBoardHidden(boardId: string, hidden: boolean) {
  const board = await Bat246Board.findByIdAndUpdate(
    boardId,
    { $set: { hidden } },
    { new: true }
  ).select("trackingNumber hidden").lean();
  if (!board) throw new Error("Board not found");
  return board;
}

export async function getBoardMovements(boardId: string, limit = 50) {
  return Bat246Movement.find({ fromBoardId: new Types.ObjectId(boardId) })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
}

export async function getPlayerById(id: string) {
  return Bat246Player.findById(id).lean();
}

export async function setPenciling(
  boardId: string,
  playerId: string,
  targetAbSlot: string | null
) {
  const board = await Bat246Board.findById(boardId);
  if (!board) throw new Error("Board not found");

  const now = new Date();
  const ppEnd = board.protectionPeriodEnd;
  if (now > ppEnd) throw new Error("Penciling only allowed during Protection Period");

  // Remove any existing penciling for this player
  (board.penciling as any[]) = (board.penciling as any[]).filter(
    (p: any) => p.playerId.toString() !== playerId
  );

  if (targetAbSlot) {
    (board.penciling as any[]).push({
      playerId: new Types.ObjectId(playerId),
      targetAbSlot,
      penciledAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });
  }

  await board.save();
  return board;
}

export async function setPrePick(
  boardId: string,
  playerId: string,
  targetAbSlot: string | null
) {
  const board = await Bat246Board.findById(boardId);
  if (!board) throw new Error("Board not found");

  (board.prePick as any[]) = (board.prePick as any[]).filter(
    (p: any) => p.playerId.toString() !== playerId
  );

  if (targetAbSlot) {
    (board.prePick as any[]).push({
      playerId: new Types.ObjectId(playerId),
      targetAbSlot,
      createdAt: new Date(),
    });
  }

  await board.save();
  return board;
}

// ── Position reservation helpers ──────────────────────────────────────────────

function getSlotFromBoard(board: any, position: string): any {
  if (position === "thirdBase")  return board.thirdBase;
  if (position === "secondBaseA") return board.secondBaseA;
  if (position === "secondBaseB") return board.secondBaseB;
  if (position === "1stA") return board.firstBase?.[0];
  if (position === "1stB") return board.firstBase?.[1];
  if (position === "1stC") return board.firstBase?.[2];
  if (position === "1stD") return board.firstBase?.[3];
  if (position.startsWith("atBat-")) {
    const idx = parseInt(position.split("-")[1], 10);
    return board.atBat?.[idx];
  }
  return undefined;
}

export function resolveUpline(board: any, position: string): { uplinePosition: string; uplineSlot: any } | null {
  const order: Array<[string, string]> = [
    ["atBat-0", "1stA"], ["atBat-1", "1stA"],
    ["atBat-2", "1stB"], ["atBat-3", "1stB"],
    ["atBat-4", "1stC"], ["atBat-5", "1stC"],
    ["atBat-6", "1stD"], ["atBat-7", "1stD"],
    ["1stA",   "secondBaseA"], ["1stB", "secondBaseA"],
    ["1stC",   "secondBaseB"], ["1stD", "secondBaseB"],
    ["secondBaseA", "thirdBase"], ["secondBaseB", "thirdBase"],
    ["thirdBase",   "homePlate"],
  ];
  let current = position;
  const visited = new Set<string>();
  while (!visited.has(current)) {
    visited.add(current);
    const entry = order.find(([from]) => from === current);
    if (!entry) break;
    const upPos = entry[1];
    const slot = upPos === "homePlate" ? board.homePlate : getSlotFromBoard(board, upPos);
    if (slot?.playerId) return { uplinePosition: upPos, uplineSlot: slot };
    current = upPos;
  }
  // Fallback: HP
  if (board.homePlate?.playerId) return { uplinePosition: "homePlate", uplineSlot: board.homePlate };
  return null;
}

// Positions whose invites place recruits directly into the inviter's dugout
const DUGOUT_DIRECT_POSITIONS = ["homePlate", "thirdBase", "secondBaseA", "secondBaseB"];

// Finds the board where the given user occupies homePlate/thirdBase/secondBaseA/B, if any.
// Only considers boards still open for placements — a player can retain these slot
// records on older boards after a split (status "split"/"closed"), which would
// otherwise be matched first and cause placeUserInDugout() to throw.
async function findDugoutTargetBoard(refUserId: string, preferredBoardId?: string | null): Promise<string | null> {
  const player = await Bat246Player.findOne({ userId: new Types.ObjectId(refUserId) }).select("_id").lean() as any;
  if (!player) return null;
  const slotMatch = { $or: DUGOUT_DIRECT_POSITIONS.map(pos => ({ [`${pos}.playerId`]: player._id })) };

  // Prefer the board the invite link actually pointed to, if the referrer still
  // holds a dugout-direct slot there and it's still open for placements.
  if (preferredBoardId) {
    const preferred = await Bat246Board.findOne({
      _id: new Types.ObjectId(preferredBoardId),
      status: { $in: ["pending", "active"] },
      ...slotMatch,
    }).select("_id").lean() as any;
    if (preferred) return preferred._id.toString();
  }

  const board = await Bat246Board.findOne({
    status: { $in: ["pending", "active"] },
    ...slotMatch,
  }).select("_id").lean() as any;
  return board?._id?.toString() ?? null;
}

export async function reservePosition(
  boardId: string,
  position: string,
  userId: string,
  productId?: string
) {
  const board = await Bat246Board.findById(boardId).lean() as any;
  if (!board) throw new Error("Board not found");
  if (!["active", "pending"].includes(board.status)) throw new Error("Board is not open for reservations");

  // Check if slot is already filled with a player
  const slot = getSlotFromBoard(board, position);
  if (slot?.playerId) throw new Error("Position is already filled");

  const user = await User.findById(userId).select("email").lean() as any;
  if (!user) throw new Error("User not found");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const reservation = await Bat246PositionReservation.create({
      boardId: new Types.ObjectId(boardId),
      position,
      reservedByUserId: new Types.ObjectId(userId),
      reservedByEmail: user.email,
      productId: productId ? new Types.ObjectId(productId) : null,
      reservedAt: now,
      expiresAt,
      status: "active",
    });
    return reservation;
  } catch (err: any) {
    if (err.code === 11000) throw new Error("Position already reserved — try another slot");
    throw err;
  }
}

export async function getReservations(boardId: string) {
  // Expire stale reservations first
  await Bat246PositionReservation.updateMany(
    { boardId: new Types.ObjectId(boardId), status: "active", expiresAt: { $lt: new Date() } },
    { $set: { status: "expired" } }
  );
  return Bat246PositionReservation.find({ boardId: new Types.ObjectId(boardId), status: "active" })
    .select("position reservedByEmail reservedAt expiresAt status")
    .lean();
}

// ── Placement notification helpers ───────────────────────────────────────────

// Maps a firstBase slot index (0-3 = 1stA-D) to its two AT BAT slot indices.
const FIRST_BASE_AB_PAIR: Record<number, [number, number]> = {
  0: [0, 1],
  1: [2, 3],
  2: [4, 5],
  3: [6, 7],
};

// Auto-placement bypass for recruits who joined via a 1st-Base player's
// "Without Position" invite link (no Bat246PositionReservation on file).
// Mirrors the manual /approve flow so the recruit never needs the upline to
// click Approve. Returns true if placed (caller skips the
// placement_unassigned notification fallback).
export async function maybeAutoPlaceFirstBaseReferral(userId: string, dist: any): Promise<boolean> {
  if (!dist?.bat246RefUserId) return false;

  const referrerPlayer = await Bat246Player.findOne({ userId: dist.bat246RefUserId }).select("_id").lean() as any;
  if (!referrerPlayer) return false;

  const board = await Bat246Board.findOne({
    "firstBase.playerId": referrerPlayer._id,
    status: { $in: ["pending", "active"] },
  }).lean() as any;
  if (!board) return false;

  const fbIndex = (board.firstBase ?? []).findIndex(
    (s: any) => s?.playerId?.toString() === referrerPlayer._id.toString()
  );
  if (fbIndex === -1) return false;

  const [first, second] = FIRST_BASE_AB_PAIR[fbIndex];
  const firstEmpty = !board.atBat?.[first]?.playerId;
  const secondEmpty = !board.atBat?.[second]?.playerId;

  const fbSlot = (board.firstBase ?? [])[fbIndex];
  const hasGold = !!fbSlot?.cardType;

  try {
    if (firstEmpty) {
      // Referrer has 0 Green Cards — auto-place into their first AT BAT slot.
      await placeUserFromReservation(userId, { boardId: String(board._id), position: `atBat-${first}` });
    } else if (secondEmpty) {
      // Referrer has 1 Green Card — auto-place into their second AT BAT slot.
      // (No Approve button shown; both pair slots must be filled automatically
      // before the Approve / Gold flow unlocks.)
      await placeUserFromReservation(userId, { boardId: String(board._id), position: `atBat-${second}` });
    } else if (!hasGold) {
      // Referrer has 2 Green Cards but no Gold yet — leave pending so their
      // Approve button becomes active (salesCredits===2, no Gold).
      // They will manually pick any open AT BAT slot and earn Gold on placement.
      // EXCEPT when the board is nearly full (6+ AT BAT filled): approvals are
      // paused board-wide, so the recruit would be stranded with no one able to
      // place them — overflow to Dugout instead. The referrer keeps their Gold
      // Approve for a future recruit once slots open up again.
      const abFilled = ((board.atBat ?? []) as any[]).filter((s: any) => s?.playerId).length;
      if (abFilled >= 6) {
        await placeUserInDugout(userId, String(board._id));
      } else {
        return false;
      }
    } else {
      // Referrer has Gold already (used their one Approve) — overflow to dugout.
      await placeUserInDugout(userId, String(board._id));
    }
    await Bat246Distributor.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { isApproved: true, approvedAt: new Date() } }
    );
    return true;
  } catch {
    // Race condition (slot filled between read and write) — fall back to
    // the placement_unassigned notification path.
    return false;
  }
}

// When an AT BAT player refers someone via a "Without Position" invite link,
// the referred person always goes to Dugout and the AT BAT referrer earns their Gold card.
// Returns true if placement was handled, false if the referrer is not an AT BAT player.
async function maybeAutoPlaceAtBatReferral(userId: string, dist: any): Promise<boolean> {
  if (!dist.bat246RefUserId) return false;

  const referrerPlayer = await Bat246Player.findOne({ userId: dist.bat246RefUserId })
    .select("_id").lean() as any;
  if (!referrerPlayer) return false;

  const atBatQuery = {
    "atBat.playerId": referrerPlayer._id,
    status: { $in: ["pending", "active"] },
  };

  // Prefer the board the invite link actually pointed to (same logic as findDugoutTargetBoard).
  // If the AT BAT player is on multiple boards after a split, this prevents placing
  // the referral on the wrong board.
  let board: any = null;
  if (dist.bat246RefBoardId) {
    board = await Bat246Board.findOne({
      _id: new Types.ObjectId(dist.bat246RefBoardId.toString()),
      ...atBatQuery,
    }).lean();
  }
  if (!board) {
    board = await Bat246Board.findOne(atBatQuery).lean();
  }
  if (!board) return false;

  const referrerAbIndex = (board.atBat ?? []).findIndex(
    (s: any) => s?.playerId?.toString() === referrerPlayer._id.toString()
  );
  if (referrerAbIndex === -1) return false;

  try {
    // Referred person always lands in Dugout
    await placeUserInDugout(userId, String(board._id));

    // Award Gold card to the AT BAT referrer — atomic conditional update so a
    // concurrent call cannot double-award or overwrite a card already set.
    const goldResult = await Bat246Board.updateOne(
      { _id: board._id, [`atBat.${referrerAbIndex}.cardType`]: null },
      { $set: { [`atBat.${referrerAbIndex}.cardType`]: "Gold" } }
    );
    if (goldResult.modifiedCount > 0) {
      await Bat246Player.updateOne({ _id: referrerPlayer._id }, { $inc: { "minorLeague.cardsEarned.gold": 1 } });
      checkAndAwardTrophiesByCards(referrerPlayer._id).catch((err) => console.error("[bat246 trophies] card-check failed:", err.message));
      // Record card-earning history (fire-and-forget — never blocks the main flow)
      Promise.all([
        Bat246Player.findOne({ userId: new Types.ObjectId(userId) }).select("_id nickname email playerIdNo").lean(),
        Bat246Player.findById(referrerPlayer._id).select("nickname email playerIdNo").lean(),
        Bat246Board.findById(board._id).select("atBat dugout trackingNumber").lean(),
      ]).then(async ([rp, ep, freshBoard]: any[]) => {
        const now = new Date();
        const earnerAbSlot = freshBoard?.atBat?.[referrerAbIndex];
        const dugoutSlot = (freshBoard?.dugout ?? []).find(
          (s: any) => s?.playerId?.toString() === rp?._id?.toString()
        );
        await Bat246SalesCredit.create({
          boardId: board._id,
          boardTrackingNumber: freshBoard?.trackingNumber ?? (board as any).trackingNumber ?? null,
          playerId: referrerPlayer._id,
          playerName: ep?.nickname ?? ep?.email ?? "",
          position: `atBat-${referrerAbIndex}`,
          cardType: "Gold",
          countsForLB: true,
          saleAmount: 0,
          earnedAt: now,
          referredUserId: rp?._id ?? null,
          referredUserName: rp?.nickname ?? rp?.email ?? null,
          cardBack: buildGoldCardBack({
            earner: ep,
            earnerEntryNo: earnerAbSlot?.entryNo ?? null,
            earnerPosition: `atBat-${referrerAbIndex}`,
            referred: rp,
            referredPlayerId: rp?._id ?? null,
            referredEntryNo: dugoutSlot?.entryNo ?? null,
            referredPosition: "dugout",
            stolenFrom: null,
            stolenFromPlayerId: null,
            stolenFromEntryNo: null,
            stolenFromPosition: null,
            boardTrackingNo: freshBoard?.trackingNumber ?? null,
            issuedAt: now,
          }),
        });
      }).catch(() => {});
    }

    await Bat246Distributor.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $set: { isApproved: true, approvedAt: new Date() } }
    );
    return true;
  } catch {
    return false;
  }
}

// Award Gold card to a 1st Base player the instant their third referral is
// placed via the Approve button. Called from the /approve route after a
// successful placement. Only fires when the caller has salesCredits===2 and
// has not yet earned a card (i.e. this is their one-time Gold Approve).
// placedUserId — the user who was just approved, used for card-history tracking.
export async function maybeAwardGoldToApprover(callerUserId: string, placedUserId: string, placedAtBatPosition?: string): Promise<void> {
  const callerPlayer = await Bat246Player.findOne({ userId: callerUserId }).select("_id").lean() as any;
  if (!callerPlayer) return;

  const board = await Bat246Board.findOne({
    "firstBase.playerId": callerPlayer._id,
    status: { $in: ["pending", "active"] },
  }).lean() as any;
  if (!board) return;

  const fbIndex = (board.firstBase ?? []).findIndex(
    (s: any) => s?.playerId?.toString() === callerPlayer._id.toString()
  );
  if (fbIndex === -1) return;

  const fbSlot = board.firstBase[fbIndex];
  if ((fbSlot.salesCredits ?? 0) < 2 || fbSlot.cardType) return;

  const now = new Date();

  // Fetch the placed (referred) player before the DB write — needed for hotBox.referredUserId
  const placedPlayer = await Bat246Player.findOne({ userId: new Types.ObjectId(placedUserId) })
    .select("_id nickname email playerIdNo").lean() as any;
  const referredBat246Id = placedPlayer?._id ?? null;

  await Bat246Board.updateOne(
    { _id: board._id },
    {
      $set:  { [`firstBase.${fbIndex}.cardType`]: "Gold" },
      $push: { hotBox: { cardType: "Gold", playerId: callerPlayer._id, assignedAt: now, referredUserId: referredBat246Id } },
    }
  );
  await Bat246Player.updateOne({ _id: callerPlayer._id }, { $inc: { "minorLeague.cardsEarned.gold": 1 } });
  checkAndAwardTrophiesByCards(callerPlayer._id).catch((err) => console.error("[bat246 trophies] card-check failed:", err.message));

  // Record card-earning history (fire-and-forget — reuses already-fetched placedPlayer)
  Bat246Player.findById(callerPlayer._id).select("nickname email playerIdNo").lean()
    .then(async (ep: any) => {
      const positionKeys = Object.keys(FIRST_BASE_INDICES); // ["1stA","1stB","1stC","1stD"]
      const earnerPositionKey = positionKeys[fbIndex] ?? "firstBase";

      // Determine "stolen from" — the 1st Base player who covers the filled AT Bat slot
      // but had their green card skipped (skipGreenCard:true) so the approver could earn gold.
      let stolenFromPlayer: any = null;
      let stolenFromPlayerId: any = null;
      let stolenFromEntryNo: string | null = null;
      let stolenFromPositionKey: string | null = null;
      let referredEntryNo: string | null = null;

      if (placedAtBatPosition?.startsWith("atBat-")) {
        const atBatIdx = parseInt(placedAtBatPosition.split("-")[1], 10);
        referredEntryNo = board.atBat?.[atBatIdx]?.entryNo ?? null;
        const covFbIndex = Math.floor(atBatIdx / 2);
        if (covFbIndex !== fbIndex) {
          const covFbSlot = board.firstBase?.[covFbIndex];
          stolenFromPositionKey = positionKeys[covFbIndex] ?? null;
          stolenFromEntryNo = covFbSlot?.entryNo ?? null;
          stolenFromPlayerId = covFbSlot?.playerId ?? null;
          if (stolenFromPlayerId) {
            stolenFromPlayer = await Bat246Player.findById(stolenFromPlayerId).select("nickname email playerIdNo").lean() as any;
          }
        }
      }

      await Bat246SalesCredit.create({
        boardId: board._id,
        boardTrackingNumber: board.trackingNumber ?? null,
        playerId: callerPlayer._id,
        playerName: ep?.nickname ?? ep?.email ?? "",
        position: earnerPositionKey,
        cardType: "Gold",
        countsForLB: true,
        saleAmount: 0,
        earnedAt: now,
        referredUserId: referredBat246Id,
        referredUserName: placedPlayer?.nickname ?? placedPlayer?.email ?? null,
        cardBack: buildGoldCardBack({
          earner: ep,
          earnerEntryNo: fbSlot.entryNo ?? null,
          earnerPosition: earnerPositionKey,
          referred: placedPlayer,
          referredPlayerId: referredBat246Id,
          referredEntryNo: referredEntryNo,
          referredPosition: placedAtBatPosition ?? "unknown",
          stolenFrom: stolenFromPlayer,
          stolenFromPlayerId,
          stolenFromEntryNo,
          stolenFromPosition: stolenFromPositionKey,
          boardTrackingNo: board.trackingNumber ?? null,
          issuedAt: now,
        }),
      });

      // Also create a NoCard SalesCredit for the 1st Base player who lost their green card.
      if (stolenFromPlayerId && stolenFromPlayer) {
        await Bat246SalesCredit.create({
          boardId: board._id,
          boardTrackingNumber: board.trackingNumber ?? null,
          playerId: stolenFromPlayerId,
          playerName: stolenFromPlayer.nickname ?? stolenFromPlayer.email ?? "",
          position: stolenFromPositionKey,
          cardType: "NoCard",
          countsForLB: false,
          saleAmount: 0,
          earnedAt: now,
          cardBack: buildNoCardCardBack({
            stolenBy: ep,
            stolenByEntryNo: fbSlot.entryNo ?? null,
            stolenByPlayerId: callerPlayer._id,
            stolenByPosition: earnerPositionKey,
            cardEarned: "Gold",
            stolenFrom: stolenFromPlayer,
            stolenFromEntryNo: stolenFromEntryNo,
            stolenFromPlayerId,
            stolenFromPosition: stolenFromPositionKey,
            boardTrackingNo: board.trackingNumber ?? null,
            issuedAt: now,
          }),
        });
      }
    }).catch(() => {});
}

export async function maybeCreatePlacementNotification(userId: string): Promise<void> {
  const [dist, user] = await Promise.all([
    Bat246Distributor.findOne({ userId: new Types.ObjectId(userId) })
      .select("isOfficeMember hasBat246Membership hasPurchasedProduct bat246RefUserId bat246RefBoardId isApproved")
      .lean() as any,
    User.findById(userId).select("email name").lean() as any,
  ]);
  if (!dist || !user) return;
  if (!(dist.isOfficeMember && dist.hasBat246Membership && dist.hasPurchasedProduct)) return;

  // Find their active position reservation
  const reservation = await Bat246PositionReservation.findOne({
    reservedByUserId: new Types.ObjectId(userId),
    status: "active",
  }).lean() as any;

  // No reserved position (e.g. joined via a "without position" invite link) —
  if (!reservation) {
    if (dist.isApproved) return;
    if (!dist.bat246RefUserId) return;

    // $160 POD-entry purchases must never auto-place onto a board — POD
    // placement is always a deliberate action from the Distributors page
    // ("Ready to place on board" -> Place), regardless of who referred them.
    // hasPurchasedProduct alone can't tell $650 from $160 apart (both are
    // bat246_entry-tagged), so check for a paid invoice on the POD product.
    const { Invoice } = await import("../../models/invoice.model");
    const { POD_PRODUCT_ID, recordAutoPodInvite } = await import("./bat246PodInvite.service");
    const paidPodInvoice = await Invoice.exists({
      userId: new Types.ObjectId(userId),
      status: "paid",
      "lineItems.itemId": new Types.ObjectId(POD_PRODUCT_ID),
    });
    if (paidPodInvoice) {
      await recordAutoPodInvite(userId, dist.bat246RefUserId.toString());
      return;
    }

    // Already placed somewhere (dugout or otherwise) — skip
    const player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) }).select("_id").lean() as any;
    if (player) {
      const alreadyPlaced = await Bat246PlayerBoard.exists({ playerId: player._id, position: { $regex: /^dugout\./ } });
      if (alreadyPlaced) return;
    }

    // A "without position" purchase (no reservation) must never silently
    // auto-place the buyer — no 1st Base/AT BAT auto-place, no dropping them
    // in the inviter's Home Plate/3rd/2nd Base dugout. Always fall through
    // to the unassigned notification below; a human (upline/admin) places
    // them from there. (Previously this called maybeAutoPlaceFirstBaseReferral
    // / maybeAutoPlaceAtBatReferral / findDugoutTargetBoard+placeUserInDugout
    // — removed because it was silently placing real buyers into Dugout on a
    // plain $650 purchase with no invite-link context at all.)

    // Idempotent — skip if an unassigned-placement notice already exists
    const existingUnassigned = await Bat246PlacementNotification.exists({
      qualifiedUserId: new Types.ObjectId(userId),
      notificationType: "placement_unassigned",
      isActioned: false,
    });
    if (existingUnassigned) return;

    // The purchase already left a no-board "Ready to Place" notice for this
    // buyer (fulfillInvoice's bat246Ref-only branch) — upgrade that one in
    // place instead of stacking a second notice for the same person.
    const upgraded = await Bat246PlacementNotification.findOneAndUpdate(
      {
        qualifiedUserId: new Types.ObjectId(userId),
        notificationType: "placement",
        boardId: null,
        isActioned: false,
      },
      { $set: { notificationType: "placement_unassigned" } }
    );
    if (upgraded) return;

    // Otherwise notify the inviter with a label-only notice; admin places manually later.
    await Bat246PlacementNotification.create({
      notificationType: "placement_unassigned",
      boardId: null,
      position: null,
      qualifiedUserId: new Types.ObjectId(userId),
      qualifiedUserEmail: user.email,
      qualifiedUserName: user.name ?? user.email,
      uplineUserId: dist.bat246RefUserId,
      uplinePosition: "",
    });
    return;
  }

  const board = await Bat246Board.findById(reservation.boardId)
    .select("homePlate thirdBase secondBaseA secondBaseB firstBase atBat trackingNumber")
    .lean() as any;
  if (!board) return;

  // Referrer is a 1st Base player who already used their one-time Gold Approve
  // (cardType set) — overflow recruits always go to Dugout, even when a position
  // reservation exists. Without this, the recruit would sit unplaced waiting for
  // the reserved slot's upline (who may not even be their referrer) to approve.
  if (!dist.isApproved && dist.bat246RefUserId) {
    const referrerPlayer = await Bat246Player.findOne({ userId: dist.bat246RefUserId }).select("_id").lean() as any;
    const fbIndex = referrerPlayer
      ? (board.firstBase ?? []).findIndex((s: any) => s?.playerId?.toString() === referrerPlayer._id.toString())
      : -1;
    if (fbIndex !== -1 && board.firstBase[fbIndex]?.cardType) {
      try {
        await placeUserInDugout(userId, String(reservation.boardId));
        await Bat246Distributor.updateOne(
          { userId: new Types.ObjectId(userId) },
          { $set: { isApproved: true, approvedAt: new Date() } }
        );
        return;
      } catch {
        // Placement race — fall through to the normal notification path.
      }
    }
  }

  const upline = resolveUpline(board, reservation.position);

  // Only notify if upline lands on 3rd base, 2nd base, or 1st base — no homePlate/admin fallback
  const NOTIFIABLE_POSITIONS = ["thirdBase", "secondBaseA", "secondBaseB", "1stA", "1stB", "1stC", "1stD"];
  if (!upline || !NOTIFIABLE_POSITIONS.includes(upline.uplinePosition)) return;

  const uplinePlayer = await Bat246Player.findById(upline.uplineSlot.playerId)
    .select("userId").lean() as any;
  const uplineUserId = uplinePlayer?.userId ?? null;
  if (!uplineUserId) return;

  const uplinePosition = upline.uplinePosition;

  // Idempotent — skip if a notice for this board position already exists
  const existingForPosition = await Bat246PlacementNotification.exists({
    qualifiedUserId: new Types.ObjectId(userId),
    boardId: reservation.boardId,
    position: reservation.position,
    isActioned: false,
  });
  if (existingForPosition) return;

  await Bat246PlacementNotification.create({
    boardId: reservation.boardId,
    boardTrackingNo: board.trackingNumber ?? "",
    position: reservation.position,
    qualifiedUserId: new Types.ObjectId(userId),
    qualifiedUserEmail: user.email,
    qualifiedUserName: user.name ?? user.email,
    uplineUserId,
    uplinePosition,
  });
}

// ── Admin-approval placement (bypasses notification auth check) ───────────────

// Shared finalize step: marks placement notification actioned, optionally updates
// the reservation, and recomputes isOfficeMember/hasPurchasedProduct/isQualified.
async function finalizePlacement(
  targetUserId: string,
  reservationUpdate?: { _id: any; set: Record<string, any> }
): Promise<void> {
  const ops: Promise<any>[] = [
    Bat246PlacementNotification.updateOne(
      { qualifiedUserId: new Types.ObjectId(targetUserId), isActioned: false },
      { $set: { isActioned: true } }
    ),
    Bat246Distributor.findOneAndUpdate(
      { userId: new Types.ObjectId(targetUserId) },
      { $set: { isOfficeMember: true, hasPurchasedProduct: true } },
      { new: true, lean: true }
    ).then(async (dist: any) => {
      // isGarageAffiliate ($25 Garage Affiliate) dropped from qualification
      // on request — qualifying now only needs office membership, BAT246
      // membership, and the entry product purchase.
      if (dist && !dist.isQualified && dist.isOfficeMember && dist.hasBat246Membership && dist.hasPurchasedProduct) {
        await Bat246Distributor.updateOne({ userId: new Types.ObjectId(targetUserId) }, { $set: { isQualified: true, qualifiedAt: new Date() } });
        await assignDistributorId(targetUserId).catch((err) => console.error("[bat246] assignDistributorId failed:", err.message));
        await maybeCreatePlacementNotification(targetUserId).catch(() => {});
      }
    }),
  ];
  if (reservationUpdate) {
    ops.push(
      Bat246PositionReservation.updateOne(
        { _id: reservationUpdate._id, status: "active" },
        { $set: reservationUpdate.set }
      )
    );
  }
  await Promise.all(ops).catch((cleanupErr: any) => {
    console.warn("[bat246 placement] cleanup error (placement still succeeded):", cleanupErr.message);
  });
}

// Returns board + position choices for the admin-approval modal.
export async function getPlacementInfo(targetUserId: string, opts?: { atBatOnly?: boolean; boardId?: string }): Promise<{
  boardId: string;
  boardTrackingNo: string;
  reservedPosition: string | null;
  reservedPositionStatus: "filled" | "blank" | null;
  reservedPositionStale: boolean;
  availablePositions: string[];
  dugoutAvailable: boolean;
}> {
  const reservation = await Bat246PositionReservation.findOne({
    reservedByUserId: new Types.ObjectId(targetUserId),
    status: "active",
  }).lean() as any;

  let board: any = null;
  let reservedPosition: string | null = null;
  let reservedPositionStatus: "filled" | "blank" | null = null;
  let reservedPositionStale = false;

  if (opts?.boardId) {
    // Explicit board override — the board-picker dropdown on the "Place on
    // Board" modal. Skips the whole auto-detect chain below and goes
    // straight to whichever board was picked. The reservation note only
    // applies if it happens to be for this exact board — otherwise there's
    // nothing board-specific to say about it.
    board = await Bat246Board.findById(opts.boardId).lean();
    if (!board || !["pending", "active"].includes(board.status)) {
      throw new Error("That board is no longer open for placement");
    }
    if (reservation && String(reservation.boardId) === String(board._id)) {
      reservedPosition = reservation.position;
      reservedPositionStatus = slotForPosition(board, reservation.position)?.playerId ? "filled" : "blank";
    }
  } else {
    if (reservation) {
      reservedPosition = reservation.position;
      const resBoard = await Bat246Board.findById(reservation.boardId).lean() as any;
      if (resBoard && ["pending", "active"].includes(resBoard.status)) {
        board = resBoard;
        reservedPositionStatus = slotForPosition(resBoard, reservation.position)?.playerId ? "filled" : "blank";
      } else {
        reservedPositionStale = true;
      }
    }

    // No active reservation (e.g. "Without Position" invite) — prefer the board
    // tied to this recruit rather than an arbitrary "newest" board, so the admin
    // modal's boardId/availablePositions match the invite link they actually used.
    if (!board) {
      const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) })
        .select("bat246RefUserId bat246RefBoardId").lean() as any;

      // 1) The referrer's 1st Base board — matches where placeUserFromReservation/
      // maybeAutoPlaceFirstBaseReferral would place this user and where the
      // referrer's Green Card credit applies.
      if (dist?.bat246RefUserId) {
        const referrerPlayer = await Bat246Player.findOne({ userId: dist.bat246RefUserId }).select("_id").lean() as any;
        if (referrerPlayer) {
          board = await Bat246Board.findOne({
            "firstBase.playerId": referrerPlayer._id,
            status: { $in: ["pending", "active"] },
          }).lean();
        }
      }

      // 2) Fall back to the board the invite link itself pointed to.
      if (!board && dist?.bat246RefBoardId) {
        const refBoard = await Bat246Board.findById(dist.bat246RefBoardId).lean() as any;
        if (refBoard && ["pending", "active"].includes(refBoard.status)) {
          board = refBoard;
        }
      }
    }

    if (!board) {
      board = await Bat246Board.findOne({ status: { $in: ["pending", "active"] } })
        .sort({ boardNumber: -1 })
        .lean();
    }
  }
  if (!board) throw new Error("No open board available for placement");

  const activeReservations = await Bat246PositionReservation.find({
    boardId: board._id,
    status: "active",
    expiresAt: { $gt: new Date() },
  }).select("position reservedByUserId").lean();

  const reservedByOthers = new Set(
    (activeReservations as any[])
      .filter(r => String(r.reservedByUserId) !== String(targetUserId))
      .map(r => r.position)
  );

  const availablePositions = POSITION_KEYS.filter(key => {
    if (opts?.atBatOnly && !key.startsWith("atBat-")) return false;
    const slot = slotForPosition(board, key);
    if (slot?.playerId) return false;
    if (reservedByOthers.has(key)) return false;
    return true;
  });

  const dugout = (board.dugout ?? []) as any[];
  const dugoutFilled = dugout.filter(d => d?.playerId).length;

  return {
    boardId: String(board._id),
    boardTrackingNo: board.trackingNumber ?? "",
    reservedPosition,
    reservedPositionStatus,
    reservedPositionStale,
    availablePositions: availablePositions as string[],
    dugoutAvailable: true, // dugout has no capacity limit
  };
}

// Board positions a player can occupy — same "part of this board" list as
// POD_MEMBER_PLAYER_ID_PATHS in bat246PodInvite.service.ts (kept as its own
// local copy rather than a cross-file import, matching how each bat246
// service file already keeps its own small position-path constant).
const BOARD_MEMBER_PLAYER_ID_PATHS = [
  "homePlate.playerId", "thirdBase.playerId", "secondBaseA.playerId", "secondBaseB.playerId",
  "firstBase.playerId", "atBat.playerId", "dugout.playerId", "onDeckCircle.playerId", "pod.playerId",
] as const;

/**
 * Boards open for placement (status "pending" or "active") — feeds the
 * board-picker dropdown on the "Place on Board" modal. Admin (Alan K) sees
 * every open board; everyone else only sees boards they personally occupy a
 * position on (same "part of it" scope isPartOfAnyActiveBoard already
 * enforces before this is ever called — this just lists which ones,
 * plural, instead of only confirming "at least one"). getPlacementInfo's
 * boardId override has no separate permission check of its own since
 * placeDistributorOnBoard already accepts an arbitrary boardId from any
 * caller who passes isPartOfAnyActiveBoard — this is just exposing board
 * choice, not a new privilege, for admin or anyone with 2+ boards alike.
 * Lightweight — id + tracking number only, no position data;
 * getPlacementInfo(targetUserId, { boardId }) is called separately once a
 * specific board is picked.
 */
export async function listOpenBoardsForPlacement(callerUserId: string): Promise<{ boardId: string; boardTrackingNo: string; boardNumber: number }[]> {
  const { isAdminCaller } = await import("./bat246PodInvite.service");
  const filter: any = { status: { $in: ["pending", "active"] } };

  if (!(await isAdminCaller(callerUserId))) {
    const player = await Bat246Player.findOne({ userId: new Types.ObjectId(callerUserId) }).select("_id").lean() as any;
    if (!player) return [];
    filter.$or = BOARD_MEMBER_PLAYER_ID_PATHS.map((path) => ({ [path]: player._id }));
  }

  const boards = await Bat246Board.find(filter)
    .select("trackingNumber boardNumber")
    .sort({ boardNumber: 1 })
    .lean();
  return (boards as any[]).map(b => ({
    boardId: String(b._id),
    boardTrackingNo: b.trackingNumber ?? "",
    boardNumber: b.boardNumber,
  }));
}

export async function placeUserFromReservation(
  targetUserId: string,
  override?: { boardId: string; position: string },
  opts?: { skipGreenCard?: boolean }
): Promise<{ position: string; boardTrackingNo: string }> {
  const reservation = await Bat246PositionReservation.findOne({
    reservedByUserId: new Types.ObjectId(targetUserId),
    status: "active",
  }).lean() as any;
  if (!reservation && !override) throw new Error("No active position reservation found for this user");

  const boardId: string = override?.boardId ?? String(reservation.boardId);
  const position: string = override?.position ?? reservation.position;
  if (!(POSITION_KEYS as readonly string[]).includes(position)) throw new Error("Invalid position");

  const [qualifiedUser, board] = await Promise.all([
    User.findById(targetUserId).select("email name country").lean() as any,
    Bat246Board.findById(boardId) as any,
  ]);
  if (!qualifiedUser) throw new Error("User not found");
  if (!board) throw new Error("Board not found");
  if (!["pending", "active"].includes(board.status)) throw new Error("Board is not open for placements");

  const currentSlot = getSlotFromBoard(board.toObject(), position);
  if (currentSlot?.playerId) throw new Error("Position is already filled on this board");

  let player = await Bat246Player.findOne({ userId: new Types.ObjectId(targetUserId) });
  if (!player) {
    player = await createBat246Player({
      userId: new Types.ObjectId(targetUserId),
      nickname: qualifiedUser.name || qualifiedUser.email,
      email: qualifiedUser.email,
      countryResidence: qualifiedUser.country ?? null,
      memberSince: new Date(),
    });
  }

  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);
  const slot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || qualifiedUser.email,
    playerEmail: qualifiedUser.email,
    enteredAt: now,
    joinedBoardAt: now,
    countryResidence: qualifiedUser.country ?? null,
    countryOrigin: await resolveCountryOrigin(qualifiedUser._id, null, qualifiedUser.country ?? null),
  };

  const updateSet: Record<string, any> = {};
  let creditPlayerId: any = null;
  let creditPosition: string = position;
  let creditEarnerEntryNo: string | undefined;

  if (position === "thirdBase") {
    updateSet["thirdBase"] = slot;
  } else if (position === "secondBaseA") {
    updateSet["secondBaseA"] = slot;
  } else if (position === "secondBaseB") {
    updateSet["secondBaseB"] = slot;
  } else if (FIRST_BASE_INDICES[position] !== undefined) {
    const fbIndex = FIRST_BASE_INDICES[position];
    updateSet[`firstBase.${fbIndex}`] = slot;
    const above = position === "1stA" || position === "1stB" ? board.secondBaseA : board.secondBaseB;
    if (above?.playerId) { creditPlayerId = above.playerId; creditPosition = position === "1stA" || position === "1stB" ? "secondBaseA" : "secondBaseB"; creditEarnerEntryNo = above.entryNo; }
  } else if (position.startsWith("atBat-")) {
    const idx = parseInt(position.split("-")[1], 10);
    updateSet[`atBat.${idx}`] = slot;
    const fbIndex = Math.floor(idx / 2);
    const fbSlot = board.firstBase?.[fbIndex];
    if (fbSlot?.playerId) {
      if (!opts?.skipGreenCard) {
        // Normal path: award Green Card to the covering 1st Base player.
        creditPlayerId = fbSlot.playerId;
        creditPosition = Object.keys(FIRST_BASE_INDICES)[fbIndex];
        creditEarnerEntryNo = fbSlot.entryNo;
        const newCredits = (fbSlot.salesCredits ?? 0) + 1;
        updateSet[`firstBase.${fbIndex}.salesCredits`] = newCredits;
        updateSet[`firstBase.${fbIndex}.warpStatus`] = Math.min(newCredits, 2);
      } else {
        // Gold Approve path: slot filled by a different 1st Base player's Approve.
        // Increment noCards count (up to 2 — one per pair slot stolen).
        const newNoCards = (fbSlot.noCards ?? 0) + 1;
        updateSet[`firstBase.${fbIndex}.noCards`] = newNoCards;
        if (!fbSlot.cardType) {
          updateSet[`firstBase.${fbIndex}.cardType`] = "NoCard";
        }
      }
    }
  }

  await Bat246Board.updateOne({ _id: board._id }, { $set: updateSet });
  await Bat246PlayerBoard.create({ playerId: player._id, boardId: board._id, position, joinedAt: now, status: "active" });
  await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });
  await maybeTriggerSplitAfterAtBatFill(boardId, position);

  if (creditPlayerId) {
    const cp = await Bat246Player.findById(creditPlayerId).select("nickname email playerIdNo").lean() as any;
    await Bat246SalesCredit.create({
      boardId: board._id,
      boardTrackingNumber: (board as any).trackingNumber ?? null,
      playerId: creditPlayerId,
      playerName: cp?.nickname ?? cp?.email ?? "",
      position: creditPosition,
      cardType: "Green",
      countsForLB: false,
      saleAmount: 0,
      earnedAt: now,
      referredUserId: player._id,
      referredUserName: (player as any).nickname ?? qualifiedUser?.email ?? null,
      cardBack: buildGreenCardBack({
        earner: cp,
        earnerEntryNo: creditEarnerEntryNo,
        earnerPosition: creditPosition,
        referred: player as any,
        referredPlayerId: player._id,
        referredEntryNo: entryNo,
        referredPosition: position,
        boardTrackingNo: (board as any).trackingNumber ?? null,
        issuedAt: now,
      }),
    });
    await Bat246Player.updateOne({ _id: creditPlayerId }, { $inc: { "minorLeague.cardsEarned.green": 1 } });
    checkAndAwardTrophiesByCards(creditPlayerId).catch((err) => console.error("[bat246 trophies] card-check failed:", err.message));
  }

  if (position.startsWith("atBat-")) {
    transferAtBatPayment((board as any).homePlate?.playerId?.toString(), (board as any).homePlate?.podTeamId).catch((err) =>
      console.warn("[bat246] AT BAT wallet transfer (reservation) failed:", err.message)
    );
    transferAtBatPaymentToThirdBase(
      (board as any).thirdBase?.playerId?.toString(),
      (board as any).thirdBase?.salesCredits,
      (board as any).thirdBase?.podTeamId
    ).catch((err) =>
      console.warn("[bat246] AT BAT 3rd Base wallet transfer (reservation) failed:", err.message)
    );
  }

  let reservationUpdate: { _id: any; set: Record<string, any> } | undefined;
  if (reservation) {
    const set: Record<string, any> = { status: "used" };
    if (String(reservation.boardId) !== String(board._id) || reservation.position !== position) {
      set.boardId = board._id;
      set.position = position;
    }
    reservationUpdate = { _id: reservation._id, set };
  }
  await finalizePlacement(targetUserId, reservationUpdate);

  return { position, boardTrackingNo: board.trackingNumber ?? "" };
}

// ── Admin-approval placement: send to Dugout (no open position chosen) ────────

export async function placeUserInDugout(
  targetUserId: string,
  boardId: string
): Promise<{ position: string; boardTrackingNo: string }> {
  const [qualifiedUser, board, reservation, dist] = await Promise.all([
    User.findById(targetUserId).select("email name country").lean() as any,
    Bat246Board.findById(boardId) as any,
    Bat246PositionReservation.findOne({
      reservedByUserId: new Types.ObjectId(targetUserId),
      status: "active",
    }).lean() as any,
    Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) }).select("bat246RefUserId").lean() as any,
  ]);
  if (!qualifiedUser) throw new Error("User not found");
  if (!board) throw new Error("Board not found");
  if (!["pending", "active"].includes(board.status)) throw new Error("Board is not open for placements");

  const dugout = (board.dugout as any[]) ?? [];
  const dugoutFilled = dugout.filter(d => d?.playerId).length;

  let player = await Bat246Player.findOne({ userId: new Types.ObjectId(targetUserId) });
  if (!player) {
    player = await createBat246Player({
      userId: new Types.ObjectId(targetUserId),
      nickname: qualifiedUser.name || qualifiedUser.email,
      email: qualifiedUser.email,
      countryResidence: qualifiedUser.country ?? null,
      memberSince: new Date(),
    });
  }

  // Look up the referring player (the upline whose invite brought this user in)
  let referredBy: any = null;
  let referredByName: string | null = null;
  if (dist?.bat246RefUserId) {
    const referrerPlayer = await Bat246Player.findOne({ userId: dist.bat246RefUserId })
      .select("nickname email").lean() as any;
    if (referrerPlayer) {
      referredBy = referrerPlayer._id;
      referredByName = referrerPlayer.nickname || referrerPlayer.email || null;
    }
  }

  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);
  const slot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || qualifiedUser.email,
    playerEmail: qualifiedUser.email,
    enteredAt: now,
    joinedBoardAt: now,
    countryResidence: qualifiedUser.country ?? null,
    countryOrigin: await resolveCountryOrigin(qualifiedUser._id, null, qualifiedUser.country ?? null),
    referredBy,
    referredByName,
  };

  await Bat246Board.updateOne({ _id: board._id }, { $push: { dugout: slot } });
  await Bat246PlayerBoard.create({ playerId: player._id, boardId: board._id, position: `dugout.${dugoutFilled}`, joinedAt: now, status: "active" });
  await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });

  const reservationUpdate = reservation ? { _id: reservation._id, set: { status: "used" } } : undefined;
  await finalizePlacement(targetUserId, reservationUpdate);

  return { position: `dugout.${dugoutFilled}`, boardTrackingNo: board.trackingNumber ?? "" };
}

// ── Manual placement (upline clicks "Place Now") ──────────────────────────────

const FIRST_BASE_INDICES: Record<string, number> = { "1stA": 0, "1stB": 1, "1stC": 2, "1stD": 3 };

export async function placeUserAtPosition(
  notificationId: string,
  callerUserId: string
): Promise<{ position: string; boardTrackingNo: string }> {
  const notif = await Bat246PlacementNotification.findById(notificationId).lean() as any;
  if (!notif) throw new Error("Notification not found");
  if (notif.uplineUserId.toString() !== callerUserId) throw new Error("Not authorized to place this user");
  if (notif.isActioned) throw new Error("This user has already been placed");

  const { boardId, position, qualifiedUserId } = notif;

  // Validate 3-step qualification
  const [dist, qualifiedUser] = await Promise.all([
    Bat246Distributor.findOne({ userId: new Types.ObjectId(qualifiedUserId) })
      .select("isOfficeMember hasBat246Membership hasPurchasedProduct").lean() as any,
    User.findById(qualifiedUserId).select("email name country").lean() as any,
  ]);
  if (!dist || !qualifiedUser) throw new Error("Qualified user not found");
  if (!(dist.isOfficeMember && dist.hasBat246Membership && dist.hasPurchasedProduct)) {
    throw new Error("User has not completed all 3 qualification steps");
  }

  const board = await Bat246Board.findById(boardId) as any;
  if (!board) throw new Error("Board not found");
  if (!["pending", "active"].includes(board.status)) throw new Error("Board is not open for placements");

  // Verify position is still empty
  const currentSlot = getSlotFromBoard(board.toObject(), position);
  if (currentSlot?.playerId) throw new Error("Position is already filled on this board");

  // Find or create Bat246Player
  let player = await Bat246Player.findOne({ userId: new Types.ObjectId(qualifiedUserId) });
  if (!player) {
    player = await createBat246Player({
      userId: new Types.ObjectId(qualifiedUserId),
      nickname: qualifiedUser.name || qualifiedUser.email,
      email: qualifiedUser.email,
      countryResidence: qualifiedUser.country ?? null,
      memberSince: new Date(),
    });
  }

  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);
  const slot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || qualifiedUser.email,
    playerEmail: qualifiedUser.email,
    enteredAt: now,
    joinedBoardAt: now,
    countryResidence: qualifiedUser.country ?? null,
    countryOrigin: await resolveCountryOrigin(qualifiedUser._id, null, qualifiedUser.country ?? null),
  };

  // Build board slot update + determine who earns the Green Card
  const updateSet: Record<string, any> = {};
  let creditPlayerId: any = null;
  let creditPosition: string = position;
  let creditEarnerEntryNo: string | undefined;

  if (position === "thirdBase") {
    updateSet["thirdBase"] = slot;
  } else if (position === "secondBaseA") {
    updateSet["secondBaseA"] = slot;
  } else if (position === "secondBaseB") {
    updateSet["secondBaseB"] = slot;
  } else if (FIRST_BASE_INDICES[position] !== undefined) {
    const fbIndex = FIRST_BASE_INDICES[position];
    updateSet[`firstBase.${fbIndex}`] = slot;
    const above = position === "1stA" || position === "1stB" ? board.secondBaseA : board.secondBaseB;
    if (above?.playerId) { creditPlayerId = above.playerId; creditPosition = position === "1stA" || position === "1stB" ? "secondBaseA" : "secondBaseB"; creditEarnerEntryNo = above.entryNo; }
  } else if (position.startsWith("atBat-")) {
    const idx = parseInt(position.split("-")[1], 10);
    updateSet[`atBat.${idx}`] = slot;
    const fbIndex = Math.floor(idx / 2);
    const fbSlot = board.firstBase?.[fbIndex];
    if (fbSlot?.playerId) {
      creditPlayerId = fbSlot.playerId;
      creditPosition = Object.keys(FIRST_BASE_INDICES)[fbIndex];
      creditEarnerEntryNo = fbSlot.entryNo;
      const newCredits = (fbSlot.salesCredits ?? 0) + 1;
      updateSet[`firstBase.${fbIndex}.salesCredits`] = newCredits;
      updateSet[`firstBase.${fbIndex}.warpStatus`] = Math.min(newCredits, 2);
    }
  }

  await Bat246Board.updateOne({ _id: board._id }, { $set: updateSet });

  await Bat246PlayerBoard.create({ playerId: player._id, boardId: board._id, position, joinedAt: now, status: "active" });
  await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });
  await maybeTriggerSplitAfterAtBatFill(String(board._id), position);

  // Award Green Card to the responsible upper-slot player
  if (creditPlayerId) {
    const cp = await Bat246Player.findById(creditPlayerId).select("nickname email playerIdNo").lean() as any;
    await Bat246SalesCredit.create({
      boardId: board._id,
      boardTrackingNumber: (board as any).trackingNumber ?? null,
      playerId: creditPlayerId,
      playerName: cp?.nickname ?? cp?.email ?? "",
      position: creditPosition,
      cardType: "Green",
      countsForLB: false,
      saleAmount: 0,
      earnedAt: now,
      referredUserId: player._id,
      referredUserName: (player as any).nickname ?? qualifiedUser?.email ?? null,
      cardBack: buildGreenCardBack({
        earner: cp,
        earnerEntryNo: creditEarnerEntryNo,
        earnerPosition: creditPosition,
        referred: player as any,
        referredPlayerId: player._id,
        referredEntryNo: entryNo,
        referredPosition: position,
        boardTrackingNo: (board as any).trackingNumber ?? null,
        issuedAt: now,
      }),
    });
    await Bat246Player.updateOne({ _id: creditPlayerId }, { $inc: { "minorLeague.cardsEarned.green": 1 } });
    checkAndAwardTrophiesByCards(creditPlayerId).catch((err) => console.error("[bat246 trophies] card-check failed:", err.message));
  }

  if (position.startsWith("atBat-")) {
    transferAtBatPayment((board as any).homePlate?.playerId?.toString(), (board as any).homePlate?.podTeamId).catch((err) =>
      console.warn("[bat246] AT BAT wallet transfer (notification placement) failed:", err.message)
    );
    transferAtBatPaymentToThirdBase(
      (board as any).thirdBase?.playerId?.toString(),
      (board as any).thirdBase?.salesCredits,
      (board as any).thirdBase?.podTeamId
    ).catch((err) =>
      console.warn("[bat246] AT BAT 3rd Base wallet transfer (notification placement) failed:", err.message)
    );
  }

  // Mark notification actioned + reservation placed
  await Promise.all([
    Bat246PlacementNotification.updateOne({ _id: new Types.ObjectId(notificationId) }, { $set: { isActioned: true } }),
    Bat246PositionReservation.updateOne(
      { reservedByUserId: new Types.ObjectId(qualifiedUserId), boardId: board._id, position, status: "active" },
      { $set: { status: "used" } }
    ),
  ]);

  return { position, boardTrackingNo: board.trackingNumber ?? "" };
}

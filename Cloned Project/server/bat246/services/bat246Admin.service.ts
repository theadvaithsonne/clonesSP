/**
 * bat246Admin.service.ts
 * Super-admin operations for configuring a PENDING board:
 *   - Create a new board (admin button, no purchase needed)
 *   - Search Garage users (to pick who goes in each slot)
 *   - Assign a Garage user to a board slot (3rd, 2ndA, 2ndB, 1stA–D)
 *   - Activate the board (status → active, PP clock starts)
 */
import { Types } from "mongoose";
import { escapeRegex } from "../../utils/userSearchClauses";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { createBat246Player } from "./bat246PlayerId.util";
import { resolveCountryOrigin } from "./bat246Country.util";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { checkAndAwardTrophiesByCards } from "./bat246Trophy.service";
import { Bat246SalesCredit } from "../models/bat246SalesCredit.model";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { Bat246Config } from "../models/bat246Config.model";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";
import { transferAtBatPayment, transferAtBatPaymentToThirdBase } from "./bat246Wallet.util";
import { buildGoldCardBack } from "./bat246CardBack.util";
import { assignPodTeamId } from "./bat246PodInvite.service";

const ALAN_K_EMAIL = "redbaron2020@mail.com";

// Positions the admin can assign on a pending board
export type AssignablePosition = "thirdBase" | "secondBaseA" | "secondBaseB" | "1stA" | "1stB" | "1stC" | "1stD" | "atBat-0" | "atBat-1" | "atBat-2" | "atBat-3" | "atBat-4" | "atBat-5" | "atBat-6" | "atBat-7";

const POSITION_TO_FIRST_BASE_INDEX: Record<string, number> = {
  "1stA": 0, "1stB": 1, "1stC": 2, "1stD": 3,
};

async function findOrCreatePlayerForUser(user: any): Promise<any> {
  let player = await Bat246Player.findOne({ userId: user._id });
  if (player) return player;

  player = await createBat246Player({
    userId: user._id,
    nickname: user.name || user.email,
    email: user.email,
    countryResidence: user.country ?? null,
    memberSince: user.createdAt ?? new Date(),
  });
  return player;
}

// Fixed slot-holder emails placed on every new board (positions HP → 1st Base D)
const SLOT_EMAILS = [
  "batuser1@yopmail.com", // HP
  "batuser2@yopmail.com", // 3rd Base
  "batuser3@yopmail.com", // 2nd Base A
  "batuser4@yopmail.com", // 2nd Base B
  "batuser5@yopmail.com", // 1st Base A
  "batuser6@yopmail.com", // 1st Base B
  "batuser7@yopmail.com", // 1st Base C
  "batuser8@yopmail.com", // 1st Base D
];

function makeSlot(player: any, user: any, now: Date, entryNo: string, countryOrigin: string | null) {
  return {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || user.name || user.email,
    playerEmail: user.email,
    enteredAt: now,
    joinedBoardAt: now,
    countryResidence: user.country ?? null,
    countryOrigin,
  };
}

/**
 * Create a new board. All 8 upper positions are auto-filled with
 * the fixed BAT246 slot-holder accounts. Board status is "active".
 */
export async function createBoard(adminUserId: string) {
  const admin = await User.findById(adminUserId).select("email name country createdAt").lean() as any;
  if (!admin) throw new Error("Admin user not found");
  if ((admin.email ?? "").toLowerCase() !== ALAN_K_EMAIL) throw new Error("Only the admin can create boards");

  // Load all 8 slot-holder users
  const slotUsers = await User.find({ email: { $in: SLOT_EMAILS } })
    .select("_id email name country createdAt")
    .lean() as any[];

  if (slotUsers.length !== 8) {
    const found = slotUsers.map((u: any) => u.email);
    const missing = SLOT_EMAILS.filter(e => !found.includes(e));
    throw new Error(`Missing slot-holder accounts: ${missing.join(", ")}. Run setupBat246Slots script first.`);
  }

  // Order by SLOT_EMAILS index so positions are deterministic
  const ordered = SLOT_EMAILS.map(email => slotUsers.find((u: any) => u.email === email)!);

  // Find or create players sequentially to avoid duplicate playerIdNo
  const players: any[] = [];
  for (const u of ordered) players.push(await findOrCreatePlayerForUser(u));

  const config = await Bat246Config.findOneAndUpdate(
    {},
    { $inc: { boardCounter: 1, familyCounter: 1 } },
    { new: true, upsert: true }
  );

  const boardNumber  = config!.boardCounter;
  const familyNumber = config!.familyCounter;
  // Normally a brand-new family starts its sequence at 1000. If a starting
  // sequence was already pre-seeded for this familyNumber (e.g. a one-off
  // admin reset), honor it instead of clobbering it back to 1000.
  const existingSeqs = (config!.familySequences as any) ?? {};
  const startSeq = existingSeqs[familyNumber] ?? 1000;
  await Bat246Config.updateOne({}, { $set: { [`familySequences.${familyNumber}`]: startSeq } });
  const now = new Date();

  const origins = await Promise.all(ordered.map((u: any) => resolveCountryOrigin(u._id, null, u.country ?? null)));
  const [hp, tb, s2a, s2b, fb0, fb1, fb2, fb3] = players.map((p, i) => makeSlot(p, ordered[i], now, String(i + 1), origins[i]));

  const board = await Bat246Board.create({
    boardNumber,
    trackingNumber: `${familyNumber}-${startSeq}`,
    title: `Board ${boardNumber}`,
    status: "active",
    generation: 0,
    familyNumber,
    protectionPeriodEnd: new Date(now.getTime() + 120 * 60 * 60 * 1000),
    warpCount: 0,
    minorLeagueAmount: 650,
    nextHomePlatePayout: 200,
    homePlate:   hp,
    thirdBase:   tb,
    secondBaseA: s2a,
    secondBaseB: s2b,
    firstBase:   [fb0, fb1, fb2, fb3],
    atBat:       Array(8).fill(null),
    leaderBoard: [
      { tier: "G", playerId: null, qualifiedAt: null, earningsOnBoard: 0 },
      { tier: "H", playerId: null, qualifiedAt: null, earningsOnBoard: 0 },
      { tier: "T", playerId: null, qualifiedAt: null, earningsOnBoard: 0 },
    ],
  });

  // Reserve this board's POD team number up front.
  await assignPodTeamId(board);
  await board.save();

  // Create PlayerBoard records for all 8
  const positionKeys = ["homePlate", "thirdBase", "secondBaseA", "secondBaseB", "firstBase.A", "firstBase.B", "firstBase.C", "firstBase.D"];
  await Promise.all(players.map((p, i) =>
    Bat246PlayerBoard.updateOne(
      { playerId: p._id, boardId: board._id },
      { $set: { playerId: p._id, boardId: board._id, position: positionKeys[i], enteredAt: now, status: "active" } },
      { upsert: true }
    )
  ));

  return board;
}

/**
 * Search Garage users by name or email (for the assign-slot search dialog).
 * Returns at most 20 results.
 */
export async function searchGarageUsers(query: string) {
  const q = query.trim();

  // Only return qualified bat246 distributors
  const distributors = await Bat246Distributor.find({ isQualified: true }).select("userId").lean();
  const distributorUserIds = distributors.map((d: any) => d.userId);

  const filter: any = { _id: { $in: distributorUserIds } };
  if (q) {
    // Escaped: `q` is user input, and an unescaped "(" makes Mongo throw
    // while ".*" returns every qualified distributor.
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const users = await User.find(filter)
    .select("_id name email profilePicture country")
    .limit(100)
    .lean();

  return users.map((u: any) => ({
    userId: u._id.toString(),
    name: u.name || u.email,
    email: u.email,
    profilePicture: u.profilePicture ?? null,
    country: u.country ?? null,
  }));
}

/**
 * Assign a Garage user to a specific slot on a PENDING board.
 * Creates a bat246Player record if the user doesn't have one yet.
 */
export async function assignSlot(
  boardId: string,
  position: AssignablePosition,
  garageUserId: string
): Promise<void> {
  const board = await Bat246Board.findById(boardId);
  if (!board) throw new Error("Board not found");
  if (!["pending", "active"].includes((board as any).status)) throw new Error("Board is not in a configurable state");

  const user = await User.findById(garageUserId).lean() as any;
  if (!user) throw new Error("Garage user not found");

  const player = await findOrCreatePlayerForUser(user);
  const now = new Date();

  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);
  const slot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || user.email,
    playerEmail: user.email,
    enteredAt: now,
    joinedBoardAt: now,
    countryResidence: user.country ?? null,
    countryOrigin: await resolveCountryOrigin(user._id, null, user.country ?? null),
  };

  let updatePath: string;
  let membershipPosition: string;

  if (position === "thirdBase") {
    updatePath = "thirdBase";
    membershipPosition = "thirdBase";
  } else if (position === "secondBaseA") {
    updatePath = "secondBaseA";
    membershipPosition = "secondBaseA";
  } else if (position === "secondBaseB") {
    updatePath = "secondBaseB";
    membershipPosition = "secondBaseB";
  } else if (position.startsWith("atBat-")) {
    const i = parseInt(position.split("-")[1], 10);
    updatePath = `atBat.${i}`;
    membershipPosition = position;
  } else {
    const fbIndex = POSITION_TO_FIRST_BASE_INDEX[position];
    updatePath = `firstBase.${fbIndex}`;
    membershipPosition = `firstBase.${position.replace("1st", "").toUpperCase()}`;
  }

  await Bat246Board.updateOne({ _id: board._id }, { $set: { [updatePath]: slot } });

  // Add user to the bat246 org so they can see the game in the sidebar
  try {
    const entryProduct = await Product.findOne({ tags: "bat246_entry" }).select("organizationId").lean() as any;
    if (entryProduct?.organizationId) {
      await User.updateOne(
        { _id: user._id, "organizations.organization": { $ne: entryProduct.organizationId } },
        { $addToSet: { organizations: { organization: entryProduct.organizationId, role: "member" } } }
      );
    }
  } catch {
    // Non-fatal — don't block board setup if org add fails
  }

  // Mark user as office member in distributor record
  try {
    await Bat246Distributor.updateOne(
      { userId: user._id },
      {
        $set: { isOfficeMember: true, playerId: player._id },
        $setOnInsert: {
          isGarageAffiliate: false,
          hasBat246Membership: false,
          hasPurchasedProduct: false,
          isQualified: false,
        },
      },
      { upsert: true }
    );
  } catch {
    // Non-fatal
  }

  // Upsert membership
  await Bat246PlayerBoard.updateOne(
    { playerId: player._id, boardId: board._id },
    { $set: { playerId: player._id, boardId: board._id, position: membershipPosition, enteredAt: now, status: "active" } },
    { upsert: true }
  );

  // Increment player entry count (only if this is a fresh slot, not a re-assign)
  const existing = await Bat246PlayerBoard.findOne({ playerId: player._id, boardId: board._id });
  if (!existing) {
    await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });
  }
}

/**
 * Activate a pending board — sets status to "active" and starts the 120h PP clock.
 * Requires at least Home Plate + 3rd Base + 2nd Base A + 2nd Base B + all 4 1st Base slots filled.
 */
export async function activateBoard(boardId: string, nextHomePlatePayout?: number): Promise<void> {
  const board = await Bat246Board.findById(boardId).lean() as any;
  if (!board) throw new Error("Board not found");
  if (board.status !== "pending") throw new Error("Board is not in pending state");

  if (!board.homePlate) throw new Error("Cannot activate: Home Plate must be filled");

  const now = new Date();
  const ppEnd = new Date(now.getTime() + 120 * 60 * 60 * 1000); // 120 hours

  await Bat246Board.updateOne(
    { _id: new Types.ObjectId(boardId) },
    { $set: { status: "active", protectionPeriodEnd: ppEnd, ...(nextHomePlatePayout !== undefined ? { nextHomePlatePayout } : {}) } }
  );
}

/**
 * Get a single pending board with full slot data (for the setup UI).
 */
export async function getPendingBoard(boardId: string) {
  return Bat246Board.findOne({ _id: boardId, status: "pending" }).lean();
}

const FIRST_BASE_POS_LABELS = ["1stA", "1stB", "1stC", "1stD"] as const;

/**
 * Admin tool: manually move all dugout players that can fit into empty AT BAT slots.
 * Awards a Black Card to the 2nd/3rd Base referrer for each moved entry (not a
 * Green Card to 1st Base), or a Brown Card to Home Plate if HP referred the entry.
 * Triggers split when all 8 AT BAT slots become filled.
 * Also updates the board's hotBox "Black" entry to the referrer (Home Plate,
 * 2nd Base A/B, or 3rd Base) of the most recently promoted dugout player.
 */
export async function promoteDugoutToAtBat(boardId: string): Promise<{ moved: number; splitTriggered: boolean }> {
  let moved = 0;

  while (true) {
    const board = await Bat246Board.findById(boardId);
    if (!board) throw new Error("Board not found");

    const atBat  = (board as any).atBat  as (any | null)[];
    const dugout = (board as any).dugout as (any | null)[];

    const dugoutPlayer = dugout.find(Boolean);
    if (!dugoutPlayer) break;

    const emptySlot = atBat.findIndex((s: any) => !s);
    if (emptySlot === -1) break;

    const update: any = {
      $set:  { [`atBat.${emptySlot}`]: dugoutPlayer },
      $pull: { dugout: { playerId: dugoutPlayer.playerId } },
    };

    // Award Black Card to the 2nd/3rd Base referrer (no cap — unlimited)
    const referrerId = dugoutPlayer.referredBy?.toString();
    let cardEarnedPlayerId: any = null;
    let cardEarnedType: "black" | "brown" | null = null;
    let cardEarnedPosition: string | null = null;
    const now = new Date();

    if (referrerId) {
      const boardObj = board.toObject() as any;
      const upperPositions = [
        { key: "secondBaseA", slot: boardObj.secondBaseA },
        { key: "secondBaseB", slot: boardObj.secondBaseB },
        { key: "thirdBase",   slot: boardObj.thirdBase   },
      ];
      let hotBoxPlayerId: any = null;
      for (const { key, slot } of upperPositions) {
        if (slot?.playerId?.toString() === referrerId) {
          const newBlackCards = (slot.blackCards ?? 0) + 1;
          update.$set[`${key}.blackCards`] = newBlackCards;
          if (!slot.cardType) {
            update.$set[`${key}.cardType`] = "Black";
          }
          hotBoxPlayerId = slot.playerId;
          cardEarnedPlayerId = slot.playerId;
          cardEarnedType = "black";
          cardEarnedPosition = key;
          break;
        }
      }
      // Home Plate referrer: award Brown Card (no cap — unlimited) and show in Hot Box
      if (!hotBoxPlayerId && boardObj.homePlate?.playerId?.toString() === referrerId) {
        const newBrownCards = (boardObj.homePlate.brownCards ?? 0) + 1;
        update.$set["homePlate.brownCards"] = newBrownCards;
        if (!boardObj.homePlate.cardType) {
          update.$set["homePlate.cardType"] = "Brown";
        }
        hotBoxPlayerId = boardObj.homePlate.playerId;
        cardEarnedPlayerId = boardObj.homePlate.playerId;
        cardEarnedType = "brown";
        cardEarnedPosition = "homePlate";
      }
      if (hotBoxPlayerId) {
        if (!update.$push) update.$push = {};
        const hbCardType = (cardEarnedType!.charAt(0).toUpperCase() + cardEarnedType!.slice(1)) as "Black" | "Brown";
        update.$push.hotBox = { cardType: hbCardType, playerId: hotBoxPlayerId, assignedAt: now, referredUserId: dugoutPlayer.playerId ?? null };
      }
    }

    await Bat246Board.updateOne({ _id: board._id }, update);

    // Sync cardsEarned on the player record so LB tier logic stays accurate
    if (cardEarnedPlayerId && cardEarnedType) {
      await Bat246Player.updateOne(
        { _id: cardEarnedPlayerId },
        { $inc: { [`minorLeague.cardsEarned.${cardEarnedType}`]: 1 } }
      );
      checkAndAwardTrophiesByCards(cardEarnedPlayerId).catch((err) => console.error("[bat246 trophies] card-check failed:", err.message));
      // Record card-earning history (try/catch so history failure never breaks promotion)
      try {
        const cardTypeCap = (cardEarnedType.charAt(0).toUpperCase() + cardEarnedType.slice(1)) as "Black" | "Brown";
        const ep = await Bat246Player.findById(cardEarnedPlayerId).select("nickname email playerIdNo").lean() as any;
        const boardObj = (board as any).toObject?.() ?? board;
        const earnerSlotKey = cardEarnedPosition ?? "";
        let earnerEntryNo: string | null = null;
        if (earnerSlotKey === "secondBaseA") earnerEntryNo = boardObj.secondBaseA?.entryNo ?? null;
        else if (earnerSlotKey === "secondBaseB") earnerEntryNo = boardObj.secondBaseB?.entryNo ?? null;
        else if (earnerSlotKey === "thirdBase") earnerEntryNo = boardObj.thirdBase?.entryNo ?? null;
        else if (earnerSlotKey === "homePlate") earnerEntryNo = boardObj.homePlate?.entryNo ?? null;
        const cardBack = buildGoldCardBack({
          earner: ep,
          earnerEntryNo,
          earnerPosition: earnerSlotKey,
          referred: { nickname: dugoutPlayer.playerName ?? null, email: dugoutPlayer.playerEmail ?? null, playerIdNo: null },
          referredPlayerId: dugoutPlayer.playerId,
          referredEntryNo: dugoutPlayer.entryNo ?? null,
          referredPosition: `atBat-${emptySlot}`,
          stolenFrom: null,
          stolenFromPlayerId: null,
          stolenFromEntryNo: null,
          stolenFromPosition: null,
          boardTrackingNo: (board as any).trackingNumber ?? null,
          issuedAt: now,
        });
        await Bat246SalesCredit.create({
          boardId: board._id,
          boardTrackingNumber: (board as any).trackingNumber ?? null,
          playerId: cardEarnedPlayerId,
          playerName: ep?.nickname ?? ep?.email ?? "",
          position: cardEarnedPosition,
          cardType: cardTypeCap,
          countsForLB: true,
          saleAmount: 0,
          earnedAt: now,
          referredUserId: dugoutPlayer.playerId,
          referredUserName: dugoutPlayer.playerName ?? null,
          cardBack,
        });
      } catch (e: any) {
        console.error("[bat246Admin] card-history create failed:", e?.message ?? e);
      }
    }

    await Bat246PlayerBoard.updateOne(
      { playerId: dugoutPlayer.playerId, boardId: board._id },
      { $set: { position: `atBat.${emptySlot}` } }
    );
    transferAtBatPayment((board as any).homePlate?.playerId?.toString(), (board as any).homePlate?.podTeamId).catch((err) =>
      console.warn("[bat246Admin] AT BAT wallet transfer (dugout promo) failed:", err.message)
    );
    transferAtBatPaymentToThirdBase(
      (board as any).thirdBase?.playerId?.toString(),
      (board as any).thirdBase?.salesCredits,
      (board as any).thirdBase?.podTeamId
    ).catch((err) =>
      console.warn("[bat246Admin] AT BAT 3rd Base wallet transfer (dugout promo) failed:", err.message)
    );
    moved++;
  }

  // Check split trigger: all 8 AT BAT slots filled
  const refreshed = await Bat246Board.findById(boardId).lean() as any;
  const atBatFilled = (refreshed?.atBat ?? []).filter(Boolean).length;
  const splitTriggered = atBatFilled >= 8;

  if (splitTriggered && refreshed?.status === "active") {
    const { splitBoardPhase1 } = require("./bat246Split.service");
    splitBoardPhase1(boardId).catch((err: any) =>
      console.error("[bat246Admin] promoteDugoutToAtBat split trigger failed:", err.message)
    );
  }

  return { moved, splitTriggered };
}

/**
 * bat246Entry.service.ts
 * Called after a successful Bat246 product purchase.
 */
import { Types } from "mongoose";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { createBat246Player } from "./bat246PlayerId.util";
import { resolveCountryOrigin } from "./bat246Country.util";
import { checkAndAwardTrophiesByCards } from "./bat246Trophy.service";
import { Bat246Config } from "../models/bat246Config.model";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { Bat246SalesCredit } from "../models/bat246SalesCredit.model";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { assignDistributorId } from "./bat246DistributorId.util";
import { splitBoardPhase1 } from "./bat246Split.service";
import { maybeCreatePlacementNotification } from "./bat246.service";
import { assignPodTeamId } from "./bat246PodInvite.service";
import { User } from "../../models/user.model";
import { Organization } from "../../models/organization.model";
import { directCreditStoreWallet, transferAtBatPayment, transferAtBatPaymentToThirdBase } from "./bat246Wallet.util";
import { payLbHolders } from "./bat246Leaderboard.service";
import { runLostMoneyAutoPay } from "./bat246LostMoneyAutoPay.service";
import { buildGreenCardBack, buildGoldCardBack, buildNoCardCardBack } from "./bat246CardBack.util";

const FIRST_BASE_POSITIONS = ["1stA", "1stB", "1stC", "1stD"] as const;

// Super admin who permanently occupies Home Plate on every new board
const ALAN_K_EMAIL = "redbaron2020@mail.com";

// Map each 1st Base position to its two At Bat indices (0-based)
const POS_TO_AB: Record<string, [number, number]> = {
  "1stA": [0, 1],
  "1stB": [2, 3],
  "1stC": [4, 5],
  "1stD": [6, 7],
};

const FIRST_BASE_INDEX: Record<string, number> = {
  "1stA": 0,
  "1stB": 1,
  "1stC": 2,
  "1stD": 3,
};


// Adds the user to the Garage App office (parent org) as a stakeholder if not already a member.
async function ensureGarageAppMembership(userId: string): Promise<void> {
  const garageOrg = await Organization.findOne({ parent: true }).select("_id").lean() as any;
  if (!garageOrg) return;

  const orgId = garageOrg._id;
  const alreadyMember = await User.exists({
    _id: new Types.ObjectId(userId),
    "organizations.organization": orgId,
  });
  if (alreadyMember) return;

  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    {
      $push: {
        organizations: {
          organization: orgId,
          role: "stakeholder",
          joinedAt: new Date(),
          guest: false,
        },
      },
    }
  );
}

async function findOrCreatePlayer(userId: string, userName: string, userEmail: string): Promise<any> {
  let player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) });
  if (player) {
    // Still ensure Garage App membership even for existing players (idempotent)
    ensureGarageAppMembership(userId).catch((err) =>
      console.error("[bat246Entry] ensureGarageAppMembership failed:", err.message)
    );
    return player;
  }

  player = await createBat246Player({
    userId: new Types.ObjectId(userId),
    nickname: userName,
    email: userEmail,
    memberSince: new Date(),
  });

  ensureGarageAppMembership(userId).catch((err) =>
    console.error("[bat246Entry] ensureGarageAppMembership failed:", err.message)
  );
  return player;
}

// ── LB-aware HP credit: deducts LB payouts from Alan K's saleAmount ─────────
async function payLbAndCreditHp(boardId: string, saleAmount: number): Promise<void> {
  const lbPaid = await payLbHolders(boardId);
  await creditRootHpUser(boardId, Math.max(0, saleAmount - lbPaid));

  // Lost Money queue auto-pay (3% of the sale, debited from Alan K's own
  // wallet — separate from, and not deducted out of, the LB/Home Plate
  // amounts above). Fire-and-forget: this can never block or affect the
  // purchase/placement that already completed successfully above it.
  runLostMoneyAutoPay(saleAmount).catch((err) =>
    console.error("[bat246Entry] Lost Money auto-pay failed:", err.message)
  );
}

// ── Credit root-board Home Plate user (items 1, 2, 7, 8) ─────────────────────
// Finds the root board (generation=0) in the same family, credits the HP user's
// store wallet with saleAmount and increments homePlate.totalEarning.
export async function creditRootHpUser(boardId: string, saleAmount: number): Promise<void> {
  if (saleAmount <= 0) return;

  const board = await Bat246Board.findById(boardId).select("familyNumber generation homePlate").lean() as any;
  if (!board) return;

  // If this IS the root board, use it directly; otherwise find via familyNumber
  let rootBoard: any = board.generation === 0 ? board : null;
  if (!rootBoard) {
    rootBoard = await Bat246Board.findOne(
      { familyNumber: board.familyNumber, generation: 0 }
    ).select("_id homePlate").lean() as any;
  }
  if (!rootBoard?.homePlate?.playerId) return;

  const hpPlayer = await Bat246Player.findById(rootBoard.homePlate.playerId)
    .select("userId").lean() as any;
  if (!hpPlayer?.userId) return;

  const { Product } = require("../../models/product.model");
  const entryProduct = await Product.findOne({ tags: "bat246_entry" })
    .select("organizationId").lean() as any;
  if (!entryProduct?.organizationId) return;

  const orgId = entryProduct.organizationId.toString();
  const hpGarageUserId = hpPlayer.userId.toString();

  await directCreditStoreWallet(hpGarageUserId, orgId, saleAmount, "Bat246 board sale revenue");

  // Increment running total on root board's HP slot
  await Bat246Board.updateOne(
    { _id: rootBoard._id },
    { $inc: { "homePlate.totalEarning": saleAmount } }
  );
}

/**
 * Called when Alan K buys a bat246_entry product with NO board context.
 * Creates a new PENDING board with Alan K at Home Plate.
 * If a real buyer (not Alan K) triggered this, they go into the Dugout.
 * When Alan K buys his own product (self-setup), the Dugout stays empty.
 */
export async function createBoardFromPurchase(params: {
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  countryResidence?: string;
  countryOrigin?: string;
}): Promise<{ boardId: string; trackingNumber: string }> {
  const { userId, userName, userEmail, productId, countryResidence, countryOrigin } = params;

  // ── Resolve Alan K (permanent Home Plate) ─────────────────────────────────
  const alanKUser = await User.findOne({ email: ALAN_K_EMAIL }).lean() as any;
  if (!alanKUser) throw new Error(`Super admin (${ALAN_K_EMAIL}) not found — cannot create board`);
  const alanKPlayer = await findOrCreatePlayer(
    alanKUser._id.toString(),
    alanKUser.name || "Alan K",
    ALAN_K_EMAIL
  );

  // When Alan K buys his own product there is no real "buyer" to place in the Dugout.
  // Only add a Dugout slot when the buyer is a different person.
  const isSelfSetup = alanKUser._id.toString() === userId;

  // ── Resolve buyer (skip if self-setup) ────────────────────────────────────
  const buyerPlayer = isSelfSetup ? null : await findOrCreatePlayer(userId, userName, userEmail);

  // Get next board number + new family number atomically
  const config = await Bat246Config.findOneAndUpdate(
    {},
    { $inc: { boardCounter: 1, familyCounter: 1 } },
    { new: true, upsert: true }
  );
  const boardNumber  = config!.boardCounter;
  const familyNumber = config!.familyCounter;
  const trackingNumber = `${familyNumber}-1000`;
  await Bat246Config.updateOne({}, { $set: { [`familySequences.${familyNumber}`]: 1000 } });

  const now = new Date();
  const pendingPpEnd = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);

  const alanKEntryNo = String((alanKPlayer.minorLeague?.totalEntries ?? 0) + 1);
  const homePlateSlot = {
    playerId: alanKPlayer._id,
    entryNo: alanKEntryNo,
    playerName: alanKPlayer.nickname || "Alan K",
    playerEmail: ALAN_K_EMAIL,
    enteredAt: now,
    joinedBoardAt: now,
    countryResidence: null,
    countryOrigin: null,
  };

  const dugoutArray: any[] = [];
  if (!isSelfSetup && buyerPlayer) {
    const buyerEntryNo = String((buyerPlayer.minorLeague?.totalEntries ?? 0) + 1);
    dugoutArray.push({
      playerId: buyerPlayer._id,
      entryNo: buyerEntryNo,
      playerName: buyerPlayer.nickname || userEmail,
      playerEmail: userEmail,
      enteredAt: now,
      joinedBoardAt: now,
      countryResidence: countryResidence ?? null,
      countryOrigin: await resolveCountryOrigin(userId, countryOrigin, countryResidence),
    });
  }

  const board = await Bat246Board.create({
    boardNumber,
    trackingNumber,
    status: "pending",
    inviteProductId: productId,
    generation: 0,
    familyNumber,
    protectionPeriodEnd: pendingPpEnd,
    warpCount: 0,
    homePlate: homePlateSlot,
    thirdBase: null,
    secondBaseA: null,
    secondBaseB: null,
    firstBase: [null, null, null, null],
    atBat: Array(8).fill(null),
    dugout: dugoutArray,
    leaderBoard: [
      { tier: "G", playerId: null, qualifiedAt: null },
      { tier: "H", playerId: null, qualifiedAt: null },
      { tier: "T", playerId: null, qualifiedAt: null },
    ],
  });

  // Reserve this board's POD team number up front — don't wait for the
  // first POD member to join.
  await assignPodTeamId(board);
  await board.save();

  // Track memberships
  await Bat246PlayerBoard.create({
    playerId: alanKPlayer._id,
    boardId: board._id,
    position: "homePlate",
    joinedAt: now,
    status: "active",
  });
  await Bat246Player.updateOne({ _id: alanKPlayer._id }, { $inc: { "minorLeague.totalEntries": 1 } });

  if (!isSelfSetup && buyerPlayer) {
    await Bat246PlayerBoard.create({
      playerId: buyerPlayer._id,
      boardId: board._id,
      position: "dugout.0",
      joinedAt: now,
      status: "active",
    });
    await Bat246Player.updateOne({ _id: buyerPlayer._id }, { $inc: { "minorLeague.totalEntries": 1 } });

    // Record that this user purchased the entry product (triggers admin board setup)
    // Buying the bat246_entry product means they are joining the office
    await Bat246Distributor.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          playerId: buyerPlayer._id,
          hasPurchasedProduct: true,
          isOfficeMember: true,
        },
        $setOnInsert: {
          isGarageAffiliate: false,
          hasBat246Membership: false,
          isQualified: false,
        },
      },
      { upsert: true }
    );

    // Recompute isQualified after purchase. isGarageAffiliate ($25 Garage
    // Affiliate) dropped from the check on request — still selected below
    // since other callers/logging may still want it, but no longer gates
    // isQualified.
    const freshDist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(userId) })
      .select("isOfficeMember hasBat246Membership hasPurchasedProduct isGarageAffiliate isQualified").lean() as any;
    if (freshDist && !freshDist.isQualified && freshDist.isOfficeMember && freshDist.hasBat246Membership && freshDist.hasPurchasedProduct) {
      await Bat246Distributor.updateOne(
        { userId: new Types.ObjectId(userId) },
        { isQualified: true, qualifiedAt: new Date() }
      );
      await assignDistributorId(userId).catch((err) => console.error("[bat246] assignDistributorId failed:", err.message));
      await maybeCreatePlacementNotification(userId).catch(() => {});
    }
  }

  return { boardId: board._id.toString(), trackingNumber };
}

/**
 * Called when someone buys via a 1st Base player's invite link.
 * Places the buyer at the next empty At Bat slot and awards a Green Card.
 * When Green Cards reach 2, the 1st Base player earns a Gold card (item 5).
 */
export async function addAtBatFromPurchase(params: {
  boardId: string;
  pos1stBase: string; // "1stA" | "1stB" | "1stC" | "1stD"
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  saleAmount?: number;
  countryResidence?: string;
  countryOrigin?: string;
}): Promise<{ boardId: string; atBatSlot: number; shouldSplit: boolean; placedInDugout?: boolean }> {
  const { boardId, pos1stBase, userId, userName, userEmail, saleAmount = 0, productId, countryResidence, countryOrigin } = params;

  if (!POS_TO_AB[pos1stBase]) throw new Error(`Invalid 1st Base position: ${pos1stBase}`);

  // Non-null assertion keeps TS narrowing intact after the guard below.
  const board = (await Bat246Board.findById(boardId))!;
  if (!board) throw new Error("Board not found");
  if (!["active", "pending"].includes((board as any).status)) {
    throw new Error("Board is not open for new entries");
  }

  const [ab1, ab2] = POS_TO_AB[pos1stBase];
  const atBat = (board as any).atBat as (any | null)[];

  // Find the 1st Base player who sent the invite
  const fbIndex = FIRST_BASE_INDEX[pos1stBase];
  const firstBaseSlot: any = (board as any).firstBase[fbIndex];
  if (!firstBaseSlot?.playerId) throw new Error(`No player at ${pos1stBase} to award Green Card to`);

  const referrerId = firstBaseSlot.playerId;
  const referrerName = firstBaseSlot.playerName;

  const player = await findOrCreatePlayer(userId, userName, userEmail);
  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);

  const baseSlot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || userEmail,
    playerEmail: userEmail,
    enteredAt: now,
    joinedBoardAt: now,
    referredBy: referrerId,
    referredByName: referrerName,
    countryResidence: countryResidence ?? null,
    countryOrigin: await resolveCountryOrigin(userId, countryOrigin, countryResidence),
  };

  // Find target: prefer the referrer's own AB slots; once both are filled
  // (referrer already has 2 Green Cards), any further referral goes to the
  // Dugout — that dugout entry earns the referrer their Gold Card once it's
  // promoted onto the board after PP (see promoteDugoutAfterPP).
  const targetSlot = !atBat[ab1] ? ab1 : !atBat[ab2] ? ab2 : -1;

  if (targetSlot === -1) {  // Referrer's AB pair full, or board full → route to Dugout
    const dugout = (board as any).dugout as (any | null)[];
    const dugoutFilled = dugout.filter(Boolean).length;
    if (dugoutFilled >= 8) throw new Error(`Dugout is also full for board ${boardId}`);

    await Bat246Board.updateOne({ _id: board._id }, { $push: { dugout: baseSlot } });

    await Bat246PlayerBoard.create({
      playerId: player._id,
      boardId: board._id,
      position: `dugout.${dugoutFilled}`,
      joinedAt: now,
      status: "active",
    });
    await Bat246Player.updateOne(
      { _id: player._id },
      { $inc: { "minorLeague.totalEntries": 1 } }
    );

    payLbAndCreditHp(boardId, saleAmount).catch((err) =>
      console.error("[bat246Entry] root HP credit failed:", err.message)
    );
    return { boardId, atBatSlot: -1, shouldSplit: false, placedInDugout: true };
  }

  // Green Card goes to the 1st Base player covering the actual landing slot
  const actualFbIndex = Math.floor(targetSlot / 2);
  const actualFirstBaseSlot: any = (board as any).firstBase[actualFbIndex];

  const atBatPath = `atBat.${targetSlot}`;
  const update: any = { $set: { [atBatPath]: baseSlot } };

  if (actualFirstBaseSlot?.playerId) {
    const newSalesCredits = (actualFirstBaseSlot.salesCredits ?? 0) + 1;
    const newWarpStatus = Math.min(newSalesCredits, 2);
    const prevWarpStatus = actualFirstBaseSlot.warpStatus ?? 0;
    const warpIncrement = prevWarpStatus < 2 && newWarpStatus >= 2 ? 1 : 0;

    update.$set[`firstBase.${actualFbIndex}.salesCredits`] = newSalesCredits;
    update.$set[`firstBase.${actualFbIndex}.warpStatus`] = newWarpStatus;
    if (warpIncrement > 0) update.$inc = { warpCount: warpIncrement };
  }

  await Bat246Board.updateOne({ _id: board._id }, update);

  if (actualFirstBaseSlot?.playerId) {
    const earnerPosition = FIRST_BASE_POSITIONS[actualFbIndex];
    const earner = await Bat246Player.findById(actualFirstBaseSlot.playerId).select("nickname email playerIdNo").lean() as any;
    const referredPosition = `atBat-${targetSlot}`;
    await Bat246SalesCredit.create({
      boardId: board._id,
      boardTrackingNumber: (board as any).trackingNumber ?? null,
      playerId: actualFirstBaseSlot.playerId,
      playerName: earner?.nickname ?? earner?.email ?? "",
      position: earnerPosition,
      cardType: "Green",
      countsForLB: true,
      saleAmount,
      earnedAt: now,
      referredUserId: player._id,
      referredUserName: player.nickname ?? userEmail ?? null,
      cardBack: buildGreenCardBack({
        earner,
        earnerEntryNo: actualFirstBaseSlot.entryNo,
        earnerPosition,
        referred: player as any,
        referredPlayerId: player._id,
        referredEntryNo: entryNo,
        referredPosition,
        boardTrackingNo: (board as any).trackingNumber ?? null,
        issuedAt: now,
      }),
    });
  }

  // Membership + entry count for new At Bat player
  await Bat246PlayerBoard.create({
    playerId: player._id,
    boardId: board._id,
    position: `atBat.${targetSlot}`,
    joinedAt: now,
    status: "active",
  });
  await Bat246Player.updateOne(
    { _id: player._id },
    { $inc: { "minorLeague.totalEntries": 1 } }
  );

  // Check if split should fire (all 8 AT BAT slots filled)
  const refreshed = await Bat246Board.findById(board._id).lean() as any;
  const atBatFilled = (refreshed?.atBat ?? []).filter(Boolean).length;
  const shouldSplit = atBatFilled >= 8;

  if (shouldSplit && refreshed?.status === "active") {
    splitBoardPhase1(boardId).catch((err) =>
      console.error("[bat246Entry] split trigger failed:", err.message)
    );
  }

  payLbAndCreditHp(boardId, saleAmount).catch((err) =>
    console.error("[bat246Entry] root HP credit failed:", err.message)
  );
  transferAtBatPayment((board as any).homePlate?.playerId?.toString(), (board as any).homePlate?.podTeamId).catch((err) =>
    console.warn("[bat246Entry] AT BAT wallet transfer failed:", err.message)
  );
  transferAtBatPaymentToThirdBase(
    (board as any).thirdBase?.playerId?.toString(),
    (board as any).thirdBase?.salesCredits,
    (board as any).thirdBase?.podTeamId
  ).catch((err) =>
    console.warn("[bat246Entry] AT BAT 3rd Base wallet transfer failed:", err.message)
  );
  return { boardId, atBatSlot: targetSlot, shouldSplit };
}

/**
 * Called when a 2nd Base A/B or 3rd Base player shares their invite link.
 * Always routes the buyer to the Dugout — they wait for the Protection Period
 * to expire, then move to empty AT BAT slots via promoteDugoutAfterPP(),
 * which awards a Black Card to this referrer (not a Green Card to 1st Base).
 */
export async function addFromUpperBaseInvite(params: {
  boardId: string;
  referrerPosition: "2ndBaseA" | "2ndBaseB" | "3rdBase";
  referrerPlayerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  saleAmount?: number;
  countryResidence?: string;
  countryOrigin?: string;
}): Promise<{ boardId: string; atBatSlot: number; shouldSplit: boolean; placedInDugout: true }> {
  const { boardId, referrerPlayerId, userId, userName, userEmail, saleAmount = 0, countryResidence, countryOrigin } = params;

  const board = await Bat246Board.findById(boardId);
  if (!board) throw new Error("Board not found");
  if (!["active", "pending"].includes((board as any).status)) {
    throw new Error("Board is not open for new entries");
  }

  const dugout = (board as any).dugout as (any | null)[];
  const dugoutFilled = dugout.filter(Boolean).length;
  if (dugoutFilled >= 8) throw new Error(`Dugout is full for board ${boardId}`);

  const player = await findOrCreatePlayer(userId, userName, userEmail);
  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);

  const referrerPlayer = await Bat246Player.findById(referrerPlayerId).lean() as any;
  const referrerName = referrerPlayer?.nickname || referrerPlayer?.email || null;

  const baseSlot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || userEmail,
    playerEmail: userEmail,
    enteredAt: now,
    joinedBoardAt: now,
    referredBy: new Types.ObjectId(referrerPlayerId),
    referredByName: referrerName,
    countryResidence: countryResidence ?? null,
    countryOrigin: await resolveCountryOrigin(userId, countryOrigin, countryResidence),
  };

  // 2nd/3rd Base invites always land in Dugout first; they move to AT BAT after PP ends
  await Bat246Board.updateOne({ _id: board._id }, { $push: { dugout: baseSlot } });
  await Bat246PlayerBoard.create({
    playerId: player._id,
    boardId: board._id,
    position: `dugout.${dugoutFilled}`,
    joinedAt: now,
    status: "active",
  });
  await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });

  payLbAndCreditHp(boardId, saleAmount).catch((err) =>
    console.error("[bat246Entry] root HP credit failed:", err.message)
  );
  return { boardId, atBatSlot: -1, shouldSplit: false, placedInDugout: true };
}

/**
 * Called for any generic invite link (item 9 — anyone can refer).
 * Handles At Bat users, Home Plate users, and any other board position.
 *
 * Special rules:
 *  - If referrer is at At Bat → they earn a Gold card (item 6)
 *  - If referrer is Home Plate on a child board (generation > 0) AND hpReferralBonusCount < 2
 *    → they earn nextHomePlatePayout credited to their store wallet (item 3)
 *  - Root board HP user always gets the full sale amount in their store wallet (items 1, 2, 7)
 */
export async function addFromGenericInvite(params: {
  boardId: string;
  referrerPlayerId: string; // bat246Player._id as string
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  saleAmount?: number;
  countryResidence?: string;
}): Promise<{ boardId: string; atBatSlot: number; shouldSplit: boolean; placedInDugout?: boolean }> {
  const { boardId, referrerPlayerId, userId, userName, userEmail, saleAmount = 0, countryResidence } = params;

  // Non-null assertion (same reason as `addAtBatFromPurchase` above) — the
  // `if (!board)` line below still throws at runtime.
  const board = (await Bat246Board.findById(boardId))!;
  if (!board) throw new Error("Board not found");
  if (!["active", "pending"].includes((board as any).status)) {
    throw new Error("Board is not open for new entries");
  }

  const atBat = (board as any).atBat as (any | null)[];
  const firstBase = (board as any).firstBase as (any | null)[];

  // If the referrer is a 1st Base player who already has both Green Cards
  // (salesCredits >= 2), route this referral to the Dugout instead of an
  // open At Bat slot — it earns them their Gold Card once promoted after PP
  // (see promoteDugoutAfterPP).
  const referrerFbSlot = (firstBase ?? []).find(
    (s: any) => s?.playerId?.toString() === referrerPlayerId
  );
  const targetSlot = (referrerFbSlot && (referrerFbSlot.salesCredits ?? 0) >= 2)
    ? -1
    : atBat.findIndex((s: any) => !s);

  const player = await findOrCreatePlayer(userId, userName, userEmail);
  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);

  const referrerPlayer = await Bat246Player.findById(referrerPlayerId).lean() as any;
  const referrerName = referrerPlayer?.nickname || referrerPlayer?.email || null;

  const baseSlot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || userEmail,
    playerEmail: userEmail,
    enteredAt: now,
    joinedBoardAt: now,
    referredBy: new Types.ObjectId(referrerPlayerId),
    referredByName: referrerName,
    countryResidence: countryResidence ?? null,
    countryOrigin: await resolveCountryOrigin(userId, null, countryResidence),
  };

  if (targetSlot === -1) {  // All At Bat slots full — fall back to Dugout
    const dugout = (board as any).dugout as (any | null)[];
    const dugoutFilled = dugout.filter(Boolean).length;
    if (dugoutFilled >= 8) throw new Error(`Dugout is also full for board ${boardId}`);

    await Bat246Board.updateOne({ _id: board._id }, { $push: { dugout: baseSlot } });
    await Bat246PlayerBoard.create({
      playerId: player._id,
      boardId: board._id,
      position: `dugout.${dugoutFilled}`,
      joinedAt: now,
      status: "active",
    });
    await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });
    payLbAndCreditHp(boardId, saleAmount).catch((err) =>
      console.error("[bat246Entry] root HP credit failed:", err.message)
    );
    return { boardId, atBatSlot: -1, shouldSplit: false, placedInDugout: true };
  }

  // ── Place buyer at the empty At Bat slot ──────────────────────────────────
  const fbIndex = Math.floor(targetSlot / 2);
  const firstBaseSlot: any = firstBase[fbIndex];

  const update: any = { $set: { [`atBat.${targetSlot}`]: baseSlot } };

  // Award Green Card to covering 1st Base player
  if (firstBaseSlot?.playerId) {
    const newSalesCredits = (firstBaseSlot.salesCredits ?? 0) + 1;
    const newWarpStatus = Math.min(newSalesCredits, 2);
    const prevWarpStatus = firstBaseSlot.warpStatus ?? 0;
    const warpIncrement = prevWarpStatus < 2 && newWarpStatus >= 2 ? 1 : 0;

    update.$set[`firstBase.${fbIndex}.salesCredits`] = newSalesCredits;
    update.$set[`firstBase.${fbIndex}.warpStatus`] = newWarpStatus;
    if (warpIncrement > 0) update.$inc = { warpCount: warpIncrement };

    const earnerPosition = FIRST_BASE_POSITIONS[fbIndex];
    const earner = await Bat246Player.findById(firstBaseSlot.playerId).select("nickname email playerIdNo").lean() as any;
    const referredPosition = `atBat-${targetSlot}`;
    await Bat246SalesCredit.create({
      boardId: board._id,
      boardTrackingNumber: (board as any).trackingNumber ?? null,
      playerId: firstBaseSlot.playerId,
      playerName: earner?.nickname ?? earner?.email ?? "",
      position: earnerPosition,
      cardType: "Green",
      countsForLB: true,
      saleAmount,
      earnedAt: now,
      referredUserId: player._id,
      referredUserName: player.nickname ?? userEmail ?? null,
      cardBack: buildGreenCardBack({
        earner,
        earnerEntryNo: firstBaseSlot.entryNo,
        earnerPosition,
        referred: player as any,
        referredPlayerId: player._id,
        referredEntryNo: entryNo,
        referredPosition,
        boardTrackingNo: (board as any).trackingNumber ?? null,
        issuedAt: now,
      }),
    });
  }

  // item 6 — Award Gold card to At Bat referrer
  const referrerAbIndex = atBat.findIndex(
    (s: any) => s?.playerId?.toString() === referrerPlayerId
  );
  if (referrerAbIndex !== -1 && !atBat[referrerAbIndex].cardType) {
    update.$set[`atBat.${referrerAbIndex}.cardType`] = "Gold";
  }

  await Bat246Board.updateOne({ _id: board._id }, update);

  // item 3 — HP referral bonus for child-board Home Plate users
  let greenCardBonus = 0;
  const boardObj = board.toObject() as any;
  const isChildBoard = (boardObj.generation ?? 0) > 0;
  const hpSlot = boardObj.homePlate;

  if (
    isChildBoard &&
    hpSlot?.playerId &&
    hpSlot.playerId.toString() === referrerPlayerId &&
    (hpSlot.hpReferralBonusCount ?? 0) < 2
  ) {
    const payoutAmount: number = boardObj.nextHomePlatePayout ?? 200;
    await Bat246Board.updateOne(
      { _id: board._id },
      { $inc: { "homePlate.hpReferralBonusCount": 1 } }
    );
    if (payoutAmount > 0) {
      const hpGaragePlayer = await Bat246Player.findById(hpSlot.playerId)
        .select("userId").lean() as any;
      if (hpGaragePlayer?.userId) {
        const { Product } = require("../../models/product.model");
        const entryProduct = await Product.findOne({ tags: "bat246_entry" })
          .select("organizationId").lean() as any;
        if (entryProduct?.organizationId) {
          directCreditStoreWallet(
            hpGaragePlayer.userId.toString(),
            entryProduct.organizationId.toString(),
            payoutAmount,
            `Bat246 HP referral bonus (board ${boardObj.trackingNumber})`
          ).catch((err) =>
            console.error("[bat246Entry] HP referral bonus credit failed:", err.message)
          );

          // Green Card Referral Bonus: $100 to whoever originally recruited the HP player
          if (hpSlot.referredBy) {
            const referrerOfHp = await Bat246Player.findById(hpSlot.referredBy)
              .select("userId").lean() as any;
            if (referrerOfHp?.userId) {
              greenCardBonus = 100;
              directCreditStoreWallet(
                referrerOfHp.userId.toString(),
                entryProduct.organizationId.toString(),
                100,
                `Bat246 green card referral bonus (board ${boardObj.trackingNumber})`
              ).catch((err) =>
                console.error("[bat246Entry] green card referral bonus failed:", err.message)
              );
            }
          }
        }
      }
    }
  }

  await Bat246PlayerBoard.create({
    playerId: player._id,
    boardId: board._id,
    position: `atBat.${targetSlot}`,
    joinedAt: now,
    status: "active",
  });
  await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });

  const refreshed = await Bat246Board.findById(board._id).lean() as any;
  const atBatFilledGeneric = (refreshed?.atBat ?? []).filter(Boolean).length;
  const shouldSplit = atBatFilledGeneric >= 8;

  if (shouldSplit && refreshed?.status === "active") {
    splitBoardPhase1(boardId).catch((err) =>
      console.error("[bat246Entry] generic invite split trigger failed:", err.message)
    );
  }

  payLbAndCreditHp(boardId, Math.max(0, saleAmount - greenCardBonus)).catch((err) =>
    console.error("[bat246Entry] root HP credit failed:", err.message)
  );
  transferAtBatPayment((board as any).homePlate?.playerId?.toString(), (board as any).homePlate?.podTeamId).catch((err) =>
    console.warn("[bat246Entry] AT BAT wallet transfer (generic invite) failed:", err.message)
  );
  transferAtBatPaymentToThirdBase(
    (board as any).thirdBase?.playerId?.toString(),
    (board as any).thirdBase?.salesCredits,
    (board as any).thirdBase?.podTeamId
  ).catch((err) =>
    console.warn("[bat246Entry] AT BAT 3rd Base wallet transfer (generic invite) failed:", err.message)
  );
  return { boardId, atBatSlot: targetSlot, shouldSplit };
}

/**
 * Called when a dugout player shares their invite link and someone purchases.
 * Places the new buyer in the board's dugout, attributed to the dugout referrer.
 */
export async function addToDugoutFromPurchase(params: {
  boardId: string;
  referredByPlayerId: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  saleAmount?: number;
  countryResidence?: string;
  countryOrigin?: string;
}): Promise<{ boardId: string; placedInDugout: true }> {
  const { boardId, referredByPlayerId, userId, userName, userEmail, saleAmount = 0, productId, countryResidence, countryOrigin } = params;

  const board = await Bat246Board.findById(boardId);
  if (!board) throw new Error("Board not found");
  if (!["active", "pending"].includes((board as any).status)) {
    throw new Error("Board is not open for new entries");
  }

  const dugout = (board as any).dugout as (any | null)[];
  const dugoutFilled = dugout.filter(Boolean).length;
  if (dugoutFilled >= 8) throw new Error(`Dugout is full for board ${boardId}`);

  const player = await findOrCreatePlayer(userId, userName, userEmail);
  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);

  const referrerPlayer = await Bat246Player.findById(referredByPlayerId).lean() as any;
  const referrerName = referrerPlayer?.nickname || referrerPlayer?.email || null;

  const newSlot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || userEmail,
    playerEmail: userEmail,
    enteredAt: now,
    joinedBoardAt: now,
    referredBy: new Types.ObjectId(referredByPlayerId),
    referredByName: referrerName,
    countryResidence: countryResidence ?? null,
    countryOrigin: await resolveCountryOrigin(userId, countryOrigin, countryResidence),
  };

  await Bat246Board.updateOne({ _id: board._id }, { $push: { dugout: newSlot } });

  await Bat246PlayerBoard.create({
    playerId: player._id,
    boardId: board._id,
    position: `dugout.${dugoutFilled}`,
    joinedAt: now,
    status: "active",
  });
  await Bat246Player.updateOne(
    { _id: player._id },
    { $inc: { "minorLeague.totalEntries": 1 } }
  );

  payLbAndCreditHp(boardId, saleAmount).catch((err) =>
    console.error("[bat246Entry] root HP credit failed:", err.message)
  );
  return { boardId, placedInDugout: true };
}

/**
 * Called after the Protection Period (120h) has expired.
 * Moves every Dugout player into the next empty AT BAT slot.
 * Awards a Black Card to the 2nd/3rd Base player who referred each dugout entry
 * (not a Green Card to 1st Base), or a Brown Card to Home Plate if HP referred
 * the entry. When blackCards reaches 2 the slot's cardType is set to "Black".
 * Triggers split if all 8 AT BAT slots become filled.
 * Also updates the board's hotBox "Black" entry to the referrer (Home Plate,
 * 2nd Base A/B, or 3rd Base) of the most recently promoted dugout player.
 */
export async function promoteDugoutAfterPP(boardId: string): Promise<{ moved: number; splitTriggered: boolean }> {
  const board = await Bat246Board.findById(boardId);
  if (!board) throw new Error("Board not found");
  if ((board as any).status !== "active") throw new Error("Board is not active");

  const now = new Date();
  const ppEnd: Date = (board as any).protectionPeriodEnd;
  if (ppEnd > now) {
    throw new Error(`Protection period has not ended yet — ends at ${ppEnd.toISOString()}`);
  }

  let moved = 0;

  while (true) {
    const fresh = await Bat246Board.findById(boardId);
    if (!fresh) break;

    const atBat  = (fresh as any).atBat  as (any | null)[];
    const dugout = (fresh as any).dugout as (any | null)[];

    const dugoutPlayer = dugout.find(Boolean);
    if (!dugoutPlayer) break;

    const emptySlot = atBat.findIndex((s: any) => !s);
    if (emptySlot === -1) break;

    // POD-driven dugout entry (the 4th POD placement, parked here while PP
    // was active — see placeUserInPod()) — a pure position move, no $650
    // card-economy side effects. Its Gray Card was already awarded to the
    // inviter when the team's 4th slot filled; the referrer here isn't a
    // real $650 referral and must not also earn a Green/Gold/Black/Brown
    // card or trigger the covering-slot No Card / HP wallet transfer.
    if (dugoutPlayer.podTeamId) {
      await Bat246Board.updateOne(
        { _id: fresh._id },
        { $set: { [`atBat.${emptySlot}`]: dugoutPlayer }, $pull: { dugout: { playerId: dugoutPlayer.playerId } } }
      );
      await Bat246PlayerBoard.updateOne(
        { playerId: dugoutPlayer.playerId, boardId: fresh._id },
        { $set: { position: `atBat.${emptySlot}` } }
      );
      moved++;
      continue;
    }

    const update: any = {
      $set:  { [`atBat.${emptySlot}`]: dugoutPlayer },
      $pull: { dugout: { playerId: dugoutPlayer.playerId } },
    };

    // Award a card to whoever referred this dugout entry, now that they're
    // joining the board.
    const referrerId = dugoutPlayer.referredBy?.toString();
    let cardEarnedPlayerId: any = null;
    let cardEarnedType: "gold" | "black" | "brown" | "green" | null = null;
    let cardEarnedPosition: string | null = null;
    let cardEarnedEntryNo: string | null = null;

    const boardObj = fresh.toObject() as any;

    // The AT BAT slot's actual pair owner — used below to decide whether this
    // fill was the owner's own referral (normal Green/Gold) or someone else's
    // referral "stealing" their slot (owner gets marked No Card instead).
    const covFbIndex = Math.floor(emptySlot / 2);
    const coveringSlot = boardObj.firstBase?.[covFbIndex];

    // Referrer's own 1st Base index, if the referrer is a 1st Base player at all
    // (not just the >=2-credit Gold case the old code only checked for).
    const referrerFbIndex = referrerId
      ? (boardObj.firstBase ?? []).findIndex((s: any) => s?.playerId?.toString() === referrerId)
      : -1;

    if (referrerId && referrerFbIndex !== -1) {
      const referrerSlot = boardObj.firstBase[referrerFbIndex];

      if ((referrerSlot.salesCredits ?? 0) >= 2 && !referrerSlot.cardType) {
        // 1st Base referrer who already has 2 Green Cards: this 3rd+ referral
        // being promoted onto the board earns them their Gold Card.
        update.$set[`firstBase.${referrerFbIndex}.cardType`] = "Gold";
        if (!update.$push) update.$push = {};
        update.$push.hotBox = { cardType: "Gold", playerId: referrerSlot.playerId, assignedAt: now, referredUserId: dugoutPlayer.playerId ?? null };
        cardEarnedPlayerId = referrerSlot.playerId;
        cardEarnedType = "gold";
        cardEarnedPosition = FIRST_BASE_POSITIONS[referrerFbIndex] ?? "firstBase";
      } else if (!referrerSlot.cardType) {
        // 1st Base referrer under 2 credits — normal Green Card. Previously
        // this case fell through to the 2nd/3rd/HP checks below, matched
        // nothing, and the referrer earned no card at all.
        const newCredits = (referrerSlot.salesCredits ?? 0) + 1;
        update.$set[`firstBase.${referrerFbIndex}.salesCredits`] = newCredits;
        update.$set[`firstBase.${referrerFbIndex}.warpStatus`] = Math.min(newCredits, 2);
        cardEarnedPlayerId = referrerSlot.playerId;
        cardEarnedType = "green";
        cardEarnedPosition = FIRST_BASE_POSITIONS[referrerFbIndex] ?? "firstBase";
        cardEarnedEntryNo = referrerSlot.entryNo ?? null;
      }
      // else: referrer already holds some other cardType — no change (unchanged behavior).
    } else if (referrerId) {
      // Award Black Card to the 2nd/3rd Base referrer (no cap — unlimited)
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

    // The covering 1st Base's own pair slot filled without their own referral
    // (including when there's no referrer at all) — mark it No Card, mirroring
    // placeUserFromReservation's skipGreenCard "steal" behavior. Skipped when
    // the referrer IS the covering 1st Base (their own normal Green/Gold above).
    let noCardPlayerId: any = null;
    let noCardPosition: string | null = null;
    let noCardEntryNo: string | null = null;
    if (coveringSlot?.playerId && referrerFbIndex !== covFbIndex) {
      const newNoCards = (coveringSlot.noCards ?? 0) + 1;
      update.$set[`firstBase.${covFbIndex}.noCards`] = newNoCards;
      if (!coveringSlot.cardType) {
        update.$set[`firstBase.${covFbIndex}.cardType`] = "NoCard";
      }
      noCardPlayerId = coveringSlot.playerId;
      noCardPosition = FIRST_BASE_POSITIONS[covFbIndex] ?? "firstBase";
      noCardEntryNo = coveringSlot.entryNo ?? null;
    }

    await Bat246Board.updateOne({ _id: fresh._id }, update);

    // Sync cardsEarned on the player record so LB tier logic stays accurate
    if (cardEarnedPlayerId && cardEarnedType) {
      await Bat246Player.updateOne(
        { _id: cardEarnedPlayerId },
        { $inc: { [`minorLeague.cardsEarned.${cardEarnedType}`]: 1 } }
      );
      checkAndAwardTrophiesByCards(cardEarnedPlayerId).catch((err) => console.error("[bat246 trophies] card-check failed:", err.message));
      // Record card-earning history (try/catch so history failure never breaks promotion)
      try {
        const cardTypeCap = (cardEarnedType.charAt(0).toUpperCase() + cardEarnedType.slice(1)) as "Gold" | "Black" | "Brown" | "Green";
        const ep = await Bat246Player.findById(cardEarnedPlayerId).select("nickname email playerIdNo").lean() as any;

        // For gold cards, find the "stolen from" 1st Base player — the one covering emptySlot
        // whose green card was skipped so the gold earner could collect instead.
        let goldCardBack: ReturnType<typeof buildGoldCardBack> | null = null;
        if (cardEarnedType === "gold") {
          const boardObj2 = (await Bat246Board.findById(fresh._id).select("firstBase").lean()) as any;
          const earnerFbIndex = (boardObj2?.firstBase ?? []).findIndex(
            (s: any) => s?.playerId?.toString() === cardEarnedPlayerId?.toString()
          );
          const covFbIndex = Math.floor(emptySlot / 2);
          let stolenFromPlayer: any = null;
          let stolenFromPlayerId: any = null;
          let stolenFromEntryNo: string | null = null;
          let stolenFromPositionKey: string | null = null;
          if (covFbIndex !== earnerFbIndex) {
            const covFbSlot = boardObj2?.firstBase?.[covFbIndex];
            stolenFromPositionKey = FIRST_BASE_POSITIONS[covFbIndex] ?? null;
            stolenFromEntryNo = covFbSlot?.entryNo ?? null;
            stolenFromPlayerId = covFbSlot?.playerId ?? null;
            if (stolenFromPlayerId) {
              stolenFromPlayer = await Bat246Player.findById(stolenFromPlayerId)
                .select("nickname email playerIdNo").lean() as any;
            }
          }
          const earnerFbSlot = boardObj2?.firstBase?.[earnerFbIndex];
          goldCardBack = buildGoldCardBack({
            earner: ep,
            earnerEntryNo: earnerFbSlot?.entryNo ?? null,
            earnerPosition: cardEarnedPosition ?? "firstBase",
            referred: { nickname: dugoutPlayer.playerName ?? null, email: dugoutPlayer.playerEmail ?? null, playerIdNo: null },
            referredPlayerId: dugoutPlayer.playerId,
            referredEntryNo: dugoutPlayer.entryNo ?? null,
            referredPosition: `atBat-${emptySlot}`,
            stolenFrom: stolenFromPlayer,
            stolenFromPlayerId,
            stolenFromEntryNo,
            stolenFromPosition: stolenFromPositionKey,
            boardTrackingNo: (fresh as any).trackingNumber ?? null,
            issuedAt: now,
          });
        }

        // Build cardBack for the new <2-credit-referrer Green case, same
        // convention used by every other Green award (e.g. addAtBatFromPurchase).
        let greenCardBack: ReturnType<typeof buildGreenCardBack> | null = null;
        if (cardEarnedType === "green") {
          greenCardBack = buildGreenCardBack({
            earner: ep,
            earnerEntryNo: cardEarnedEntryNo,
            earnerPosition: cardEarnedPosition ?? "firstBase",
            referred: { nickname: dugoutPlayer.playerName ?? null, email: dugoutPlayer.playerEmail ?? null, playerIdNo: null },
            referredPlayerId: dugoutPlayer.playerId,
            referredEntryNo: dugoutPlayer.entryNo ?? null,
            referredPosition: `atBat-${emptySlot}`,
            boardTrackingNo: (fresh as any).trackingNumber ?? null,
            issuedAt: now,
          });
        }

        // Build cardBack for Black/Brown cards (same shape as gold but stolenFrom=null)
        let blackBrownCardBack: ReturnType<typeof buildGoldCardBack> | null = null;
        if (cardEarnedType !== "gold" && cardEarnedType !== "green") {
          const earnerSlotKey = cardEarnedPosition ?? "";
          let earnerEntryNo: string | null = null;
          const bObj = (fresh as any).toObject?.() ?? fresh;
          if (earnerSlotKey === "secondBaseA") earnerEntryNo = bObj.secondBaseA?.entryNo ?? null;
          else if (earnerSlotKey === "secondBaseB") earnerEntryNo = bObj.secondBaseB?.entryNo ?? null;
          else if (earnerSlotKey === "thirdBase") earnerEntryNo = bObj.thirdBase?.entryNo ?? null;
          else if (earnerSlotKey === "homePlate") earnerEntryNo = bObj.homePlate?.entryNo ?? null;
          blackBrownCardBack = buildGoldCardBack({
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
            boardTrackingNo: (fresh as any).trackingNumber ?? null,
            issuedAt: now,
          });
        }
        const cardBackToSave = goldCardBack ?? greenCardBack ?? blackBrownCardBack;

        await Bat246SalesCredit.create({
          boardId: fresh._id,
          boardTrackingNumber: (fresh as any).trackingNumber ?? null,
          playerId: cardEarnedPlayerId,
          playerName: ep?.nickname ?? ep?.email ?? "",
          position: cardEarnedPosition,
          cardType: cardTypeCap,
          countsForLB: true,
          saleAmount: 0,
          earnedAt: now,
          referredUserId: dugoutPlayer.playerId,
          referredUserName: dugoutPlayer.playerName ?? null,
          ...(cardBackToSave ? { cardBack: cardBackToSave } : {}),
        });
      } catch (e: any) {
        console.error("[bat246Entry] card-history create failed:", e?.message ?? e);
      }
    }

    // Record the covering 1st Base's No Card, if this fill "stole" their slot.
    // Independent of the earner's own history block above — a NoCard event and
    // a positive card-earn event can both happen from the same slot fill.
    if (noCardPlayerId) {
      try {
        const stolenByPlayer = cardEarnedPlayerId
          ? await Bat246Player.findById(cardEarnedPlayerId).select("nickname email playerIdNo").lean() as any
          : null;
        const stolenFromPlayer = await Bat246Player.findById(noCardPlayerId).select("nickname email playerIdNo").lean() as any;
        await Bat246SalesCredit.create({
          boardId: fresh._id,
          boardTrackingNumber: (fresh as any).trackingNumber ?? null,
          playerId: noCardPlayerId,
          playerName: stolenFromPlayer?.nickname ?? stolenFromPlayer?.email ?? "",
          position: noCardPosition,
          cardType: "NoCard",
          countsForLB: false,
          saleAmount: 0,
          earnedAt: now,
          cardBack: buildNoCardCardBack({
            stolenBy: stolenByPlayer,
            stolenByEntryNo: cardEarnedEntryNo,
            stolenByPlayerId: cardEarnedPlayerId ?? null,
            stolenByPosition: cardEarnedPosition ?? "",
            cardEarned: cardEarnedType ? cardEarnedType.charAt(0).toUpperCase() + cardEarnedType.slice(1) : "None",
            stolenFrom: stolenFromPlayer,
            stolenFromEntryNo: noCardEntryNo,
            stolenFromPlayerId: noCardPlayerId,
            stolenFromPosition: noCardPosition,
            boardTrackingNo: (fresh as any).trackingNumber ?? null,
            issuedAt: now,
          }),
        });
      } catch (e: any) {
        console.error("[bat246Entry] NoCard history create failed:", e?.message ?? e);
      }
    }

    await Bat246PlayerBoard.updateOne(
      { playerId: dugoutPlayer.playerId, boardId: fresh._id },
      { $set: { position: `atBat.${emptySlot}` } }
    );
    transferAtBatPayment((fresh as any).homePlate?.playerId?.toString(), (fresh as any).homePlate?.podTeamId).catch((err) =>
      console.warn("[bat246Entry] AT BAT wallet transfer (dugout promo) failed:", err.message)
    );
    transferAtBatPaymentToThirdBase(
      (fresh as any).thirdBase?.playerId?.toString(),
      (fresh as any).thirdBase?.salesCredits,
      (fresh as any).thirdBase?.podTeamId
    ).catch((err) =>
      console.warn("[bat246Entry] AT BAT 3rd Base wallet transfer (dugout promo) failed:", err.message)
    );
    moved++;
  }

  // Check split trigger: all 8 AT BAT slots filled
  const refreshed = await Bat246Board.findById(boardId).lean() as any;
  const atBatFilled = (refreshed?.atBat ?? []).filter(Boolean).length;
  const splitTriggered = atBatFilled >= 8;

  if (splitTriggered && refreshed?.status === "active") {
    splitBoardPhase1(boardId).catch((err) =>
      console.error("[bat246Entry] promoteDugoutAfterPP split trigger failed:", err.message)
    );
  }

  return { moved, splitTriggered };
}

/**
 * Called when the Home Plate player shares their invite link.
 * Always routes the buyer to the Dugout — they wait for the Protection Period
 * to expire, then move to empty AT BAT slots via promoteDugoutAfterPP(),
 * which awards a Brown Card to Home Plate (not a Green Card to 1st Base).
 */
export async function addFromHomePlateInvite(params: {
  boardId: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  saleAmount?: number;
  countryResidence?: string;
  countryOrigin?: string;
}): Promise<{ boardId: string; atBatSlot: number; shouldSplit: boolean; placedInDugout: true }> {
  const { boardId, userId, userName, userEmail, saleAmount = 0, countryResidence, countryOrigin } = params;

  const board = await Bat246Board.findById(boardId);
  if (!board) throw new Error("Board not found");
  if ((board as any).status !== "active") throw new Error("Board is not open for new entries");

  const homePlateSlot: any = (board as any).homePlate;
  if (!homePlateSlot?.playerId) throw new Error("No Home Plate player on this board");

  const dugout = (board as any).dugout as (any | null)[];
  const dugoutFilled = dugout.filter(Boolean).length;
  if (dugoutFilled >= 8) throw new Error(`Dugout is full for board ${boardId}`);

  const player = await findOrCreatePlayer(userId, userName, userEmail);
  const now = new Date();
  const entryNo = String((player.minorLeague?.totalEntries ?? 0) + 1);

  const baseSlot = {
    playerId: player._id,
    entryNo,
    playerName: player.nickname || userEmail,
    playerEmail: userEmail,
    enteredAt: now,
    joinedBoardAt: now,
    referredBy: homePlateSlot.playerId,
    referredByName: homePlateSlot.playerName,
    countryResidence: countryResidence ?? null,
    countryOrigin: await resolveCountryOrigin(userId, countryOrigin, countryResidence),
  };

  // HP invites land in Dugout first; they move to AT BAT after PP ends,
  // at which point promoteDugoutAfterPP() awards the Brown Card to HP.
  await Bat246Board.updateOne({ _id: board._id }, { $push: { dugout: baseSlot } });
  await Bat246PlayerBoard.create({
    playerId: player._id,
    boardId: board._id,
    position: `dugout.${dugoutFilled}`,
    joinedAt: now,
    status: "active",
  });
  await Bat246Player.updateOne({ _id: player._id }, { $inc: { "minorLeague.totalEntries": 1 } });

  payLbAndCreditHp(boardId, saleAmount).catch((err) =>
    console.error("[bat246Entry] root HP credit failed:", err.message)
  );
  return { boardId, atBatSlot: -1, shouldSplit: false, placedInDugout: true };
}

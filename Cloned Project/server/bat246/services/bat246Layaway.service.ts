/**
 * bat246Layaway.service.ts
 *
 * B2 Coins — a new, not-yet-redeemable currency people who currently hold
 * certain board positions/status can hand out to any Garage + BAT246-office
 * member. See the approved plan (elegant-wiggling-scroll.md, "BAT246
 * Layaway → B2 Coins give/request system") for the full design.
 *
 * Five eligibility pools, each with its own cap. A person's total giving
 * allowance right now = the SUM of every pool they currently qualify for
 * (caps stack, confirmed explicitly by the user — NOT "take the highest").
 * "Already given" is tracked PER POOL, permanently (never refunds/resets
 * even if the qualifying condition is later lost) — computed by
 * aggregating bat246B2CoinTransaction.model.ts, never a second
 * separately-maintained running total (this session hit the "two fields
 * silently drift apart" bug twice already on unrelated features; not
 * repeating that here for a money-adjacent one).
 *
 * Concurrency note: unlike a design with a Mongo session/transaction, this
 * follows the SAME check-then-write pattern already used everywhere else
 * money moves in this subsystem (bat246Wallet.util.ts,
 * bat246LostMoneyAutoPay.service.ts — recompute balance, verify, then
 * write, no transaction wrapper). Introducing Mongo transactions here
 * would be new, untested infrastructure for this codebase (they require a
 * replica-set deployment, which local dev may not have) and inconsistent
 * with how every other real-money path in this file's neighborhood already
 * accepts the same small race window for a rare, manually-triggered,
 * high-value board-game action.
 */
import { Types } from "mongoose";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246LostMoneyPaid } from "../models/bat246LostMoneyPaid.model";
import { Bat246LostMoneyPayment } from "../models/bat246LostMoneyPayment.model";
import { Bat246B2CoinWallet } from "../models/bat246B2CoinWallet.model";
import { Bat246B2CoinTransaction } from "../models/bat246B2CoinTransaction.model";
import { Bat246B2CoinProductPurchase } from "../models/bat246B2CoinProductPurchase.model";
import { Bat246LayawayRequest } from "../models/bat246LayawayRequest.model";
import { Bat246PlacementNotification } from "../models/bat246PlacementNotifications.model";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";
import { escapeRegex } from "../../utils/userSearchClauses";
import { getInvoice, fulfillInvoice } from "../../services/invoice";
import { refuseIfNotPayable } from "../../services/invoicePayable";

const ALAN_K_EMAIL = "redbaron2020@mail.com";
export const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
// Exported for reuse by bat246SnapBackLoan.service.ts — SBL requests are
// restricted to these same two known entry products, same reasoning the
// product-targeted give/request already enforces.
export const BOARD_ENTRY_PRODUCT_ID = "6a159466cd9f94f7f23b2ef9"; // $650
export const POD_ENTRY_PRODUCT_ID = "6a7236f5e76fd9817e7238d9"; // $160
export const KNOWN_ENTRY_PRODUCT_IDS = [BOARD_ENTRY_PRODUCT_ID, POD_ENTRY_PRODUCT_ID];

const AUTO_PAY_ROUND_TARGET = 300; // mirrors bat246LostMoneyAutoPay.service.ts

// Active-lineup filter — identical to ACTIVE_LINEUP_FILTER in
// bat246LostMoney.routes.ts / the query in bat246LostMoneyAutoPay.service.ts.
const ACTIVE_LINEUP_FILTER = {
  fullyRepaid: { $ne: true },
  userId: { $ne: null },
  $or: [{ movedToLineupAt: { $exists: false } }, { movedToLineupAt: { $ne: null } }],
};

// "walletBalance" isn't a real eligibility pool — it's the received coins
// already sitting in the giver's own wallet (Bat246B2CoinWallet.balance).
// Included as a PoolKey so a wallet-sourced portion of a send can be
// recorded in a transaction's `breakdown` right alongside real pool
// sources, using the exact same shape — see giveB2Coins.
export type PoolKey = "homePlate" | "podLastSale" | "leaderboard" | "matchingBonus" | "lineup1" | "adminBypass" | "walletBalance";

// Largest-cap-first — the order a gift's amount is allocated across a
// giver's currently-qualifying pools. podLastSale requires homePlate to
// also be true (see below), so in practice it can never be the pool that
// actually absorbs any of a gift — homePlate (a strictly higher cap) will
// already have room first. Kept in the list anyway for eligibility
// transparency ("why am I eligible" reasons), just never load-bearing.
const POOL_ORDER: PoolKey[] = ["homePlate", "matchingBonus", "leaderboard", "lineup1", "podLastSale"];

const POOL_CAPS: Record<PoolKey, number> = {
  homePlate: 1600,
  podLastSale: 280,
  leaderboard: 300, // ceiling; the live cap for a given person may be lower (100/200) — see below
  matchingBonus: 400,
  lineup1: AUTO_PAY_ROUND_TARGET,
  adminBypass: Number.MAX_SAFE_INTEGER, // Alan K — never enforced (isAlanK short-circuits before any cap math), present only so this Record stays exhaustive
  walletBalance: Number.MAX_SAFE_INTEGER, // not pool-allocated (see allocateAcrossPools/POOL_ORDER, which never touch it) — present only so this Record stays exhaustive for PoolKey
};

interface QualifyingPool {
  pool: PoolKey;
  cap: number;
  detail: string;
}

export interface EligibilityPool {
  pool: PoolKey;
  cap: number;
  alreadyGiven: number;
  remaining: number;
  detail: string;
}

export interface EligibilityResult {
  eligible: boolean;
  isAlanK: boolean;
  totalCap: number;
  totalAlreadyGiven: number;
  totalRemaining: number;
  pools: EligibilityPool[];
}

/** All slot-array/singular position field names a player can occupy on a board. */
const SINGULAR_SLOT_PATHS = ["homePlate", "thirdBase", "secondBaseA", "secondBaseB"] as const;
const ARRAY_SLOT_PATHS = ["firstBase", "atBat", "dugout", "pod"] as const;

function occupantSlots(board: any, pid: string): any[] {
  const found: any[] = [];
  for (const p of SINGULAR_SLOT_PATHS) {
    const slot = board[p];
    if (slot?.playerId?.toString() === pid) found.push(slot);
  }
  for (const p of ARRAY_SLOT_PATHS) {
    for (const slot of board[p] ?? []) {
      if (slot?.playerId?.toString() === pid) found.push(slot);
    }
  }
  return found;
}

async function findPlayerBoards(pid: Types.ObjectId) {
  return Bat246Board.find({
    $or: [
      { "homePlate.playerId": pid },
      { "thirdBase.playerId": pid },
      { "secondBaseA.playerId": pid },
      { "secondBaseB.playerId": pid },
      { "firstBase.playerId": pid },
      { "atBat.playerId": pid },
      { "dugout.playerId": pid },
      { "pod.playerId": pid },
    ],
  }).lean();
}

/**
 * Runs all 5 eligibility checks live (never cached), returns the SUM of
 * every currently-qualifying pool's cap minus what's permanently been
 * given from each. Alan K bypasses everything — always eligible,
 * effectively uncapped — matching the universal admin override used
 * everywhere else in this subsystem (isBat246CardAdmin).
 */
export async function computeLayawayEligibility(userId: string): Promise<EligibilityResult> {
  const user = await User.findById(userId).select("email").lean() as any;
  const isAlanK = (user?.email || "").toLowerCase() === ALAN_K_EMAIL;

  if (isAlanK) {
    return {
      eligible: true,
      isAlanK: true,
      totalCap: Number.MAX_SAFE_INTEGER,
      totalAlreadyGiven: 0,
      totalRemaining: Number.MAX_SAFE_INTEGER,
      pools: [],
    };
  }

  const player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) }).select("_id trophies").lean() as any;

  const qualifying: QualifyingPool[] = [];

  if (player) {
    const pid = player._id as Types.ObjectId;
    const pidStr = pid.toString();

    const playerBoards = await findPlayerBoards(pid);
    const onHomePlate = playerBoards.some((b: any) => b.homePlate?.playerId?.toString() === pidStr);

    if (onHomePlate) {
      qualifying.push({ pool: "homePlate", cap: POOL_CAPS.homePlate, detail: "Currently seated at Home Plate" });

      const addedLastPodSale = playerBoards.some(
        (b: any) => b.podEarnerPlayerId?.toString() === pidStr
      );
      if (addedLastPodSale) {
        qualifying.push({ pool: "podLastSale", cap: POOL_CAPS.podLastSale, detail: "Added the last POD sale and currently on Home Plate" });
      }
    }

    // Leaderboard trophy — highest tier held, permanent flags.
    const trophies = player.trophies || {};
    if (trophies.G) qualifying.push({ pool: "leaderboard", cap: 300, detail: "Holds the Grand Slam trophy" });
    else if (trophies.H) qualifying.push({ pool: "leaderboard", cap: 200, detail: "Holds the Home Run trophy" });
    else if (trophies.T) qualifying.push({ pool: "leaderboard", cap: 100, detail: "Holds the Triple trophy" });

    // Matching Bonus: a direct personal recruit (referredBy === this
    // player) is currently the Home Plate occupant on some board, AND
    // this player holds a Gray Card on some slot they currently occupy.
    const recruitAtHomePlate = await Bat246Board.exists({ "homePlate.referredBy": pid });
    if (recruitAtHomePlate) {
      const holdsGrayCard = playerBoards.some((b: any) =>
        occupantSlots(b, pidStr).some((slot) => (slot.grayCards ?? 0) > 0 || (slot.grayCard160 ?? 0) > 0)
      );
      if (holdsGrayCard) {
        qualifying.push({ pool: "matchingBonus", cap: POOL_CAPS.matchingBonus, detail: "Personal recruit now at Home Plate, and you hold a Gray Card" });
      }
    }
  }

  // #1 in the Lostmoney "No Wait" lineup.
  const lineupPerson = await Bat246LostMoneyPaid.findOne(ACTIVE_LINEUP_FILTER).sort({ order: 1 }).select("userId").lean() as any;
  if (lineupPerson?.userId?.toString() === userId) {
    qualifying.push({ pool: "lineup1", cap: POOL_CAPS.lineup1, detail: "Currently #1 in the Lostmoney lineup" });
  }

  // Already given, per pool — aggregated from the immutable transaction log.
  const rows = await Bat246B2CoinTransaction.find({ fromUserId: new Types.ObjectId(userId) }).select("breakdown").lean();
  const alreadyGivenByPool: Record<string, number> = {};
  for (const row of rows) {
    for (const b of (row as any).breakdown ?? []) {
      alreadyGivenByPool[b.pool] = (alreadyGivenByPool[b.pool] ?? 0) + b.amount;
    }
  }

  const pools: EligibilityPool[] = qualifying.map((q) => {
    const alreadyGiven = alreadyGivenByPool[q.pool] ?? 0;
    return { pool: q.pool, cap: q.cap, alreadyGiven, remaining: Math.max(0, q.cap - alreadyGiven), detail: q.detail };
  });

  const totalCap = pools.reduce((sum, p) => sum + p.cap, 0);
  const totalAlreadyGiven = pools.reduce((sum, p) => sum + p.alreadyGiven, 0);
  const totalRemaining = pools.reduce((sum, p) => sum + p.remaining, 0);

  return { eligible: totalRemaining > 0, isAlanK: false, totalCap, totalAlreadyGiven, totalRemaining, pools };
}

/** Allocates `amount` across currently-qualifying pools, largest-cap-first. Throws if it doesn't fit. */
function allocateAcrossPools(amount: number, pools: EligibilityPool[]): { pool: PoolKey; amount: number }[] {
  const byPool = new Map(pools.map((p) => [p.pool, p]));
  const breakdown: { pool: PoolKey; amount: number }[] = [];
  let remainingToAllocate = amount;

  for (const key of POOL_ORDER) {
    if (remainingToAllocate <= 0) break;
    const p = byPool.get(key);
    if (!p || p.remaining <= 0) continue;
    const take = Math.min(p.remaining, remainingToAllocate);
    breakdown.push({ pool: key, amount: take });
    remainingToAllocate -= take;
  }

  if (remainingToAllocate > 0.004) {
    throw new Error("Amount exceeds your current remaining B2 Coins allowance");
  }
  return breakdown;
}

// Exported for reuse by bat246SnapBackLoan.service.ts — an SBL amount is
// always server-derived the same way a product-targeted give/request
// already is.
export async function resolveGivenAmountForProduct(productId: string | undefined, requestedAmount: number | undefined): Promise<{ amount: number; productId: string | null }> {
  if (!productId) {
    const amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("A positive amount is required");
    return { amount: Math.round(amount * 100) / 100, productId: null };
  }
  if (!KNOWN_ENTRY_PRODUCT_IDS.includes(productId)) {
    throw new Error("Unrecognized product — only the $650 Board Entry or $160 POD Entry can be given via B2 Coins");
  }
  // Amount is ALWAYS server-derived from the real product price when a
  // productId is given — a client-sent amount alongside it is ignored.
  const product = await Product.findById(productId).select("price").lean() as any;
  if (!product) throw new Error("Product not found");
  return { amount: Number(product.price), productId };
}

// Exported for reuse by bat246SnapBackLoan.service.ts (referring a
// friend/contact to an eligible lender needs the same "recipient must be
// a real office member, not yourself" guard).
export async function verifyRecipientIsOfficeMember(recipientUserId: string, giverUserId: string) {
  if (recipientUserId === giverUserId) throw new Error("You can't give B2 Coins to yourself");
  const recipient = await User.findById(recipientUserId).select("organizations").lean() as any;
  if (!recipient) throw new Error("Recipient not found");
  const isOfficeMember = (recipient.organizations ?? []).some(
    (o: any) => o.organization?.toString() === BAT246_ORG_ID
  );
  if (!isOfficeMember) throw new Error("Recipient must be a current Garage + BAT246-office member");
}

async function creditB2CoinWallet(userId: string, amount: number) {
  let wallet = await Bat246B2CoinWallet.findOne({ userId });
  if (!wallet) wallet = await Bat246B2CoinWallet.create({ userId, balance: 0 });
  wallet.balance += amount;
  wallet.lastTransactionAt = new Date();
  await wallet.save();
}

/** Read-only current balance — 0 for a user with no wallet doc yet (never received anything).
 *  Exported for reuse by bat246SnapBackLoan.service.ts. */
export async function getWalletBalance(userId: string): Promise<number> {
  const wallet = await Bat246B2CoinWallet.findOne({ userId }).select("balance").lean() as any;
  return wallet?.balance ?? 0;
}

/**
 * Debits received coins the giver is passing along. Clamped at 0 rather
 * than allowed to go negative — same accepted check-then-write race this
 * whole file already lives with (see the file-header concurrency note);
 * the clamp just means a very unlucky concurrent double-send loses at the
 * wallet floor instead of producing a negative balance.
 */
async function debitB2CoinWallet(userId: string, amount: number) {
  let wallet = await Bat246B2CoinWallet.findOne({ userId });
  if (!wallet) wallet = await Bat246B2CoinWallet.create({ userId, balance: 0 });
  wallet.balance = Math.max(0, Math.round((wallet.balance - amount) * 100) / 100);
  wallet.lastTransactionAt = new Date();
  await wallet.save();
}

/**
 * The Lineup-#1 pool isn't free money — it's the person diverting their
 * own real Lostmoney auto-pay round into coins instead of cash. Hooks
 * directly into the same round mechanics bat246LostMoneyAutoPay.service.ts
 * already uses: bumps roundAccumulated, and finalizes exactly like a real
 * completed round (totalPaid, order → end of lineup, a
 * Bat246LostMoneyPayment row) when the round target is reached. No real
 * money moves for this portion — runLostMoneyAutoPay already pays LESS
 * real cash automatically once roundAccumulated is partly filled, so
 * nothing in that file needs to change.
 */
async function applyLineup1Give(userId: string, amountFromLineup1Pool: number) {
  if (amountFromLineup1Pool <= 0) return;
  const person = await Bat246LostMoneyPaid.findOne({
    userId: new Types.ObjectId(userId),
    fullyRepaid: { $ne: true },
    $or: [{ movedToLineupAt: { $exists: false } }, { movedToLineupAt: { $ne: null } }],
  });
  if (!person) return; // shouldn't happen if eligibility was just computed correctly — non-fatal no-op

  const roundTarget = Math.min(AUTO_PAY_ROUND_TARGET, person.approvedAmount - person.totalPaid);
  person.roundAccumulated = Math.round((person.roundAccumulated + amountFromLineup1Pool) * 100) / 100;

  if (person.roundAccumulated >= roundTarget - 0.004) {
    person.totalPaid = Math.round((person.totalPaid + roundTarget) * 100) / 100;
    person.lastPaymentAmount = roundTarget;
    person.lastPaymentAt = new Date();
    person.roundAccumulated = 0;
    if (person.totalPaid >= person.approvedAmount) person.fullyRepaid = true;

    const highest = await Bat246LostMoneyPaid.findOne().sort({ order: -1 }).select("order").lean() as any;
    person.order = (highest?.order ?? 0) + 1; // → end of the line, same as a real completed round

    await person.save();
    await Bat246LostMoneyPayment.create({
      paidEntryId: person._id,
      amount: roundTarget,
      recordedByEmail: "system",
      note: "Round completed via B2 Coins layaway (no cash moved)",
      source: "layaway",
    });
  } else {
    await person.save();
  }
}

export interface GiveResult {
  eligibility: EligibilityResult;
  amount: number;
  breakdown: { pool: PoolKey; amount: number }[];
}

export async function giveB2Coins(params: {
  fromUserId: string;
  recipientUserId: string;
  amount?: number;
  productId?: string;
  requestId?: string;
}): Promise<GiveResult> {
  const { fromUserId, recipientUserId } = params;
  const { amount, productId } = await resolveGivenAmountForProduct(params.productId, params.amount);

  await verifyRecipientIsOfficeMember(recipientUserId, fromUserId);

  const eligibility = await computeLayawayEligibility(fromUserId);
  // What someone can actually send is bigger than just their pool-based
  // giving power: coins already sitting in their own wallet (received from
  // someone else's earlier give) are real and sendable too, independent of
  // whether they currently qualify for any pool. Alan never needs his own
  // balance — he stays uncapped exactly as before, no debit at all.
  const walletBalance = eligibility.isAlanK ? 0 : await getWalletBalance(fromUserId);
  const maxSendable = eligibility.isAlanK
    ? Number.MAX_SAFE_INTEGER
    : walletBalance + eligibility.totalRemaining;

  if (!eligibility.isAlanK && amount > maxSendable + 0.004) {
    throw new Error(
      `Amount exceeds what you have available to send ($${maxSendable.toFixed(2)} = ` +
        `$${walletBalance.toFixed(2)} from your balance + $${eligibility.totalRemaining.toFixed(2)} giving power)`
    );
  }

  // Wallet balance first — a plain debit with no other side effects — and
  // only reach into the pool-based giving power (which can trigger the
  // Lineup-#1 real-money hook below) for whatever the balance doesn't
  // cover. Keeps every existing pool-allocation/Lineup-1 code path exactly
  // as it was, just fed a possibly-smaller amount.
  const fromWallet = eligibility.isAlanK ? 0 : Math.min(amount, walletBalance);
  const fromPools = Math.round((amount - fromWallet) * 100) / 100;

  const poolBreakdown = eligibility.isAlanK
    ? [{ pool: "adminBypass" as PoolKey, amount }] // Alan K — uncapped, not drawn from any real pool
    : fromPools > 0
      ? allocateAcrossPools(fromPools, eligibility.pools)
      : [];

  const breakdown = fromWallet > 0
    ? [{ pool: "walletBalance" as PoolKey, amount: fromWallet }, ...poolBreakdown]
    : poolBreakdown;

  await Bat246B2CoinTransaction.create({
    fromUserId: new Types.ObjectId(fromUserId),
    toUserId: new Types.ObjectId(recipientUserId),
    amount,
    productId: productId ? new Types.ObjectId(productId) : null,
    breakdown,
    requestId: params.requestId ? new Types.ObjectId(params.requestId) : null,
  });

  if (fromWallet > 0) await debitB2CoinWallet(fromUserId, fromWallet);
  await creditB2CoinWallet(recipientUserId, amount);

  const lineup1Amount = poolBreakdown.find((b) => b.pool === "lineup1")?.amount ?? 0;
  if (lineup1Amount > 0) {
    await applyLineup1Give(fromUserId, lineup1Amount);
  }

  const eligibilityAfter = await computeLayawayEligibility(fromUserId);
  return { eligibility: eligibilityAfter, amount, breakdown };
}

export async function createLayawayRequest(params: {
  requestedByUserId: string;
  eligibleUserId: string;
  recipientUserId: string;
  amount?: number;
  productId?: string;
  note?: string;
}) {
  const { amount, productId } = await resolveGivenAmountForProduct(params.productId, params.amount);
  await verifyRecipientIsOfficeMember(params.recipientUserId, params.eligibleUserId);

  const request = await Bat246LayawayRequest.create({
    requestedByUserId: new Types.ObjectId(params.requestedByUserId),
    eligibleUserId: new Types.ObjectId(params.eligibleUserId),
    recipientUserId: new Types.ObjectId(params.recipientUserId),
    amount,
    productId: productId ? new Types.ObjectId(productId) : null,
    note: params.note?.trim() || "",
  });

  const [requester, recipient, product] = await Promise.all([
    User.findById(params.requestedByUserId).select("name email").lean() as any,
    User.findById(params.recipientUserId).select("name email").lean() as any,
    productId ? (Product.findById(productId).select("name").lean() as any) : null,
  ]);

  const amountLabel = product ? `${product.name} ($${amount.toFixed(2)})` : `$${amount.toFixed(2)}`;
  const recipientLabel = recipient?.name || recipient?.email || "someone";
  const summary = `${requester?.name || requester?.email || "Someone"} is asking you to give ${amountLabel} to ${recipientLabel}`;

  await Bat246PlacementNotification.create({
    notificationType: "layaway_request",
    qualifiedUserId: new Types.ObjectId(params.requestedByUserId),
    qualifiedUserEmail: requester?.email || "",
    qualifiedUserName: requester?.name || "",
    uplineUserId: new Types.ObjectId(params.eligibleUserId),
    layawayRequestId: request._id,
    summary,
  });

  try {
    const { sendMail, EMAIL_FROM_NOTIFICATION, bat246LayawayRequestEmailTemplate } = await import("../../services/mailer");
    const eligibleUser = await User.findById(params.eligibleUserId).select("name email").lean() as any;
    if (eligibleUser?.email) {
      const template = bat246LayawayRequestEmailTemplate({
        eligibleName: eligibleUser.name,
        requesterName: requester?.name || requester?.email || "A fellow distributor",
        recipientName: recipientLabel,
        amountLabel,
        note: params.note?.trim(),
      });
      await sendMail(eligibleUser.email, template.subject, template.html, template.text, EMAIL_FROM_NOTIFICATION);
    }
  } catch (err: any) {
    // Never let an email failure block the request itself.
    console.error("[bat246-layaway] request email failed:", err?.message);
  }

  return request;
}

/**
 * `$or` alternatives for "find a person by what was typed", forgiving of how
 * people really type a name: a stray or missing space ("red baron" must find
 * redbaron2020@mail.com, "redbaron" must find the name "Red Baron"), word
 * order ("baron red") and commas. The plain substring stays as the first
 * alternative, so anything that matched before still does.
 */
function personSearchClauses(q: string): any[] {
  if (!q) return [];
  const plain = new RegExp(escapeRegex(q), "i");
  const clauses: any[] = [{ name: plain }, { email: plain }];

  // Whitespace-insensitive in both directions: ignore spaces in the term and
  // allow optional whitespace between its characters in the stored value.
  const compact = q.replace(/\s+/g, "");
  if (compact.length >= 2) {
    const loose = new RegExp(compact.split("").map(escapeRegex).join("\\s*"), "i");
    clauses.push({ name: loose }, { email: loose });
  }

  // Every word must appear somewhere in the name or the email, in any order.
  const words = q.split(/[\s,;]+/).filter(Boolean).slice(0, 5);
  if (words.length > 1) {
    clauses.push({
      $and: words.map((w) => {
        const rx = new RegExp(escapeRegex(w), "i");
        return { $or: [{ name: rx }, { email: rx }] };
      }),
    });
  }
  return clauses;
}

/** Best matches first (exact, then starts-with, then contains), ignoring spaces and case. */
function rankByMatch(rows: any[], q: string): any[] {
  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const nq = squash(q);
  const score = (u: any) => {
    const fields = [squash(u.name || ""), squash(u.email || "")];
    if (fields.some((f) => f === nq)) return 0;
    if (fields.some((f) => f.startsWith(nq))) return 1;
    if (fields.some((f) => f.includes(nq))) return 2;
    return 3;
  };
  return rows
    .map((u, i) => ({ u, i, s: score(u) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.u);
}

/**
 * Search a person to give/request B2 Coins for — "any Garage + BAT246
 * office member" per the plan (broader than searchGarageUsers in
 * bat246Admin.service.ts, which only returns QUALIFIED distributors — a
 * recipient doesn't need to be qualified, just a member of the office).
 */
export async function searchBat246OfficeUsers(query: string, limit = 20) {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 80);
  const filter: any = { organizations: { $elemMatch: { organization: new Types.ObjectId(BAT246_ORG_ID) } } };
  const clauses = personSearchClauses(q);
  if (clauses.length) filter.$or = clauses;
  // Over-fetch when searching so the ranking below — not natural collection
  // order — decides which `limit` people survive a broad term.
  const rows = (await User.find(filter)
    .select("_id name email profilePicture")
    .limit(q ? limit * 3 : limit)
    .lean()) as any[];
  const users = q ? rankByMatch(rows, q).slice(0, limit) : rows;
  return users.map((u: any) => ({
    userId: u._id.toString(),
    name: u.name || u.email,
    email: u.email,
    profilePicture: u.profilePicture ?? null,
  }));
}

/**
 * For the "request" flow's picker: who can actually fulfill a request right
 * now — matching a search term. `eligibility.totalRemaining` here is
 * DELIBERATELY overwritten to mean the same combined "sendable" total
 * giveB2Coins itself checks (wallet balance + pool giving power), not the
 * pool-only figure `computeLayawayEligibility` returns on its own — someone
 * with a wallet balance but no qualifying pool can still fulfill a request,
 * same as they can now Send directly. Kept under the same field name/shape
 * the frontend search dropdown already reads (LayawayUserSearch.tsx) so no
 * frontend change was needed; `/my-eligibility` (the Giving Power card) is
 * untouched and still reports the pool-only figure — the two are
 * intentionally different numbers for different purposes.
 */
export async function searchEligiblePeople(query: string, limit = 20) {
  const candidates = await searchBat246OfficeUsers(query, limit);
  const withSendable = await Promise.all(
    candidates.map(async (c) => {
      const eligibility = await computeLayawayEligibility(c.userId);
      const balance = eligibility.isAlanK ? 0 : await getWalletBalance(c.userId);
      const totalRemaining = eligibility.isAlanK ? eligibility.totalRemaining : eligibility.totalRemaining + balance;
      return { ...c, eligibility: { ...eligibility, totalRemaining } };
    })
  );
  return withSendable.filter((c) => c.eligibility.totalRemaining > 0);
}

// Display-only labels for the two known giftable products — the wallet
// history never trusts/queries Product.name (this codebase has hit real
// drift between a product's `.name` and `.description` before); the set of
// possible productIds here is already hard-limited to these two by
// resolveGivenAmountForProduct, so a small static map is both simpler and
// safer than a live lookup.
const PRODUCT_LABELS: Record<string, string> = {
  [BOARD_ENTRY_PRODUCT_ID]: "$650 Board Entry",
  [POD_ENTRY_PRODUCT_ID]: "$160 POD Entry",
};

export interface WalletTransactionView {
  id: string;
  amount: number;
  // "received" — someone gave TO this user (counterparty = giver).
  // "sent" — this user gave TO someone else (counterparty = recipient).
  // A heavy giver (Alan, or anyone using Transact to send) otherwise never
  // shows up in their own history at all — this was the actual bug: admin
  // almost never receives, so his "Recent Transaction" list read as
  // permanently empty despite him actively giving out coins constantly.
  direction: "received" | "sent";
  counterpartyName: string;
  counterpartyEmail: string;
  productLabel: string | null;
  viaRequest: boolean;
  createdAt: Date;
}

export interface WalletResult {
  balance: number;
  transactions: WalletTransactionView[];
}

/**
 * This user's own B2 Coins activity — real balance credited by others'
 * gives, plus a merged history of coins both received AND sent (see
 * WalletTransactionView.direction). Deliberately separate from
 * computeLayawayEligibility(), which is the GIVING side (what this person
 * CAN hand out, i.e. remaining allowance) — this is the ledger of what
 * has actually moved, aggregated the same immutable-transaction-log way
 * as everything else in this file (never a second running total that
 * could drift).
 */
export async function getMyB2CoinWallet(userId: string, limit = 500): Promise<WalletResult> {
  const uid = new Types.ObjectId(userId);
  const [wallet, receivedRows, sentRows] = await Promise.all([
    Bat246B2CoinWallet.findOne({ userId: uid }).select("balance").lean() as any,
    Bat246B2CoinTransaction.find({ toUserId: uid }).sort({ createdAt: -1 }).limit(limit).lean(),
    Bat246B2CoinTransaction.find({ fromUserId: uid }).sort({ createdAt: -1 }).limit(limit).lean(),
  ]);

  const otherUserIds = Array.from(
    new Set([
      ...(receivedRows as any[]).map((t) => t.fromUserId.toString()),
      ...(sentRows as any[]).map((t) => t.toUserId.toString()),
    ])
  );
  const others = otherUserIds.length
    ? await User.find({ _id: { $in: otherUserIds } }).select("name email").lean()
    : [];
  const otherById = new Map((others as any[]).map((u) => [u._id.toString(), u]));

  const toView = (t: any, direction: "received" | "sent"): WalletTransactionView => {
    const otherId = direction === "received" ? t.fromUserId.toString() : t.toUserId.toString();
    const other = otherById.get(otherId);
    return {
      id: t._id.toString(),
      amount: t.amount,
      direction,
      counterpartyName: other?.name || other?.email || "Someone",
      counterpartyEmail: other?.email || "",
      productLabel: t.productId ? (PRODUCT_LABELS[t.productId.toString()] ?? "a product") : null,
      viaRequest: !!t.requestId,
      createdAt: t.createdAt,
    };
  };

  const transactions = [
    ...(receivedRows as any[]).map((t) => toView(t, "received")),
    ...(sentRows as any[]).map((t) => toView(t, "sent")),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    // Each side was independently capped at `limit` before merging — cap
    // the combined, sorted list back down to `limit` too.
    .slice(0, limit);

  return { balance: wallet?.balance ?? 0, transactions };
}

export async function respondToLayawayRequest(
  requestId: string,
  responderUserId: string,
  approve: boolean,
  overrideAmount?: number
) {
  const request = await Bat246LayawayRequest.findById(requestId);
  if (!request) throw new Error("Request not found");
  if (request.eligibleUserId.toString() !== responderUserId) throw new Error("Not authorized to respond to this request");
  if (request.status !== "pending") throw new Error("This request has already been responded to");

  if (!approve) {
    request.status = "denied";
    request.respondedAt = new Date();
    await request.save();
    return { status: "denied" as const };
  }

  // The responder can adjust the amount before actually sending — give
  // more or less than what was originally asked. Only for a plain-amount
  // request, though: a product-targeted request's amount is always the
  // real product price (resolveGivenAmountForProduct), never something a
  // client value should override, same reasoning a direct product give
  // already follows in giveB2Coins.
  const amountToGive =
    !request.productId && typeof overrideAmount === "number" && overrideAmount > 0
      ? Math.round(overrideAmount * 100) / 100
      : request.amount;

  try {
    const result = await giveB2Coins({
      fromUserId: responderUserId,
      recipientUserId: request.recipientUserId.toString(),
      amount: amountToGive,
      productId: request.productId?.toString(),
      requestId: request._id.toString(),
    });
    request.status = "approved";
    request.respondedAt = new Date();
    // Keep the request record matching what was actually sent — a lesson
    // this codebase has already paid for twice (two numbers meant to
    // agree silently drifting apart). If the responder adjusted the
    // amount, this IS the real amount now, not the original ask.
    if (amountToGive !== request.amount) request.amount = amountToGive;
    await request.save();
    return { status: "approved" as const, ...result };
  } catch (err: any) {
    request.status = "insufficient_at_approval";
    request.respondedAt = new Date();
    await request.save();
    throw new Error(err.message || "Your remaining allowance no longer covers this request");
  }
}

/** The requester backing out of their own still-pending request. */
export async function cancelLayawayRequest(requestId: string, requesterUserId: string) {
  const request = await Bat246LayawayRequest.findById(requestId);
  if (!request) throw new Error("Request not found");
  if (request.requestedByUserId.toString() !== requesterUserId) throw new Error("Not authorized to cancel this request");
  if (request.status !== "pending") throw new Error("This request is no longer pending");
  request.status = "cancelled";
  request.respondedAt = new Date();
  await request.save();
  return { status: "cancelled" as const };
}

export interface LayawayRequestView {
  id: string;
  amount: number;
  productLabel: string | null;
  note: string;
  status: "pending" | "approved" | "denied" | "insufficient_at_approval" | "cancelled";
  createdAt: Date;
  respondedAt: Date | null;
  recipientName: string;
  recipientEmail: string;
  /** The person being asked to give (set on getMyLayawayRequests — "who you asked"). */
  eligibleName?: string;
  eligibleEmail?: string;
  /** The person who asked (set on getLayawayRequestsForMe — "who's asking you"). */
  requesterName?: string;
  requesterEmail?: string;
}

async function namesFor(userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
  const ids = Array.from(new Set(userIds));
  const users = ids.length ? await User.find({ _id: { $in: ids } }).select("name email").lean() : [];
  return new Map((users as any[]).map((u) => [u._id.toString(), { name: u.name || u.email, email: u.email }]));
}

/**
 * Requests THIS user sent — how they track status (pending/approved/
 * denied/insufficient-at-approval/cancelled) on something they asked an
 * eligible person (or Alan) to give on their behalf, and the list a
 * "Cancel" action operates on while a row is still pending.
 */
export async function getMyLayawayRequests(userId: string, limit = 100): Promise<LayawayRequestView[]> {
  const rows = await Bat246LayawayRequest.find({ requestedByUserId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const others = await namesFor([
    ...(rows as any[]).map((r) => r.eligibleUserId.toString()),
    ...(rows as any[]).map((r) => r.recipientUserId.toString()),
  ]);

  return (rows as any[]).map((r) => {
    const eligible = others.get(r.eligibleUserId.toString());
    const recipient = others.get(r.recipientUserId.toString());
    return {
      id: r._id.toString(),
      amount: r.amount,
      productLabel: r.productId ? (PRODUCT_LABELS[r.productId.toString()] ?? "a product") : null,
      note: r.note || "",
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt ?? null,
      recipientName: recipient?.name || "Someone",
      recipientEmail: recipient?.email || "",
      eligibleName: eligible?.name || "Someone",
      eligibleEmail: eligible?.email || "",
    };
  });
}

/**
 * Requests waiting on (or previously answered by) THIS user as the
 * eligible person being asked — what "approve/deny" and the request
 * history operate on. Includes every status, not just pending, so this
 * user can see what they've already approved/denied, not only what's
 * still outstanding.
 */
export async function getLayawayRequestsForMe(userId: string, limit = 100): Promise<LayawayRequestView[]> {
  const rows = await Bat246LayawayRequest.find({ eligibleUserId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const others = await namesFor([
    ...(rows as any[]).map((r) => r.requestedByUserId.toString()),
    ...(rows as any[]).map((r) => r.recipientUserId.toString()),
  ]);

  return (rows as any[]).map((r) => {
    const requester = others.get(r.requestedByUserId.toString());
    const recipient = others.get(r.recipientUserId.toString());
    return {
      id: r._id.toString(),
      amount: r.amount,
      productLabel: r.productId ? (PRODUCT_LABELS[r.productId.toString()] ?? "a product") : null,
      note: r.note || "",
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt ?? null,
      recipientName: recipient?.name || "Someone",
      recipientEmail: recipient?.email || "",
      requesterName: requester?.name || "Someone",
      requesterEmail: requester?.email || "",
    };
  });
}

export interface PayEntryWithB2CoinsResult {
  invoiceId: string;
  amount: number;
  balanceAfter: number;
}

/**
 * Pay the $650 Board Entry / $160 POD Entry invoice with the buyer's own
 * received B2 Coins balance instead of Razorpay/a real wallet. Structural
 * copy of POST /api/invoices/:invoiceId/pay-with-wallet
 * (src/routes/invoice.ts): verify ownership + payable status, debit, mark
 * the invoice paid, then call the exact same fulfillInvoice() every other
 * payment path already calls — board placement, the
 * hasPurchasedProduct/isQualified flip, and "becomes a distributor" (via
 * assignDistributorId/maybeCreatePlacementNotification inside
 * fulfillInvoice's "product" case) all fall out for free, zero
 * bat246-specific duplication needed here.
 *
 * Spends only the wallet BALANCE (coins this person has received) — never
 * their giving-power/eligibility pools, which is an unrelated concept
 * (capacity to hand coins to OTHER people, not to spend on yourself).
 *
 * Deliberately leaves invoice.paymentMethodCategory/paymentPlatform unset
 * rather than mirroring pay-with-wallet's exact field values — both are
 * closed Mongoose enums (["card","upi","crypto","wallet"] /
 * ["razorpay","stripe",...,"store_wallet","affiliate_wallet",...]) with no
 * value that honestly means "B2 Coins", and mislabeling this as e.g.
 * "store_wallet" would misattribute it in any future reporting that reads
 * those fields. Both are optional on the schema (already legitimately
 * unset for the free-price checkout branch), so leaving them unset here is
 * a already-handled, safe state. `metadata.paidWithB2Coins` plus the new
 * Bat246B2CoinProductPurchase row are the real source of truth for "how
 * was this paid."
 */
export async function payEntryProductWithB2Coins(
  invoiceId: string,
  userId: string
): Promise<PayEntryWithB2CoinsResult> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    const err: any = new Error("Invoice not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (invoice.userId?.toString() !== userId) {
    const err: any = new Error("This invoice belongs to another user");
    err.code = "FORBIDDEN";
    throw err;
  }

  if (!["draft", "pending"].includes(invoice.status)) {
    const err: any = new Error(`Invoice cannot be paid (current status: ${invoice.status})`);
    err.code = "NOT_PAYABLE";
    throw err;
  }

  const refusal = await refuseIfNotPayable(invoice);
  if (refusal) {
    const err: any = new Error(refusal.error);
    err.code = refusal.code;
    throw err;
  }

  // Product safeguard — this endpoint can only ever settle one of the two
  // known BAT246 entry invoices, never an arbitrary one.
  const productId = invoice.lineItems?.[0]?.itemId?.toString();
  if (!productId || !KNOWN_ENTRY_PRODUCT_IDS.includes(productId)) {
    const err: any = new Error(
      "Only the $650 Board Entry or $160 POD Entry can be paid with B2 Coins"
    );
    err.code = "WRONG_PRODUCT";
    throw err;
  }

  // The invoice's own authoritative total (already server-derived,
  // GST-exempt, from process-checkout) — never re-derived from
  // Product.price a second time, so it can never disagree with what the
  // buyer was actually quoted.
  const amount = (invoice.totalAmount ?? 0) / 100;

  const balance = await getWalletBalance(userId);
  if (balance < amount) {
    const err: any = new Error(
      "Not enough B2 Coins — please request more from the B2 Coin Wallet."
    );
    err.code = "INSUFFICIENT_BALANCE";
    throw err;
  }

  await debitB2CoinWallet(userId, amount);

  invoice.status = "paid";
  invoice.paidAt = new Date();
  invoice.metadata = {
    ...(invoice.metadata || {}),
    paidWithB2Coins: true,
    b2CoinsAmount: amount,
  };
  await invoice.save();

  try {
    await fulfillInvoice(invoice as any, `b2coins_${invoice._id}`);
  } catch (fulfillErr: any) {
    console.error(
      `[bat246] B2 Coins fulfillment error for invoice ${invoice.invoiceNumber}:`,
      fulfillErr
    );
    // Payment already succeeded (wallet debited, invoice paid) even if
    // fulfillment has an issue — same non-fatal handling pay-with-wallet
    // and every other payment-completion route in this app already uses.
  }

  try {
    await Bat246B2CoinProductPurchase.create({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
      productLabel: productId === BOARD_ENTRY_PRODUCT_ID ? "board" : "pod",
      amount,
      invoiceId: invoice._id,
    });
  } catch (trackErr: any) {
    // Best-effort — the purchase itself already succeeded above.
    console.error("[bat246] Bat246B2CoinProductPurchase record failed:", trackErr.message);
  }

  const balanceAfter = await getWalletBalance(userId);
  return { invoiceId: invoice._id.toString(), amount, balanceAfter };
}

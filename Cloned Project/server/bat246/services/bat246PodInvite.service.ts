import { Types, ClientSession } from "mongoose";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { Bat246PodInvite } from "../models/bat246PodInvites.model";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { createBat246Player } from "./bat246PlayerId.util";
import { pickCountryOrigin } from "./bat246Country.util";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";
import { sendMail, EMAIL_FROM_NOTIFICATION, podInviteEmailTemplate } from "../../services/mailer";
import { runLostMoneyAutoPay } from "./bat246LostMoneyAutoPay.service";

// Board positions a player can occupy — mirrors SLOT_EMAIL_PATHS in
// bat246.service.ts (dugout/onDeckCircle included, same "part of this
// board" definition used by the existing My Boards list).
const POD_MEMBER_PLAYER_ID_PATHS = [
  "homePlate.playerId", "thirdBase.playerId", "secondBaseA.playerId", "secondBaseB.playerId",
  "firstBase.playerId", "atBat.playerId", "dugout.playerId", "onDeckCircle.playerId", "pod.playerId",
] as const;

// The $160 "POD" digital product — purchasing it is what flips a distributor's
// POD status from "Remind" to "Ready to place on board".
export const POD_PRODUCT_ID = "6a7236f5e76fd9817e7238d9";
export const POD_PRODUCT_URL = `https://www.garage.app/digital/product/${POD_PRODUCT_ID}?ref=aff_ukjqb4wy`;

const ALAN_K_EMAIL = "redbaron2020@mail.com";

// Admin (Alan K) can invite/place on any board or POD cycle regardless of
// whether he personally occupies a position anywhere — unlike every other
// caller, who can only act on boards they're actually part of. Checked by
// email rather than a role flag since that's how every other admin gate in
// this codebase (routes/controllers) already identifies Alan K.
export async function isAdminCaller(callerUserId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(callerUserId)) return false;
  const user = await User.findById(callerUserId).select("email").lean() as any;
  return (user?.email || "").toLowerCase() === ALAN_K_EMAIL;
}

/**
 * Whether the caller currently occupies any position (fixed or
 * dugout/onDeckCircle) on any "active"-status board. Gate for both POD
 * grid columns — a viewer who isn't part of any active board can't send
 * invites or place anyone (there'd be nowhere for them to place into).
 * Admin (Alan K) always passes — see isAdminCaller.
 */
export async function isPartOfAnyActiveBoard(callerUserId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(callerUserId)) return false;
  if (await isAdminCaller(callerUserId)) return true;
  const player = await Bat246Player.findOne({ userId: new Types.ObjectId(callerUserId) }).select("_id").lean() as any;
  if (!player) return false;
  const board = await Bat246Board.findOne({
    status: "active",
    $or: POD_MEMBER_PLAYER_ID_PATHS.map((path) => ({ [path]: player._id })),
  }).select("_id").lean();
  return !!board;
}

/**
 * Sends (or resends) the POD invite email to a qualified distributor.
 * Every click — first invite or any later "Remind" — sends a real email,
 * no cooldown; double-clicks are guarded client-side by disabling the
 * button while a send is in flight.
 * First-touch attribution: podInvitedByUserId is set only on the very first
 * send and never overwritten by later reminders (from the same or a
 * different caller) — every send still gets its own bat246PodInvites row.
 */
export async function sendPodInvite(targetUserId: string, callerUserId: string) {
  if (!Types.ObjectId.isValid(targetUserId)) throw new Error("Invalid userId");
  if (!(await isPartOfAnyActiveBoard(callerUserId))) {
    throw new Error("You must be part of an active board to send POD invites");
  }

  const [dist, targetUser, callerUser] = await Promise.all([
    Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) }),
    User.findById(targetUserId).select("name email").lean() as any,
    User.findById(callerUserId).select("name email").lean() as any,
  ]);

  if (!dist) throw new Error("Distributor not found");
  const targetEmail = targetUser?.email || "";
  if (!targetEmail) throw new Error("This distributor has no email on file");
  if (dist.podPurchaseCompletedAt) throw new Error("This distributor has already purchased POD");

  const product = await Product.findById(POD_PRODUCT_ID).select("name price currency").lean() as any;
  const isFirstSend = !dist.podInviteSentAt;
  const callerName = callerUser?.name || callerUser?.email || "A member";
  const callerEmail = callerUser?.email || "";

  const template = podInviteEmailTemplate({
    recipientName: targetUser?.name || undefined,
    productName: product?.name || "POD",
    // Product.price is stored in whole currency units (e.g. 160 = $160), not
    // cents — see productCheckout.ts's `listedAmountMinor: price * 100` for
    // the same convention. Do NOT divide by 100 here.
    priceLabel: product ? `${product.currency || "USD"} ${Number(product.price).toFixed(2)}` : "$160",
    productUrl: POD_PRODUCT_URL,
  });
  await sendMail(targetEmail, template.subject, template.html, template.text, EMAIL_FROM_NOTIFICATION);

  // Log this send — every call, always.
  await Bat246PodInvite.create({
    targetUserId: new Types.ObjectId(targetUserId),
    targetEmail,
    invitedByUserId: new Types.ObjectId(callerUserId),
    invitedByEmail: callerEmail,
    invitedByName: callerName,
    productId: new Types.ObjectId(POD_PRODUCT_ID),
    type: isFirstSend ? "invite" : "remind",
  });

  // First-touch lock-in — only set inviter fields if this is the first send.
  const update: any = { podInviteSentAt: new Date(), $inc: { podInviteCount: 1 } };
  if (isFirstSend) {
    update.podInvitedByUserId = new Types.ObjectId(callerUserId);
    update.podInvitedByEmail = callerEmail;
    update.podInvitedByName = callerName;
  }
  await Bat246Distributor.updateOne({ _id: dist._id }, update);

  return { ok: true, type: isFirstSend ? "invite" : "remind" };
}

/**
 * Called from fulfillInvoice() / the free-product checkout path whenever the
 * POD product is purchased. Idempotent (filtered on podPurchaseCompletedAt
 * being unset) and non-fatal by design — callers should wrap in try/catch.
 *
 * Also the single choke point for the Lost Money 3%-of-sale auto-pay drip on
 * POD purchases — unlike a $650 Board Entry purchase (which always flows
 * through bat246Entry.service.ts's payLbAndCreditHp), a plain $160 POD
 * purchase has no board/position yet at checkout time, so it never reaches
 * that function. This is called from every known POD purchase path
 * (productCheckout.ts, invoice fulfillment, and the generic-invite/
 * reconciliation backfills below), and its own idempotency guard (below)
 * ensures the drip fires exactly once per real purchase no matter which
 * caller gets there first.
 */
export async function markPodPurchaseCompleted(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return;
  const dist = await Bat246Distributor.findOne({
    userId: new Types.ObjectId(userId),
    podPurchaseCompletedAt: null,
  }).select("podInvitedByUserId").lean() as any;
  if (!dist) return; // no distributor record, or already marked — no-op either way

  const result = await Bat246Distributor.updateOne(
    { _id: dist._id, podPurchaseCompletedAt: null },
    {
      $set: {
        podPurchaseCompletedAt: new Date(),
        podPurchaseCreditedToUserId: dist.podInvitedByUserId ?? null,
      },
    }
  );

  // Only the call that actually flipped podPurchaseCompletedAt just now
  // treats this as a real, fresh purchase — guards against double-firing
  // the auto-pay drip if two callers race, or this function is invoked
  // more than once for the same purchase (see call sites above).
  if (result.modifiedCount > 0) {
    try {
      // Use the ACTUAL amount paid on this purchase (not the product's
      // current list price) — correctly yields $0 for a 100%-off coupon
      // (a real, already-handled edge case at the productCheckout.ts call
      // site) or a partial amount for any other discount, same as every
      // $650 Board Entry call site already does with its own saleAmount.
      const { Invoice } = await import("../../models/invoice.model");
      const paidInvoice = await Invoice.findOne({
        userId: new Types.ObjectId(userId),
        status: "paid",
        "lineItems.itemId": new Types.ObjectId(POD_PRODUCT_ID),
      }).sort({ createdAt: -1 }).select("totalAmount").lean() as any;
      const saleAmount = paidInvoice ? paidInvoice.totalAmount / 100 : 0;

      if (saleAmount > 0) {
        runLostMoneyAutoPay(saleAmount).catch((err) =>
          console.error("[bat246-pod] Lost Money auto-pay failed:", err.message)
        );
      }
    } catch (err: any) {
      console.error("[bat246-pod] Lost Money auto-pay lookup failed:", err.message);
    }
  }
}

/**
 * Called from bat246.service.ts's maybeCreatePlacementNotification() when a
 * distributor's qualifying entry purchase turns out to be the $160 POD
 * product bought through the generic "+ Invite" referral link (no explicit
 * "Invite to POD" click ever happened, so podInvitedByUserId would otherwise
 * be empty). Back-fills the same first-touch attribution sendPodInvite()
 * would have set, then marks the purchase completed — so the Distributors
 * grid shows "Invited — by {inviter}" -> "Ready to place on board" exactly
 * as if the inviter had used the Invite-to-POD button, without ever placing
 * the recruit on a board automatically.
 */
export async function recordAutoPodInvite(userId: string, inviterUserId: string): Promise<void> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(inviterUserId)) return;
  const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(userId) })
    .select("podInvitedByUserId podPurchaseCompletedAt podPurchaseCreditedToUserId").lean() as any;
  if (!dist) return;

  const setFields: Record<string, any> = {};
  if (!dist.podInvitedByUserId) {
    const inviter = await User.findById(inviterUserId).select("name email").lean() as any;
    setFields.podInvitedByUserId = new Types.ObjectId(inviterUserId);
    setFields.podInvitedByEmail = inviter?.email || "";
    setFields.podInvitedByName = inviter?.name || inviter?.email || "";
  }
  // markPodPurchaseCompleted() is wired unconditionally into every checkout
  // path and typically runs BEFORE this referral-branch code does (while
  // podInvitedByUserId is still empty), so its own credit-snapshot logic
  // would otherwise permanently leave podPurchaseCreditedToUserId null.
  // Set it directly here instead of relying on that backfill.
  if (dist.podPurchaseCompletedAt && !dist.podPurchaseCreditedToUserId) {
    setFields.podPurchaseCreditedToUserId = new Types.ObjectId(inviterUserId);
  }
  if (Object.keys(setFields).length > 0) {
    await Bat246Distributor.updateOne({ _id: dist._id }, { $set: setFields });
  }

  // Covers the rare case this runs before the generic hook does — sets
  // podPurchaseCompletedAt (and podPurchaseCreditedToUserId, now that
  // podInvitedByUserId is set) if it hasn't already.
  await markPodPurchaseCompleted(userId);
}

/**
 * Self-healing safety net — called from listDistributors on every page load.
 * `markPodPurchaseCompleted` is wired into every known checkout path
 * (fulfillInvoice, the two coupon-zero-pay branches, the free-product
 * branch), but a purchase can in principle still slip through an
 * as-yet-unknown path or a mid-flight server restart. Rather than trust that
 * every call site was found, this re-derives ground truth directly from paid
 * invoices for anyone still shown as "invited" and backfills them — so the
 * status column can never silently stay wrong even if a hook is missed.
 * Cheap no-op when there's nothing to reconcile (empty $in query).
 * Returns the set of userIds it just completed, so the caller can patch its
 * already-fetched response instead of waiting for the next reload.
 */
export async function reconcilePodInvitedPurchases(candidateUserIds: string[]): Promise<Set<string>> {
  const completed = new Set<string>();
  const validIds = candidateUserIds.filter((id) => Types.ObjectId.isValid(id));
  if (!validIds.length) return completed;

  const { Invoice } = await import("../../models/invoice.model");
  const oids = validIds.map((id) => new Types.ObjectId(id));
  const paidInvoices = await Invoice.find({
    userId: { $in: oids },
    status: "paid",
    "lineItems.itemId": new Types.ObjectId(POD_PRODUCT_ID),
  }).select("userId").lean();

  for (const inv of paidInvoices as any[]) {
    const userId = inv.userId?.toString();
    if (!userId) continue;
    await markPodPurchaseCompleted(userId);
    completed.add(userId);
  }
  return completed;
}

function getSlotRef(board: any, key: string): any {
  if (key === "homePlate" || key === "thirdBase" || key === "secondBaseA" || key === "secondBaseB") return board[key];
  if (key.startsWith("1st")) return board.firstBase?.["ABCD".indexOf(key[3])] ?? null;
  if (key.startsWith("atBat-")) return board.atBat?.[Number(key.split("-")[1])] ?? null;
  return null;
}

/** Which named position (if any) does this player occupy on this board? */
function findCallerPosition(board: any, playerId: string): string | null {
  if (board.homePlate?.playerId?.toString() === playerId) return "homePlate";
  if (board.thirdBase?.playerId?.toString() === playerId) return "thirdBase";
  if (board.secondBaseA?.playerId?.toString() === playerId) return "secondBaseA";
  if (board.secondBaseB?.playerId?.toString() === playerId) return "secondBaseB";
  const fbIdx = (board.firstBase ?? []).findIndex((s: any) => s?.playerId?.toString() === playerId);
  if (fbIdx !== -1) return `1st${["A", "B", "C", "D"][fbIdx]}`;
  const abIdx = (board.atBat ?? []).findIndex((s: any) => s?.playerId?.toString() === playerId);
  if (abIdx !== -1) return `atBat-${abIdx}`;
  if ((board.dugout ?? []).some((s: any) => s?.playerId?.toString() === playerId)) return "dugout";
  if ((board.onDeckCircle ?? []).some((s: any) => s?.playerId?.toString() === playerId)) return "onDeckCircle";
  return null;
}

/** Awards the $160 Gray Card to whichever slot the caller occupies on this
 * board (fixed position or a dugout/onDeckCircle array entry). No-op if the
 * caller's slot can't be found (shouldn't happen — caller was already
 * validated as a board member before this is called). */
function awardGrayCard160(board: any, callerPlayerId: string, position: string) {
  let slot: any = null;
  if (position === "dugout") slot = (board.dugout ?? []).find((s: any) => s?.playerId?.toString() === callerPlayerId);
  else if (position === "onDeckCircle") slot = (board.onDeckCircle ?? []).find((s: any) => s?.playerId?.toString() === callerPlayerId);
  else slot = getSlotRef(board, position);
  if (!slot) return;
  slot.grayCard160 = (slot.grayCard160 ?? 0) + 1;
  if (!slot.cardType) slot.cardType = "Gray";
}

/**
 * Assigns this board's POD "team" ID — globally sequential ("P-1001",
 * "P-1002", ...), shared by all 4 members of that cycle once they join.
 * Called eagerly right after a board is created (see bat246Entry.service.ts,
 * bat246Split.service.ts, bat246Admin.service.ts) so every board has its
 * number reserved up front, even before anyone has joined its POD. Also
 * still safe to call lazily from placeUserInPod, since it's a no-op (and
 * burns no counter) if the board already has one. Mutates `board.podTeamId`
 * in memory — caller still needs to `.save()`.
 */
export async function assignPodTeamId(board: any, session?: ClientSession): Promise<void> {
  if (board.podTeamId) return;
  const { Bat246Config } = await import("../models/bat246Config.model");
  const config = await Bat246Config.findOneAndUpdate(
    {},
    { $inc: { podTeamCounter: 1 } },
    { new: true, upsert: true, session }
  );
  board.podTeamId = `P-${config!.podTeamCounter}`;
}

/**
 * Boards the caller can place a purchased POD distributor into: status
 * "active", caller occupies some position on it, and the board's POD cycle
 * (3 visual seats + 1 Dugout/AT BAT 4th) isn't complete yet. Admin (Alan K)
 * isn't restricted to boards he personally occupies — every active board
 * with an open seat is offered.
 */
export async function getMyActivePodBoards(callerUserId: string) {
  if (!Types.ObjectId.isValid(callerUserId)) return [];
  const admin = await isAdminCaller(callerUserId);

  let boardFilter: any = { status: "active" };
  if (!admin) {
    const player = await Bat246Player.findOne({ userId: new Types.ObjectId(callerUserId) }).select("_id").lean() as any;
    if (!player) return [];
    boardFilter = { ...boardFilter, $or: POD_MEMBER_PLAYER_ID_PATHS.map((path) => ({ [path]: player._id })) };
  }

  const boards = await Bat246Board.find(boardFilter).select("boardNumber trackingNumber pod podCompletedAt").lean();

  return (boards as any[])
    .map((b) => {
      const filledSeats = (b.pod ?? []).filter((s: any) => s?.playerId).length;
      // 4 total placements per cycle: up to 3 visual seats + 1 redirected —
      // "remaining" counts down from 4, and hits 0 once podCompletedAt is set.
      const remaining = b.podCompletedAt ? 0 : Math.max(0, 4 - filledSeats);
      return {
        _id: b._id.toString(),
        boardNumber: b.boardNumber,
        trackingNumber: b.trackingNumber,
        podBlankCount: remaining,
      };
    })
    .filter((b) => b.podBlankCount > 0)
    .sort((a, b) => a.boardNumber - b.boardNumber);
}

/**
 * Places a purchased-but-unplaced distributor for a given board's POD cycle:
 *  - Seats 1-3: fills the next open visual POD seat.
 *  - Seat 4 (last of the cycle): NOT placed in `board.pod`. Goes to Dugout
 *    if the board's Protection Period is still active (shown grouped under
 *    the cycle's podTeamId, not their own name — promoted to AT BAT
 *    automatically once PP expires, same as any other dugout entry), or
 *    straight to an open AT BAT slot if PP has already expired. Either way
 *    the caller is awarded a $160 Gray Card on their own slot on this board
 *    and the cycle closes (podCompletedAt/podEarnerPlayerId set). All 4
 *    members share one podTeamId (see assignPodTeamId) — none of this is
 *    copied onto child boards on a split; only the 4th entrant's dugout/
 *    atBat slot follows ordinary referredBy-based dugout split-routing.
 *
 * Concurrency:
 *  - The distributor's placement is claimed ATOMICALLY FIRST (`podPlacedAt:
 *    null` filter), before any board mutation — so two callers racing to
 *    place the same distributor can't both succeed; the loser fails fast
 *    with nothing to roll back on the board side.
 *  - The board mutation uses load → mutate → `board.save()`, never a raw
 *    dot-path `$set: {"pod.0": ...}`. Mongo's dot-notation $set on an array
 *    index CREATES A PLAIN OBJECT (`{pod: {"0": {...}}}`), not a real array,
 *    when the field doesn't already exist as an array on the stored
 *    document — true for every board that predates this schema field.
 *    `board.save()` always (re)writes the whole array correctly, and the
 *    schema's `optimisticConcurrency: true` makes save() throw a
 *    VersionError on concurrent modification — our race guard for the board
 *    side. If the board mutation fails for any reason, the distributor
 *    claim is rolled back so it's never left falsely claimed.
 */
export async function placeUserInPod(targetUserId: string, boardId: string, callerUserId: string) {
  if (!Types.ObjectId.isValid(targetUserId) || !Types.ObjectId.isValid(boardId)) {
    throw new Error("Invalid id");
  }

  const [dist, targetUser, callerUser, callerPlayer, admin] = await Promise.all([
    Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) }).lean() as any,
    User.findById(targetUserId).select("name email country").lean() as any,
    User.findById(callerUserId).select("name email").lean() as any,
    Bat246Player.findOne({ userId: new Types.ObjectId(callerUserId) }).select("_id").lean() as any,
    isAdminCaller(callerUserId),
  ]);

  if (!dist) throw new Error("Distributor not found");
  if (!dist.isQualified) throw new Error("Distributor is not qualified");
  if (!dist.podPurchaseCompletedAt) throw new Error("This distributor has not completed the POD purchase yet");
  if (dist.podPlacedAt) throw new Error("This distributor is already placed on a board");
  // Admin can place into any board regardless of whether he personally has
  // a position on it — everyone else needs an actual player record.
  if (!callerPlayer && !admin) throw new Error("You are not part of any board");

  // Claim first — atomic, no board work has happened yet, so a lost race
  // here needs no rollback at all.
  const claim = await Bat246Distributor.updateOne(
    { _id: dist._id, podPlacedAt: null },
    { $set: { podPlacedBoardId: new Types.ObjectId(boardId), podPlacedAt: new Date(), podPlacedByUserId: new Types.ObjectId(callerUserId) } }
  );
  if (claim.modifiedCount === 0) {
    throw new Error("This distributor was just placed on another board — please refresh");
  }

  try {
    // Admin isn't required to occupy a position on this specific board —
    // everyone else is (same "part of it" requirement as before).
    const board = admin
      ? await Bat246Board.findOne({ _id: new Types.ObjectId(boardId), status: "active" })
      : await Bat246Board.findOne({
          _id: new Types.ObjectId(boardId),
          status: "active",
          $or: POD_MEMBER_PLAYER_ID_PATHS.map((path) => ({ [path]: callerPlayer._id })),
        });
    if (!board) throw new Error("Board not found, not active, or you are not part of it");
    if ((board as any).podCompletedAt) throw new Error("This board's POD cycle is already complete");

    // Find-or-create the target's player record (same pattern used
    // throughout bat246Entry.service.ts / productCheckout.ts).
    let targetPlayer = await Bat246Player.findOne({ userId: new Types.ObjectId(targetUserId) });
    if (!targetPlayer) {
      targetPlayer = await createBat246Player({
        userId: new Types.ObjectId(targetUserId),
        nickname: targetUser?.name || targetUser?.email || "",
        email: targetUser?.email || "",
        memberSince: new Date(),
      });
    }

    const now = new Date();
    // For a POD slot, entryNo = how many times THIS player has purchased the
    // $160 POD product — a separate count from the $650 board-entry counter
    // (Bat246Player.minorLeague.totalEntries, used everywhere else on the
    // board). Derived from paid invoices rather than a cached counter since
    // there's no dedicated field for it; `podPurchaseCompletedAt` (checked
    // above) guarantees at least one, so the floor is just a display safety
    // net in case the count query races the invoice write.
    const { Invoice } = await import("../../models/invoice.model");
    const podPurchaseCount = await Invoice.countDocuments({
      userId: new Types.ObjectId(targetUserId),
      status: "paid",
      "lineItems.itemId": new Types.ObjectId(POD_PRODUCT_ID),
    });
    const entryNo = String(Math.max(1, podPurchaseCount));
    // null when admin has no position on this board at all — fine for
    // seats 1-3 below (which don't need it); the 4th/cycle-closing seat
    // does need a real position to award its Gray Card to, and already
    // fails with a clear error in that branch if this is null.
    const callerPosition = callerPlayer ? findCallerPosition(board as any, callerPlayer._id.toString()) : null;
    const podArr: any[] = Array.isArray((board as any).pod) ? (board as any).pod : [];
    const seatIndex = podArr.length < 3 ? podArr.length : podArr.findIndex((s: any) => !s?.playerId);

    // Every member of this board's POD cycle (all 4) shares one team ID —
    // assigned once, on whoever joins first.
    await assignPodTeamId(board as any);
    const podTeamId: string = (board as any).podTeamId;

    let positionKey: string;
    let split4thTrigger = false;

    if (seatIndex !== -1 && seatIndex < 3) {
      // Seats 1-3 — normal visual POD placement.
      while (podArr.length < 3) podArr.push(null);
      podArr[seatIndex] = {
        playerId: targetPlayer._id,
        entryNo,
        playerName: targetUser?.name || targetUser?.email || "",
        playerEmail: targetUser?.email || "",
        enteredAt: now,
        countryResidence: targetUser?.country ?? null,
        countryOrigin: pickCountryOrigin(null, dist?.countryOfBirth, targetUser?.country),
        podTeamId,
      };
      (board as any).pod = podArr;
      board.markModified("pod");
      positionKey = `pod-${seatIndex}`;
    } else {
      // Seat 4 — the cycle-closing placement. NOT placed straight onto the
      // board tree. If the board's Protection Period is still active they
      // wait in Dugout (grouped under podTeamId — see slotToPodOccupant /
      // the dugout renderer, which shows the team ID instead of a name and
      // pops a 4-member roster on click); promoteDugoutAfterPP() picks them
      // up automatically once PP naturally expires. If PP has ALREADY
      // expired right now, skip the wait and place/split immediately —
      // mirrors what promoteDugoutAfterPP would do a moment later anyway.
      if (!callerPosition) throw new Error("Could not resolve your position on this board");
      const ppEnd: Date | undefined = (board as any).protectionPeriodEnd;
      const ppActive = !!ppEnd && new Date(ppEnd) > now;
      const atBatArr: any[] = (board as any).atBat ?? [];
      const openAtBatIdx = atBatArr.findIndex((s: any) => !s);

      const slot = {
        playerId: targetPlayer._id,
        entryNo,
        playerName: targetUser?.name || targetUser?.email || "",
        playerEmail: targetUser?.email || "",
        enteredAt: now,
        joinedBoardAt: now,
        referredBy: callerPlayer._id,
        referredByName: callerUser?.name || callerUser?.email || null,
        countryResidence: targetUser?.country ?? null,
        countryOrigin: pickCountryOrigin(null, dist?.countryOfBirth, targetUser?.country),
        podTeamId,
      };

      if (!ppActive && openAtBatIdx !== -1) {
        // PP already expired and there's room — go straight to AT BAT.
        (board as any).atBat[openAtBatIdx] = slot;
        board.markModified("atBat");
        positionKey = `atBat-${openAtBatIdx}`;
        split4thTrigger = true;
      } else {
        // PP still active, OR PP expired but the board is already full
        // (rare — parks in dugout; the next split-trigger check below, or
        // the ordinary promote/split flow, resolves it from there).
        (board as any).dugout = [...((board as any).dugout ?? []), slot];
        board.markModified("dugout");
        positionKey = "dugout";
      }

      // Award the $160 Gray Card to the caller and close the cycle — this
      // happens the instant the 4th person joins, regardless of where they
      // physically land.
      awardGrayCard160(board as any, callerPlayer._id.toString(), callerPosition);
      board.markModified(
        callerPosition === "dugout" ? "dugout" :
        callerPosition === "onDeckCircle" ? "onDeckCircle" :
        callerPosition.startsWith("1st") ? "firstBase" :
        callerPosition.startsWith("atBat") ? "atBat" : callerPosition
      );
      (board as any).podEarnerPlayerId = callerPlayer._id;
      (board as any).podCompletedAt = now;
    }

    try {
      await board.save(); // throws VersionError on concurrent modification (optimisticConcurrency)
    } catch (err: any) {
      if (err?.name === "VersionError") throw new Error("Something on that board just changed — please try again");
      throw err;
    }

    await Bat246Distributor.updateOne({ _id: dist._id }, { $set: { podPlacedPositionKey: positionKey } });

    // Placing the 4th entrant into AT BAT can fill the board's last slot —
    // check the same split trigger every other AT BAT-filling path checks.
    if (split4thTrigger) {
      const atBatFilled = ((board as any).atBat ?? []).filter((s: any) => s?.playerId).length;
      if (atBatFilled >= 8) {
        const { splitBoardPhase1 } = await import("./bat246Split.service");
        splitBoardPhase1((board as any)._id.toString()).catch((e: any) =>
          console.error("[bat246-pod] split trigger after 4th-POD-entrant placement failed:", e.message)
        );
      }
    }

    return { ok: true, boardTrackingNumber: (board as any).trackingNumber, position: positionKey };
  } catch (err) {
    // Board-side work failed — the distributor was already claimed above;
    // release the claim so it isn't left falsely marked as placed.
    await Bat246Distributor.updateOne(
      { _id: dist._id },
      { $set: { podPlacedBoardId: null, podPlacedAt: null, podPlacedByUserId: null } }
    ).catch(() => { /* best-effort rollback — non-fatal */ });
    throw err;
  }
}

/**
 * All 4 members of a POD team, keyed by the shared podTeamId shown on the
 * dugout gondola / dugout slot in place of a name. The 3 visual-seat members
 * always live in `board.pod[]` on whichever single board originated the
 * team (podTeamId is set once, never copied on split). The 4th member can
 * end up on a DIFFERENT board than that — a split can carry their dugout
 * slot to a child board while the 3 seats stay on the parent — or even get
 * promoted into an AT BAT slot there, so it's looked up separately by
 * scanning dugout/atBat across all boards for a matching podTeamId.
 */
export async function getPodTeamDetails(teamId: string) {
  const originBoard = await Bat246Board.findOne({ podTeamId: teamId })
    .select("trackingNumber pod").lean() as any;

  const members: Array<{
    playerId: string; playerName: string; entryNo: string | null;
    position: string; boardTrackingNumber: string; enteredAt: Date | null;
    referredByName?: string | null;
  }> = [];

  if (originBoard) {
    for (let i = 0; i < (originBoard.pod ?? []).length; i++) {
      const s = originBoard.pod[i];
      if (!s?.playerId) continue;
      members.push({
        playerId: s.playerId.toString(),
        playerName: s.playerName ?? "",
        entryNo: s.entryNo ?? null,
        position: `pod-${i}`,
        boardTrackingNumber: originBoard.trackingNumber,
        enteredAt: s.enteredAt ?? null,
      });
    }
  }

  const fourthBoard = await Bat246Board.findOne({
    $or: [{ "dugout.podTeamId": teamId }, { "atBat.podTeamId": teamId }],
  }).select("trackingNumber dugout atBat").lean() as any;

  if (fourthBoard) {
    const dugoutSlot = (fourthBoard.dugout ?? []).find((s: any) => s?.podTeamId === teamId);
    if (dugoutSlot) {
      members.push({
        playerId: dugoutSlot.playerId.toString(),
        playerName: dugoutSlot.playerName ?? "",
        entryNo: dugoutSlot.entryNo ?? null,
        position: "dugout",
        boardTrackingNumber: fourthBoard.trackingNumber,
        enteredAt: dugoutSlot.enteredAt ?? null,
      });
    } else {
      const abIdx = (fourthBoard.atBat ?? []).findIndex((s: any) => s?.podTeamId === teamId);
      if (abIdx !== -1) {
        const s = fourthBoard.atBat[abIdx];
        members.push({
          playerId: s.playerId.toString(),
          playerName: s.playerName ?? "",
          entryNo: s.entryNo ?? null,
          position: `atBat-${abIdx}`,
          boardTrackingNumber: fourthBoard.trackingNumber,
          enteredAt: s.enteredAt ?? null,
        });
      }
    }
  }

  // Join playerId -> User -> Bat246Distributor.podInvitedByName ("who
  // referred this person into POD") for each member.
  if (members.length > 0) {
    const playerIds = members.map((m) => new Types.ObjectId(m.playerId));
    const players = await Bat246Player.find({ _id: { $in: playerIds } }).select("userId").lean() as any[];
    const playerUserMap = new Map(players.map((p: any) => [p._id.toString(), p.userId?.toString()]));
    const userIds = [...new Set(players.map((p: any) => p.userId?.toString()).filter(Boolean))];
    const dists = await Bat246Distributor.find({ userId: { $in: userIds } }).select("userId podInvitedByName").lean() as any[];
    const distMap = new Map(dists.map((d: any) => [d.userId.toString(), d.podInvitedByName]));
    for (const m of members) {
      const uid = playerUserMap.get(m.playerId);
      m.referredByName = uid ? (distMap.get(uid) ?? null) : null;
    }
  }

  return { teamId, members };
}

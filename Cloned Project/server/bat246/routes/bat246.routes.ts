import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import * as ctrl from "../controllers/bat246.controller";
import { placeUserFromReservation, placeUserInDugout, getPlacementInfo, maybeAwardGoldToApprover, listOpenBoardsForPlacement } from "../services/bat246.service";
import { sendPodInvite, getMyActivePodBoards, placeUserInPod, isPartOfAnyActiveBoard, getPodTeamDetails } from "../services/bat246PodInvite.service";
import { sendBoardInvite, placeDistributorOnBoard, getBoardPlacementInfoForCaller } from "../services/bat246BoardInvite.service";
import { activateFreeTrialMembership } from "../services/bat246MembershipBilling.service";
import { Bat246SalesCredit } from "../models/bat246SalesCredit.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { Bat246PendingPlacement } from "../models/bat246PendingPlacement.model";
import { Bat246PositionReservation, RESERVATION_POSITIONS } from "../models/bat246PositionReservations.model";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";
import { createInvoice } from "../../services/invoice";
import { signJwt } from "../../services/jwt";
import { isBat246CardAdmin } from "../services/bat246Permission.service";

const router = Router();

// Positions that grant access to the new "Dashboard" page + approve permission
// (homePlate, thirdBase, secondBaseA/B, any 1st base — NOT atBat slots)
async function hasDashboardAccess(userId: string): Promise<boolean> {
  const { Bat246Board } = await import("../models/bat246Board.model");
  const player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) }).select("_id").lean() as any;
  if (!player) return false;
  const pid = player._id;
  const board = await Bat246Board.findOne({
    $or: [
      { "homePlate.playerId": pid },
      { "thirdBase.playerId": pid },
      { "secondBaseA.playerId": pid },
      { "secondBaseB.playerId": pid },
      { "firstBase.playerId": pid },
    ],
  }).select("_id").lean();
  return !!board;
}

// 1st Base only — approve/placement permission (subset of dashboard access)
async function isFirstBasePlayer(userId: string): Promise<boolean> {
  const { Bat246Board } = await import("../models/bat246Board.model");
  const player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) }).select("_id").lean() as any;
  if (!player) return false;
  const pid = player._id;
  const board = await Bat246Board.findOne({ "firstBase.playerId": pid }).select("_id").lean();
  return !!board;
}

// 1st Base Green Card count (salesCredits, 0-2) + board's AT BAT fill count.
// Drives "Generate Link — Preserve Position" gating and the distributors-grid
// Approve button. Non-1st-Base users get { null, null }.
async function getMySalesCredits(userId: string): Promise<{ salesCredits: number | null; atBatFilledCount: number | null; myCardType: string | null }> {
  const { Bat246Board } = await import("../models/bat246Board.model");
  const player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) }).select("_id").lean() as any;
  if (!player) return { salesCredits: null, atBatFilledCount: null, myCardType: null };
  const pid = player._id;
  const board = await Bat246Board.findOne({ "firstBase.playerId": pid }).select("firstBase atBat").lean() as any;
  if (!board) return { salesCredits: null, atBatFilledCount: null, myCardType: null };
  const slot = (board.firstBase ?? []).find((s: any) => s?.playerId?.toString() === pid.toString());
  const salesCredits = slot?.salesCredits ?? 0;
  const atBatFilledCount = (board.atBat ?? []).filter((s: any) => s?.playerId).length;
  const myCardType = slot?.cardType ?? null;
  return { salesCredits, atBatFilledCount, myCardType };
}

// Lightweight board summary — just tracking/board number, for the header
// prev/next navigation buttons (avoids the heavy full-board endpoint).
router.get("/boards/:id/summary", requireAuth, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid board id" });
    const { Bat246Board } = await import("../models/bat246Board.model");
    const board = await Bat246Board.findById(req.params.id).select("boardNumber trackingNumber").lean() as any;
    if (!board) return res.status(404).json({ error: "Board not found" });
    res.json({ boardNumber: board.boardNumber, trackingNumber: board.trackingNumber });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/boards",                    requireAuth, ctrl.listBoards);
router.post("/boards",                  requireAuth, ctrl.createBoard);

// POD placement — "Ready to place on board" button/modal. Boards the caller
// is part of, active, with an open POD seat. MUST be registered before
// "/boards/:id" below — Express matches routes top-to-bottom, and the
// literal "my-active-pod-boards" segment would otherwise be swallowed by
// the ":id" param route, causing an ObjectId cast error.
router.get("/boards/my-active-pod-boards", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const boards = await getMyActivePodBoards(caller.userId);
    res.json({ ok: true, boards });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Board Entry board-picker dropdown ("Place on Board" modal, admin-only on
// the frontend) — every board open for placement, not just ones the caller
// occupies (unlike the POD list above). Same route-ordering note as above:
// must be registered before "/boards/:id".
router.get("/boards/open-for-placement", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const boards = await listOpenBoardsForPlacement(caller.userId);
    res.json({ ok: true, boards });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/boards/:id/public",        ctrl.getBoard); // no auth — for invite preview pages
router.get("/boards/:id",               requireAuth, ctrl.getBoard);
router.get("/boards/:id/movements",     requireAuth, ctrl.getBoardMovements);
router.post("/boards/:id/reserve-position", requireAuth, ctrl.reservePosition);
router.post("/boards/:id/place-user",       requireAuth, ctrl.placeUser);
router.get("/boards/:id/reservations",  requireAuth, ctrl.getReservations);
router.post("/boards/:id/split",        requireAuth, ctrl.triggerSplit);
router.post("/boards/:id/penciling",    requireAuth, ctrl.updatePenciling);
router.post("/boards/:id/prepick",      requireAuth, ctrl.updatePrePick);
router.get("/players/:id",              requireAuth, ctrl.getPlayer);

// PP-triggered dugout promotion + Home Plate invite
router.post("/boards/:id/promote-dugout-pp", requireAuth, ctrl.promoteDugoutPP);
router.post("/boards/:id/hp-invite",         requireAuth, ctrl.addHomePlateEntry);

// Admin / board-setup endpoints
router.get("/stats",                    requireAuth, ctrl.getStats);
router.get("/distributors",             requireAuth, ctrl.listDistributors);
router.get("/users/search",             requireAuth, ctrl.searchUsers);
router.post("/boards/:id/assign",       requireAuth, ctrl.assignSlot);
router.post("/boards/:id/activate",     requireAuth, ctrl.activateBoard);
router.post("/boards/:id/fix-dugout",   requireAuth, ctrl.fixDugout);
router.post("/boards/:id/hidden",       requireAuth, ctrl.setBoardHidden);

const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
const ALAN_K_EMAIL  = "redbaron2020@mail.com";
const MEMBERSHIP_PRICE_CENTS = 2000; // $20.00

// ─── Distributor progress endpoint ───────────────────────────────────────────

const BAT246_PRODUCT_ORG_ID = "6a0d34e677323d1b81c6469b";

router.get("/distributor/progress", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const userObjId = new Types.ObjectId(me.userId);
    let [dist, user] = await Promise.all([
      Bat246Distributor.findOne({ userId: userObjId })
        .select("hasBat246Membership hasPurchasedProduct isGarageAffiliate isQualified membershipExpiresAt qualifiedAt bat246RefUserId invitedProductId podPlacedPositionKey")
        .lean() as any,
      User.findById(me.userId).select("organizations email name").lean() as any,
    ]);

    const isOfficeMember = !!(user?.organizations?.some(
      (o: any) => o.organization.toString() === BAT246_PRODUCT_ORG_ID
    ));

    // Self-heal on every read of this endpoint (called on every boards-page
    // mount/refresh — see frontend fetchDistributorProgress). This exists
    // for the case a real, paid $650/$160 entry purchase didn't correctly
    // flip `hasPurchasedProduct` — a bug we already fixed in fulfilInvoice,
    // but this is the safety net for that class of gap in general (a future
    // regression there, a webhook that failed to fire, etc.): rather than
    // trust the stored flag blindly, when it reads false we cross-check
    // against a real paid invoice for a bat246_entry-tagged product and
    // correct the record on the spot, so a stale/missed write self-repairs
    // the next time the user simply reloads the page — no manual DB fix
    // needed. Only runs when the flag is currently false, so this adds no
    // extra query once a distributor is correctly marked purchased.
    if (!dist?.hasPurchasedProduct) {
      try {
        const entryProducts = await Product.find({ tags: "bat246_entry" }).select("_id").lean();
        if (entryProducts.length) {
          const { Invoice } = await import("../../models/invoice.model");
          const paidEntry = await Invoice.findOne({
            userId: userObjId,
            status: "paid",
            "lineItems.itemId": { $in: entryProducts.map((p: any) => p._id) },
          }).select("_id").lean();

          if (paidEntry) {
            const { resolveBat246Ref } = await import("../services/bat246.service");
            const resolvedRef = dist?.bat246RefUserId
              ? dist.bat246RefUserId.toString()
              : await resolveBat246Ref({ email: user?.email, userId: userObjId });

            const update: any = { hasPurchasedProduct: true, isOfficeMember: true };
            if (!dist?.bat246RefUserId && resolvedRef) {
              update.bat246RefUserId = new Types.ObjectId(resolvedRef);
            }
            // isGarageAffiliate ($25 Garage Affiliate) dropped from
            // qualification on request.
            const isNowQualified = isOfficeMember && !!dist?.hasBat246Membership;
            const wasQualified = !!dist?.isQualified;
            if (isNowQualified && !wasQualified) {
              update.isQualified = true;
              update.qualifiedAt = new Date();
            }

            const healed = await Bat246Distributor.findOneAndUpdate(
              { userId: userObjId },
              { $set: update, $setOnInsert: { userId: userObjId } },
              { upsert: true, new: true },
            ).lean() as any;
            dist = healed;

            if (isNowQualified && !wasQualified) {
              const { assignDistributorId } = await import("../services/bat246DistributorId.util");
              const { maybeCreatePlacementNotification } = await import("../services/bat246.service");
              await assignDistributorId(me.userId).catch((e: any) =>
                console.error("[bat246] progress self-heal: assignDistributorId failed:", e?.message),
              );
              await maybeCreatePlacementNotification(me.userId).catch(() => {});
            }
            console.log(`[bat246] distributor/progress self-heal: found paid entry invoice ${paidEntry._id} for user ${me.userId}, corrected hasPurchasedProduct`);
          }
        }
      } catch (healErr: any) {
        // Never let the reconciliation attempt break the read itself.
        console.error("[bat246] distributor/progress self-heal failed (non-fatal):", healErr?.message);
      }
    }

    // Same self-heal, for isGarageAffiliate ($25 Garage Affiliate step). This
    // flag is normally set by the Unilevel Plus purchase webhook path in
    // invoice.ts, but that setter only fires on a user's *first-ever*
    // Unilevel Plus activation (`if (!existing && quantity > 0)`). A real
    // case: milliondollarbill.bm@gmail.com paid for Unilevel Plus back in
    // May, but their Bat246Distributor record wasn't created until months
    // later — so the flag never had a chance to be set, and the boards page
    // kept showing "$25 Garage Affiliate" as an unpaid, pending step even
    // though he'd already paid. Rather than only fix it by hand in Mongo,
    // cross-check on every read: if the flag is false but the user has an
    // ACTIVE Unilevel Plus purchase, correct it on the spot so the "pay $25"
    // prompt/notification never shows for someone who already paid, and the
    // Path to Bat246 Distributor progresses automatically on their next
    // page load. Only runs when the flag is currently false, so this adds
    // no extra query once a distributor is correctly marked.
    if (!dist?.isGarageAffiliate) {
      try {
        const { getUserPurchase } = await import("../../services/unilevelPlusCommission");
        const activePurchase = await getUserPurchase(me.userId);
        if (activePurchase) {
          const isNowQualified = isOfficeMember && !!dist?.hasBat246Membership && !!dist?.hasPurchasedProduct;
          const wasQualified = !!dist?.isQualified;
          const update: any = { isGarageAffiliate: true };
          if (isNowQualified && !wasQualified) {
            update.isQualified = true;
            update.qualifiedAt = new Date();
          }

          const healed = await Bat246Distributor.findOneAndUpdate(
            { userId: userObjId },
            { $set: update, $setOnInsert: { userId: userObjId } },
            { upsert: true, new: true },
          ).lean() as any;
          dist = healed;

          if (isNowQualified && !wasQualified) {
            const { assignDistributorId } = await import("../services/bat246DistributorId.util");
            const { maybeCreatePlacementNotification } = await import("../services/bat246.service");
            await assignDistributorId(me.userId).catch((e: any) =>
              console.error("[bat246] progress self-heal: assignDistributorId failed:", e?.message),
            );
            await maybeCreatePlacementNotification(me.userId).catch(() => {});
          }
          console.log(`[bat246] distributor/progress self-heal: found active Unilevel Plus purchase for user ${me.userId}, corrected isGarageAffiliate`);
        }
      } catch (healErr: any) {
        // Never let the reconciliation attempt break the read itself.
        console.error("[bat246] distributor/progress self-heal (isGarageAffiliate) failed (non-fatal):", healErr?.message);
      }
    }

    // isGarageAffiliate dropped from both `steps` and the count on
    // request — it no longer gates isQualified (see the self-heal blocks
    // above), so counting it here left the UI showing "3/4" once someone
    // completed every step that actually matters. Still returned
    // separately below for anything that wants to know the raw flag.
    const steps = {
      isOfficeMember,
      hasPurchasedProduct: dist?.hasPurchasedProduct ?? false,
      hasBat246Membership: dist?.hasBat246Membership ?? false,
    };
    const completedCount = Object.values(steps).filter(Boolean).length;

    res.json({
      isQualified:         dist?.isQualified         ?? false,
      membershipExpiresAt: dist?.membershipExpiresAt  ?? null,
      qualifiedAt:         dist?.qualifiedAt          ?? null,
      bat246RefUserId:     dist?.bat246RefUserId?.toString() ?? null,
      invitedProductId:    dist?.invitedProductId?.toString() ?? null,
      inPod:               !!dist?.podPlacedPositionKey?.startsWith("pod-"),
      isGarageAffiliate:   dist?.isGarageAffiliate ?? false,
      steps,
      completedCount,
      totalCount: 3,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Membership endpoints ─────────────────────────────────────────────────────

router.get("/membership/status", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const player = await Bat246Player.findOne({ userId: new Types.ObjectId(me.userId) })
      .select("membershipActive membershipExpiresAt membershipPlan nextBillingAt").lean() as any;
    res.json({
      active: player?.membershipActive ?? false,
      expiresAt: player?.membershipExpiresAt ?? null,
      plan: player?.membershipPlan ?? null,
      nextBillingAt: player?.nextBillingAt ?? null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// New users — free 3-month trial replacing the old one-time $20/year
// purchase. No invoice, no payment: activates immediately. Only usable once
// (whoever has never activated membership before, either way).
router.post("/membership/activate-free", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const result = await activateFreeTrialMembership(me.userId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/membership/checkout/create-order", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; orgId: string };

    // Check if already active
    const player = await Bat246Player.findOne({ userId: new Types.ObjectId(me.userId) })
      .select("membershipActive membershipExpiresAt").lean() as any;
    if (player?.membershipActive && player?.membershipExpiresAt && new Date(player.membershipExpiresAt) > new Date()) {
      return res.status(400).json({ error: "Membership is already active" });
    }

    const [user, alanK] = await Promise.all([
      User.findById(me.userId).select("email name").lean() as any,
      User.findOne({ email: ALAN_K_EMAIL }).select("_id").lean() as any,
    ]);

    if (!alanK) return res.status(500).json({ error: "Seller configuration error" });

    const invoice = await createInvoice({
      organizationId: BAT246_ORG_ID,
      sellerId: alanK._id.toString(),
      userId: me.userId,
      customerEmail: user?.email ?? "",
      customerName: user?.name,
      lineItems: [{
        itemType: "bat246_membership",
        itemId: BAT246_ORG_ID,
        itemName: "Bat246 Annual Membership",
        quantity: 1,
        unitPrice: MEMBERSHIP_PRICE_CENTS,
        originalCurrency: "USD",
      }],
      itemCurrency: "USD",
      metadata: { type: "bat246_membership" },
    });

    res.json({
      success: true,
      invoiceId: invoice._id.toString(),
      amount: MEMBERSHIP_PRICE_CENTS,
      currency: "USD",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/notifications",          requireAuth, ctrl.getNotifications);
router.post("/notifications/:id/read", requireAuth, ctrl.markNotificationRead);
router.post("/notifications/:id/clear", requireAuth, ctrl.clearNotification);

// ─── Products list (for invite modal dropdown) ────────────────────────────────
router.get("/products", requireAuth, async (req, res) => {
  try {
    const products = await Product.find({ organizationId: new Types.ObjectId(BAT246_PRODUCT_ORG_ID), status: "active" })
      .select("_id name price currency").lean();
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Auto-join Bat246 office (called when new user clicks Activate Membership) ─
router.post("/office/join", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; name: string; email: string; role: string; guest?: boolean };

    const user = await User.findById(me.userId).select("organizations name email guest").lean() as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const alreadyMember = user.organizations?.some(
      (o: any) => o.organization.toString() === BAT246_PRODUCT_ORG_ID
    );

    if (!alreadyMember) {
      await User.findByIdAndUpdate(me.userId, {
        $addToSet: { organizations: { organization: new Types.ObjectId(BAT246_PRODUCT_ORG_ID), role: "stakeholder" } },
      });
    }

    const token = signJwt({
      userId: me.userId,
      orgId: BAT246_PRODUCT_ORG_ID,
      role: "stakeholder",
      name: user.name,
      email: user.email,
      guest: user.guest,
    });

    res.json({ success: true, token, orgId: BAT246_PRODUCT_ORG_ID });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Invite a brand-new prospect (no Garage account yet) ──────────────────────
// Distinct from claim-invite/POD-invite, both of which require the recipient
// to already have a userId/Bat246Distributor row. This sends a plain email
// pointing at our own login/signup page — no board or product page shown —
// for either the $650 board-entry or $160 POD-entry product. Open to any
// logged-in Bat246 user, same as the rest of the Distributors page.
router.post("/office-invite", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };

    const { email, productId } = req.body;
    if (!email || !productId || !Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: "email and productId are required" });
    }

    const product = await Product.findById(productId).select("name price currency tags").lean() as any;
    if (!product || !(product.tags ?? []).includes("bat246_entry")) {
      return res.status(400).json({ error: "Invalid product" });
    }

    // People currently seated in a POD (pod-0/1/2) can only invite for the
    // $160 POD Entry product — not the $650 Board Entry.
    const BAT246_650_PRODUCT_ID = "6a159466cd9f94f7f23b2ef9";
    const callerDist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(caller.userId) })
      .select("podPlacedPositionKey").lean() as any;
    const callerInPod = !!callerDist?.podPlacedPositionKey?.startsWith("pod-");
    if (callerInPod && productId === BAT246_650_PRODUCT_ID) {
      return res.status(400).json({ error: "POD members can only invite new distributors for the $160 POD Entry product." });
    }

    // Durable record, keyed by email — the prospect has no account yet, so
    // this is the only handle we have on them. Consulted by
    // resolveBat246Ref() as a fallback wherever `bat246Ref` doesn't survive
    // to signup/checkout (closed browser mid-flow, forwarded email, signed
    // up a different way, etc.) — see that function for the full picture.
    // Upsert, not insert: re-inviting the same email updates who gets
    // credit, rather than erroring or silently keeping the stale inviter.
    try {
      const { Bat246OfficeInvite } = await import("../models/bat246OfficeInvite.model");
      await Bat246OfficeInvite.findOneAndUpdate(
        { email: email.trim().toLowerCase() },
        { inviterUserId: new Types.ObjectId(caller.userId), productId: new Types.ObjectId(productId) },
        { upsert: true },
      );
    } catch (err: any) {
      // Non-fatal — worst case this prospect falls back to the existing
      // URL-param-based attribution instead of the new durable one.
      console.error("[bat246] office-invite: failed to record Bat246OfficeInvite:", err?.message);
    }

    const { env } = await import("../../config/env");
    const { sendMail, EMAIL_FROM_NOTIFICATION, bat246OfficeInviteEmailTemplate } = await import("../../services/mailer");

    const productUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/games/bat246/office-invite?productId=${productId}&ref=${caller.userId}`;
    const template = bat246OfficeInviteEmailTemplate({
      productName: product.name || "Bat246 Entry",
      priceLabel: `${product.currency || "USD"} ${Number(product.price).toFixed(2)}`,
      productUrl,
    });
    await sendMail(email, template.subject, template.html, template.text, EMAIL_FROM_NOTIFICATION);

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── My role on a board (can I generate invite links?) ───────────────────────
router.get("/boards/:id/my-role", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { Bat246Board } = await import("../models/bat246Board.model");
    const player = await Bat246Player.findOne({ userId: new Types.ObjectId(me.userId) }).select("_id").lean() as any;
    if (!player) return res.json({ canInvite: false, position: null });

    const board = await Bat246Board.findById(req.params.id)
      .select("homePlate thirdBase secondBaseA secondBaseB firstBase atBat").lean() as any;
    if (!board) return res.json({ canInvite: false, position: null });

    const pid = player._id.toString();
    const allSlots: { pos: string; slot: any }[] = [
      { pos: "homePlate",   slot: board.homePlate },
      { pos: "thirdBase",   slot: board.thirdBase },
      { pos: "secondBaseA", slot: board.secondBaseA },
      { pos: "secondBaseB", slot: board.secondBaseB },
      { pos: "1stA", slot: board.firstBase?.[0] },
      { pos: "1stB", slot: board.firstBase?.[1] },
      { pos: "1stC", slot: board.firstBase?.[2] },
      { pos: "1stD", slot: board.firstBase?.[3] },
      ...Array.from({ length: 8 }, (_, i) => ({ pos: `atBat-${i}`, slot: board.atBat?.[i] })),
    ];
    const found = allSlots.find(({ slot }) => slot?.playerId?.toString() === pid);
    res.json({ canInvite: !!found, position: found?.pos ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Do I get the Dashboard page + approve access? ────────────────────────────
router.get("/my-dashboard-access", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const hasAccess = await hasDashboardAccess(me.userId);
    const canApprove = await isFirstBasePlayer(me.userId);
    const { salesCredits, atBatFilledCount, myCardType } = await getMySalesCredits(me.userId);
    res.json({ hasAccess, canApprove, salesCredits, atBatFilledCount, myCardType });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Pending placements for a board (for AT BAT tooltip) ─────────────────────
router.get("/boards/:id/pending-placements", requireAuth, async (req, res) => {
  try {
    const placements = await Bat246PendingPlacement.find({
      boardId: new Types.ObjectId(req.params.id),
      isPlaced: false,
      expiresAt: { $gt: new Date() },
    }).select("userId userName userEmail position refUserId purchasedAt expiresAt").lean();
    res.json({ placements });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Claim invite — save position reservation after join-page auth modal ─────
router.post("/claim-invite", async (req, res) => {
  try {
    const { userId, boardId, position, ref, defaultRef, invitedProductId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    // Boardless "office invite" — no board/position at all, just referral
    // attribution (and optionally which product they were invited to buy).
    // boardId/position are otherwise required together, as before.
    if ((boardId || position) && (!boardId || !position)) {
      return res.status(400).json({ error: "boardId and position are required together" });
    }
    if (position && position !== "unassigned" && !RESERVATION_POSITIONS.includes(position)) {
      return res.status(400).json({ error: "Invalid position" });
    }

    const user = await User.findById(userId).select("email").lean() as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // "unassigned" invites (and boardless office invites) skip the position
    // reservation — the user will be placed manually by an admin via the
    // approve modal, or has no board context at all yet.
    if (position && position !== "unassigned") {
      // Upsert keyed by the slot (matches the unique index on boardId+position+active):
      // re-claiming this invite link re-points the slot's reservation to the new user.
      await Bat246PositionReservation.findOneAndUpdate(
        { boardId: new Types.ObjectId(boardId), position, status: "active" },
        {
          $set: { reservedByUserId: new Types.ObjectId(userId), reservedByEmail: user.email, expiresAt },
          $setOnInsert: { reservedAt: new Date(), productId: null },
        },
        { upsert: true, new: true }
      );
    }

    // Store inviter ref + the board the link pointed to + which product they
    // were invited to buy (only on first creation). `ref` here came from
    // this request's URL — fall back to the durable, email-keyed
    // Bat246OfficeInvite record (see resolveBat246Ref) when it's missing,
    // so re-claiming via a link that lost its `ref` param still attributes
    // correctly. `defaultRef` is a house fallback (gotobigwin.com JOIN NOW
    // with no inviter) and only applies when nothing else names one.
    const { resolveBat246Ref } = await import("../services/bat246.service");
    const resolvedRef = await resolveBat246Ref({ explicitRef: ref, fallbackRef: defaultRef, email: user.email, userId });
    if (resolvedRef || invitedProductId) {
      try {
        const setOnInsert: any = { userId: new Types.ObjectId(userId) };
        if (resolvedRef) setOnInsert.bat246RefUserId = new Types.ObjectId(resolvedRef);
        if (position === "unassigned" && boardId) {
          setOnInsert.bat246RefBoardId = new Types.ObjectId(boardId);
        }
        if (invitedProductId && Types.ObjectId.isValid(invitedProductId)) {
          setOnInsert.invitedProductId = new Types.ObjectId(invitedProductId);
        }
        await Bat246Distributor.findOneAndUpdate(
          { userId: new Types.ObjectId(userId) },
          { $setOnInsert: setOnInsert },
          { upsert: true, setDefaultsOnInsert: false }
        );
      } catch {}
    }

    res.json({ ok: true });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "This position is already reserved. Please try another." });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: fetch board/position choices for the approve modal ────────────────
router.get("/distributors/:userId/placement-info", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const callerUser = await User.findById(caller.userId).select("email").lean() as any;
    const isAdmin = await isBat246CardAdmin(callerUser?.email, caller.userId, "distributors", "inviteandplace");
    if (!isAdmin && !(await isFirstBasePlayer(caller.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const targetUserId = req.params.userId;
    const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) }).lean() as any;
    if (!dist?.isQualified) return res.status(400).json({ error: "User is not qualified" });

    // Gold Approve mode: 1st Base caller with salesCredits===2 and no Gold yet
    // may place the 3rd referral in ANY open AT BAT slot (not just their pair).
    let atBatOnly = false;
    if (!isAdmin) {
      const { salesCredits, myCardType } = await getMySalesCredits(caller.userId);
      atBatOnly = salesCredits === 2 && myCardType === null;
    }

    const info = await getPlacementInfo(targetUserId, { atBatOnly });
    res.json({ ok: true, ...info });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Admin-only: permanently delete a distributor record ─────────────────────
// Removes only the Bat246Distributor qualification/tracking document for this
// user (distributorId, isQualified, POD/Board invite history, etc.) — does
// NOT touch their User account, Bat246Player record, or any board placements
// already made (Bat246PlayerBoard / board slot data are untouched). If they
// were already placed on a board, that placement stays exactly as-is; this
// just removes them from the Distributors / Invite-and-Place grid and their
// qualification tracking. Irreversible — no soft-delete/undo.
router.delete("/distributors/:userId", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const callerUser = await User.findById(caller.userId).select("email").lean() as any;
    if (!(await isBat246CardAdmin(callerUser?.email, caller.userId, "distributors", "inviteandplace"))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const targetUserId = req.params.userId;
    if (!Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }
    const result = await Bat246Distributor.deleteOne({ userId: new Types.ObjectId(targetUserId) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Distributor not found" });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin approve distributor → mark as approved for board placement ─────────
router.post("/distributors/:userId/approve", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const callerUser = await User.findById(caller.userId).select("email").lean() as any;
    const isAdmin = await isBat246CardAdmin(callerUser?.email, caller.userId, "distributors", "inviteandplace");
    if (!isAdmin && !(await isFirstBasePlayer(caller.userId))) {
      return res.status(403).json({ error: "Admin only" });
    }

    const targetUserId = req.params.userId;
    const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) });
    if (!dist?.isQualified) return res.status(400).json({ error: "User is not qualified" });
    if (dist.isApproved) return res.status(400).json({ error: "User is already approved" });

    const { boardId, position, toDugout } = req.body as { boardId?: string; position?: string; toDugout?: boolean };
    if (!boardId) return res.status(400).json({ error: "boardId is required" });

    let placement: { position: string; boardTrackingNo: string };
    if (toDugout) {
      placement = await placeUserInDugout(targetUserId, boardId);
    } else {
      if (!position) return res.status(400).json({ error: "position is required" });
      // Non-admin 1st Base Approve: the placed person was referred by the *approver*,
      // not by whichever 1st Base player covers the target slot. Suppress the Green
      // Card that placeUserFromReservation would otherwise give to the slot's pair owner.
      placement = await placeUserFromReservation(targetUserId, { boardId, position }, { skipGreenCard: !isAdmin });
    }

    dist.isApproved = true;
    dist.approvedAt = dist.approvedAt ?? new Date();
    await dist.save();

    // Award Gold instantly to the 1st Base approver if this was their
    // one-time Gold Approve (salesCredits===2, no card yet).
    if (!isAdmin) {
      await maybeAwardGoldToApprover(caller.userId, targetUserId, toDugout ? undefined : position);
    }

    res.json({ ok: true, placement });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POD invite — "Invite To POD" / "POD Invite Status" columns ──────────────
// Any logged-in user may send/resend (no cooldown — every click sends a real
// email); first-touch attribution is enforced inside sendPodInvite itself.
router.post("/distributors/:userId/invite-pod", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const result = await sendPodInvite(req.params.userId, caller.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POD access gate — "Invite To POD" / "POD Invite Status" columns ─────────
// Whether the caller is part of ANY active board at all. Drives whether the
// Invite/Remind/Ready-to-place buttons are clickable on the Distributors grid.
router.get("/my-active-board-membership", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const isPartOfActiveBoard = await isPartOfAnyActiveBoard(caller.userId);
    res.json({ ok: true, isPartOfActiveBoard });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/distributors/:userId/place-pod", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const { boardId } = req.body as { boardId?: string };
    if (!boardId) return res.status(400).json({ error: "boardId is required" });
    const result = await placeUserInPod(req.params.userId, boardId, caller.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── $650 Board Entry invite — "Invite To Board" / "Board Invite Status"
// columns (Inviteandplace page only) ──────────────────────────────────────
// Same no-cooldown, any-click-sends-a-real-email pattern as invite-pod above;
// first-touch attribution is enforced inside sendBoardInvite itself.
router.post("/distributors/:userId/invite-board", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const result = await sendBoardInvite(req.params.userId, caller.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Placement-info for the OPEN board-placement flow ("Ready to be placed on
// board") — gated by isPartOfAnyActiveBoard (same as invite-board), NOT
// admin/1st-Base like /distributors/:userId/placement-info above. A second,
// more open path onto the board tree; both converge on the same isApproved
// flag as the existing Approve flow.
router.get("/distributors/:userId/board-placement-info", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const boardId = typeof req.query.boardId === "string" ? req.query.boardId : undefined;
    const info = await getBoardPlacementInfoForCaller(req.params.userId, caller.userId, boardId);
    res.json({ ok: true, ...info });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/distributors/:userId/place-on-board", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const { boardId, position, toDugout } = req.body as { boardId?: string; position?: string; toDugout?: boolean };
    if (!boardId) return res.status(400).json({ error: "boardId is required" });
    const choice = toDugout ? { boardId, toDugout: true as const } : { boardId, position: position ?? "" };
    if (!toDugout && !position) return res.status(400).json({ error: "position is required" });
    const result = await placeDistributorOnBoard(req.params.userId, caller.userId, choice);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// All 4 members of a POD team — powers the popup shown when clicking a
// dugout slot rendered as "P-100X" (a POD cycle's 4th entrant) instead of a
// name. See getPodTeamDetails() for why the 4 members can span 2 boards.
router.get("/pod-team/:teamId", requireAuth, async (req, res) => {
  try {
    const result = await getPodTeamDetails(req.params.teamId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Card-earning history for a player — used by the board UI hover tooltip.
// Returns SalesCredit records for the given player, optionally filtered by cardType.
router.get("/players/:playerId/card-history", requireAuth, async (req, res) => {
  try {
    const { playerId } = req.params;
    const { cardType } = req.query as { cardType?: string };

    if (!Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: "Invalid playerId" });
    }

    const query: Record<string, any> = { playerId: new Types.ObjectId(playerId) };
    if (cardType) query.cardType = cardType;

    const records = await Bat246SalesCredit.find(query)
      .select("cardType earnedAt boardTrackingNumber referredUserId referredUserName position cardBack")
      .sort({ earnedAt: 1 })
      .lean();

    // Enrich cardBack with live distributorId — the snapshot is frozen at card-earn time,
    // before the referred user may have qualified and received their distributorId.
    // Lookup chain: bat246Player._id → bat246Player.userId → Bat246Distributor.userId → distributorId
    // (Bat246Distributor.playerId is optional/may be unset, so we join via userId like the board service does)
    const playerIdSet = new Set<string>([playerId]);
    for (const r of records as any[]) {
      if (r.referredUserId) playerIdSet.add(r.referredUserId.toString());
      if (r.cardBack?.stolenFrom?.playerId) playerIdSet.add(r.cardBack.stolenFrom.playerId.toString());
      if (r.cardBack?.stolenBy?.playerId) playerIdSet.add(r.cardBack.stolenBy.playerId.toString());
    }
    const playerDocs = await Bat246Player.find({
      _id: { $in: [...playerIdSet].map((id) => new Types.ObjectId(id)) },
    }).select("userId").lean() as any[];
    const playerUserMap = new Map<string, string>(
      playerDocs.filter((p: any) => p.userId).map((p: any) => [p._id.toString(), p.userId.toString()])
    );
    const userIds = [...new Set(playerDocs.map((p: any) => p.userId?.toString()).filter(Boolean))];
    const distDocs = await Bat246Distributor.find({
      userId: { $in: userIds },
    }).select("userId distributorId").lean() as any[];
    console.log("[card-history debug] playerIdSet:", [...playerIdSet]);
    console.log("[card-history debug] playerDocs:", JSON.stringify(playerDocs));
    console.log("[card-history debug] userIds:", userIds);
    console.log("[card-history debug] distDocs:", JSON.stringify(distDocs));
    // Map: bat246Player._id → distributorId (via userId)
    const distMap = new Map<string, string | null>();
    for (const [pid, uid] of playerUserMap) {
      const dist = (distDocs as any[]).find((d: any) => d.userId.toString() === uid);
      distMap.set(pid, dist?.distributorId ?? null);
    }
    console.log("[card-history debug] distMap:", [...distMap.entries()]);

    const enriched = (records as any[]).map((r) => {
      if (!r.cardBack) return r;
      const cb = { ...r.cardBack };
      // assignedTo = shows the green card owner/earner's ID (playerId = the referrer)
      if (cb.assignedTo) {
        cb.assignedTo = { ...cb.assignedTo, distributorId: distMap.get(playerId) ?? null };
      }
      // freePosition = shows the referred user's ID (referredUserId = who was placed)
      if (cb.freePosition && r.referredUserId) {
        cb.freePosition = { ...cb.freePosition, distributorId: distMap.get(r.referredUserId.toString()) ?? null };
      }
      // stolenFrom = the 1st Base player whose green card was skipped for gold (gold cards only)
      if (cb.stolenFrom?.playerId) {
        cb.stolenFrom = { ...cb.stolenFrom, distributorId: distMap.get(cb.stolenFrom.playerId.toString()) ?? null };
      }
      // stolenBy = the gold card earner (NoCard records only)
      if (cb.stolenBy?.playerId) {
        cb.stolenBy = { ...cb.stolenBy, distributorId: distMap.get(cb.stolenBy.playerId.toString()) ?? null };
      }
      return { ...r, cardBack: cb };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

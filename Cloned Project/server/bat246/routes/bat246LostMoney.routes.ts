import { Router } from "express";
import { Types } from "mongoose";
import multer from "multer";
import { requireAuth, softAuth } from "../../middleware/auth";
import { s3Service } from "../../services/s3";
import { Bat246LostMoneyClaim } from "../models/bat246LostMoneyClaim.model";
import { Bat246LostMoneyTestimonial } from "../models/bat246LostMoneyTestimonial.model";
import { Bat246LostMoneyPaid } from "../models/bat246LostMoneyPaid.model";
import { Bat246LostMoneyGalleryImage } from "../models/bat246LostMoneyGalleryImage.model";
import { Bat246LostMoneyPaymentSettings } from "../models/bat246LostMoneyPaymentSettings.model";
import { User } from "../../models/user.model";
import { isBat246CardAdmin } from "../services/bat246Permission.service";

const router = Router();

// Public site: /games/bat246/lostmoney/index — mounted at /bat246/lostmoney
const ALAN_K_EMAIL = "redbaron2020@mail.com";

// Alan, or anyone Alan has granted "Lost Money" card access to via the
// Permissions page (see bat246Permission.routes.ts).
async function requireAlanK(req: any, res: any, next: any) {
  const ok = await isBat246CardAdmin(req.user?.email, req.user?.userId, "lostmoney");
  if (!ok) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

// ─── Claims (Application Form) ────────────────────────────────────────────

router.post("/claims", softAuth, async (req, res) => {
  try {
    const b = req.body ?? {};
    const companyName = String(b.companyName ?? "").trim();
    const firstName = String(b.firstName ?? "").trim();
    const lastName = String(b.lastName ?? "").trim();
    const mobileNumber = String(b.mobileNumber ?? "").trim();

    if (!companyName || !firstName || !lastName || !mobileNumber) {
      return res.status(400).json({ error: "Company name, first name, last name, and mobile number are required." });
    }

    const user = (req as any).user as { userId?: string } | undefined;

    // teamsCopyImages: URLs already uploaded client-side via /uploads/public —
    // same pattern as testimonial images. Cap defensively even though the FE
    // already limits selection, since this endpoint is unauthenticated.
    const teamsCopyImagesRaw = Array.isArray(b.teamsCopyImages) ? b.teamsCopyImages : [];
    const teamsCopyImages = teamsCopyImagesRaw
      .filter((u: any) => typeof u === "string" && u.trim())
      .map((u: string) => u.trim())
      .slice(0, 5);

    const claim = await Bat246LostMoneyClaim.create({
      userId: user?.userId && Types.ObjectId.isValid(user.userId) ? new Types.ObjectId(user.userId) : null,
      companyName,
      registrationFees: String(b.registrationFees ?? "").trim(),
      totalLoss: String(b.totalLoss ?? "").trim(),
      firstName,
      lastName,
      mobileNumber,
      city: String(b.city ?? "").trim(),
      country: String(b.country ?? "").trim(),
      cityAtLoss: String(b.cityAtLoss ?? "").trim(),
      countryAtLoss: String(b.countryAtLoss ?? "").trim(),
      lossDescription: String(b.lossDescription ?? "").trim(),
      managementNames: String(b.managementNames ?? "").trim(),
      shareholderNames: String(b.shareholderNames ?? "").trim(),
      reasonJoined: String(b.reasonJoined ?? "").trim(),
      teamsCopy: String(b.teamsCopy ?? "").trim(),
      teamsCopyImages,
      timeline: String(b.timeline ?? "").trim(),
      sponsorName: String(b.sponsorName ?? "").trim(),
      sponsorPhone: String(b.sponsorPhone ?? "").trim(),
      sponsorCity: String(b.sponsorCity ?? "").trim(),
      sponsorCountry: String(b.sponsorCountry ?? "").trim(),
      productBought: String(b.productBought ?? "").trim(),
      productCost: String(b.productCost ?? "").trim(),
      knownPeople: String(b.knownPeople ?? "").trim(),
      productChosenOrReceived: String(b.productChosenOrReceived ?? "").trim(),
      paymentMethod: String(b.paymentMethod ?? "").trim(),
      teammates: String(b.teammates ?? "").trim(),
      meetingsHosted: String(b.meetingsHosted ?? "").trim(),
      priorEarnings: String(b.priorEarnings ?? "").trim(),
      reasonForLoss: String(b.reasonForLoss ?? "").trim(),
      localManagement: String(b.localManagement ?? "").trim(),
      profitCentersOnCount: String(b.profitCentersOnCount ?? "").trim(),
      profitCentersCount: String(b.profitCentersCount ?? "").trim(),
      venuesAttended: String(b.venuesAttended ?? "").trim(),
      peopleIntroducedCount: String(b.peopleIntroducedCount ?? "").trim(),
      peopleIntroducedSaleCost: String(b.peopleIntroducedSaleCost ?? "").trim(),
      boardsProfitedCount: String(b.boardsProfitedCount ?? "").trim(),
      boardsProfitedAmount: String(b.boardsProfitedAmount ?? "").trim(),
      boardsLostCount: String(b.boardsLostCount ?? "").trim(),
      bestPart: String(b.bestPart ?? "").trim(),
      worstPart: String(b.worstPart ?? "").trim(),
      ageAtLoss: String(b.ageAtLoss ?? "").trim(),
      ageNow: String(b.ageNow ?? "").trim(),
      idNumberAtLoss: String(b.idNumberAtLoss ?? "").trim(),
    });

    res.json({ ok: true, id: claim._id.toString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — review submitted claims
router.get("/claims", requireAuth, requireAlanK, async (_req, res) => {
  try {
    // Oldest first — the admin Pending Claims list numbers these 1, 2, 3…
    // in submission order, so #1 should be the oldest claim, not the newest.
    const claims = await Bat246LostMoneyClaim.find().sort({ createdAt: 1 }).lean();
    res.json({ claims });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/claims/:id/status", requireAuth, requireAlanK, async (req, res) => {
  try {
    const { status } = req.body ?? {};
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    await Bat246LostMoneyClaim.updateOne({ _id: req.params.id }, { $set: { status } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Testimonials ──────────────────────────────────────────────────────────

router.get("/testimonials", async (_req, res) => {
  try {
    // hidden testimonials stay approved (so unhiding doesn't need re-approval)
    // but are kept off the public site.
    const testimonials = await Bat246LostMoneyTestimonial.find({ approved: true, hidden: { $ne: true } })
      .sort({ approvedAt: -1 })
      .select("name message images approvedAt")
      .lean();
    res.json({ testimonials });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const MAX_TESTIMONIAL_IMAGES = 10;
const MAX_CAPTION_LENGTH = 200;

router.post("/testimonials", softAuth, async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const message = String(req.body?.message ?? "").trim();
    if (!name || !message) {
      return res.status(400).json({ error: "Name and message are required." });
    }
    const imagesRaw = Array.isArray(req.body?.images) ? req.body.images : [];
    // Accepts either {url, caption} (current submission form) or a bare
    // string (defensive — in case an older cached frontend, or any other
    // future caller, still sends the pre-caption plain-URL shape).
    const images = imagesRaw
      .map((entry: any) => {
        if (typeof entry === "string") return { url: entry.trim(), caption: "" };
        if (entry && typeof entry.url === "string") {
          return {
            url: entry.url.trim(),
            caption: typeof entry.caption === "string" ? entry.caption.trim().slice(0, MAX_CAPTION_LENGTH) : "",
          };
        }
        return null;
      })
      .filter((img: any): img is { url: string; caption: string } => !!img && !!img.url)
      .slice(0, MAX_TESTIMONIAL_IMAGES);

    await Bat246LostMoneyTestimonial.create({ name, message, images });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — moderation queue
router.get("/testimonials/pending", requireAuth, requireAlanK, async (_req, res) => {
  try {
    const testimonials = await Bat246LostMoneyTestimonial.find({ approved: false }).sort({ createdAt: -1 }).lean();
    res.json({ testimonials });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — every testimonial currently live on the public site
router.get("/testimonials/approved", requireAuth, requireAlanK, async (_req, res) => {
  try {
    const testimonials = await Bat246LostMoneyTestimonial.find({ approved: true }).sort({ approvedAt: -1 }).lean();
    res.json({ testimonials });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/testimonials/:id/approve", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    await Bat246LostMoneyTestimonial.updateOne(
      { _id: req.params.id },
      { $set: { approved: true, approvedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/testimonials/:id/reject", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    await Bat246LostMoneyTestimonial.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — hide a live testimonial from the public site without deleting it
router.post("/testimonials/:id/hide", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    await Bat246LostMoneyTestimonial.updateOne({ _id: req.params.id }, { $set: { hidden: true } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — bring a hidden testimonial back onto the public site
router.post("/testimonials/:id/unhide", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    await Bat246LostMoneyTestimonial.updateOne({ _id: req.params.id }, { $set: { hidden: false } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — remove a testimonial that's already live on the public site
router.post("/testimonials/:id/delete", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    await Bat246LostMoneyTestimonial.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Paid list ──────────────────────────────────────────────────────────────
//
// One row per person, not per payout. "Add" (below) either creates a row
// (first payment — sets the approved ceiling too) or, if that person is
// already on the list, tops up their running total (a repeat payment).
// Sequence ("order") is admin-controlled and independent of payment dates.
//
// 90-day waiting period gate: see the movedToLineupAt comment in
// bat246LostMoneyPaid.model.ts. These two filters classify every row into
// exactly one of the two admin grids; bat246LostMoneyAutoPay.service.ts uses
// the same ACTIVE filter so a row sitting in the waiting grid is structurally
// skipped by the real money drip, not just hidden in the UI.
const ACTIVE_LINEUP_FILTER = { $or: [{ movedToLineupAt: { $exists: false } }, { movedToLineupAt: { $ne: null } }] };
const WAITING_LINEUP_FILTER = { movedToLineupAt: { $exists: true, $eq: null } };

// Shared by /paid/add (when creating straight into the active grid) and
// /paid/:id/move-to-lineup — always the back of the real payment queue.
async function nextActiveOrder(): Promise<number> {
  const highest = await Bat246LostMoneyPaid.findOne().sort({ order: -1 }).select("order").lean() as any;
  return (highest?.order ?? 0) + 1;
}

// Same org the "Invite to Bat246" button (below) invites people into —
// used to detect people already in the office, so the admin grid can show
// "Already part of Bat246" instead of an Invite button for them. Membership
// lives directly on the User doc (organizations[].organization), same
// pattern GET /office/bat246/members uses.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";
async function findBat246MemberIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const members = await User.find({
    _id: { $in: userIds },
    "organizations.organization": new Types.ObjectId(BAT246_ORG_ID),
  }).select("_id").lean();
  return new Set(members.map((m: any) => m._id.toString()));
}

// Public site — kept in the exact shape the public Paid List page already
// expects (amount/totalPaid/paidAt), so no frontend changes were needed
// there. No admin-only fields (reportedLoss, approvedAmount) are exposed.
//
// Only people who have actually been paid (totalPaid > 0) appear here —
// being added to the admin list (an approval, not a payment) is not
// enough. The lineup order itself is admin-only (see /paid/admin); this
// just reflects real payment history, in the same admin-controlled order.
router.get("/paid", async (req, res) => {
  try {
    const page = req.query.page ? Math.max(1, Number(req.query.page) || 1) : null;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const filter = { totalPaid: { $gt: 0 } };
    const total = await Bat246LostMoneyPaid.countDocuments(filter);
    let query = Bat246LostMoneyPaid.find(filter).sort({ order: 1 })
      .select("name totalPaid lastPaymentAmount lastPaymentAt createdAt");
    if (page) {
      query = query.skip((page - 1) * limit).limit(limit);
    }
    const paid = await query.lean();

    // Match each paid entry to an approved testimonial from the same person
    // (by exact, case-insensitive name match) so the Paid List can link to it.
    const testimonials = await Bat246LostMoneyTestimonial.find({ approved: true })
      .select("name message").lean();
    const testimonialByName = new Map(
      testimonials.map((t: any) => [String(t.name).trim().toLowerCase(), t.message])
    );

    const result = paid.map((p: any) => ({
      _id: p._id,
      name: p.name,
      amount: p.lastPaymentAmount ?? 0,
      totalPaid: p.totalPaid ?? 0,
      paidAt: p.lastPaymentAt ?? p.createdAt,
      testimonial: testimonialByName.get(String(p.name).trim().toLowerCase()) ?? null,
    }));

    res.json({ paid: result, total, page: page ?? 1, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — the full backoffice grid: every admin-only field, plus dynamic
// stats (computed across the WHOLE collection — both grids — unaffected by
// pagination or which grid is being viewed, since totalRepaid is real money
// paid regardless of who's currently waiting).
//
// ?lineup=active (default) → "No Wait Lineup" grid. ?lineup=waiting →
// "90 Days Waiting Period" grid.
router.get("/paid/admin", requireAuth, requireAlanK, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const lineup = req.query.lineup === "waiting" ? "waiting" : "active";
    const filter = lineup === "waiting" ? WAITING_LINEUP_FILTER : ACTIVE_LINEUP_FILTER;

    const [total, paidRows, stats] = await Promise.all([
      Bat246LostMoneyPaid.countDocuments(filter),
      Bat246LostMoneyPaid.find(filter)
        .sort({ order: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      // totalMembers = actually-paid people only (totalPaid > 0 — same
      // rule the public /paid list uses), not "everyone on either grid".
      // Someone only counts here once a full $300 round has landed for
      // them and they've moved to the end of the lineup.
      Bat246LostMoneyPaid.aggregate([
        {
          $group: {
            _id: null,
            totalRepaid: { $sum: "$totalPaid" },
            totalMembers: { $sum: { $cond: [{ $gt: ["$totalPaid", 0] }, 1, 0] } },
          },
        },
      ]),
    ]);

    // Waiting grid only: attach the (pause-aware) eligible date per row —
    // see computeEligibleInfo() above.
    let paid: any[] = paidRows;
    if (lineup === "waiting" && paidRows.length > 0) {
      const settings = await getHealedPaymentSettings();
      paid = paidRows.map((p: any) => {
        const { eligibleOn, eligibleNow } = computeEligibleInfo(p.createdAt, settings.pauseHistory);
        return { ...p, eligibleOn, eligibleNow };
      });
    }

    // Both grids: flag rows whose linked account is already in the Bat246
    // office, so the frontend can swap the Invite button for a static
    // "Already part of Bat246" badge instead.
    if (paid.length > 0) {
      const linkedUserIds = paid.filter((p: any) => p.userId).map((p: any) => p.userId.toString());
      const memberIds = await findBat246MemberIds(linkedUserIds);
      paid = paid.map((p: any) => ({
        ...p,
        alreadyBat246Member: p.userId ? memberIds.has(p.userId.toString()) : false,
      }));
    }

    res.json({
      paid,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      lineup,
      stats: {
        totalMembers: stats[0]?.totalMembers ?? 0,
        totalRepaid: stats[0]?.totalRepaid ?? 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — add a payment. Creates a new row (first payment for this person,
// also sets the approved ceiling + reported loss) or, if this person is
// already on the list (matched by userId, else by name), tops up their
// running total instead of creating a duplicate row.
router.post("/paid/add", requireAuth, requireAlanK, async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const amount = Number(req.body?.amount);
    if (!name) return res.status(400).json({ error: "Name is required." });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Enter a valid amount." });
    }

    const userIdRaw = req.body?.userId;
    let userId: string | null = null;
    if (userIdRaw) {
      if (!Types.ObjectId.isValid(userIdRaw)) return res.status(400).json({ error: "Invalid userId" });
      userId = userIdRaw;
    }

    const matchQuery = userId ? { userId } : { name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } };
    const existing = await Bat246LostMoneyPaid.findOne(matchQuery);

    // NOTE: this only records an *approval*, not a payment. Approving a
    // claim (or approving more for someone already on the list) does not
    // mean money has actually gone out — totalPaid / lastPaymentAt are left
    // untouched here and only move automatically via the 3%-of-sale drip
    // in bat246LostMoneyAutoPay.service.ts.
    if (existing) {
      // Repeat approval — add to the approved ceiling, leave the reported
      // loss and everything payment-related exactly as it was.
      existing.approvedAmount += amount;
      await existing.save();
      return res.json({ ok: true, entry: existing, created: false });
    }

    // Which grid this new row lands in: whichever one the admin had open
    // when they hit Add (frontend sends its current lineupView). Defaults
    // to "waiting" if omitted (older clients / API callers) — new
    // approvals are parked in the 90 Days Waiting Period grid by default,
    // an admin has to explicitly click "Move to Lineup" (see
    // /paid/:id/move-to-lineup below) before the auto-pay drip can ever
    // pay them. Passing lineup: "active" skips the wait entirely — an
    // explicit admin decision made right at approval time, same as
    // clicking Move immediately after adding would do.
    const intoActive = req.body?.lineup === "active";
    const order = intoActive ? await nextActiveOrder() : await Bat246LostMoneyPaid.countDocuments(WAITING_LINEUP_FILTER);
    const entry = await Bat246LostMoneyPaid.create({
      name,
      userId,
      email: String(req.body?.email ?? "").trim(),
      claimId: req.body?.claimId && Types.ObjectId.isValid(req.body.claimId) ? req.body.claimId : null,
      reportedLoss: String(req.body?.reportedLoss ?? "").trim(),
      approvedAmount: amount,
      totalPaid: 0,
      lastPaymentAmount: 0,
      lastPaymentAt: null,
      order,
      movedToLineupAt: intoActive ? new Date() : null,
    });
    // Total rows now in the SAME grid this one just landed in — lets the
    // frontend jump straight to the last page of that grid without an
    // extra round trip.
    const totalInGrid = await Bat246LostMoneyPaid.countDocuments(intoActive ? ACTIVE_LINEUP_FILTER : WAITING_LINEUP_FILTER);
    res.json({ ok: true, entry, created: true, total: totalInGrid, lineup: intoActive ? "active" : "waiting" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — directly edit the approved ceiling on an existing row (correcting
// a mistake, unlike /paid/add's "top up" behavior which only ever adds).
router.post("/paid/:id/edit-amount", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Enter a valid amount." });
    }
    const entry = await Bat246LostMoneyPaid.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Not found" });
    // Can't approve less than what's already been paid out — would make
    // totalPaid exceed the approved ceiling, breaking the auto-pay drip's
    // "roundTarget = min(300, approvedAmount - totalPaid)" math.
    if (amount < entry.totalPaid) {
      return res.status(400).json({ error: `Can't be less than the $${entry.totalPaid} already paid.` });
    }
    entry.approvedAmount = amount;
    await entry.save();
    res.json({ ok: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — correct a row's display name (typo fix, name change, etc.).
// Purely cosmetic — doesn't touch userId/email or anything payment-related.
router.post("/paid/:id/edit-name", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Name is required." });
    const entry = await Bat246LostMoneyPaid.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Not found" });
    entry.name = name;
    await entry.save();
    res.json({ ok: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — move a row out of the "90 Days Waiting Period" grid and into the
// "No Wait Lineup" grid. One-directional (no move-back). Always joins the
// BACK of the real payment queue (max order + 1), not wherever its "order"
// happened to land while it was just sitting in the waiting grid.
router.post("/paid/:id/move-to-lineup", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const entry = await Bat246LostMoneyPaid.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Not found" });
    if (entry.movedToLineupAt) return res.status(400).json({ error: "Already in the lineup." });

    entry.order = await nextActiveOrder();
    entry.movedToLineupAt = new Date();
    await entry.save();
    res.json({ ok: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — the reverse of the above: pull a row back out of the No Wait
// Lineup and park it in the 90 Days Waiting Period grid. Works on any row
// (including legacy rows that never had movedToLineupAt at all) — after
// this call the field is explicitly `null`, which is exactly what
// WAITING_LINEUP_FILTER matches. Doesn't touch totalPaid/roundAccumulated —
// this only changes which grid they show in and pauses future auto-pay
// rounds for them; nothing already paid is undone.
router.post("/paid/:id/move-to-waiting", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const entry = await Bat246LostMoneyPaid.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Not found" });
    entry.movedToLineupAt = null;
    await entry.save();
    res.json({ ok: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — remove an entry from the Paid List
router.post("/paid/:id/delete", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    await Bat246LostMoneyPaid.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — swap the sequence position of two rows (used by the grid's
// move-earlier/move-later controls). A pairwise swap, rather than
// re-indexing the whole list, so it works correctly across pagination.
router.post("/paid/swap-order", requireAuth, requireAlanK, async (req, res) => {
  try {
    const { idA, idB } = req.body ?? {};
    if (!Types.ObjectId.isValid(idA) || !Types.ObjectId.isValid(idB)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const [a, b] = await Promise.all([
      Bat246LostMoneyPaid.findById(idA).select("order"),
      Bat246LostMoneyPaid.findById(idB).select("order"),
    ]);
    if (!a || !b) return res.status(404).json({ error: "Not found" });
    const aOrder = a.order;
    a.order = b.order;
    b.order = aOrder;
    await Promise.all([a.save(), b.save()]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — search Garage users in the Bat246 office by name or email, to link
// a paid entry to an existing account instead of typing the name freehand.
router.get("/people/search", requireAuth, requireAlanK, async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ users: [] });
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    // Search across all of Garage, not just the Bat246 org — the Paid List
    // can include people who lost money outside of Bat246's own office.
    const users = await User.find(
      {
        isVerified: true,
        $or: [{ name: regex }, { email: regex }, { phone: regex }],
      },
      { _id: 1, name: 1, email: 1 }
    )
      .limit(10)
      .lean();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Home-page gallery (admin-managed) ─────────────────────────────────────

const GALLERY_ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"]);
const galleryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (GALLERY_ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    cb(null, false);
  },
});

function buildGalleryKey(originalName: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `bat246-lostmoney-gallery/${timestamp}_${randomId}_${safeName}`;
}

// Public — images shown in the homepage gallery, in admin-chosen sequence
router.get("/gallery", async (_req, res) => {
  try {
    const images = await Bat246LostMoneyGalleryImage.find().sort({ order: 1, createdAt: 1 }).select("url order").lean();
    res.json({ images });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — upload a new gallery image (appended to the end of the sequence)
router.post("/gallery", requireAuth, requireAlanK, galleryUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided or file type not allowed" });
    }
    const { buffer, originalname, mimetype } = req.file;
    const key = buildGalleryKey(originalname);
    await s3Service.uploadFile(key, buffer, mimetype, { uploadedVia: "bat246-lostmoney-gallery" });
    const url = s3Service.getPublicUrl(key);
    const count = await Bat246LostMoneyGalleryImage.countDocuments();
    const image = await Bat246LostMoneyGalleryImage.create({ url, key, order: count });
    res.json({ ok: true, image: { _id: image._id, url: image.url, order: image.order } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — save the sequence the images should appear in on the homepage
router.post("/gallery/reorder", requireAuth, requireAlanK, async (req, res) => {
  try {
    const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
    if (orderedIds.some((id: any) => typeof id !== "string" || !Types.ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid id in orderedIds" });
    }
    await Promise.all(
      orderedIds.map((id: string, index: number) =>
        Bat246LostMoneyGalleryImage.updateOne({ _id: id }, { $set: { order: index } })
      )
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin — remove a gallery image
router.post("/gallery/:id/delete", requireAuth, requireAlanK, async (req, res) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid id" });
    const image = await Bat246LostMoneyGalleryImage.findById(req.params.id).lean();
    if (!image) return res.status(404).json({ error: "Not found" });
    await Bat246LostMoneyGalleryImage.deleteOne({ _id: req.params.id });
    try {
      await s3Service.deleteFile((image as any).key);
    } catch (e) {
      console.warn("[bat246LostMoneyGallery] Failed to delete S3 object, continuing:", e);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Payment distribution on/off switch ────────────────────────────────────
// Read by bat246LostMoneyAutoPay.service.ts on every real Bat246 sale —
// paused means the automatic 3% drip does nothing at all that sale.

// Loads the singleton, creating it if needed, and self-heals one edge case:
// this doc was paused before pauseHistory existed, so there's no recorded
// start time for whatever pause is in effect right now. If we're currently
// paused but have no open interval, backfill one starting at `updatedAt`
// (the last time this doc was written — i.e. when it was last paused) so
// the 90-day countdown freeze (below) has something to work from.
async function getHealedPaymentSettings() {
  let settings = await Bat246LostMoneyPaymentSettings.findOne();
  if (!settings) {
    settings = await Bat246LostMoneyPaymentSettings.create({ paymentsEnabled: true });
  }
  if (settings.paymentsEnabled === false) {
    const open = settings.pauseHistory.find((p: any) => !p.resumedAt);
    if (!open) {
      settings.pauseHistory.push({ pausedAt: settings.updatedAt ?? new Date(), resumedAt: null });
      await settings.save();
    }
  }
  return settings;
}

// 90-Day Waiting Period countdown, frozen while payments are paused —
// confirmed: paused time should not count toward someone's 90 days. Works
// by subtracting every pauseHistory interval's overlap with
// [createdAt, now] from the raw elapsed time, then projecting forward from
// "now" by whatever's left. While a pause is still ongoing, this naturally
// stays frozen (each extra second of "now" is also inside the ongoing
// paused interval, so it cancels out) — see the comment in
// bat246_lostmoney_autopay.md for the worked-through math.
const WAITING_PERIOD_MS = 90 * 24 * 60 * 60 * 1000;
function computeEligibleInfo(createdAt: Date, pauseHistory: Array<{ pausedAt: Date; resumedAt: Date | null }>) {
  const now = Date.now();
  const created = createdAt.getTime();
  let pausedOverlapMs = 0;
  for (const p of pauseHistory ?? []) {
    const start = Math.max(created, new Date(p.pausedAt).getTime());
    const end = Math.min(now, p.resumedAt ? new Date(p.resumedAt).getTime() : now);
    if (end > start) pausedOverlapMs += end - start;
  }
  const activeElapsedMs = Math.max(0, now - created - pausedOverlapMs);
  const remainingMs = Math.max(0, WAITING_PERIOD_MS - activeElapsedMs);
  return {
    eligibleOn: new Date(now + remainingMs),
    eligibleNow: activeElapsedMs >= WAITING_PERIOD_MS,
  };
}

router.get("/payments/status", requireAuth, requireAlanK, async (_req, res) => {
  try {
    const settings = await getHealedPaymentSettings();
    res.json({
      paymentsEnabled: settings.paymentsEnabled,
      updatedByEmail: settings.updatedByEmail,
      updatedAt: settings.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/payments/toggle", requireAuth, requireAlanK, async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const settings = await getHealedPaymentSettings();

    if (enabled !== settings.paymentsEnabled) {
      const now = new Date();
      if (!enabled) {
        // true → false: a new pause interval starts now.
        settings.pauseHistory.push({ pausedAt: now, resumedAt: null });
      } else {
        // false → true: close out whichever interval is still open.
        const open = settings.pauseHistory.find((p: any) => !p.resumedAt);
        if (open) open.resumedAt = now;
      }
    }
    settings.paymentsEnabled = enabled;
    settings.updatedByEmail = req.user?.email ?? "";
    await settings.save();

    res.json({
      paymentsEnabled: settings.paymentsEnabled,
      updatedByEmail: settings.updatedByEmail,
      updatedAt: settings.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

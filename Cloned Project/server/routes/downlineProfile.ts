// ───────────────────────────────────────────────────────────────────────
// Downline member profile — per-tab data with server-side sort + pagination.
//
// The header comes from GET /affiliate/user-info/:userId (identity, upline,
// location, counts). This route serves every profile TAB:
//
//   GET /affiliate/downline/:userId/purchases
//       ?category=<offices|communities|live_streams|courses|digital_products|all>
//       &page=1&limit=20&sortBy=<columnId>&sortOrder=<asc|desc>
//
// …plus the header's monthly activity chart:
//
//   GET /affiliate/downline/:userId/monthly?year=YYYY
// ───────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireUserOrGarageAdmin } from "../middleware/userOrGarageAdmin";
import { getMemberMonthlyActivity } from "../services/downlineMemberMonthly";
import {
  listMemberLiveStreams,
  listMemberLiveStreamSessions,
} from "../services/downlineMemberLiveStreams";
import {
  listMemberPurchases,
  listMemberOffices,
  listMemberCommunities,
  listMemberPhysicalOrders,
  MemberTabCategory,
  SortOrder,
} from "../services/downlineMemberPurchases";

const router = Router();

const VALID_CATEGORIES: MemberTabCategory[] = [
  "all",
  "offices",
  "communities",
  "live_streams",
  "courses",
  "digital_products",
  "physical_products",
];

router.get(
  "/downline/:userId/purchases",
  // Admin panel reaches this too (no user session) → accept a user or admin
  // token. For an admin, viewerId is undefined and the "You Earned" column is
  // simply blank (no commission relationship).
  requireUserOrGarageAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const category = String(req.query.category || "all") as MemberTabCategory;
      if (!VALID_CATEGORIES.includes(category)) {
        return res
          .status(400)
          .json({ success: false, error: `Invalid category: ${category}` });
      }
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20)
      );
      const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
      const sortOrder: SortOrder =
        String(req.query.sortOrder || "desc") === "asc" ? "asc" : "desc";

      // The viewing upline — drives the "You Earned" column (their commission
      // from this member).
      const viewerId = ((req as any).user as { userId?: string } | undefined)?.userId;

      const result =
        category === "offices"
          ? await listMemberOffices({ userId, viewerId, page, limit, sortBy, sortOrder })
          : category === "communities"
            ? await listMemberCommunities({ userId, viewerId, page, limit, sortBy, sortOrder })
            : category === "physical_products"
              ? await listMemberPhysicalOrders({ userId, page, limit, sortBy, sortOrder })
              : await listMemberPurchases({
                  userId,
                  viewerId,
                  category,
                  page,
                  limit,
                  sortBy,
                  sortOrder,
                });

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("💥 Error listing member tab data:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to list member tab data",
        details: (error as Error).message,
      });
    }
  }
);

// ── GET /affiliate/downline/:userId/monthly?year=YYYY ────────────────────
// Monthly spend + the viewer's earnings for the profile header chart. Same
// auth as the tabs above: for a garage admin there is no commission
// relationship, so `earned` comes back as zeros.
router.get(
  "/downline/:userId/monthly",
  requireUserOrGarageAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: "Invalid userId" });
      }

      const now = new Date();
      const parsedYear = parseInt(String(req.query.year ?? ""), 10);
      // Clamp to a sane window — the year reaches a $match on an indexed date,
      // and a garbage value would otherwise scan a nonsense range.
      const year =
        Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
          ? parsedYear
          : now.getUTCFullYear();

      const viewerId = ((req as any).user as { userId?: string } | undefined)
        ?.userId;

      const result = await getMemberMonthlyActivity(
        new Types.ObjectId(userId),
        viewerId && Types.ObjectId.isValid(viewerId)
          ? new Types.ObjectId(viewerId)
          : undefined,
        year,
      );

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("💥 Error building member monthly activity:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to load monthly activity",
        details: (error as Error).message,
      });
    }
  },
);

// ── GET /affiliate/downline/:userId/live-streams ─────────────────────────
// The Live Streams tab: one row per live stream the member registered for.
// Deliberately backed by its own service, not the founder console's — see
// the header of services/downlineMemberLiveStreams.ts.
router.get(
  "/downline/:userId/live-streams",
  requireUserOrGarageAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, error: "Invalid userId" });
      }
      const viewerId = ((req as any).user as { userId?: string } | undefined)
        ?.userId;
      const result = await listMemberLiveStreams({ userId, viewerId });
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("💥 Error listing member live streams:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to list live streams",
        details: (error as Error).message,
      });
    }
  },
);

// ── GET /affiliate/downline/:userId/live-streams/:workshopId/sessions ────
// The "See Session Level Data" drill-down — one row per session of that
// stream that this member registered for.
router.get(
  "/downline/:userId/live-streams/:workshopId/sessions",
  requireUserOrGarageAdmin,
  async (req: Request, res: Response) => {
    try {
      const { userId, workshopId } = req.params;
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workshopId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid userId or workshopId" });
      }
      const viewerId = ((req as any).user as { userId?: string } | undefined)
        ?.userId;
      const result = await listMemberLiveStreamSessions({
        userId,
        workshopId,
        viewerId,
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("💥 Error listing member live-stream sessions:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to list sessions",
        details: (error as Error).message,
      });
    }
  },
);

export default router;

import { Router } from "express";
import { Types } from "mongoose";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";

const router = Router();

// GET /discover/categories - Get all unique categories with counts
router.get("/categories", async (req, res) => {
  try {
    const categories = await Organization.aggregate([
      // Only get orgs that have a non-empty category
      { $match: { category: { $exists: true, $ne: "" } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { name: "$_id", count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /discover/organizations - Get organizations with filtering, search, pagination
router.get("/organizations", async (req, res) => {
  try {
    const {
      search,
      category,
      page = "1",
      limit = "12",
    } = req.query as {
      search?: string;
      category?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

    // Build query - show ALL organizations
    const query: Record<string, unknown> = {};

    // Search by name (case-insensitive)
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }

    // Filter by category (case-insensitive match)
    if (category && category.trim()) {
      query.category = { $regex: `^${category.trim()}$`, $options: "i" };
    }

    // Execute query with pagination
    const [organizations, total] = await Promise.all([
      Organization.find(query)
        .select(
          "_id name slug description icon coverPhoto category city state country createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Organization.countDocuments(query),
    ]);

    // Get member count for each organization
    const orgsWithMemberCount = await Promise.all(
      organizations.map(async (org) => {
        const memberCount = await User.countDocuments({
          "organizations.organization": org._id,
        });
        return {
          ...org,
          memberCount,
        };
      })
    );

    res.json({
      success: true,
      organizations: orgsWithMemberCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch organizations",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /discover/featured - Get featured organizations (newest orgs)
router.get("/featured", async (req, res) => {
  try {
    // Get ALL organizations, sorted by newest first
    const organizations = await Organization.find({})
      .select(
        "_id name slug description icon coverPhoto category city state country createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    // Get member count for each organization
    const orgsWithMemberCount = await Promise.all(
      organizations.map(async (org) => {
        const memberCount = await User.countDocuments({
          "organizations.organization": org._id,
        });
        return {
          ...org,
          memberCount,
        };
      })
    );

    res.json({
      success: true,
      organizations: orgsWithMemberCount,
    });
  } catch (error) {
    console.error("Error fetching featured organizations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch featured organizations",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /discover/trending - Offices that gained the most members recently,
// ranked by memberships whose joinedAt falls in the last `days` (default 7).
// Offices nobody joined in that window are left out. Feeds the web Offices
// page's Featured and Trending rows (/discover/featured is the mobile app's
// newest-offices list, so it keeps its meaning).
router.get("/trending", async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? "7"), 10) || 7));
    const limit = Math.min(24, Math.max(1, parseInt(String(req.query.limit ?? "6"), 10) || 6));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ranked = await User.aggregate<{ _id: Types.ObjectId; recentJoins: number }>([
      { $match: { "organizations.joinedAt": { $gte: since } } },
      { $unwind: "$organizations" },
      { $match: { "organizations.joinedAt": { $gte: since } } },
      { $group: { _id: "$organizations.organization", recentJoins: { $sum: 1 } } },
      { $sort: { recentJoins: -1, _id: 1 } },
      { $limit: limit },
    ]);

    const organizations = await Organization.find({ _id: { $in: ranked.map((r) => r._id) } })
      .select("_id name slug description icon coverPhoto category city state country createdAt")
      .lean();
    const byId = new Map(organizations.map((org) => [String(org._id), org]));

    // Keep the ranking order; skip memberships that point at deleted offices.
    const ranking = await Promise.all(
      ranked
        .filter((r) => byId.has(String(r._id)))
        .map(async (r) => ({
          ...byId.get(String(r._id))!,
          memberCount: await User.countDocuments({ "organizations.organization": r._id }),
          recentJoins: r.recentJoins,
        }))
    );

    res.json({ success: true, days, organizations: ranking });
  } catch (error) {
    console.error("Error fetching trending organizations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch trending organizations",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;

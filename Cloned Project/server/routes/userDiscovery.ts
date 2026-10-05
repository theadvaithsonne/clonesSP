import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { Types } from "mongoose";

const router = Router();

// Search/list all platform users
router.get("/discover", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };

  const { search, page = 1, limit = 20, excludeSelf = "true" } = z
    .object({
      search: z.string().optional(),
      page: z.coerce.number().min(1).optional(),
      limit: z.coerce.number().min(1).max(50).optional(),
      excludeSelf: z.string().optional(),
    })
    .parse(req.query);

  const skip = (page - 1) * limit;

  // Build query
  const query: any = {};

  // Exclude self if requested (default true)
  if (excludeSelf !== "false") {
    query._id = { $ne: new Types.ObjectId(me.userId) };
  }

  // Search by name or email if search term provided
  if (search && search.trim()) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
  }

  // Only return verified users
  query.isVerified = true;

  // Fetch users with pagination
  const [users, total] = await Promise.all([
    User.find(query, {
      _id: 1,
      name: 1,
      email: 1,
      profilePicture: 1,
      city: 1,
      state: 1,
      country: 1,
    })
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.json({
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  });
});

// Get a specific user's public profile
router.get("/discover/:userId", requireAuth, async (req, res) => {
  const { userId } = z.object({ userId: z.string() }).parse(req.params);

  if (!Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const user = await User.findById(userId, {
    _id: 1,
    name: 1,
    email: 1,
    profilePicture: 1,
    city: 1,
    state: 1,
    country: 1,
  }).lean();

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ user });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { UserActivity } from "../models/userActivity.model";
import { Types } from "mongoose";
import { getSocketInstance } from "../services/socket";

const router = Router();

// Get user activities with pagination
router.get("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const orgId = req.query.orgId as string;
  
  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  const { 
    cursor, 
    limit = 50, 
    category, 
    type, 
    isRead 
  } = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().max(100).optional(),
    category: z.string().optional(),
    type: z.string().optional(),
    isRead: z.coerce.boolean().optional()
  }).parse(req.query);

  try {
    const query: any = { 
      userId: new Types.ObjectId(me.userId),
      orgId: new Types.ObjectId(orgId)
    };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    if (category) {
      query.category = category;
    }

    if (type) {
      query.type = type;
    }

    if (isRead !== undefined) {
      query.isRead = isRead;
    }

    const activities = await UserActivity.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const nextCursor = activities.length ? activities[activities.length - 1].createdAt.toISOString() : null;
    
    res.json({ 
      activities: activities.reverse(), // Reverse to show oldest first
      nextCursor 
    });
  } catch (error) {
    console.error("Error fetching user activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

// Get organization-wide activities (for founders/admins)
router.get("/org", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const orgId = req.query.orgId as string;
  
  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  const { 
    cursor, 
    limit = 50, 
    category, 
    type 
  } = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().max(100).optional(),
    category: z.string().optional(),
    type: z.string().optional()
  }).parse(req.query);

  try {
    const query: any = { 
      orgId: new Types.ObjectId(orgId),
      userId: { $ne: new Types.ObjectId(me.userId) } // Exclude current user's activities
    };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    if (category) {
      query.category = category;
    }

    if (type) {
      query.type = type;
    }

    const activities = await UserActivity.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const nextCursor = activities.length ? activities[activities.length - 1].createdAt.toISOString() : null;
    
    res.json({ 
      activities: activities.reverse(),
      nextCursor 
    });
  } catch (error) {
    console.error("Error fetching org activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

// Create a new activity
router.post("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  
  const {
    orgId,
    type,
    title,
    description,
    metadata = {},
    category,
    priority = "medium"
  } = z.object({
    orgId: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string(),
    metadata: z.any().optional(),
    category: z.string(),
    priority: z.enum(["low", "medium", "high"]).optional()
  }).parse(req.body);

  try {
    const activity = await UserActivity.create({
      userId: new Types.ObjectId(me.userId),
      orgId: new Types.ObjectId(orgId),
      type,
      title,
      description,
      metadata,
      category,
      priority
    });

    const populatedActivity = await UserActivity.findById(activity._id)
      .populate('userId', 'name email')
      .lean();

    // Emit real-time activity to organization members
    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}`).emit("activity:new", { activity: populatedActivity });
    }

    res.status(201).json({ activity: populatedActivity });
  } catch (error) {
    console.error("Error creating activity:", error);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

// Mark activities as read
router.post("/read", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const orgId = req.body.orgId;
  
  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  try {
    await UserActivity.updateMany(
      { 
        userId: new Types.ObjectId(me.userId),
        orgId: new Types.ObjectId(orgId),
        isRead: false 
      },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking activities as read:", error);
    res.status(500).json({ error: "Failed to mark activities as read" });
  }
});

// Get unread count
router.get("/unread-count", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const orgId = req.query.orgId as string;
  
  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  try {
    const count = await UserActivity.countDocuments({
      userId: new Types.ObjectId(me.userId),
      orgId: new Types.ObjectId(orgId),
      isRead: false
    });

    res.json({ count });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// Get organization-wide unread count (excluding current user's activities)
router.get("/org/unread-count", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const orgId = req.query.orgId as string;
  
  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  try {
    const count = await UserActivity.countDocuments({
      orgId: new Types.ObjectId(orgId),
      userId: { $ne: new Types.ObjectId(me.userId) }, // Exclude current user
      isRead: false
    });

    res.json({ count });
  } catch (error) {
    console.error("Error getting org unread count:", error);
    res.status(500).json({ error: "Failed to get org unread count" });
  }
});

export default router;
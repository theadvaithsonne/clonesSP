import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Testimonial, ITestimonial } from "../models/testimonial.model";

const router = Router();

// Helper to check if user is a founder in the organization
async function isUserFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId).lean();
  if (!user) return false;

  // Check in organizations array
  const membership = user.organizations?.find(
    (org) => org.organization.toString() === orgId
  );

  if (membership && hasFounderAccess(membership)) {
    return true;
  }

  // Fallback to legacy single-org field
  if (user.organization?.toString() === orgId && ["admin", "founder"].includes(user.role || "")) {
    return true;
  }

  return false;
}

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ============ Testimonial CRUD Routes ============

// Get all testimonials (founders see all, others see published only)
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    const {
      status,
      category,
      tag,
      search,
      featured,
      page = "1",
      limit = "20",
    } = req.query;

    // Build query
    const query: any = { organizationId: new Types.ObjectId(orgId) };

    // Non-founders only see published testimonials
    if (!isFounder) {
      query.status = "published";
      query.isPublic = true;
    } else if (status) {
      query.status = status;
    }

    // Category filter
    if (category) {
      query.categories = category;
    }

    // Tag filter
    if (tag) {
      query.tags = tag;
    }

    // Featured filter
    if (featured === "true") {
      query.isFeatured = true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { clientName: { $regex: search, $options: "i" } },
        { shortDescription: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [testimonials, total] = await Promise.all([
      Testimonial.find(query)
        .sort({ isFeatured: -1, displayOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Testimonial.countDocuments(query),
    ]);

    // Get unique categories for this organization
    const allCategories = await Testimonial.distinct("categories", {
      organizationId: new Types.ObjectId(orgId),
      ...(isFounder ? {} : { status: "published", isPublic: true }),
    });

    res.json({
      success: true,
      testimonials,
      categories: allCategories,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      isFounder,
    });
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ success: false, error: "Failed to fetch testimonials" });
  }
});

// Get single testimonial
router.get("/:testimonialId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    // Try to find by ID first, then by slug
    let testimonial = await Testimonial.findOne({
      _id: Types.ObjectId.isValid(testimonialId)
        ? new Types.ObjectId(testimonialId)
        : null,
      organizationId: new Types.ObjectId(orgId),
    }).lean();

    if (!testimonial) {
      testimonial = await Testimonial.findOne({
        slug: testimonialId,
        organizationId: new Types.ObjectId(orgId),
      }).lean();
    }

    if (!testimonial) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    // Check access for non-founders
    if (!isFounder && (testimonial.status !== "published" || !testimonial.isPublic)) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    res.json({ success: true, testimonial, isFounder });
  } catch (error) {
    console.error("Error fetching testimonial:", error);
    res.status(500).json({ success: false, error: "Failed to fetch testimonial" });
  }
});

// Create testimonial (founders only)
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can create testimonials",
      });
    }

    const {
      clientName,
      clientLogo,
      clientWebsite,
      clientIndustry,
      title,
      slug: providedSlug,
      shortDescription,
      coverImage,
      featuredImage,
      categories,
      tags,
      contentBlocks,
      primaryQuote,
      primaryQuoteAuthor,
      primaryQuoteAuthorRole,
      primaryQuoteAuthorImage,
      metrics,
      artifactUrl,
      artifactLabel,
      isFeatured,
      status,
      isPublic,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!clientName || !title || !shortDescription) {
      return res.status(400).json({
        success: false,
        error: "Client name, title, and short description are required",
      });
    }

    // Generate slug if not provided
    let slug = providedSlug || generateSlug(title);

    // Ensure slug is unique within organization
    const existingSlug = await Testimonial.findOne({
      organizationId: new Types.ObjectId(orgId),
      slug,
    });

    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const testimonial = await Testimonial.create({
      organizationId: new Types.ObjectId(orgId),
      createdBy: new Types.ObjectId(userId),
      clientName,
      clientLogo,
      clientWebsite,
      clientIndustry,
      title,
      slug,
      shortDescription,
      coverImage,
      featuredImage,
      categories: categories || [],
      tags: tags || [],
      contentBlocks: contentBlocks || [],
      primaryQuote,
      primaryQuoteAuthor,
      primaryQuoteAuthorRole,
      primaryQuoteAuthorImage,
      metrics: metrics || [],
      artifactUrl,
      artifactLabel,
      isFeatured: isFeatured || false,
      displayOrder: 0,
      status: status || "draft",
      isPublic: isPublic || false,
      metaTitle,
      metaDescription,
    });

    res.status(201).json({ success: true, testimonial });
  } catch (error) {
    console.error("Error creating testimonial:", error);
    res.status(500).json({ success: false, error: "Failed to create testimonial" });
  }
});

// Update testimonial (founders only)
router.put("/:testimonialId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can update testimonials",
      });
    }

    const updateData = req.body;

    // Don't allow changing organizationId or createdBy
    delete updateData.organizationId;
    delete updateData.createdBy;

    // If slug is being changed, ensure it's unique
    if (updateData.slug) {
      const existingSlug = await Testimonial.findOne({
        organizationId: new Types.ObjectId(orgId),
        slug: updateData.slug,
        _id: { $ne: new Types.ObjectId(testimonialId) },
      });

      if (existingSlug) {
        return res.status(400).json({
          success: false,
          error: "Slug already exists for another testimonial",
        });
      }
    }

    // Set publishedAt when status changes to published
    if (updateData.status === "published") {
      const existing = await Testimonial.findById(testimonialId).lean();
      if (existing && existing.status !== "published" && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const testimonial = await Testimonial.findOneAndUpdate(
      {
        _id: new Types.ObjectId(testimonialId),
        organizationId: new Types.ObjectId(orgId),
      },
      { $set: updateData },
      { new: true }
    ).lean();

    if (!testimonial) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    res.json({ success: true, testimonial });
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ success: false, error: "Failed to update testimonial" });
  }
});

// Delete testimonial (founders only)
router.delete("/:testimonialId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can delete testimonials",
      });
    }

    const testimonial = await Testimonial.findOneAndDelete({
      _id: new Types.ObjectId(testimonialId),
      organizationId: new Types.ObjectId(orgId),
    });

    if (!testimonial) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ success: false, error: "Failed to delete testimonial" });
  }
});

// Publish testimonial (founders only)
router.post("/:testimonialId/publish", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can publish testimonials",
      });
    }

    const testimonial = await Testimonial.findOneAndUpdate(
      {
        _id: new Types.ObjectId(testimonialId),
        organizationId: new Types.ObjectId(orgId),
      },
      {
        $set: {
          status: "published",
          isPublic: true,
          publishedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!testimonial) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    res.json({ success: true, testimonial });
  } catch (error) {
    console.error("Error publishing testimonial:", error);
    res.status(500).json({ success: false, error: "Failed to publish testimonial" });
  }
});

// ============ Content Block Management Routes (Founder Only) ============

// Add content block
router.post("/:testimonialId/blocks", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can manage content blocks",
      });
    }

    const { type, ...blockData } = req.body;

    if (!type || !["text", "image", "video", "youtube", "gallery", "quote"].includes(type)) {
      return res.status(400).json({
        success: false,
        error: "Valid block type is required",
      });
    }

    // Get current testimonial to determine order
    const existing = await Testimonial.findOne({
      _id: new Types.ObjectId(testimonialId),
      organizationId: new Types.ObjectId(orgId),
    }).lean();

    if (!existing) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    const maxOrder = existing.contentBlocks.length > 0
      ? Math.max(...existing.contentBlocks.map((b) => b.order))
      : -1;

    const newBlock = {
      _id: new Types.ObjectId(),
      order: maxOrder + 1,
      type,
      ...blockData,
    };

    const testimonial = await Testimonial.findOneAndUpdate(
      {
        _id: new Types.ObjectId(testimonialId),
        organizationId: new Types.ObjectId(orgId),
      },
      { $push: { contentBlocks: newBlock } },
      { new: true }
    ).lean();

    res.status(201).json({ success: true, testimonial, block: newBlock });
  } catch (error) {
    console.error("Error adding content block:", error);
    res.status(500).json({ success: false, error: "Failed to add content block" });
  }
});

// Update content block
router.put("/:testimonialId/blocks/:blockId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId, blockId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can manage content blocks",
      });
    }

    const updateData = req.body;
    delete updateData._id; // Don't allow changing block ID
    delete updateData.order; // Use reorder endpoint for order changes

    // Build update object for nested array element
    const setObj: any = {};
    for (const [key, value] of Object.entries(updateData)) {
      setObj[`contentBlocks.$.${key}`] = value;
    }

    const testimonial = await Testimonial.findOneAndUpdate(
      {
        _id: new Types.ObjectId(testimonialId),
        organizationId: new Types.ObjectId(orgId),
        "contentBlocks._id": new Types.ObjectId(blockId),
      },
      { $set: setObj },
      { new: true }
    ).lean();

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        error: "Testimonial or block not found",
      });
    }

    res.json({ success: true, testimonial });
  } catch (error) {
    console.error("Error updating content block:", error);
    res.status(500).json({ success: false, error: "Failed to update content block" });
  }
});

// Delete content block
router.delete("/:testimonialId/blocks/:blockId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId, blockId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can manage content blocks",
      });
    }

    const testimonial = await Testimonial.findOneAndUpdate(
      {
        _id: new Types.ObjectId(testimonialId),
        organizationId: new Types.ObjectId(orgId),
      },
      { $pull: { contentBlocks: { _id: new Types.ObjectId(blockId) } } },
      { new: true }
    ).lean();

    if (!testimonial) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    res.json({ success: true, testimonial });
  } catch (error) {
    console.error("Error deleting content block:", error);
    res.status(500).json({ success: false, error: "Failed to delete content block" });
  }
});

// Reorder content blocks
router.post("/:testimonialId/blocks/reorder", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialId } = req.params;
    const { blockIds } = req.body;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can manage content blocks",
      });
    }

    if (!blockIds || !Array.isArray(blockIds)) {
      return res.status(400).json({
        success: false,
        error: "blockIds array is required",
      });
    }

    const testimonial = await Testimonial.findOne({
      _id: new Types.ObjectId(testimonialId),
      organizationId: new Types.ObjectId(orgId),
    });

    if (!testimonial) {
      return res.status(404).json({ success: false, error: "Testimonial not found" });
    }

    // Reorder blocks based on blockIds array
    const reorderedBlocks = blockIds
      .map((id: string, index: number) => {
        const block = testimonial.contentBlocks.find(
          (b) => b._id.toString() === id
        );
        if (block) {
          block.order = index;
          return block;
        }
        return null;
      })
      .filter(Boolean);

    testimonial.contentBlocks = reorderedBlocks as any;
    await testimonial.save();

    res.json({ success: true, testimonial: testimonial.toObject() });
  } catch (error) {
    console.error("Error reordering content blocks:", error);
    res.status(500).json({ success: false, error: "Failed to reorder content blocks" });
  }
});

// ============ Reorder Testimonials (Founder Only) ============

router.post("/reorder", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { testimonialIds } = req.body;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can reorder testimonials",
      });
    }

    if (!testimonialIds || !Array.isArray(testimonialIds)) {
      return res.status(400).json({
        success: false,
        error: "testimonialIds array is required",
      });
    }

    // Update display order for each testimonial
    const bulkOps = testimonialIds.map((id: string, index: number) => ({
      updateOne: {
        filter: {
          _id: new Types.ObjectId(id),
          organizationId: new Types.ObjectId(orgId),
        },
        update: { $set: { displayOrder: index } },
      },
    }));

    await Testimonial.bulkWrite(bulkOps);

    res.json({ success: true });
  } catch (error) {
    console.error("Error reordering testimonials:", error);
    res.status(500).json({ success: false, error: "Failed to reorder testimonials" });
  }
});

// ============ Get Unique Categories ============

router.get("/meta/categories", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    const query: any = { organizationId: new Types.ObjectId(orgId) };

    // Non-founders only see categories from published testimonials
    if (!isFounder) {
      query.status = "published";
      query.isPublic = true;
    }

    const categories = await Testimonial.distinct("categories", query);

    res.json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, error: "Failed to fetch categories" });
  }
});

export default router;

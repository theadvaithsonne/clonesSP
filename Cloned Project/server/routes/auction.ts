import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { Auction } from "../models/auction.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { Product } from "../models/product.model";
import { emitAuctionNew, emitAuctionUpdate, emitAuctionEnd } from "../services/socket";

const router = Router();

router.use(requireAuth);

// GET /auctions/my-products — active products from all orgs the user belongs to (any role)
router.get("/my-products", async (req: any, res) => {
  try {
    const { userId } = (req as AuthRequest).user;

    const user = await User.findById(userId).select("organizations organization role").lean() as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const orgIds: Types.ObjectId[] = [];

    if (Array.isArray(user.organizations)) {
      for (const m of user.organizations) {
        if (m.organization) orgIds.push(m.organization);
      }
    }

    // Fallback: legacy single-org field
    if (user.organization) {
      const legacyId = user.organization;
      if (!orgIds.some((id) => id.toString() === legacyId.toString())) {
        orgIds.push(legacyId);
      }
    }

    if (orgIds.length === 0) return res.json({ products: [] });

    const products = await Product.find({
      organizationId: { $in: orgIds },
      status: "active",
    })
      .select("_id name images organizationId")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ products });
  } catch (err) {
    console.error("[Auction] GET /my-products error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /auctions — all ongoing auctions, newest first (global)
router.get("/", async (req, res) => {
  try {
    const auctions = await Auction.find({ status: "ongoing" })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ auctions });
  } catch (err) {
    console.error("[Auction] GET / error:", err);
    res.status(500).json({ error: "Failed to fetch auctions" });
  }
});

// POST /auctions — create auction
router.post("/", async (req: any, res) => {
  try {
    const { userId, orgId } = (req as AuthRequest).user;

    const {
      productSource,
      productId,
      productName,
      productImages,
      productDescription,
      productVideoUrl,
      minPrice,
      currency,
      durationHours,
      creatorName,
      creatorAvatar,
    } = req.body;

    if (!productSource || !productName || minPrice == null || !durationHours || !creatorName) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["garage", "outside"].includes(productSource)) {
      return res.status(400).json({ error: "Invalid productSource" });
    }
    if (![1, 6, 24, 48].includes(Number(durationHours))) {
      return res.status(400).json({ error: "Invalid durationHours. Must be 1, 6, 24, or 48" });
    }
    if (Number(minPrice) < 0) {
      return res.status(400).json({ error: "minPrice must be >= 0" });
    }
    if (productSource === "garage" && !productId) {
      return res.status(400).json({ error: "productId required for garage source" });
    }
    if (productSource === "garage" && !Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: "Invalid productId" });
    }

    const org = await Organization.findById(orgId).select("name").lean();
    const creatorOrgName = (org as any)?.name || "Unknown Org";

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + Number(durationHours) * 3600 * 1000);

    const auction = await Auction.create({
      createdBy: new Types.ObjectId(userId),
      creatorName,
      creatorAvatar: creatorAvatar || undefined,
      creatorOrgName,
      organizationId: new Types.ObjectId(orgId),
      productSource,
      productId: productSource === "garage" ? new Types.ObjectId(productId) : undefined,
      productName,
      productImages: Array.isArray(productImages) ? productImages : [],
      productDescription: productDescription || undefined,
      productVideoUrl: productVideoUrl || undefined,
      minPrice: Number(minPrice),
      currency: currency || "USD",
      durationHours: Number(durationHours),
      startTime,
      endTime,
      status: "ongoing",
    });

    emitAuctionNew(auction.toObject());
    res.status(201).json({ auction });
  } catch (err) {
    console.error("[Auction] POST / error:", err);
    res.status(500).json({ error: "Failed to create auction" });
  }
});

// PUT /auctions/:id — edit auction (creator only)
router.put("/:id", async (req: any, res) => {
  try {
    const { userId } = (req as AuthRequest).user;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid auction id" });
    }

    const auction = await Auction.findById(id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    if (auction.createdBy.toString() !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (auction.status !== "ongoing") {
      return res.status(400).json({ error: "Cannot edit a non-ongoing auction" });
    }

    const {
      productSource,
      productId,
      productName,
      productImages,
      productDescription,
      productVideoUrl,
      minPrice,
      currency,
      durationHours,
    } = req.body;

    if (productSource && !["garage", "outside"].includes(productSource)) {
      return res.status(400).json({ error: "Invalid productSource" });
    }
    if (durationHours && ![1, 6, 24, 48].includes(Number(durationHours))) {
      return res.status(400).json({ error: "Invalid durationHours" });
    }
    if (minPrice != null && Number(minPrice) < 0) {
      return res.status(400).json({ error: "minPrice must be >= 0" });
    }

    if (productSource) auction.productSource = productSource;
    if (productId && Types.ObjectId.isValid(productId)) auction.productId = new Types.ObjectId(productId);
    if (productName) auction.productName = productName;
    if (Array.isArray(productImages)) auction.productImages = productImages;
    if (productDescription !== undefined) auction.productDescription = productDescription || undefined;
    if (productVideoUrl !== undefined) auction.productVideoUrl = productVideoUrl || undefined;
    if (minPrice != null) auction.minPrice = Number(minPrice);
    if (currency) auction.currency = currency;
    if (durationHours) {
      auction.durationHours = Number(durationHours);
      auction.endTime = new Date(auction.startTime.getTime() + Number(durationHours) * 3600 * 1000);
    }

    await auction.save();
    emitAuctionUpdate(auction.toObject());
    res.json({ auction });
  } catch (err) {
    console.error("[Auction] PUT /:id error:", err);
    res.status(500).json({ error: "Failed to update auction" });
  }
});

// PATCH /auctions/:id/cancel — soft cancel (creator only)
router.patch("/:id/cancel", async (req: any, res) => {
  try {
    const { userId } = (req as AuthRequest).user;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid auction id" });
    }

    const auction = await Auction.findById(id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    if (auction.createdBy.toString() !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (auction.status !== "ongoing") {
      return res.status(400).json({ error: "Auction is not ongoing" });
    }

    auction.status = "cancelled";
    await auction.save();
    emitAuctionEnd(auction.toObject());
    res.json({ auction });
  } catch (err) {
    console.error("[Auction] PATCH /:id/cancel error:", err);
    res.status(500).json({ error: "Failed to cancel auction" });
  }
});

export default router;

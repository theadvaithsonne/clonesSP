import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireFounder } from "../middleware/auth";
import { ThirdPartyClient, generateApiKey, generateWebhookSecret, THIRD_PARTY_SCOPES } from "../models/thirdPartyClient.model";

const router = Router();

router.use(requireAuth);
router.use(requireFounder);

// Multi-month term. The model's validator enforces the solvency invariant:
// upPortion × termMonths must not exceed the cheapest sell price.
const termPlanSchema = z.object({
  termMonths: z.number().int().min(1).max(60),
  // Standalone sell price for the whole term.
  totalAmount: z.number().nonnegative(),
  // The SUBSCRIPTION PORTION when bought alongside the licence — NOT the cart
  // total. The buyer pays `licencePrice + this`. Omit for no bundle discount;
  // not valid on the 1-month tier.
  bundleSubscriptionAmount: z.number().nonnegative().optional(),
  // PER MONTH into the comp tree — the commission basis, always list value.
  // `platformPortion` is intentionally absent: the platform's share is the
  // residual of whichever price was actually charged.
  upPortion: z.number().nonnegative(),
  isActive: z.boolean().default(true),
  label: z.string().max(64).optional(),
  sortOrder: z.number().int().optional(),
});

const productConfigSchema = z.object({
  productCode: z.string().min(1),
  totalAmount: z.number().positive(),
  upPortion: z.number().nonnegative(),
  platformPortion: z.number().nonnegative(),
  platformUserEmail: z.string().email(),
  platformOrgId: z.string().min(1),
  recurringPeriod: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  // Was missing entirely, so `allowsTopUp` could never be set through this API
  // (zod strips unknown keys) and had to be edited directly in Mongo.
  allowsTopUp: z.boolean().optional(),
  termPlans: z.array(termPlanSchema).optional(),
  // No `defaultTermMonths`: the default is always 1 month. A configurable
  // default would let a config change silently bill an unspecified request at
  // $432 instead of $36 — a multi-month term is always an explicit choice.
});

const rateLimitsSchema = z.object({
  perMinute: z.number().int().positive(),
  perDay: z.number().int().positive(),
});

const createSchema = z.object({
  name: z.string().min(1),
  webhookUrl: z.string().url().optional(),
  scopes: z.array(z.enum(THIRD_PARTY_SCOPES)).optional(),
  rateLimits: rateLimitsSchema.optional(),
  productConfig: productConfigSchema,
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  webhookUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  scopes: z.array(z.enum(THIRD_PARTY_SCOPES)).optional(),
  rateLimits: rateLimitsSchema.optional(),
  productConfig: productConfigSchema.partial().optional(),
});

function sanitize(client: any) {
  return {
    id: client._id.toString(),
    name: client.name,
    apiKeyPrefix: client.apiKeyPrefix,
    webhookUrl: client.webhookUrl,
    scopes: client.scopes,
    isActive: client.isActive,
    rateLimits: client.rateLimits,
    productConfig: client.productConfig,
    lastUsedAt: client.lastUsedAt,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

// ============ Create client ============

router.post("/clients", async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.issues });
    }
    const user = (req as any).user;
    const { rawKey, hash, prefix } = await generateApiKey();
    const client = await ThirdPartyClient.create({
      name: parsed.data.name,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      webhookUrl: parsed.data.webhookUrl,
      webhookSecret: generateWebhookSecret(),
      scopes: parsed.data.scopes || ["invoices:read", "invoices:write"],
      rateLimits: parsed.data.rateLimits,
      productConfig: parsed.data.productConfig,
      createdBy: user.userId,
      isActive: true,
    });
    return res.status(201).json({
      client: sanitize(client),
      apiKey: rawKey,
      webhookSecret: client.webhookSecret,
      notice:
        "Save the apiKey and webhookSecret now — apiKey cannot be retrieved later (only rotated).",
    });
  } catch (err: any) {
    console.error("[ThirdPartyAdmin] create failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ============ List clients ============

router.get("/clients", async (_req: Request, res: Response) => {
  try {
    const clients = await ThirdPartyClient.find().sort({ createdAt: -1 });
    return res.json({ clients: clients.map(sanitize) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============ Get one ============

router.get("/clients/:id", async (req: Request, res: Response) => {
  try {
    const client = await ThirdPartyClient.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    return res.json({ client: sanitize(client) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============ Rotate API key ============

router.post("/clients/:id/rotate-key", async (req: Request, res: Response) => {
  try {
    const client = await ThirdPartyClient.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    const { rawKey, hash, prefix } = await generateApiKey();
    client.apiKeyHash = hash;
    client.apiKeyPrefix = prefix;
    await client.save();
    return res.json({
      client: sanitize(client),
      apiKey: rawKey,
      notice: "Old API key is now invalid. Save the new apiKey.",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============ Patch client ============

router.patch("/clients/:id", async (req: Request, res: Response) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid body", details: parsed.error.issues });
    }
    const client = await ThirdPartyClient.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });

    if (parsed.data.name !== undefined) client.name = parsed.data.name;
    if (parsed.data.webhookUrl !== undefined) client.webhookUrl = parsed.data.webhookUrl;
    if (parsed.data.isActive !== undefined) client.isActive = parsed.data.isActive;
    if (parsed.data.scopes !== undefined) client.scopes = parsed.data.scopes;
    if (parsed.data.rateLimits !== undefined) client.rateLimits = parsed.data.rateLimits;
    if (parsed.data.productConfig) {
      // Patch onto whatever's already on the doc — analytics-only clients
      // (no existing productConfig) get a fresh object built from the patch
      // alone; invoice clients get a merge.
      //
      // toObject() is load-bearing: productConfig is a Mongoose single-nested
      // subdocument, and spreading a Mongoose Document copies its internals
      // ($__, _doc, $isNew) rather than the data fields — so the previous
      // spread silently dropped every existing field on any partial patch.
      const existing: any =
        (client.productConfig as any)?.toObject?.() ??
        client.productConfig ??
        {};
      client.productConfig = {
        ...existing,
        ...parsed.data.productConfig,
      } as any;
    }
    await client.save();
    return res.json({ client: sanitize(client) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============ Soft-delete ============

router.delete("/clients/:id", async (req: Request, res: Response) => {
  try {
    const client = await ThirdPartyClient.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });
    client.isActive = false;
    await client.save();
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

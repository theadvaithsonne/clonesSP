import { Router, Response } from "express";
import { Types } from "mongoose";
import { Parser as Json2csvParser } from "json2csv";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { AivatarWallet } from "../models/aivatarWallet.model";
import { AivatarWalletTransaction } from "../models/aivatarWalletTransaction.model";
import {
  addAivatarCredits,
  deductAivatarCreditsWithDebt,
  clearAivatarDebt,
  getOrCreateAivatarWallet,
} from "../services/aivatarWallet.service";

const router = Router();

export const MAX_ADMIN_ACTION_CENTS = 100_000; // $1000 hard cap per single action

router.use(requireGarageAdminAuth, requireGarageSuperAdmin);

// ── List view: GET /garage-admin/wallets ─────────────────────────────────────
router.get("/", async (req: GarageAdminRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const skip = Math.max(parseInt(String(req.query.skip ?? "0"), 10) || 0, 0);
    const sort = String(req.query.sort ?? "lastActivity");
    const order = String(req.query.order ?? "desc") === "asc" ? 1 : -1;
    const hasDebt = req.query.hasDebt === "true";
    const minDebt = parseInt(String(req.query.minDebt ?? "0"), 10) || 0;
    const search = String(req.query.search ?? "").trim();
    // Universal header search (garage-admin/admin-search). Broader than the
    // toolbar's ?search= (org name/slug only): also matches the owning founder
    // by name/email.
    const q = String(req.query.q ?? "").trim();

    const sortMap: Record<string, string> = {
      balance: "balance",
      debt: "debt",
      lastActivity: "lastTransactionAt",
    };
    const sortField = sortMap[sort] ?? "lastTransactionAt";

    const walletFilter: Record<string, any> = {};
    if (hasDebt) walletFilter.debt = { $gt: minDebt };
    else if (minDebt > 0) walletFilter.debt = { $gte: minDebt };

    // Both the toolbar (?search=) and the header (?q=) narrow by orgId. Resolve
    // each present term to a set of matching orgIds, then intersect so the two
    // filters compose instead of clobbering one another.
    const orgIdConstraints: string[][] = [];

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingOrgs = await Organization.find({
        $or: [{ name: rx }, { slug: rx }],
      }).select("_id").lean();
      orgIdConstraints.push(matchingOrgs.map((o) => String(o._id)));
    }

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const [orgsByName, ownersByName] = await Promise.all([
        Organization.find({ $or: [{ name: rx }, { slug: rx }] })
          .select("_id").lean(),
        User.find({
          $or: [{ name: rx }, { email: rx }, { phone: rx }],
          "organizations.role": "founder",
        }).select("organizations").lean(),
      ]);
      const ids = new Set<string>(orgsByName.map((o) => String(o._id)));
      for (const u of ownersByName) {
        for (const m of ((u.organizations as any[]) ?? [])) {
          if (m.role === "founder" && m.organization) ids.add(String(m.organization));
        }
      }
      orgIdConstraints.push([...ids]);
    }

    if (orgIdConstraints.length) {
      let allowed = orgIdConstraints[0];
      for (let i = 1; i < orgIdConstraints.length; i++) {
        const next = new Set(orgIdConstraints[i]);
        allowed = allowed.filter((id) => next.has(id));
      }
      walletFilter.orgId = { $in: allowed.map((id) => new Types.ObjectId(id)) };
    }

    const [wallets, total] = await Promise.all([
      AivatarWallet
        .find(walletFilter)
        .sort({ [sortField]: order })
        .skip(skip)
        .limit(limit)
        .lean(),
      AivatarWallet.countDocuments(walletFilter),
    ]);

    const orgIds = wallets.map((w) => w.orgId);
    const orgs = await Organization
      .find({ _id: { $in: orgIds } })
      .select("_id name slug")
      .lean();
    const orgById = new Map(orgs.map((o) => [String(o._id), o]));

    const founders = await User
      .find({
        "organizations.organization": { $in: orgIds },
        "organizations.role": "founder",
      })
      .select("email organizations")
      .lean();
    const founderByOrgId = new Map<string, string>();
    for (const u of founders) {
      for (const m of (u.organizations as any[]) ?? []) {
        if (m.role === "founder") {
          const k = String(m.organization);
          if (!founderByOrgId.has(k) && u.email) founderByOrgId.set(k, u.email);
        }
      }
    }

    // Include orphan wallets (org deleted) so super-admin can see and
    // eventually decide what to do with them. Tag with orgDeleted: true so
    // the frontend can disable click-through and show a "deleted" badge.
    const items = wallets.map((w) => {
      const o = orgById.get(String(w.orgId));
      return {
        orgId: w.orgId,
        orgName: o?.name ?? "(deleted org)",
        orgSlug: o?.slug ?? "",
        founderEmail: founderByOrgId.get(String(w.orgId)) ?? null,
        balance: w.balance,
        debt: w.debt,
        lastTransactionAt: w.lastTransactionAt ?? null,
        orgDeleted: !o,
      };
    });

    res.json({ items, total, limit, skip, hasMore: skip + items.length < total });
  } catch (err: any) {
    console.error("GET /garage-admin/wallets error:", err);
    res.status(500).json({ error: err?.message ?? "Failed to list wallets" });
  }
});

// ── Stats ────────────────────────────────────────────────────────────────────
router.get("/stats", async (_req: GarageAdminRequest, res: Response) => {
  try {
    const [agg] = await AivatarWallet.aggregate([
      {
        $group: {
          _id: null,
          totalOrgs: { $sum: 1 },
          totalBalance: { $sum: "$balance" },
          totalDebt: { $sum: "$debt" },
          orgsWithDebt: { $sum: { $cond: [{ $gt: ["$debt", 0] }, 1, 0] } },
        },
      },
    ]);
    res.json({
      totalOrgs: agg?.totalOrgs ?? 0,
      totalBalance: agg?.totalBalance ?? 0,
      totalDebt: agg?.totalDebt ?? 0,
      orgsWithDebt: agg?.orgsWithDebt ?? 0,
    });
  } catch (err: any) {
    console.error("GET /garage-admin/wallets/stats error:", err);
    res.status(500).json({ error: err?.message ?? "Failed to compute stats" });
  }
});

// ── Cross-org ledger ─────────────────────────────────────────────────────────
function parseLedgerFilter(query: any) {
  const filter: Record<string, any> = {};
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(String(query.dateFrom));
    if (query.dateTo) filter.createdAt.$lte = new Date(String(query.dateTo));
  }
  if (query.types) {
    const arr = String(query.types).split(",").filter(Boolean);
    if (arr.length) filter.type = { $in: arr };
  }
  if (query.sources) {
    const arr = String(query.sources).split(",").filter(Boolean);
    if (arr.length) filter.source = { $in: arr };
  }
  if (query.orgIds) {
    const arr = String(query.orgIds).split(",").filter(Boolean).map((s) => new Types.ObjectId(s));
    if (arr.length) filter.orgId = { $in: arr };
  }
  return filter;
}

router.get("/ledger", async (req: GarageAdminRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
    const skip = Math.max(parseInt(String(req.query.skip ?? "0"), 10) || 0, 0);
    const filter = parseLedgerFilter(req.query);

    const [items, total, sumIn, sumOut] = await Promise.all([
      AivatarWalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AivatarWalletTransaction.countDocuments(filter),
      AivatarWalletTransaction.aggregate([
        { $match: { ...filter, type: "credit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      AivatarWalletTransaction.aggregate([
        { $match: { ...filter, type: { $in: ["debit", "clear_debt"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const orgIds = [...new Set(items.map((t) => String(t.orgId)))];
    const orgs = await Organization
      .find({ _id: { $in: orgIds } })
      .select("_id name slug")
      .lean();
    const orgById = new Map(orgs.map((o) => [String(o._id), o]));

    const enriched = items.map((t) => {
      const o = orgById.get(String(t.orgId));
      return {
        ...t,
        orgName: o?.name ?? "(deleted org)",
        orgSlug: o?.slug ?? "",
        orgDeleted: !o,
      };
    });

    res.json({
      items: enriched,
      total,
      limit,
      skip,
      hasMore: skip + items.length < total,
      totalIn: sumIn[0]?.total ?? 0,
      totalOut: sumOut[0]?.total ?? 0,
    });
  } catch (err: any) {
    console.error("GET /garage-admin/wallets/ledger error:", err);
    res.status(500).json({ error: err?.message ?? "Failed to load ledger" });
  }
});

// ── Ledger CSV export ────────────────────────────────────────────────────────
router.get("/ledger/export.csv", async (req: GarageAdminRequest, res: Response) => {
  try {
    const filter = parseLedgerFilter(req.query);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="wallet-ledger-${Date.now()}.csv"`
    );

    const fields = [
      "createdAt", "orgName", "orgId", "type", "amount", "balanceAfter",
      "debtAfter", "source", "adminEmail", "note", "description",
    ];
    const parser = new Json2csvParser({ fields, header: true });
    // Write header row only.
    res.write(parser.parse([]) + "\n");

    const cursor = AivatarWalletTransaction.find(filter).sort({ createdAt: -1 }).cursor();
    const orgCache = new Map<string, string>();
    const rowParser = new Json2csvParser({ fields, header: false });

    for await (const txn of cursor) {
      let orgName = orgCache.get(String(txn.orgId));
      if (!orgName) {
        const org = await Organization.findById(txn.orgId).select("name").lean();
        orgName = org?.name ?? "(deleted org)";
        orgCache.set(String(txn.orgId), orgName);
      }
      const row = rowParser.parse([{
        createdAt: txn.createdAt.toISOString(),
        orgName,
        orgId: String(txn.orgId),
        type: txn.type,
        amount: txn.amount,
        balanceAfter: txn.balanceAfter,
        debtAfter: txn.debtAfter,
        source: txn.source,
        adminEmail: txn.adminEmail ?? "",
        note: (txn.note ?? "").replace(/[\r\n]+/g, " "),
        description: (txn.description ?? "").replace(/[\r\n]+/g, " "),
      }]);
      res.write(row + "\n");
    }

    res.end();
  } catch (err: any) {
    console.error("GET /garage-admin/wallets/ledger/export.csv error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message ?? "Failed to export" });
    } else {
      res.end();
    }
  }
});

// ── Per-org detail ───────────────────────────────────────────────────────────
router.get("/:orgId", async (req: GarageAdminRequest, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.orgId)) {
      return res.status(400).json({ error: "Invalid orgId" });
    }
    const orgId = new Types.ObjectId(req.params.orgId);
    const [org, wallet, transactions] = await Promise.all([
      Organization.findById(orgId).select("_id name slug").lean(),
      AivatarWallet.findOne({ orgId }).lean(),
      AivatarWalletTransaction.find({ orgId }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    if (!org) {
      // Wallet may exist for a deleted org — surface that explicitly so
      // the frontend renders a "deleted" state instead of a generic error.
      return res.status(410).json({
        error: "Organization deleted",
        orgDeleted: true,
        wallet: wallet ?? null,
      });
    }

    const founder = await User.findOne({
      "organizations.organization": orgId,
      "organizations.role": "founder",
    }).select("email").lean();

    res.json({
      org: { _id: org._id, name: org.name, slug: org.slug, founderEmail: founder?.email ?? null },
      wallet: wallet ?? { orgId, balance: 0, debt: 0, lastTransactionAt: null },
      transactions,
    });
  } catch (err: any) {
    console.error("GET /garage-admin/wallets/:orgId error:", err);
    res.status(500).json({ error: err?.message ?? "Failed to load wallet" });
  }
});

router.get("/:orgId/transactions", async (req: GarageAdminRequest, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.orgId)) {
      return res.status(400).json({ error: "Invalid orgId" });
    }
    const orgId = new Types.ObjectId(req.params.orgId);
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const skip = Math.max(parseInt(String(req.query.skip ?? "0"), 10) || 0, 0);

    const [items, total] = await Promise.all([
      AivatarWalletTransaction.find({ orgId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AivatarWalletTransaction.countDocuments({ orgId }),
    ]);
    res.json({ items, total, limit, skip, hasMore: skip + items.length < total });
  } catch (err: any) {
    console.error("GET /garage-admin/wallets/:orgId/transactions error:", err);
    res.status(500).json({ error: err?.message ?? "Failed to load transactions" });
  }
});

// ── Mutating endpoints ───────────────────────────────────────────────────────
function validateAmount(amountCents: any): number | null {
  const n = parseInt(String(amountCents), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > MAX_ADMIN_ACTION_CENTS) return null;
  return n;
}

router.post("/:orgId/credit", async (req: GarageAdminRequest, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.orgId)) {
      return res.status(400).json({ error: "Invalid orgId" });
    }
    const amount = validateAmount(req.body.amountCents);
    if (amount === null) {
      return res.status(400).json({
        error: `amountCents must be a positive integer ≤ ${MAX_ADMIN_ACTION_CENTS}`,
      });
    }
    const note: string | undefined = req.body.note?.toString().trim() || undefined;
    const idempotencyKey = req.headers["idempotency-key"]?.toString();

    const wallet = await addAivatarCredits(
      req.params.orgId,
      amount,
      `Admin credit by ${req.garageAdmin!.email}` + (note ? ` — ${note}` : ""),
      {
        source: "admin",
        adminEmail: req.garageAdmin!.email,
        note,
        idempotencyKey,
      }
    );
    res.json({ wallet });
  } catch (err: any) {
    console.error("POST /garage-admin/wallets/:orgId/credit error:", err);
    res.status(500).json({ error: err?.message ?? "Credit failed" });
  }
});

router.post("/:orgId/debit", async (req: GarageAdminRequest, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.orgId)) {
      return res.status(400).json({ error: "Invalid orgId" });
    }
    const amount = validateAmount(req.body.amountCents);
    if (amount === null) {
      return res.status(400).json({
        error: `amountCents must be a positive integer ≤ ${MAX_ADMIN_ACTION_CENTS}`,
      });
    }
    const note: string = (req.body.note ?? "").toString().trim();
    if (!note) return res.status(400).json({ error: "note is required for debit" });

    const wallet = await getOrCreateAivatarWallet(req.params.orgId);
    if (wallet.balance < amount) {
      return res.status(422).json({
        error: "Insufficient balance",
        balance: wallet.balance,
        requested: amount,
      });
    }
    const idempotencyKey = req.headers["idempotency-key"]?.toString();

    const result = await deductAivatarCreditsWithDebt(
      req.params.orgId,
      amount,
      `Admin debit by ${req.garageAdmin!.email} — ${note}`,
      {
        source: "admin",
        adminEmail: req.garageAdmin!.email,
        note,
        idempotencyKey,
      }
    );
    res.json({ wallet: result.wallet });
  } catch (err: any) {
    console.error("POST /garage-admin/wallets/:orgId/debit error:", err);
    res.status(500).json({ error: err?.message ?? "Debit failed" });
  }
});

router.post("/:orgId/clear-debt", async (req: GarageAdminRequest, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.orgId)) {
      return res.status(400).json({ error: "Invalid orgId" });
    }
    const note: string = (req.body.note ?? "").toString().trim();
    if (!note) return res.status(400).json({ error: "note is required for clear-debt" });

    const idempotencyKey = req.headers["idempotency-key"]?.toString();
    const wallet = await clearAivatarDebt(req.params.orgId, {
      adminEmail: req.garageAdmin!.email,
      note,
      idempotencyKey,
    });
    res.json({ wallet });
  } catch (err: any) {
    console.error("POST /garage-admin/wallets/:orgId/clear-debt error:", err);
    res.status(500).json({ error: err?.message ?? "Clear-debt failed" });
  }
});

// ── Bulk credit ──────────────────────────────────────────────────────────────
router.post("/bulk-credit", async (req: GarageAdminRequest, res: Response) => {
  try {
    const amount = validateAmount(req.body.amountCents);
    if (amount === null) {
      return res.status(400).json({
        error: `amountCents must be a positive integer ≤ ${MAX_ADMIN_ACTION_CENTS}`,
      });
    }
    const note: string | undefined = req.body.note?.toString().trim() || undefined;
    const filter = req.body.filter ?? {};

    const orgQuery: Record<string, any> = {};
    if (filter.createdBefore) orgQuery.createdAt = { $lte: new Date(filter.createdBefore) };
    if (filter.country) orgQuery.country = filter.country;
    const candidateOrgs = await Organization.find(orgQuery).select("_id").lean();
    let orgIds = candidateOrgs.map((o) => o._id);

    if (filter.hasDebt === true) {
      const debted = await AivatarWallet
        .find({ orgId: { $in: orgIds }, debt: { $gt: 0 } })
        .select("orgId")
        .lean();
      orgIds = debted.map((w) => w.orgId);
    }

    if (orgIds.length === 0) {
      return res.json({ succeeded: 0, failed: 0, errors: [], orgIds: [] });
    }

    const succeeded: string[] = [];
    const errors: Array<{ orgId: string; error: string }> = [];
    for (const orgId of orgIds) {
      try {
        await addAivatarCredits(
          String(orgId),
          amount,
          `Bulk credit by ${req.garageAdmin!.email}` + (note ? ` — ${note}` : ""),
          {
            source: "admin",
            adminEmail: req.garageAdmin!.email,
            note,
          }
        );
        succeeded.push(String(orgId));
      } catch (err: any) {
        errors.push({ orgId: String(orgId), error: err?.message ?? "unknown" });
      }
    }
    res.json({
      succeeded: succeeded.length,
      failed: errors.length,
      errors,
      orgIds: succeeded,
    });
  } catch (err: any) {
    console.error("POST /garage-admin/wallets/bulk-credit error:", err);
    res.status(500).json({ error: err?.message ?? "Bulk credit failed" });
  }
});

export default router;

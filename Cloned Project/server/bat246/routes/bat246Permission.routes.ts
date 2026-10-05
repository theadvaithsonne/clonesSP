import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../../middleware/auth";
import { User } from "../../models/user.model";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246CardPermission, BAT246_CARD_KEYS, Bat246CardKey } from "../models/bat246CardPermission.model";
import { ALAN_K_EMAIL, getGrantedCardKeys, DEFAULT_ORG_CARD_KEYS } from "../services/bat246Permission.service";

// The 4 cards also reachable via the older /games/bat246/dashboard hub on a
// board position (see hasDashboardAccess() in bat246.routes.ts). Documentation
// and Lost Money have no tile there, so board position never applies to them.
const LEGACY_OVERLAP_CARDS: Bat246CardKey[] = ["boards", "members", "distributors", "inviteandplace"];

// Scans every board's Home Plate / 3rd Base / 2nd Base A / 2nd Base B / 1st
// Base slots and returns the linked Garage userIds — the same set
// hasDashboardAccess() checks for one user, done in reverse for all of them.
async function scanLegacyDashboardUserIds(): Promise<Set<string>> {
  const boards = await Bat246Board
    .find({}, { homePlate: 1, thirdBase: 1, secondBaseA: 1, secondBaseB: 1, firstBase: 1 })
    .lean();

  const playerIds = new Set<string>();
  const addSlot = (slot: any) => { if (slot?.playerId) playerIds.add(slot.playerId.toString()); };
  for (const b of boards as any[]) {
    addSlot(b.homePlate);
    addSlot(b.thirdBase);
    addSlot(b.secondBaseA);
    addSlot(b.secondBaseB);
    (b.firstBase ?? []).forEach(addSlot);
  }

  if (playerIds.size === 0) return new Set();
  const players = await Bat246Player.find({ _id: { $in: Array.from(playerIds) } }).select("userId").lean();
  return new Set((players as any[]).filter(p => p.userId).map(p => p.userId.toString()));
}

const router = Router();

// Same org constant used for the "Already part of Bat246" check in
// bat246LostMoney.routes.ts — granting Bat246 Admin card access only makes
// sense for people already in the Bat246 office.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

// Managing permissions is never itself grantable — only Alan can see/change
// who has access to what.
function requireAlanKOnly(req: any, res: any, next: any) {
  if (req.user?.email?.toLowerCase() !== ALAN_K_EMAIL) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

function isValidCardKey(v: any): v is Bat246CardKey {
  return typeof v === "string" && (BAT246_CARD_KEYS as readonly string[]).includes(v);
}

// ─── List all grants, grouped by card ──────────────────────────────────────
router.get("/", requireAuth, requireAlanKOnly, async (_req, res) => {
  try {
    const grants = await Bat246CardPermission.find().sort({ createdAt: -1 }).lean();
    const userIds = grants.map((g: any) => g.userId);
    const users = await User.find({ _id: { $in: userIds } }).select("_id name email").lean();
    const userById = new Map(users.map((u: any) => [u._id.toString(), u]));

    const byCard: Record<string, any[]> = {};
    for (const key of BAT246_CARD_KEYS) byCard[key] = [];

    for (const g of grants as any[]) {
      const user = userById.get(g.userId.toString());
      if (!user) continue; // deleted account — skip rather than error
      byCard[g.cardKey]?.push({
        _id: g._id,
        userId: user._id,
        name: user.name ?? null,
        email: user.email,
        grantedByEmail: g.grantedByEmail,
        createdAt: g.createdAt,
      });
    }

    res.json({ byCard });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Search Bat246-org users to grant access to ────────────────────────────
router.get("/search-users", requireAuth, requireAlanKOnly, async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ users: [] });
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find(
      {
        isVerified: true,
        "organizations.organization": new Types.ObjectId(BAT246_ORG_ID),
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

// ─── Grant a card to a user ─────────────────────────────────────────────────
router.post("/grant", requireAuth, requireAlanKOnly, async (req, res) => {
  try {
    const userId = String(req.body?.userId ?? "").trim();
    const cardKey = req.body?.cardKey;

    if (!Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (!isValidCardKey(cardKey)) return res.status(400).json({ error: "Invalid cardKey" });

    const target = await User.findById(userId).select("email").lean() as any;
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.email?.toLowerCase() === ALAN_K_EMAIL) {
      return res.status(400).json({ error: "Alan already has full access." });
    }

    await Bat246CardPermission.findOneAndUpdate(
      { userId, cardKey },
      { $setOnInsert: { userId, cardKey }, $set: { grantedByEmail: req.user?.email ?? "" } },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Revoke a card from a user ──────────────────────────────────────────────
router.post("/revoke", requireAuth, requireAlanKOnly, async (req, res) => {
  try {
    const userId = String(req.body?.userId ?? "").trim();
    const cardKey = req.body?.cardKey;

    if (!Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (!isValidCardKey(cardKey)) return res.status(400).json({ error: "Invalid cardKey" });

    // Missing grant is treated as success — idempotent, safe against
    // double-clicks / stale UI state.
    await Bat246CardPermission.deleteOne({ userId, cardKey });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Legacy "board position" access — read-only, informational ─────────────
// Anyone holding Home Plate / 3rd Base / 2nd Base A / 2nd Base B / 1st Base
// on ANY board already sees Boards/Members/Distributors/Invite-and-Place via
// the older /games/bat246/dashboard hub — see hasDashboardAccess() in
// bat246.routes.ts, which checks this same set of slots for one user. This
// is the reverse: every user currently qualifying, for display only. Not
// itself grantable/revocable here — it's earned by board position, not
// something this Permissions page controls.
router.get("/legacy-dashboard-access", requireAuth, requireAlanKOnly, async (_req, res) => {
  try {
    const boards = await Bat246Board
      .find({}, { homePlate: 1, thirdBase: 1, secondBaseA: 1, secondBaseB: 1, firstBase: 1 })
      .lean();

    const byPlayerId = new Map<string, { playerId: string; name: string | null; email: string }>();
    const addSlot = (slot: any) => {
      if (!slot?.playerId || !slot?.playerEmail) return;
      const key = slot.playerId.toString();
      if (!byPlayerId.has(key)) {
        byPlayerId.set(key, { playerId: key, name: slot.playerName ?? null, email: slot.playerEmail });
      }
    };

    for (const b of boards as any[]) {
      addSlot(b.homePlate);
      addSlot(b.thirdBase);
      addSlot(b.secondBaseA);
      addSlot(b.secondBaseB);
      (b.firstBase ?? []).forEach(addSlot);
    }

    res.json({ people: Array.from(byPlayerId.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Full people × cards access matrix — powers the grid view ─────────────
// Rows = everyone in the Bat246 office, plus anyone else who somehow already
// has access (explicit grant or legacy board position) even if they're not
// currently found in the office member search — a defensive union, not the
// expected common case. Alan himself is never a row — he always has
// everything, a checkbox grid for him would be pure noise.
router.get("/people-matrix", requireAuth, requireAlanKOnly, async (_req, res) => {
  try {
    const [orgMembers, grants, legacyUserIds] = await Promise.all([
      User.find(
        { "organizations.organization": new Types.ObjectId(BAT246_ORG_ID) },
        { _id: 1, name: 1, email: 1 }
      ).lean(),
      Bat246CardPermission.find().lean(),
      scanLegacyDashboardUserIds(),
    ]);

    const peopleById = new Map<string, { userId: string; name: string | null; email: string }>();
    const orgMemberIds = new Set<string>();
    for (const u of orgMembers as any[]) {
      const id = u._id.toString();
      peopleById.set(id, { userId: id, name: u.name ?? null, email: u.email });
      orgMemberIds.add(id);
    }

    const missingIds = new Set<string>();
    for (const g of grants as any[]) {
      const key = g.userId.toString();
      if (!peopleById.has(key)) missingIds.add(key);
    }
    for (const id of legacyUserIds) {
      if (!peopleById.has(id)) missingIds.add(id);
    }
    if (missingIds.size > 0) {
      const extraUsers = await User.find({ _id: { $in: Array.from(missingIds) } }).select("_id name email").lean();
      for (const u of extraUsers as any[]) {
        peopleById.set(u._id.toString(), { userId: u._id.toString(), name: u.name ?? null, email: u.email });
      }
    }

    const grantedCardsByUser = new Map<string, Set<Bat246CardKey>>();
    for (const g of grants as any[]) {
      const key = g.userId.toString();
      if (!grantedCardsByUser.has(key)) grantedCardsByUser.set(key, new Set());
      grantedCardsByUser.get(key)!.add(g.cardKey);
    }

    const people = Array.from(peopleById.values())
      .filter(p => p.email?.toLowerCase() !== ALAN_K_EMAIL)
      .map(p => {
        const explicitlyGranted = grantedCardsByUser.get(p.userId) ?? new Set<Bat246CardKey>();
        const isLegacyBoardPosition = legacyUserIds.has(p.userId);
        const isOrgMember = orgMemberIds.has(p.userId);
        const access: Record<string, { granted: boolean; legacy: boolean }> = {};
        for (const key of BAT246_CARD_KEYS) {
          // Two independent "automatic, non-revocable-here" sources: board
          // position (existing) and plain org membership (new — see
          // DEFAULT_ORG_CARD_KEYS). Either one locks the cell on.
          const legacy =
            (isLegacyBoardPosition && LEGACY_OVERLAP_CARDS.includes(key)) ||
            (isOrgMember && DEFAULT_ORG_CARD_KEYS.includes(key));
          access[key] = { granted: legacy || explicitlyGranted.has(key), legacy };
        }
        return { userId: p.userId, name: p.name, email: p.email, access };
      })
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

    res.json({ people });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Apply a batch of checkbox changes from the grid (Save) ────────────────
// Never touches legacy board-position access — the grid only ever sends
// changes for checkboxes it let the admin click, and legacy cells are
// rendered disabled client-side. Malformed entries are skipped rather than
// failing the whole batch, so one bad row can't block the rest of a save.
router.post("/bulk-update", requireAuth, requireAlanKOnly, async (req, res) => {
  try {
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
    const callerEmail = (req as any).user?.email ?? "";

    for (const c of changes) {
      const userId = String(c?.userId ?? "");
      const cardKey = c?.cardKey;
      if (!Types.ObjectId.isValid(userId) || !isValidCardKey(cardKey)) continue;

      if (c?.granted) {
        const target = await User.findById(userId).select("email").lean() as any;
        if (!target || target.email?.toLowerCase() === ALAN_K_EMAIL) continue;
        await Bat246CardPermission.findOneAndUpdate(
          { userId, cardKey },
          { $setOnInsert: { userId, cardKey }, $set: { grantedByEmail: callerEmail } },
          { upsert: true }
        );
      } else {
        await Bat246CardPermission.deleteOne({ userId, cardKey });
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── The caller's own grants — any logged-in user, not Alan-only ───────────
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const caller = (req as any).user as { userId: string };
    const cardKeys = await getGrantedCardKeys(caller?.userId);
    res.json({ cardKeys });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

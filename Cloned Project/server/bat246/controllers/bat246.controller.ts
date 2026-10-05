import { Request, Response } from "express";
import { Types } from "mongoose";
import * as svc from "../services/bat246.service";
import { requestIsFromLocalFrontend } from "../services/bat246TestMode";
import { splitBoardPhase1 } from "../services/bat246Split.service";
import * as adminSvc from "../services/bat246Admin.service";
import { promoteDugoutAfterPP, addFromHomePlateInvite } from "../services/bat246Entry.service";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { Bat246PlacementNotification } from "../models/bat246PlacementNotifications.model";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { buildUserSnapshot } from "../services/bat246DistributorId.util";
import { User } from "../../models/user.model";

// Same constant every Bat246 admin route file hardcodes independently —
// not consolidated, matching the established pattern (see ALAN_K_EMAIL
// comment in bat246Permission.service.ts).
const ALAN_K_EMAIL = "redbaron2020@mail.com";

export async function listBoards(req: Request, res: Response) {
  try {
    const mine = req.query.mine === "true";
    const garageUserId = (req as any).user?.userId;

    // Resolved unconditionally (not just when mine=true) — isAdmin gates
    // hidden boards in both the "my boards" and "all boards" listings.
    let callerEmail: string | undefined;
    if (garageUserId) {
      const user = await User.findById(garageUserId).select("email").lean() as any;
      callerEmail = user?.email?.toLowerCase();
    }
    const isAdmin = callerEmail === ALAN_K_EMAIL;
    // Test-mode boards are only served to a frontend running on http://localhost:3000.
    const includeTest = requestIsFromLocalFrontend(req);

    let filterEmail: string | undefined;
    if (mine) {
      if (!callerEmail) return res.json({ boards: [], completed: [] });
      filterEmail = callerEmail;
    }

    const [boards, completed] = await Promise.all([
      svc.getBoards(filterEmail, isAdmin, includeTest),
      svc.getCompletedBoards(filterEmail, isAdmin, includeTest),
    ]);
    res.json({ boards, completed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getBoard(req: Request, res: Response) {
  try {
    // Auto-promote dugout players when PP has expired
    const raw = await Bat246Board
      .findById(req.params.id)
      .select("status protectionPeriodEnd dugout atBat")
      .lean() as any;
    if (raw && raw.status === "active") {
      const ppExpired = raw.protectionPeriodEnd && new Date() > new Date(raw.protectionPeriodEnd);
      const hasDugout = (raw.dugout ?? []).some(Boolean);
      const hasEmptyAtBat = (raw.atBat ?? []).some((s: any) => !s);
      if (ppExpired && hasDugout && hasEmptyAtBat) {
        try { await promoteDugoutAfterPP(req.params.id); } catch { /* non-fatal */ }
      }
    }

    const garageUserId = (req as any).user?.userId;
    let callerEmail: string | undefined;
    if (garageUserId) {
      const user = await User.findById(garageUserId).select("email").lean() as any;
      callerEmail = user?.email?.toLowerCase();
    }

    const board = await svc.getBoardById(req.params.id, callerEmail, requestIsFromLocalFrontend(req));
    if (!board) return res.status(404).json({ error: "Board not found" });
    res.json({ board });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// Alan-K-only: flips a board's `hidden` flag (POST /bat246/boards/:id/hidden,
// body { hidden: boolean }) — the "Make Live" / "Pause Live" button so future
// hide/unhide never needs a script or a deploy.
export async function setBoardHidden(req: Request, res: Response) {
  try {
    const garageUserId = (req as any).user?.userId;
    const user = garageUserId
      ? (await User.findById(garageUserId).select("email").lean() as any)
      : null;
    if (user?.email?.toLowerCase() !== ALAN_K_EMAIL) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { hidden } = req.body;
    if (typeof hidden !== "boolean") {
      return res.status(400).json({ error: "hidden (boolean) required" });
    }

    const board = await svc.setBoardHidden(req.params.id, hidden);
    res.json({ ok: true, board });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getBoardMovements(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const movements = await svc.getBoardMovements(req.params.id, limit);
    res.json({ movements });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getPlayer(req: Request, res: Response) {
  try {
    const player = await svc.getPlayerById(req.params.id);
    if (!player) return res.status(404).json({ error: "Player not found" });
    res.json({ player });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function triggerSplit(req: Request, res: Response) {
  try {
    const result = await splitBoardPhase1(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    const status = err.message.includes("Concurrent") ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
}

export async function updatePenciling(req: Request, res: Response) {
  try {
    const { playerId, targetAbSlot } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    const board = await svc.setPenciling(req.params.id, playerId, targetAbSlot ?? null);
    res.json({ ok: true, penciling: (board as any).penciling });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updatePrePick(req: Request, res: Response) {
  try {
    const { playerId, targetAbSlot } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    const board = await svc.setPrePick(req.params.id, playerId, targetAbSlot ?? null);
    res.json({ ok: true, prePick: (board as any).prePick });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// ── Admin / setup endpoints ────────────────────────────────────────────────

export async function createBoard(req: Request, res: Response) {
  try {
    const adminUserId = (req as any).user?.userId;
    const board = await adminSvc.createBoard(adminUserId);
    res.json({ ok: true, board });
  } catch (err: any) {
    const status = err.message.includes("Only the admin") ? 403 : 400;
    res.status(status).json({ error: err.message });
  }
}

export async function searchUsers(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || "";
    const users = await adminSvc.searchGarageUsers(q);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function assignSlot(req: Request, res: Response) {
  try {
    const { position, garageUserId } = req.body;
    if (!position || !garageUserId) {
      return res.status(400).json({ error: "position and garageUserId required" });
    }
    await adminSvc.assignSlot(req.params.id, position, garageUserId);
    const board = await svc.getBoardById(req.params.id, undefined, requestIsFromLocalFrontend(req));
    res.json({ ok: true, board });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function fixDugout(req: Request, res: Response) {
  try {
    const result = await adminSvc.promoteDugoutToAtBat(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function promoteDugoutPP(req: Request, res: Response) {
  try {
    const result = await promoteDugoutAfterPP(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function addHomePlateEntry(req: Request, res: Response) {
  try {
    const { userId, userName, userEmail, productId, saleAmount, countryResidence, countryOrigin } = req.body;
    if (!userId || !userEmail || !productId) {
      return res.status(400).json({ error: "userId, userEmail, and productId are required" });
    }
    const result = await addFromHomePlateInvite({
      boardId: req.params.id,
      userId,
      userName: userName ?? userEmail,
      userEmail,
      productId,
      saleAmount,
      countryResidence,
      countryOrigin,
    });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function reservePosition(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const { position, productId } = req.body;
    if (!position) return res.status(400).json({ error: "position required" });
    const reservation = await svc.reservePosition(req.params.id, position, userId, productId);
    res.json({ ok: true, reservation });
  } catch (err: any) {
    const status = err.message.includes("already reserved") || err.message.includes("already filled") ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
}

export async function getReservations(req: Request, res: Response) {
  try {
    const reservations = await svc.getReservations(req.params.id);
    res.json({ reservations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function activateBoard(req: Request, res: Response) {
  try {
    const nextHomePlatePayout = typeof req.body?.nextHomePlatePayout === "number" ? req.body.nextHomePlatePayout : undefined;
    await adminSvc.activateBoard(req.params.id, nextHomePlatePayout);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getStats(req: Request, res: Response) {
  try {
    const [membersCount, distributorsCount] = await Promise.all([
      Bat246Player.countDocuments(),
      Bat246Distributor.countDocuments({ isQualified: true }),
    ]);
    res.json({ membersCount, distributorsCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function placeUser(req: Request, res: Response) {
  try {
    const callerUserId = (req as any).user?.userId;
    const { notificationId } = req.body;
    if (!notificationId) return res.status(400).json({ error: "notificationId required" });
    const result = await svc.placeUserAtPosition(notificationId, callerUserId);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    const status = err.message.includes("Not authorized") ? 403
      : err.message.includes("already been placed") || err.message.includes("already filled") ? 409
      : 400;
    res.status(status).json({ error: err.message });
  }
}

export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const notifications = await Bat246PlacementNotification.find({
      isActioned: false,
      uplineUserId: new Types.ObjectId(userId),
    }).sort({ createdAt: -1 }).lean();
    res.json({ notifications });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function markNotificationRead(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    await Bat246PlacementNotification.updateOne(
      { _id: new Types.ObjectId(req.params.id), uplineUserId: new Types.ObjectId(userId) },
      { isRead: true }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function clearNotification(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    await Bat246PlacementNotification.updateOne(
      { _id: new Types.ObjectId(req.params.id), uplineUserId: new Types.ObjectId(userId) },
      { isActioned: true, isRead: true }
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function listDistributors(req: Request, res: Response) {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;

    const [total, docs] = await Promise.all([
      Bat246Distributor.countDocuments({ isQualified: true }),
      Bat246Distributor.find({ isQualified: true })
        // userId is intentionally NOT populated here (see the block right
        // below) — populate() replaces a dangling reference with null,
        // which would throw away the raw ObjectId we still need for the
        // snapshot-fallback case and for linking to the detail page.
        .populate("bat246RefUserId", "name email")
        .sort({ qualifiedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Resilient user data: a User document can be deleted after a
    // distributor qualifies (an orphaned reference, not a throw) — this
    // used to crash the whole page reading .name off a null populate()
    // result. Batch-fetch whichever live users still exist, then for
    // each row prefer that live data (and self-heal userSnapshot from
    // it) and fall back to the stored snapshot — taken once, guaranteed,
    // at qualification time in assignDistributorId() — for any row whose
    // user is gone. Only when BOTH are missing (pre-existing data from
    // before this feature ever ran) does userId stay null, which the
    // frontend's existing guard skips rather than crashing on.
    const rawUserIds = docs.map((d: any) => d.userId).filter(Boolean);
    const liveUsers = rawUserIds.length
      ? await User.find({ _id: { $in: rawUserIds } })
          .select("name email phone profilePicture country state city postalCode")
          .lean()
      : [];
    const liveUserMap = new Map((liveUsers as any[]).map((u) => [String(u._id), u]));

    const snapshotUpdates: any[] = [];
    for (const d of docs as any[]) {
      const rawUserId = d.userId;
      const liveUser = rawUserId ? liveUserMap.get(String(rawUserId)) : null;
      if (liveUser) {
        const snapshot = buildUserSnapshot(liveUser);
        d.userId = { _id: liveUser._id, ...snapshot };
        snapshotUpdates.push({
          updateOne: { filter: { _id: d._id }, update: { $set: { userSnapshot: snapshot } } },
        });
      } else if (rawUserId && d.userSnapshot) {
        d.userId = { _id: rawUserId, ...d.userSnapshot };
      } else {
        d.userId = null;
      }
    }
    if (snapshotUpdates.length) {
      // Fire-and-forget — this is a display-freshness nicety, not
      // something the response needs to wait on.
      Bat246Distributor.bulkWrite(snapshotUpdates).catch((err) =>
        console.error("[bat246] userSnapshot self-heal failed:", err.message)
      );
    }

    const playerIds = docs.map((d: any) => d.playerId).filter(Boolean);
    // find() instead of distinct() — also gives a playerId->boardId map, used
    // below as a fallback board-tracking-number lookup for "Board Invite
    // Status" rows placed via the *old* Approve flow (which never sets
    // boardPlacedBoardId, only this app's original isApproved/isOnBoard).
    const playerBoardDocs = playerIds.length
      ? await Bat246PlayerBoard.find({ playerId: { $in: playerIds } }).select("playerId boardId").lean()
      : [];
    const onBoardIds = new Set((playerBoardDocs as any[]).map((pb) => String(pb.playerId)));
    const playerBoardIdMap = new Map<string, string>(); // playerId -> boardId (first match)
    for (const pb of playerBoardDocs as any[]) {
      const pid = String(pb.playerId);
      if (!playerBoardIdMap.has(pid)) playerBoardIdMap.set(pid, String(pb.boardId));
    }

    const placedBoardIds = [
      ...docs.map((d: any) => d.podPlacedBoardId).filter(Boolean),
      ...docs.map((d: any) => d.boardPlacedBoardId).filter(Boolean),
      ...playerBoardIdMap.values(),
    ];
    const placedBoardMap = new Map<string, string>();
    if (placedBoardIds.length) {
      const { Bat246Board } = await import("../models/bat246Board.model");
      const placedBoards = await Bat246Board.find({ _id: { $in: placedBoardIds } }).select("trackingNumber").lean();
      for (const b of placedBoards as any[]) placedBoardMap.set(String(b._id), b.trackingNumber);
    }

    // Self-healing POD reconciliation — see reconcilePodInvitedPurchases for why.
    // Only checks rows still stuck on "invited" (cheap: usually empty/small).
    const needsReconcile = docs
      .filter((d: any) => d.podInviteSentAt && !d.podPurchaseCompletedAt && !d.podPlacedAt)
      .map((d: any) => d.userId?._id?.toString() || d.userId?.toString())
      .filter(Boolean);
    const justCompleted = needsReconcile.length
      ? await (await import("../services/bat246PodInvite.service")).reconcilePodInvitedPurchases(needsReconcile)
      : new Set<string>();

    // "Ready to be placed on board" must mean they actually paid for the
    // $650 Board Entry product — isQualified alone isn't enough, because
    // hasPurchasedProduct (and therefore isQualified) also turns true from
    // the separate $160 POD purchase (same "bat246_entry"-tagged pattern the
    // POD reconciliation above has to work around). Without this check,
    // someone who only ever bought the POD product would incorrectly show
    // as "Ready to be placed on board".
    const allUserIds = docs.map((d: any) => d.userId?._id || d.userId).filter(Boolean);
    const { Invoice } = await import("../../models/invoice.model");
    const { BOARD_ENTRY_PRODUCT_ID } = await import("../services/bat246BoardInvite.service");
    const paidBoardInvoices = allUserIds.length
      ? await Invoice.find({
          userId: { $in: allUserIds },
          status: "paid",
          "lineItems.itemId": new Types.ObjectId(BOARD_ENTRY_PRODUCT_ID),
        }).select("userId").lean()
      : [];
    const boardPurchasedSet = new Set((paidBoardInvoices as any[]).map((inv) => String(inv.userId)));

    const result = docs.map((d: any) => {
      const uid = d.userId?._id?.toString() || d.userId?.toString();
      const podPurchaseCompleted = !!d.podPurchaseCompletedAt || justCompleted.has(uid);
      const isOnBoard = d.playerId ? onBoardIds.has(String(d.playerId)) : false;
      const hasBoardPurchase = boardPurchasedSet.has(uid);

      // Board status ("Invite To Board" / "Board Invite Status" columns,
      // Inviteandplace page): "ready to place" requires an actual paid
      // invoice on the $650 Board Entry product (hasBoardPurchase) — NOT
      // isQualified alone, since isQualified can also be satisfied by the
      // separate $160 POD purchase (see the comment above boardPurchasedSet).
      let boardPlacedTrackingNo: string | null = d.boardPlacedBoardId
        ? placedBoardMap.get(String(d.boardPlacedBoardId)) ?? null
        : null;
      if (!boardPlacedTrackingNo && d.playerId) {
        const bid = playerBoardIdMap.get(String(d.playerId));
        if (bid) boardPlacedTrackingNo = placedBoardMap.get(bid) ?? null;
      }

      return {
        ...d,
        isOnBoard,
        podStatus: d.podPlacedAt ? "placed" : podPurchaseCompleted ? "purchased" : d.podInviteSentAt ? "invited" : "not_invited",
        podPlacedBoardTrackingNo: d.podPlacedBoardId ? placedBoardMap.get(String(d.podPlacedBoardId)) ?? null : null,
        boardStatus: (d.isApproved || isOnBoard) ? "placed" : hasBoardPurchase ? "qualified" : d.boardInviteSentAt ? "invited" : "not_invited",
        boardPlacedBoardTrackingNo: boardPlacedTrackingNo,
        referredByName: d.bat246RefUserId?.name || d.bat246RefUserId?.email || null,
      };
    });

    res.json({ distributors: result, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

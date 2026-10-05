import mongoose, { Types } from "mongoose";
import { Bat246Config } from "../models/bat246Config.model";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { Bat246PlayerBoard } from "../models/bat246PlayerBoard.model";
import { Bat246Movement } from "../models/bat246Movement.model";

/**
 * Filters a parent board's hotBox for a child board.
 * An entry is carried over when its referredUserId lands on this child board.
 * Entries without referredUserId (pre-feature records) are intentionally dropped
 * since we have no way to determine which child they belong to.
 * Dugout players are included in the lookup set so overflow-routed dugout entries
 * are handled correctly.
 */
function buildChildHotBox(
  parentHotBox: any[],
  positionPlayerIds: Set<string>,
  childDugout: any[],
): any[] {
  const childPlayerIds = new Set<string>(positionPlayerIds);
  for (const slot of childDugout) {
    if (slot?.playerId) childPlayerIds.add(slot.playerId.toString());
  }
  return (parentHotBox ?? []).filter(
    (h: any) => h.referredUserId && childPlayerIds.has(h.referredUserId.toString()),
  );
}

/**
 * Phase 1 — Atomic board creation in a transaction.
 * Creates left + right child boards, locks parent as "splitting".
 */
export async function splitBoardPhase1(parentBoardId: string) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Read parent with current __v
    const parent = await Bat246Board.findById(parentBoardId).session(session);
    if (!parent) throw new Error("Board not found");
    if (parent.status !== "active") throw new Error(`Board status is '${parent.status}', cannot split`);

    const currentVersion = (parent as any).__v as number;
    const p = parent.toObject();

    // Derive family prefix from the board's own familyNumber field — it's
    // copied verbatim to every board at creation and never re-derived, so
    // unlike trackingNumber (a display string that one-off scripts have
    // directly rewritten in the past) it can't silently drift. Only fall
    // back to parsing trackingNumber for legacy boards that predate this
    // field being populated, and log if the two ever disagree so drift is
    // visible instead of silently propagating to every descendant.
    const tnMatch = ((p as any).trackingNumber ?? "").match(/^(\d+)-(\d+)/);
    const familyNumberField: number | null = (p as any).familyNumber ?? null;
    const familyPrefix: string = familyNumberField != null ? String(familyNumberField) : (tnMatch ? tnMatch[1] : "");
    const parentSeq: number    = tnMatch ? parseInt(tnMatch[2], 10) : 0;
    const familyPrefixNum      = parseInt(familyPrefix, 10);

    if (familyNumberField != null && tnMatch && String(familyNumberField) !== tnMatch[1]) {
      console.warn(
        `[bat246 split] familyNumber field (${familyNumberField}) disagrees with trackingNumber prefix ` +
        `("${tnMatch[1]}" from "${(p as any).trackingNumber}") for board ${p._id} — trusting familyNumber field.`
      );
    }

    // Seed the counter from ground truth: the highest sequence number in use
    // by ANY board in this family, not just the splitting parent's own
    // number. A parent-only floor is not enough — if a sibling branch
    // already carries a higher number (or a migration/manual edit shifted
    // visible numbers without updating this counter), seeding from the
    // parent alone lets the next $inc reissue an already-used number.
    const familyBoards = await Bat246Board.find(
      { familyNumber: familyPrefixNum },
      { trackingNumber: 1 }
    ).session(session).lean();
    let trueMaxSeq = parentSeq;
    for (const b of familyBoards) {
      const m = ((b as any).trackingNumber ?? "").match(/-(\d+)/);
      if (m) trueMaxSeq = Math.max(trueMaxSeq, parseInt(m[1], 10));
    }
    await Bat246Config.updateOne(
      {},
      { $max: { [`familySequences.${familyPrefix}`]: trueMaxSeq } },
      { upsert: true, session }
    );

    // Get two new board numbers atomically
    const config = await Bat246Config.findOneAndUpdate(
      {},
      {
        $inc: {
          boardCounter: 2,
          [`familySequences.${familyPrefix}`]: 2,
        },
      },
      { new: true, upsert: true, session }
    );
    const leftBoardNumber  = config!.boardCounter - 1;
    const rightBoardNumber = config!.boardCounter;
    const familySeqs = (config!.familySequences as any) ?? {};
    const lastSeq    = familySeqs[familyPrefix] as number;
    const leftSeq    = lastSeq - 1;   // even seq → left
    const rightSeq   = lastSeq;       // odd  seq → right

    // Parity assertion — catches any future counter corruption immediately
    // and loudly instead of silently handing out a wrong number.
    if (leftSeq % 2 !== 0 || rightSeq !== leftSeq + 1) {
      throw new Error(
        `[bat246 split] Sequence parity broken for family ${familyPrefix}: leftSeq=${leftSeq}, rightSeq=${rightSeq}`
      );
    }

    // Semantic collision guard — belt-and-suspenders on top of the
    // ground-truth seed above. Checks the sequence NUMBER regardless of
    // L/R suffix, since e.g. "6-1003 L" and "6-1003 R" are different
    // strings but the same (already-used) sequence number.
    const collision = familyBoards.find((b: any) => {
      const m = (b.trackingNumber ?? "").match(/-(\d+)/);
      if (!m) return false;
      const seq = parseInt(m[1], 10);
      return seq === leftSeq || seq === rightSeq;
    });
    if (collision) {
      throw new Error(
        `[bat246 split] Tracking-number collision detected while splitting ${p.trackingNumber}: ` +
        `sequence ${leftSeq}/${rightSeq} already used by "${(collision as any).trackingNumber}". ` +
        `Aborting split — check Bat246Config.familySequences.${familyPrefix} for drift.`
      );
    }

    // Lock parent
    const locked = await Bat246Board.findOneAndUpdate(
      { _id: parent._id, __v: currentVersion, status: "active" },
      { $set: { status: "splitting" }, $inc: { __v: 1 } },
      { session }
    );
    if (!locked) throw new Error("Concurrent split detected — retry");

    const now = new Date();
    const ppEnd = new Date(now.getTime() + 120 * 60 * 60 * 1000); // +5 days

    // Helper to build a slot copy for the child board. entryNo represents how
    // many times this player has purchased the $650 entry product — a split
    // is a board relocation, not a new purchase, so entryNo carries forward
    // UNCHANGED. (Previously incremented here, which inflated entryNo by 1
    // per split regardless of actual purchase count — fixed.)
    const copySlot = (slot: any) => {
      if (!slot) return null;
      return { ...slot, enteredAt: now };
    };

    // Leaderboard "carried forward" (2026-08-22): the parent's CURRENT G/H/T
    // occupants are copied onto BOTH children — same duplication style as
    // Home Plate above (copySlot(p.thirdBase) onto both sides) — each side
    // then living its own independent life from there. The one new graduate
    // (parent's old Home Plate player, who just crossed — see runPhase2) is
    // cascaded into each child's copy separately via assignLbSlots(), so the
    // same 3 people can end up holding, losing, or being promoted
    // differently on the left board vs. the right board. A tier the parent
    // hadn't filled yet stays empty on both children, same as before.
    // See bat246_leaderboard.md § "Carried forward across splits".
    const parentLbByTier = new Map(
      (Array.isArray(p.leaderBoard) ? p.leaderBoard : []).map((r: any) => [r.tier, r])
    );
    const copyLeaderBoard = () =>
      (["G", "H", "T"] as const).map((tier) => {
        const row: any = parentLbByTier.get(tier);
        return {
          tier,
          playerId: row?.playerId ?? null,
          qualifiedAt: row?.playerId ? now : null,
          earningsOnBoard: 0, // this board's own running total starts fresh
        };
      });

    // ── Dugout routing ────────────────────────────────────────────────────────
    // Rule A: dugout[0] → Left dugout, dugout[1] → Right dugout (one per child board)
    // Rule B: dugout[2+] → On-Deck Circle; follow referredBy to pick which child board
    //
    // Build sets of playerIds landing on each child board (for referredBy lookup)
    const leftPlayerIds = new Set<string>();
    const rightPlayerIds = new Set<string>();

    if (p.thirdBase?.playerId) {
      // 3rd Base duplicates to both boards
      leftPlayerIds.add(p.thirdBase.playerId.toString());
      rightPlayerIds.add(p.thirdBase.playerId.toString());
    }
    if (p.secondBaseA?.playerId) leftPlayerIds.add(p.secondBaseA.playerId.toString());
    if (p.secondBaseB?.playerId) rightPlayerIds.add(p.secondBaseB.playerId.toString());
    if (p.firstBase?.[0]?.playerId) leftPlayerIds.add(p.firstBase[0].playerId.toString());
    if (p.firstBase?.[1]?.playerId) leftPlayerIds.add(p.firstBase[1].playerId.toString());
    if (p.firstBase?.[2]?.playerId) rightPlayerIds.add(p.firstBase[2].playerId.toString());
    if (p.firstBase?.[3]?.playerId) rightPlayerIds.add(p.firstBase[3].playerId.toString());
    for (let i = 0; i < 4; i++) {
      if (p.atBat?.[i]?.playerId) leftPlayerIds.add(p.atBat[i]!.playerId!.toString());
    }
    for (let i = 4; i < 8; i++) {
      if (p.atBat?.[i]?.playerId) rightPlayerIds.add(p.atBat[i]!.playerId!.toString());
    }

    const parentDugout: any[] = (p.dugout ?? []).filter(Boolean);
    const leftDugout:  any[] = [];
    const rightDugout: any[] = [];

    parentDugout.forEach((slot: any, i: number) => {
      // A POD cycle's 4th-entrant dugout slot always follows its inviter
      // (referredBy) to whichever child board they land on — overrides the
      // fixed index-0/1 rule below, which doesn't apply to it.
      if (slot.podTeamId) {
        const rid = slot.referredBy?.toString();
        const goesLeft = rid
          ? leftPlayerIds.has(rid) && !rightPlayerIds.has(rid)
          : false;
        goesLeft ? leftDugout.push(copySlot(slot)) : rightDugout.push(copySlot(slot));
        return;
      }
      if (i === 0) { leftDugout.push(copySlot(slot));  return; }
      if (i === 1) { rightDugout.push(copySlot(slot)); return; }
      // Overflow (index 2+): follow referredBy, default to right
      const rid = slot.referredBy?.toString();
      const goesLeft = rid
        ? leftPlayerIds.has(rid) && !rightPlayerIds.has(rid)
        : false;
      goesLeft ? leftDugout.push(copySlot(slot)) : rightDugout.push(copySlot(slot));
    });
    // ─────────────────────────────────────────────────────────────────────────

    // NOTE: a board's POD cycle (pod[]/podTeamId/podEarnerPlayerId/
    // podCompletedAt) is closed history specific to THIS board and is
    // deliberately NOT copied onto either child — both children start fresh
    // and get their own podTeamId whenever their own POD cycle begins. Only
    // the 4th entrant's own dugout/atBat slot (a normal slot, just
    // podTeamId-tagged) travels forward, via the ordinary referredBy-based
    // dugout routing above — same as any other dugout occupant.

    // LEFT board: 3rdBase→HP, 2ndBaseA→3rd, 1BA→2ndA, 1BB→2ndB, AB1-4→1stBase A-D
    const leftBoard = await Bat246Board.create(
      [{
        boardNumber: leftBoardNumber,
        trackingNumber: `${familyPrefix}-${leftSeq} L`,
        title: p.title,
        status: "active",
        generation: (p.generation ?? 0) + 1,
        familyNumber: familyPrefixNum,
        side: "left",
        parentBoardId: parent._id,
        protectionPeriodEnd: ppEnd,
        inviteProductId: (p as any).inviteProductId ?? null,
        warpCount: 0,
        minorLeagueAmount: p.minorLeagueAmount,
        nextHomePlatePayout: (p as any).nextHomePlatePayout ?? 200,

        homePlate:   copySlot(p.thirdBase),
        thirdBase:   copySlot(p.secondBaseA),
        secondBaseA: copySlot(p.firstBase?.[0] ?? null),
        secondBaseB: copySlot(p.firstBase?.[1] ?? null),
        firstBase: [
          copySlot(p.atBat?.[0] ?? null),
          copySlot(p.atBat?.[1] ?? null),
          copySlot(p.atBat?.[2] ?? null),
          copySlot(p.atBat?.[3] ?? null),
        ],
        atBat:        Array(8).fill(null),
        dugout:       leftDugout,
        hotBox:       buildChildHotBox(p.hotBox, leftPlayerIds, leftDugout),
        penciling:    [],
        prePick:      [],
        leaderBoard: copyLeaderBoard(),
      }],
      { session }
    );

    // Reserve each child's own POD team number up front (never inherited
    // from the parent — see the note above about closed POD history).
    {
      const { assignPodTeamId } = await import("./bat246PodInvite.service");
      // Must share the session: the transaction already locked the config doc, so an outside $inc deadlocks until it times out.
      await assignPodTeamId(leftBoard[0], session);
      await leftBoard[0].save({ session });
    }

    // RIGHT board: 3rdBase→HP, 2ndBaseB→3rd, 1BC→2ndA, 1BD→2ndB, AB5-8→1stBase A-D
    const rightBoard = await Bat246Board.create(
      [{
        boardNumber: rightBoardNumber,
        trackingNumber: `${familyPrefix}-${rightSeq} R`,
        title: p.title,
        status: "active",
        generation: (p.generation ?? 0) + 1,
        familyNumber: familyPrefixNum,
        side: "right",
        parentBoardId: parent._id,
        protectionPeriodEnd: ppEnd,
        inviteProductId: (p as any).inviteProductId ?? null,
        warpCount: 0,
        minorLeagueAmount: p.minorLeagueAmount,
        nextHomePlatePayout: (p as any).nextHomePlatePayout ?? 200,

        homePlate:   copySlot(p.thirdBase),
        thirdBase:   copySlot(p.secondBaseB),
        secondBaseA: copySlot(p.firstBase?.[2] ?? null),
        secondBaseB: copySlot(p.firstBase?.[3] ?? null),
        firstBase: [
          copySlot(p.atBat?.[4] ?? null),
          copySlot(p.atBat?.[5] ?? null),
          copySlot(p.atBat?.[6] ?? null),
          copySlot(p.atBat?.[7] ?? null),
        ],
        atBat:        Array(8).fill(null),
        dugout:       rightDugout,
        hotBox:       buildChildHotBox(p.hotBox, rightPlayerIds, rightDugout),
        penciling:    [],
        prePick:      [],
        leaderBoard: copyLeaderBoard(),
      }],
      { session }
    );

    {
      const { assignPodTeamId } = await import("./bat246PodInvite.service");
      await assignPodTeamId(rightBoard[0], session);
      await rightBoard[0].save({ session });
    }

    // Finalize parent
    await Bat246Board.findByIdAndUpdate(
      parent._id,
      {
        $set: {
          status: "split",
          splitAt: now,
          leftChildBoardId: leftBoard[0]._id,
          rightChildBoardId: rightBoard[0]._id,
        },
        $inc: { __v: 1 },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Phase 2 fires async — do not await
    runPhase2(parent._id.toString(), leftBoard[0]._id.toString(), rightBoard[0]._id.toString()).catch(
      err => console.error("[bat246 split phase2 error]", err)
    );

    return {
      parentId: parent._id,
      leftBoardId: leftBoard[0]._id,
      rightBoardId: rightBoard[0]._id,
      leftBoardNumber,
      rightBoardNumber,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

/**
 * Phase 2 — Async stat updates (outside transaction, each step retryable).
 */
async function runPhase2(parentId: string, leftId: string, rightId: string) {
  const now = new Date();

  const [leftBoard, rightBoard] = await Promise.all([
    Bat246Board.findById(leftId).lean(),
    Bat246Board.findById(rightId).lean(),
  ]);
  if (!leftBoard || !rightBoard) return;

  const allSlotMoves: Array<{
    playerId: Types.ObjectId;
    playerName: string;
    fromPos: string;
    toPos: string;
    toBoardId: Types.ObjectId;
  }> = [];

  const collectMoves = (board: any, boardId: Types.ObjectId) => {
    const slots: Array<{ slot: any; pos: string }> = [
      { slot: board.homePlate,   pos: "homePlate" },
      { slot: board.thirdBase,   pos: "thirdBase" },
      { slot: board.secondBaseA, pos: "secondBaseA" },
      { slot: board.secondBaseB, pos: "secondBaseB" },
      ...(board.firstBase ?? []).map((s: any, i: number) => ({ slot: s, pos: `firstBase.${["A","B","C","D"][i]}` })),
      ...(board.atBat ?? []).map((s: any, i: number) => ({ slot: s, pos: `atBat.${i}` })),
      ...(board.dugout ?? []).map((s: any, i: number) => ({ slot: s, pos: `dugout.${i}` })),
      ...(board.onDeckCircle ?? []).map((s: any, i: number) => ({ slot: s, pos: `onDeckCircle.${i}` })),
    ];
    for (const { slot, pos } of slots) {
      if (slot?.playerId) {
        allSlotMoves.push({ playerId: slot.playerId, playerName: slot.playerName ?? "", fromPos: "split", toPos: pos, toBoardId: boardId });
      }
    }
  };

  collectMoves(leftBoard,  new Types.ObjectId(leftId));
  collectMoves(rightBoard, new Types.ObjectId(rightId));

  // a. Write movement records
  await Bat246Movement.insertMany(
    allSlotMoves.map(m => ({
      fromBoardId: new Types.ObjectId(parentId),
      toBoardId: m.toBoardId,
      playerId: m.playerId,
      playerName: m.playerName,
      fromPosition: "split",
      toPosition: m.toPos,
      reason: "split",
      timestamp: now,
    }))
  );

  // b. Update bat246PlayerBoards
  const allPlayerIds = allSlotMoves.map(m => m.playerId);
  await Bat246PlayerBoard.updateMany(
    { playerId: { $in: allPlayerIds }, boardId: new Types.ObjectId(parentId), status: "active" },
    { $set: { status: "left", leftAt: now } }
  );

  const newMemberships = allSlotMoves.map(m => ({
    playerId: m.playerId,
    boardId: m.toBoardId,
    position: m.toPos,
    status: "active",
    joinedAt: now,
  }));

  for (const mem of newMemberships) {
    await Bat246PlayerBoard.updateOne(
      { playerId: mem.playerId, boardId: mem.boardId },
      { $setOnInsert: mem },
      { upsert: true }
    );
  }

  // (c. previously bumped minorLeague.totalEntries here per split — removed.
  //  totalEntries drives entryNo, which represents $650-product purchase
  //  count; a split relocates a player, it isn't a new purchase, so the
  //  counter must not move here. See copySlot above for the matching fix.)

  // d. LB graduation: the parent board's Home Plate player exits the board when it splits.
  //    That is "crossing home plate" — mark them so they qualify for LB on future boards.
  //    The 3rd Base player moving to HP on child boards does NOT count — they haven't exited yet.
  const parentBoard = await Bat246Board.findById(parentId).lean() as any;
  const parentHpId  = parentBoard?.homePlate?.playerId;
  if (parentHpId) {
    await Bat246Player.updateOne(
      { _id: parentHpId },
      { $set: { "minorLeague.crossedHp": true, "minorLeague.crossedHpAt": now } }
    );
    // Per-board LB cascade (bat246_leaderboard.md) — the graduate (this
    // exiting parent-board HP player) is evaluated independently against
    // each fresh child board's own 3 slots. No-op on either board if they
    // don't qualify for any tier.
    const { assignLbSlots } = require("./bat246Leaderboard.service");
    await Promise.all([
      assignLbSlots(leftId, parentHpId).catch((e: any) => console.error("[bat246 split] assignLbSlots left:", e.message)),
      assignLbSlots(rightId, parentHpId).catch((e: any) => console.error("[bat246 split] assignLbSlots right:", e.message)),
    ]);
  }

  // Steps e-i (matching bonus, free entries, loans, layaway, TopTen)
  // are stubs here — implement per business rules as game goes live
  console.log(`[bat246 split phase2] complete for parent ${parentId}`);
}

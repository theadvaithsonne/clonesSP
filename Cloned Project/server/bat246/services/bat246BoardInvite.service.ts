import { Types } from "mongoose";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { Bat246BoardInvite } from "../models/bat246BoardInvites.model";
import { Bat246Board } from "../models/bat246Board.model";
import { Bat246Player } from "../models/bat246Player.model";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";
import { sendMail, EMAIL_FROM_NOTIFICATION, bat246OfficeInviteEmailTemplate } from "../../services/mailer";
import { isPartOfAnyActiveBoard } from "./bat246PodInvite.service";
import { getPlacementInfo, placeUserFromReservation, placeUserInDugout } from "./bat246.service";

// The $650 "Board Entry" product — same ID used by the top "+ Invite" button
// and InviteNewDistributorModal.tsx's PRODUCT_650_ID.
export const BOARD_ENTRY_PRODUCT_ID = "6a159466cd9f94f7f23b2ef9";

/**
 * Sends (or resends) the Board Entry invite email to a distributor who
 * isn't qualified yet. Mirrors sendPodInvite() exactly: every click — first
 * invite or any later "Remind" — sends a real email, no cooldown; the
 * first-touch inviter (boardInvitedByUserId) is set once and never
 * overwritten by later reminders from the same or a different caller, but
 * every send still gets its own Bat246BoardInvite log row.
 */
export async function sendBoardInvite(targetUserId: string, callerUserId: string) {
  if (!Types.ObjectId.isValid(targetUserId)) throw new Error("Invalid userId");
  if (!(await isPartOfAnyActiveBoard(callerUserId))) {
    throw new Error("You must be part of an active board to send Board Entry invites");
  }

  const [dist, targetUser, callerUser] = await Promise.all([
    Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) }),
    User.findById(targetUserId).select("name email").lean() as any,
    User.findById(callerUserId).select("name email").lean() as any,
  ]);

  if (!dist) throw new Error("Distributor not found");
  const targetEmail = targetUser?.email || "";
  if (!targetEmail) throw new Error("This distributor has no email on file");
  // isQualified already means "completed all 4 steps, including the $650
  // purchase" — once true there's nothing left to invite them to buy.
  if (dist.isQualified) throw new Error("This distributor is already qualified");

  const product = await Product.findById(BOARD_ENTRY_PRODUCT_ID).select("name price currency").lean() as any;
  const isFirstSend = !dist.boardInviteSentAt;
  const callerName = callerUser?.name || callerUser?.email || "A member";
  const callerEmail = callerUser?.email || "";

  const { env } = await import("../../config/env");
  const productUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/games/bat246/office-invite?productId=${BOARD_ENTRY_PRODUCT_ID}&ref=${callerUserId}`;
  const template = bat246OfficeInviteEmailTemplate({
    productName: product?.name || "Bat246 Board Entry",
    priceLabel: product ? `${product.currency || "USD"} ${Number(product.price).toFixed(2)}` : "$650.00",
    productUrl,
  });
  await sendMail(targetEmail, template.subject, template.html, template.text, EMAIL_FROM_NOTIFICATION);

  await Bat246BoardInvite.create({
    targetUserId: new Types.ObjectId(targetUserId),
    targetEmail,
    invitedByUserId: new Types.ObjectId(callerUserId),
    invitedByEmail: callerEmail,
    invitedByName: callerName,
    productId: new Types.ObjectId(BOARD_ENTRY_PRODUCT_ID),
    type: isFirstSend ? "invite" : "remind",
  });

  const update: any = { boardInviteSentAt: new Date(), $inc: { boardInviteCount: 1 } };
  if (isFirstSend) {
    update.boardInvitedByUserId = new Types.ObjectId(callerUserId);
    update.boardInvitedByEmail = callerEmail;
    update.boardInvitedByName = callerName;
  }
  await Bat246Distributor.updateOne({ _id: dist._id }, update);

  return { ok: true, type: isFirstSend ? "invite" : "remind" };
}

/**
 * Places a "ready" (isQualified) distributor onto a board — the "Ready to
 * be placed on board" button. A second, open-to-any-active-board-member
 * path onto the board tree alongside the existing admin/1st-Base Approve
 * flow (bat246.routes.ts POST /distributors/:userId/approve): same
 * underlying placement functions (placeUserFromReservation /
 * placeUserInDugout), same isApproved completion flag, just relaxed
 * permission and its own attribution fields (boardPlaced*) for POD-parity
 * tracking.
 */
export async function placeDistributorOnBoard(
  targetUserId: string,
  callerUserId: string,
  choice: { boardId: string; position: string } | { boardId: string; toDugout: true }
) {
  if (!(await isPartOfAnyActiveBoard(callerUserId))) {
    throw new Error("You must be part of an active board to place someone on a board");
  }

  const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) });
  if (!dist) throw new Error("Distributor not found");
  if (!dist.isQualified) throw new Error("Distributor is not qualified");
  if (dist.isApproved) throw new Error("This distributor is already placed on a board");

  let placement: { position: string; boardTrackingNo: string };
  if ("toDugout" in choice && choice.toDugout) {
    placement = await placeUserInDugout(targetUserId, choice.boardId);
  } else {
    placement = await placeUserFromReservation(
      targetUserId,
      { boardId: choice.boardId, position: (choice as any).position },
      { skipGreenCard: true } // caller here isn't necessarily the actual referrer
    );
  }

  const board = await Bat246Board.findOne({ trackingNumber: placement.boardTrackingNo }).select("_id").lean() as any;

  await Bat246Distributor.updateOne(
    { _id: dist._id },
    {
      $set: {
        isApproved: true,
        approvedAt: dist.approvedAt ?? new Date(),
        boardPlacedBoardId: board?._id ?? new Types.ObjectId(choice.boardId),
        boardPlacedPositionKey: placement.position,
        boardPlacedAt: new Date(),
        boardPlacedByUserId: new Types.ObjectId(callerUserId),
      },
    }
  );

  return { ok: true, placement };
}

/**
 * Placement-info lookup for the open board-placement flow — same shape as
 * the existing admin/1st-Base placement-info route, just reusing the
 * generic (permission-agnostic) getPlacementInfo() service function with a
 * relaxed caller check (isPartOfAnyActiveBoard instead of admin/1st Base).
 * An optional explicit boardId (the board-picker dropdown, currently
 * admin-only on the frontend) skips getPlacementInfo's own auto-detected
 * board and returns positions for that board instead.
 */
export async function getBoardPlacementInfoForCaller(targetUserId: string, callerUserId: string, boardId?: string) {
  if (!(await isPartOfAnyActiveBoard(callerUserId))) {
    throw new Error("You must be part of an active board to place someone on a board");
  }
  const dist = await Bat246Distributor.findOne({ userId: new Types.ObjectId(targetUserId) }).lean() as any;
  if (!dist?.isQualified) throw new Error("Distributor is not qualified");
  return getPlacementInfo(targetUserId, boardId ? { boardId } : undefined);
}

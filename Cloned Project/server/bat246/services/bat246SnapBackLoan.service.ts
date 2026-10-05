/**
 * bat246SnapBackLoan.service.ts
 *
 * Snap Back Loans (SBL) — B2 Coins a member can BORROW (not be gifted) to
 * purchase the $650 Board Entry / $160 POD Entry, automatically repaid
 * from that borrower's own future real BAT246 earnings. Parallel to, and
 * built on top of, bat246Layaway.service.ts's B2 Coins system — see the
 * approved plan for the full design.
 *
 * Approving a loan is, underneath, just a normal giveB2Coins() call from
 * the responder to the borrower (reused unchanged) — this is what makes
 * "an SBL draws from the giver's normal pool capacity" fall out for free,
 * with zero new pool-allocation logic. The loan record layered on top is
 * purely about tracking the borrower's own debt and its automatic
 * repayment; it never routes anything back to the giver.
 *
 * Repayment hooks into the single directCreditStoreWallet() choke point
 * in bat246Wallet.util.ts — every real BAT246 earning (AT-BAT, POD
 * splits, Leaderboard, Lostmoney auto-pay) already funnels through that
 * one function, so applySnapBackLoanRepayment() below is the only place
 * this feature needs to touch the earnings side at all.
 */
import { Types } from "mongoose";
import { Bat246SnapBackLoanRequest } from "../models/bat246SnapBackLoanRequest.model";
import { Bat246SnapBackLoan } from "../models/bat246SnapBackLoan.model";
import { Bat246SnapBackLoanRepayment } from "../models/bat246SnapBackLoanRepayment.model";
import { Bat246PlacementNotification } from "../models/bat246PlacementNotifications.model";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { User } from "../../models/user.model";
import {
  computeLayawayEligibility,
  giveB2Coins,
  resolveGivenAmountForProduct,
  verifyRecipientIsOfficeMember,
  BOARD_ENTRY_PRODUCT_ID,
  POD_ENTRY_PRODUCT_ID,
} from "./bat246Layaway.service";

function labelForProduct(productId: string): "board" | "pod" | null {
  if (productId === BOARD_ENTRY_PRODUCT_ID) return "board";
  if (productId === POD_ENTRY_PRODUCT_ID) return "pod";
  return null;
}

function productDisplayLabel(label: "board" | "pod"): string {
  return label === "board" ? "$650 Board Entry" : "$160 POD Entry";
}

// requestedByUserId was added after this feature already had live
// documents in production (self-only requests, back when the requester
// was always the borrower) — those rows genuinely have no value for it.
// Every read of requestedByUserId off a lean() doc must go through this,
// not `r.requestedByUserId.toString()` directly, or it throws on those
// pre-existing rows.
function requestedByIdOf(r: any): string {
  return (r.requestedByUserId ?? r.borrowerUserId).toString();
}

async function namesFor(userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
  const ids = Array.from(new Set(userIds));
  const users = ids.length ? await User.find({ _id: { $in: ids } }).select("name email").lean() : [];
  return new Map((users as any[]).map((u) => [u._id.toString(), { name: u.name || u.email, email: u.email }]));
}

export async function createSnapBackLoanRequest(params: {
  /** Who's actually submitting this ask — the authenticated caller. */
  requestedByUserId: string;
  /** Whose future earnings the loan (if approved) will garnish. Defaults
   *  to the caller for a normal self-request; a distinct value means
   *  someone without giving power of their own is referring a
   *  friend/contact to an eligible lender instead. */
  borrowerUserId: string;
  eligibleUserId: string;
  productId: string;
  note?: string;
}) {
  const { requestedByUserId, borrowerUserId, eligibleUserId, productId } = params;
  // Computed up front — every validation error below needs to know
  // whether it's addressing the borrower directly ("you") or a referrer
  // asking on a friend's behalf ("they"), or the messages read as if the
  // referrer is the one blocked, which isn't what's actually true.
  const isReferral = requestedByUserId !== borrowerUserId;

  if (eligibleUserId === borrowerUserId) {
    throw new Error(
      isReferral
        ? "The lender you're asking can't be the same person you're borrowing for."
        : "You can't ask yourself for a Snap Back Loan"
    );
  }
  // Referral case: the borrower must be a real BAT246-office member (same
  // guard the plain Give/Request flow already enforces for its
  // recipient) — a self-request trivially passes since the caller is
  // already authenticated as one.
  await verifyRecipientIsOfficeMember(borrowerUserId, eligibleUserId);

  const { amount, productId: resolvedProductId } = await resolveGivenAmountForProduct(productId, undefined);
  if (!resolvedProductId) throw new Error("A product is required for a Snap Back Loan");
  const productLabel = labelForProduct(resolvedProductId);
  if (!productLabel) throw new Error("Unrecognized product");

  // Already bought their entry (real money, B2 Coins, or a prior loan) —
  // nothing left to borrow for. Missing distributor doc (hasn't started
  // the funnel yet) is treated as "not purchased", not an error.
  const distributor = await Bat246Distributor.findOne({ userId: borrowerUserId })
    .select("hasPurchasedProduct invitedProductId")
    .lean() as any;
  if (distributor?.hasPurchasedProduct) {
    throw new Error(
      isReferral
        ? "They've already completed their BAT 246 entry purchase — there's nothing left to borrow for."
        : "You've already completed your BAT 246 entry purchase — there's nothing left to borrow for."
    );
  }

  const activeLoan = await Bat246SnapBackLoan.exists({ borrowerUserId, status: "active" });
  if (activeLoan) {
    throw new Error(
      isReferral
        ? "They already have an outstanding Snap Back Loan — it needs to be repaid before requesting another."
        : "You already have an outstanding Snap Back Loan — repay it before requesting another."
    );
  }
  const pendingRequest = await Bat246SnapBackLoanRequest.exists({ borrowerUserId, status: "pending" });
  if (pendingRequest) {
    throw new Error(isReferral ? "They already have a pending Snap Back Loan request." : "You already have a pending Snap Back Loan request.");
  }

  const eligibility = await computeLayawayEligibility(eligibleUserId);
  if (!eligibility.isAlanK && !eligibility.eligible) {
    throw new Error("This person isn't currently eligible to fund a Snap Back Loan");
  }

  const request = await Bat246SnapBackLoanRequest.create({
    requestedByUserId: new Types.ObjectId(requestedByUserId),
    borrowerUserId: new Types.ObjectId(borrowerUserId),
    eligibleUserId: new Types.ObjectId(eligibleUserId),
    productId: new Types.ObjectId(resolvedProductId),
    productLabel,
    amount,
    note: params.note?.trim() || "",
    termsAcceptedAt: new Date(),
  });

  const [borrower, eligiblePerson, requester] = await Promise.all([
    User.findById(borrowerUserId).select("name email").lean() as any,
    User.findById(eligibleUserId).select("name email").lean() as any,
    isReferral ? (User.findById(requestedByUserId).select("name email").lean() as any) : null,
  ]);

  const displayLabel = productDisplayLabel(productLabel);
  const borrowerLabel = borrower?.name || borrower?.email || "Someone";
  const requesterLabel = requester?.name || requester?.email || "Someone";
  const summary = isReferral
    ? `${requesterLabel} is asking you to fund a $${amount.toFixed(2)} Snap Back Loan (${displayLabel}) for ${borrowerLabel} — repaid automatically from ${borrowerLabel}'s future earnings`
    : `${borrowerLabel} is requesting a $${amount.toFixed(2)} Snap Back Loan (${displayLabel}) — repaid automatically from their future earnings`;

  await Bat246PlacementNotification.create({
    notificationType: "snapbackloan_request",
    qualifiedUserId: new Types.ObjectId(borrowerUserId),
    qualifiedUserEmail: borrower?.email || "",
    qualifiedUserName: borrower?.name || "",
    uplineUserId: new Types.ObjectId(eligibleUserId),
    snapBackLoanRequestId: request._id,
    summary,
  });

  try {
    const { sendMail, EMAIL_FROM_NOTIFICATION, bat246SnapBackLoanRequestEmailTemplate } = await import("../../services/mailer");
    if (eligiblePerson?.email) {
      const template = bat246SnapBackLoanRequestEmailTemplate({
        eligibleName: eligiblePerson.name,
        borrowerName: borrowerLabel,
        amountLabel: `$${amount.toFixed(2)}`,
        productLabel: displayLabel,
        note: params.note?.trim(),
        requestedByName: isReferral ? requesterLabel : undefined,
      });
      await sendMail(eligiblePerson.email, template.subject, template.html, template.text, EMAIL_FROM_NOTIFICATION);
    }
  } catch (err: any) {
    // Never let an email failure block the request itself.
    console.error("[bat246-sbl] request email failed:", err?.message);
  }

  return request;
}

export async function respondToSnapBackLoanRequest(
  requestId: string,
  responderUserId: string,
  approve: boolean
) {
  const request = await Bat246SnapBackLoanRequest.findById(requestId);
  if (!request) throw new Error("Request not found");
  if (request.eligibleUserId.toString() !== responderUserId) {
    throw new Error("Not authorized to respond to this request");
  }
  if (request.status !== "pending") {
    throw new Error("This request has already been responded to");
  }

  if (!approve) {
    request.status = "denied";
    request.respondedAt = new Date();
    await request.save();
    return { status: "denied" as const };
  }

  // Race guard — re-checked live rather than trusting the state at
  // request-creation time, same convention every other write in this
  // subsystem follows.
  const alreadyActive = await Bat246SnapBackLoan.exists({
    borrowerUserId: request.borrowerUserId,
    status: "active",
  });
  if (alreadyActive) {
    request.status = "insufficient_at_approval";
    request.respondedAt = new Date();
    await request.save();
    throw new Error("This borrower already has an outstanding Snap Back Loan");
  }

  try {
    // The actual coin movement — pool/wallet allocation, the
    // Bat246B2CoinTransaction row, the Lineup-1 hook — is 100% the
    // existing giveB2Coins, completely unmodified.
    const result = await giveB2Coins({
      fromUserId: responderUserId,
      recipientUserId: request.borrowerUserId.toString(),
      productId: request.productId.toString(),
    });

    const loan = await Bat246SnapBackLoan.create({
      borrowerUserId: request.borrowerUserId,
      giverUserId: new Types.ObjectId(responderUserId),
      requestId: request._id,
      productId: request.productId,
      productLabel: request.productLabel,
      principal: result.amount,
      outstandingBalance: result.amount,
      status: "active",
    });

    request.status = "approved";
    request.respondedAt = new Date();
    request.loanId = loan._id as any;
    await request.save();

    return { status: "approved" as const, loan };
  } catch (err: any) {
    request.status = "insufficient_at_approval";
    request.respondedAt = new Date();
    await request.save();
    throw new Error(err.message || "Your remaining allowance no longer covers this loan");
  }
}

/** The requester backing out of their own still-pending ask — whoever
 *  actually submitted it (requestedByUserId), not necessarily the
 *  borrower it was submitted for. */
export async function cancelSnapBackLoanRequest(requestId: string, requesterUserId: string) {
  const request = await Bat246SnapBackLoanRequest.findById(requestId);
  if (!request) throw new Error("Request not found");
  if (requestedByIdOf(request) !== requesterUserId) throw new Error("Not authorized to cancel this request");
  if (request.status !== "pending") throw new Error("This request is no longer pending");
  request.status = "cancelled";
  request.respondedAt = new Date();
  await request.save();
  return { status: "cancelled" as const };
}

/**
 * The repayment hook — called from directCreditStoreWallet()
 * (bat246Wallet.util.ts) before any real earning lands in a wallet.
 * 100% of the earning is diverted until the loan is fully repaid (per
 * the approved design), capped at whatever's still owed so a payout
 * bigger than the remaining debt only takes what's owed — the rest is
 * left in `remainder` for the caller to credit normally in the same
 * call. A no-op (full remainder, nothing diverted) when the user has no
 * active loan.
 */
export async function applySnapBackLoanRepayment(
  userId: string,
  earnedAmount: number,
  description: string
): Promise<{ divert: number; remainder: number }> {
  if (earnedAmount <= 0) return { divert: 0, remainder: earnedAmount };

  const loan = await Bat246SnapBackLoan.findOne({ borrowerUserId: userId, status: "active" });
  if (!loan) return { divert: 0, remainder: earnedAmount };

  const divert = Math.round(Math.min(earnedAmount, loan.outstandingBalance) * 100) / 100;
  if (divert <= 0) return { divert: 0, remainder: earnedAmount };

  loan.outstandingBalance = Math.round((loan.outstandingBalance - divert) * 100) / 100;
  if (loan.outstandingBalance <= 0.004) {
    loan.outstandingBalance = 0;
    loan.status = "repaid";
    loan.repaidAt = new Date();
  }
  await loan.save();

  await Bat246SnapBackLoanRepayment.create({
    loanId: loan._id,
    borrowerUserId: loan.borrowerUserId,
    amount: divert,
    earningDescription: description,
    balanceAfter: loan.outstandingBalance,
  });

  return { divert, remainder: Math.round((earnedAmount - divert) * 100) / 100 };
}

export interface SnapBackLoanRepaymentView {
  amount: number;
  earningDescription: string;
  balanceAfter: number;
  createdAt: Date;
}

export interface SnapBackLoanView {
  id: string;
  productLabel: "board" | "pod";
  principal: number;
  outstandingBalance: number;
  repaid: number;
  status: "active" | "repaid";
  createdAt: Date;
  repaidAt: Date | null;
  giverName: string;
  giverEmail: string;
  repayments: SnapBackLoanRepaymentView[];
}

/** The caller's own most recent loan (active or already repaid), with its
 *  repayment ledger — powers the B2 Coin Wallet page's "My Loan" card. */
export async function getMySnapBackLoan(borrowerUserId: string): Promise<SnapBackLoanView | null> {
  const loan = await Bat246SnapBackLoan.findOne({ borrowerUserId }).sort({ createdAt: -1 }).lean() as any;
  if (!loan) return null;

  const [giver, repayments] = await Promise.all([
    User.findById(loan.giverUserId).select("name email").lean() as any,
    Bat246SnapBackLoanRepayment.find({ loanId: loan._id }).sort({ createdAt: -1 }).lean(),
  ]);

  return {
    id: loan._id.toString(),
    productLabel: loan.productLabel,
    principal: loan.principal,
    outstandingBalance: loan.outstandingBalance,
    repaid: Math.round((loan.principal - loan.outstandingBalance) * 100) / 100,
    status: loan.status,
    createdAt: loan.createdAt,
    repaidAt: loan.repaidAt ?? null,
    giverName: giver?.name || giver?.email || "Someone",
    giverEmail: giver?.email || "",
    repayments: (repayments as any[]).map((r) => ({
      amount: r.amount,
      earningDescription: r.earningDescription || "",
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt,
    })),
  };
}

export interface SnapBackLoanRequestView {
  id: string;
  amount: number;
  productLabel: "board" | "pod";
  note: string;
  status: "pending" | "approved" | "denied" | "insufficient_at_approval" | "cancelled";
  createdAt: Date;
  respondedAt: Date | null;
  loanId: string | null;
  /** Set on getMySnapBackLoanRequests — "who I asked". */
  eligibleName?: string;
  eligibleEmail?: string;
  /** Who the loan is/would be for. Always set; equals the caller's own
   *  name on a plain self-request. */
  borrowerName?: string;
  borrowerEmail?: string;
  /** Set only when this was a referral (requester !== borrower) — set on
   *  both getMySnapBackLoanRequests ("you asked on X's behalf") and
   *  getSnapBackLoanRequestsForMe ("X is asking on Y's behalf"). */
  requestedByName?: string;
  requestedByEmail?: string;
  /** true when requestedByUserId !== borrowerUserId — lets the frontend
   *  branch its copy without re-deriving identity comparisons itself. */
  isReferral: boolean;
}

/** Requests THIS user submitted — status tracking + what Cancel operates
 *  on. Keyed on requestedByUserId, not borrowerUserId, so a referral
 *  request still shows up here for the person who actually asked. Also
 *  matches pre-existing rows from before this field existed (where every
 *  request was necessarily self-only) — those never got `requestedByUserId`
 *  backfilled, so a plain `{requestedByUserId: userId}` filter alone would
 *  silently drop a member's own request history. */
export async function getMySnapBackLoanRequests(userId: string, limit = 100): Promise<SnapBackLoanRequestView[]> {
  const rows = await Bat246SnapBackLoanRequest.find({
    $or: [
      { requestedByUserId: userId },
      { requestedByUserId: { $exists: false }, borrowerUserId: userId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const others = await namesFor([
    ...(rows as any[]).map((r) => r.eligibleUserId.toString()),
    ...(rows as any[]).map((r) => r.borrowerUserId.toString()),
  ]);
  return (rows as any[]).map((r) => {
    const eligible = others.get(r.eligibleUserId.toString());
    const borrower = others.get(r.borrowerUserId.toString());
    return {
      id: r._id.toString(),
      amount: r.amount,
      productLabel: r.productLabel,
      note: r.note || "",
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt ?? null,
      loanId: r.loanId ? r.loanId.toString() : null,
      eligibleName: eligible?.name || "Someone",
      eligibleEmail: eligible?.email || "",
      borrowerName: borrower?.name || "Someone",
      borrowerEmail: borrower?.email || "",
      isReferral: requestedByIdOf(r) !== r.borrowerUserId.toString(),
    };
  });
}

/** Requests waiting on (or previously answered by) THIS user as the
 *  eligible person — what Approve/Deny operate on. */
export async function getSnapBackLoanRequestsForMe(userId: string, limit = 100): Promise<SnapBackLoanRequestView[]> {
  const rows = await Bat246SnapBackLoanRequest.find({ eligibleUserId: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const others = await namesFor([
    ...(rows as any[]).map((r) => r.borrowerUserId.toString()),
    ...(rows as any[]).map((r) => requestedByIdOf(r)),
  ]);
  return (rows as any[]).map((r) => {
    const borrower = others.get(r.borrowerUserId.toString());
    const isReferral = requestedByIdOf(r) !== r.borrowerUserId.toString();
    const requestedBy = isReferral ? others.get(requestedByIdOf(r)) : null;
    return {
      id: r._id.toString(),
      amount: r.amount,
      productLabel: r.productLabel,
      note: r.note || "",
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt ?? null,
      loanId: r.loanId ? r.loanId.toString() : null,
      borrowerName: borrower?.name || "Someone",
      borrowerEmail: borrower?.email || "",
      requestedByName: isReferral ? requestedBy?.name || "Someone" : undefined,
      requestedByEmail: isReferral ? requestedBy?.email || "" : undefined,
      isReferral,
    };
  });
}

export interface AdminSnapBackLoanRow {
  id: string;
  borrowerName: string;
  borrowerEmail: string;
  giverName: string;
  giverEmail: string;
  productLabel: "board" | "pod";
  principal: number;
  outstandingBalance: number;
  repaid: number;
  status: "active" | "repaid";
  createdAt: Date;
  repaidAt: Date | null;
  /** The borrower's OWN current giving-power — underwriting context for
   *  whoever's deciding whether to extend a(nother) loan. Alan-borrower
   *  edge case is theoretical (Alan never needs a loan) but reported as
   *  Number.MAX_SAFE_INTEGER for consistency with every other place this
   *  codebase represents "unlimited". */
  borrowerCurrentGivingPower: number;
}

/** Shared row-shaping — same columns for the admin's org-wide grid and a
 *  regular member's own-activity grid (see getMySnapBackLoanActivity),
 *  so the two views never drift into different-looking data for the
 *  same underlying loan. */
async function shapeLoanRows(loans: any[]): Promise<AdminSnapBackLoanRow[]> {
  const userIds = Array.from(
    new Set([
      ...loans.map((l) => l.borrowerUserId.toString()),
      ...loans.map((l) => l.giverUserId.toString()),
    ])
  );
  const names = await namesFor(userIds);

  const rows: AdminSnapBackLoanRow[] = [];
  for (const l of loans) {
    const borrower = names.get(l.borrowerUserId.toString());
    const giver = names.get(l.giverUserId.toString());
    const eligibility = await computeLayawayEligibility(l.borrowerUserId.toString());
    rows.push({
      id: l._id.toString(),
      borrowerName: borrower?.name || "Someone",
      borrowerEmail: borrower?.email || "",
      giverName: giver?.name || "Someone",
      giverEmail: giver?.email || "",
      productLabel: l.productLabel,
      principal: l.principal,
      outstandingBalance: l.outstandingBalance,
      repaid: Math.round((l.principal - l.outstandingBalance) * 100) / 100,
      status: l.status,
      createdAt: l.createdAt,
      repaidAt: l.repaidAt ?? null,
      borrowerCurrentGivingPower: eligibility.isAlanK ? Number.MAX_SAFE_INTEGER : eligibility.totalRemaining,
    });
  }
  return rows;
}

export async function adminListSnapBackLoans(limit = 200): Promise<AdminSnapBackLoanRow[]> {
  const loans = await Bat246SnapBackLoan.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  return shapeLoanRows(loans as any[]);
}

/**
 * Every loan THIS user is personally involved in — as the borrower, or as
 * the giver who funded someone else's loan — same row shape as the admin
 * grid, but safe for any authenticated user to call (never exposes a
 * loan they have no part in). Powers the "grid like admin have" section
 * on the member-facing Snap Back Loans tab.
 */
export async function getMySnapBackLoanActivity(userId: string, limit = 200): Promise<AdminSnapBackLoanRow[]> {
  const loans = await Bat246SnapBackLoan.find({
    $or: [{ borrowerUserId: userId }, { giverUserId: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return shapeLoanRows(loans as any[]);
}

// Conference-room billing helpers.
//
// When a founder adds or cancels a conference room from the dashboard
// (after their initial office checkout), two things have to happen in
// concert:
//   1. The recurring parent `Invoice` (itemType: "office_addon") has its
//      quantity adjusted so the NEXT monthly cycle bills the correct
//      number of rooms.
//   2. For ADDS, a one-off prorated invoice is generated immediately for
//      the remainder of the current cycle.
//   3. For CANCELS, the room stays usable through the end of the cycle
//      it was already paid for (no refund), and is deactivated lazily
//      on the next listing call via `pruneExpiredRoomsForOrg`.
//
// All math is in USD cents. We deliberately keep the parent invoice +
// child cycles managed by the existing `generateDueRecurringInvoices`
// cron (services/invoice.ts) — we never need to schedule anything
// ourselves; bumping the parent's `lineItems[0].quantity` is enough.

import { Types } from "mongoose";
import { Invoice, IInvoice } from "../models/invoice.model";
import { ConferenceRoom } from "../models/conferenceRoom.model";
import { User } from "../models/user.model";
import { createInvoice, getNextChargeDate } from "./invoice";
import { calculateTaxAmounts, GST_CONFIG } from "../models/officePlan.model";
import { getOfficePlanBySlug } from "./officeSubscription";

// $5/month per extra room. Mirrors `CONFERENCE_ROOM_PRICE_CENTS` in
// routes/officeCheckout.ts. Worth extracting to a single config module
// once we have a second consumer beyond these two files.
export const CONFERENCE_ROOM_PRICE_CENTS = 500;

// Standard cycle length used for proration math. The actual cycle is
// driven by `nextDueDate` on the parent invoice; we use 30 days as the
// divisor for simplicity (matches how the existing recurring cron
// schedules — `getNextChargeDate(now, "monthly")` lands ~30 days out).
const DAYS_IN_CYCLE = 30;

/**
 * Find the active parent recurring rooms invoice for an org, if any.
 * Returns `null` when the org has only the free included room (no
 * extras have ever been billed) — caller should lazy-create the parent.
 */
export async function findRoomsParentInvoice(
  orgId: string
): Promise<IInvoice | null> {
  return Invoice.findOne({
    organizationId: new Types.ObjectId(orgId),
    "lineItems.itemType": "office_addon",
    isRecurring: true,
    parentInvoiceId: { $exists: false },
    status: { $in: ["draft", "pending", "paid"] },
    cancelledAt: { $exists: false },
  });
}

/**
 * Days remaining in the current billing cycle for the given parent
 * invoice. Clamped to [1, DAYS_IN_CYCLE] so we never charge $0 (one
 * day's worth of room) or more than a full cycle.
 */
function daysRemainingInCycle(parent: IInvoice): number {
  const now = Date.now();
  const dueAt = parent.nextDueDate
    ? new Date(parent.nextDueDate).getTime()
    : now + DAYS_IN_CYCLE * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((dueAt - now) / (24 * 60 * 60 * 1000));
  return Math.min(DAYS_IN_CYCLE, Math.max(1, remaining));
}

/**
 * Create the very first recurring parent rooms invoice for an org
 * (lazy-creation path — when the founder went 1→2 rooms from the
 * dashboard AFTER signup, not at checkout). Quantity starts at 0 and
 * is bumped by the caller right after. Uses Pro plan's tax shape so
 * room billing's GST handling matches the office's.
 */
async function createInitialRoomsParentInvoice(
  orgId: string,
  founderUserId: string,
  initialQuantity: number,
): Promise<IInvoice> {
  const userDoc = await User.findById(founderUserId).select("name email").lean();
  // Conference rooms are priced at a fixed $5/month USD globally.
  // Deliberately NOT pulling currency from the Pro plan doc — Indian
  // orgs have `proPlan.currency: "INR"`, and stamping the invoice as
  // INR with a USD-cents `unitPrice` (500) silently turns "$5" into
  // "₹5" (~$0.06). The USD→local conversion happens at the Razorpay
  // checkout layer, not at invoice-mint time.
  const currency = "USD";
  // Schema enforces quantity >= 1. Caller passes the target `initialQuantity`
  // (the number of rooms being added in the same call), so we create the
  // parent already at its final quantity and skip the qty=0 intermediate
  // that the old code path used — that intermediate save() started failing
  // once schema validation caught up (min: 1).
  const startingQty = Math.max(1, initialQuantity);

  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId: founderUserId,
    userId: founderUserId,
    customerEmail: userDoc?.email || "",
    customerName: userDoc?.name || undefined,
    lineItems: [
      {
        itemType: "office_addon",
        itemId: orgId,
        itemName: "Conference Room",
        itemDescription: `Extra conference rooms ($${
          CONFERENCE_ROOM_PRICE_CENTS / 100
        }/room/month)`,
        quantity: startingQty,
        unitPrice: CONFERENCE_ROOM_PRICE_CENTS,
        originalCurrency: currency,
      },
    ],
    itemCurrency: currency,
    isRecurring: true,
    recurringPeriod: "monthly",
    metadata: {
      type: "office_addon_subscription",
      kind: "conference_room",
      orgId,
      lazyCreated: true,
    },
  });

  invoice.nextDueDate = getNextChargeDate(new Date(), "monthly");
  invoice.recurringPaymentNumber = 1;
  // Mark as paid at $0-owed anchor. The parent invoice itself never gets
  // paid — the founder's real partial-cycle payment lives on the separate
  // prorated invoice minted by `generateProratedAddInvoice` right after
  // this. Marking the parent as paid keeps the recurring cron happy
  // (`generateNextChildInvoice` early-returns on unpaid parents), so
  // cycle 2 mints normally at `nextDueDate` with the current quantity.
  invoice.status = "paid";
  invoice.paidAt = new Date();
  (invoice.metadata as any).syntheticAnchor = true;
  await invoice.save();
  return invoice;
}

/**
 * Bump (or decrement) the parent rooms invoice's line-item quantity by
 * `delta`. Recomputes subtotal, tax, and total in place. The cron will
 * pick up the new quantity automatically for FUTURE cycles.
 *
 * Crucially, this ALSO syncs the quantity into any pending/draft child
 * invoice that the cron may have already generated within the 5-day
 * lookahead window. Without that sync, a founder who cancels a room
 * within 5 days of the renewal date would still get billed at the old
 * quantity on the next cycle (the child already exists at the old
 * snapshot of lineItems).
 *
 * Returns the resulting quantity. If it hits 0 the caller should cancel
 * the parent invoice (we don't auto-cancel here — that's a billing
 * decision the route makes).
 */
export async function bumpRoomsParentQuantity(
  parent: IInvoice,
  delta: number
): Promise<number> {
  const lineItem = parent.lineItems[0];
  const unitPrice = lineItem.unitPrice;
  const newQuantity = Math.max(0, lineItem.quantity + delta);
  lineItem.quantity = newQuantity;
  lineItem.totalPrice = unitPrice * newQuantity;
  parent.subtotal = parent.lineItems.reduce(
    (sum, li) => sum + li.totalPrice,
    0
  );
  // Recompute GST on the new subtotal. Existing parent tax could have been
  // computed for the OLD quantity, so we recalculate from scratch using the
  // same taxRate the original invoice was created with.
  //
  // CRITICAL: preserve whether GST applied at all. GST is gated on the org's
  // country, so an org outside India has tax = 0 and a `gstSkipped` marker.
  // Recomputing unconditionally would silently re-add 18% to their invoice on
  // the next room change. We re-derive applicability from the invoice's own
  // record rather than re-resolving the region, so a parent never changes tax
  // treatment mid-cycle.
  const taxRate = GST_CONFIG.rate;
  const parentHasGst =
    !!(parent.metadata as any)?.gst || (parent.tax || 0) > 0;
  const { taxAmount: newTax } = parentHasGst
    ? calculateTaxAmounts(parent.subtotal, taxRate)
    : { taxAmount: 0 };
  parent.tax = newTax;
  parent.totalAmount =
    parent.subtotal + (parent.tax || 0) - (parent.discount || 0);
  await parent.save();

  // Sync any UNPAID child invoice the cron may have already generated.
  // We only touch pending/draft children — paid children represent
  // completed cycles and must stay immutable for audit. Each unpaid
  // child gets its lineItem[0] (the single Conference Room row) updated
  // and totals recomputed so the founder pays for the right count.
  const pendingChildren = await Invoice.find({
    parentInvoiceId: parent._id,
    status: { $in: ["draft", "pending"] },
  });
  for (const child of pendingChildren) {
    const childLine = child.lineItems[0];
    if (!childLine) continue;
    childLine.quantity = newQuantity;
    childLine.totalPrice = childLine.unitPrice * newQuantity;
    child.subtotal = child.lineItems.reduce(
      (sum, li) => sum + li.totalPrice,
      0
    );
    // Children inherit the parent's treatment — same reasoning as above.
    const { taxAmount: childNewTax } = parentHasGst
      ? calculateTaxAmounts(child.subtotal, taxRate)
      : { taxAmount: 0 };
    child.tax = childNewTax;
    child.totalAmount =
      child.subtotal + (child.tax || 0) - (child.discount || 0);
    await child.save();
  }

  return newQuantity;
}

/**
 * Generate a one-off prorated invoice for `roomsAdded` extra rooms
 * covering the remainder of the parent's current cycle. Founder pays
 * via the existing `/invoice/<id>` flow.
 */
export async function generateProratedAddInvoice(
  parent: IInvoice,
  founderUserId: string,
  roomsAdded: number
): Promise<IInvoice> {
  const userDoc = await User.findById(founderUserId).select("name email").lean();
  const orgId = parent.organizationId.toString();
  const daysRemaining = daysRemainingInCycle(parent);
  // Per-room cents for the prorated window. Round at the per-room level
  // so multi-room adds don't accumulate sub-cent drift.
  const proratedPerRoomCents = Math.round(
    (CONFERENCE_ROOM_PRICE_CENTS * daysRemaining) / DAYS_IN_CYCLE
  );

  const taxRate = GST_CONFIG.rate;
  const subtotal = proratedPerRoomCents * roomsAdded;
  // Inherit the parent invoice's GST treatment rather than re-resolving the
  // org's region, so a prorated top-up always matches the cycle it extends.
  const parentHasGst = !!(parent.metadata as any)?.gst || (parent.tax || 0) > 0;
  const { taxAmount } = parentHasGst
    ? calculateTaxAmounts(subtotal, taxRate)
    : { taxAmount: 0 };

  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId: founderUserId,
    userId: founderUserId,
    customerEmail: userDoc?.email || "",
    customerName: userDoc?.name || undefined,
    lineItems: [
      {
        itemType: "office_addon",
        itemId: orgId,
        itemName: "Conference Room",
        itemDescription: `${roomsAdded} extra room${
          roomsAdded > 1 ? "s" : ""
        } · prorated for ${daysRemaining} day${
          daysRemaining > 1 ? "s" : ""
        } remaining in current cycle`,
        quantity: roomsAdded,
        unitPrice: proratedPerRoomCents,
        originalCurrency: "USD",
      },
    ],
    itemCurrency: "USD",
    // One-off charge — NOT recurring. The parent invoice's recurring
    // cycle continues independently with the bumped quantity.
    isRecurring: false,
    tax: taxAmount,
    metadata: {
      type: "office_addon_proration",
      kind: "conference_room",
      orgId,
      parentInvoiceId: parent._id.toString(),
      daysRemaining,
      roomsAdded,
    },
  });
  return invoice;
}

/**
 * Auto-heal a rooms parent invoice that pre-dates the paid-anchor fix.
 *
 * Legacy state we care about:
 *   - `status: "draft"` (the pre-fix `createInitialRoomsParentInvoice`
 *     never marked lazy parents paid → cron skipped every cycle).
 *   - `nextDueDate` missing (an even older code path forgot to set it).
 *   - `quantity` drift (a room was removed via a path that bypassed
 *     `applyCancelRoomBilling`, so parent quantity is higher than the
 *     actual billable room count).
 *
 * The heal lands the parent in its correct AFTER-add state in a single
 * `updateOne`. Reason we can't use `parent.save()`: the Invoice schema
 * has `lineItems.quantity: { min: 1 }`, and Chamak-style parents may
 * need to pass through `quantity: 0` as an intermediate reset — which
 * `.save()` refuses. `updateOne` skips document validators by default,
 * so we can land the correct final numbers directly.
 *
 * Because heal now applies the +roomsAdded delta INLINE (final quantity
 * = totalActive − 1, i.e. total minus the free default), the caller
 * MUST NOT double-bump. `applyAddRoomsBilling` skips
 * `bumpRoomsParentQuantity` when heal returns `true`.
 *
 * Returns `true` when heal ran (delta already applied), `false` when
 * the parent was already healthy (caller runs bump normally).
 */
async function autoHealParentIfNeeded(
  parent: IInvoice,
  orgId: string,
  _roomsAdded: number,
): Promise<boolean> {
  const needsPaidFlip = parent.status !== "paid";
  const needsDueDate = !parent.nextDueDate;
  if (!needsPaidFlip && !needsDueDate) return false;

  const totalActive = await ConferenceRoom.countDocuments({
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  });
  // Final billable extras AFTER this add call. Subtract 1 for the free
  // included room. `totalActive` already reflects the just-created new
  // room(s) because the route handler creates them BEFORE calling us.
  const finalQuantity = Math.max(0, totalActive - 1);

  const unitPrice =
    parent.lineItems[0]?.unitPrice ?? CONFERENCE_ROOM_PRICE_CENTS;
  const newSubtotal = unitPrice * finalQuantity;
  // Preserve original GST treatment (same reasoning as
  // bumpRoomsParentQuantity — don't retroactively add tax to a foreign
  // org whose invoice was created without it).
  const parentHasGst =
    !!(parent.metadata as any)?.gst || (parent.tax || 0) > 0;
  const { taxAmount: newTax } = parentHasGst
    ? calculateTaxAmounts(newSubtotal, GST_CONFIG.rate)
    : { taxAmount: 0 };

  const setFields: Record<string, any> = {
    "lineItems.0.quantity": finalQuantity,
    "lineItems.0.totalPrice": newSubtotal,
    subtotal: newSubtotal,
    tax: newTax,
    totalAmount: newSubtotal + newTax - (parent.discount || 0),
    "metadata.syntheticAnchor": true,
    "metadata.autoHealedAt": new Date(),
  };
  // Currency heal: legacy parents were minted with `itemCurrency: "INR"`
  // for Indian orgs because the code pulled currency from the Pro plan
  // doc, but `unitPrice` was always a USD-cents constant → the parent
  // silently displayed as ₹5 instead of $5. Flip any non-USD parent to
  // USD here so the founder gets billed the correct amount on the next
  // cron cycle.
  if (parent.itemCurrency !== "USD") {
    setFields.itemCurrency = "USD";
    setFields["lineItems.0.originalCurrency"] = "USD";
    setFields["metadata.currencyHealedAt"] = new Date();
  }
  if (needsDueDate) {
    setFields.nextDueDate = getNextChargeDate(new Date(), "monthly");
  }
  if (needsPaidFlip) {
    setFields.status = "paid";
    setFields.paidAt = new Date();
  }
  // updateOne skips document validators (min: 1 on quantity) which is
  // exactly what we need to land a legitimate `finalQuantity` value that
  // may have started this heal at 0 mid-flight.
  await Invoice.updateOne({ _id: parent._id }, { $set: setFields });

  // Sync any UNPAID children that the cron may have already generated in
  // its 5-day lookahead. Same rule as bumpRoomsParentQuantity: only
  // touch pending/draft children, never paid ones.
  const pendingChildren = await Invoice.find({
    parentInvoiceId: parent._id,
    status: { $in: ["draft", "pending"] },
  });
  for (const child of pendingChildren) {
    const childLine = child.lineItems[0];
    if (!childLine) continue;
    const childSubtotal = childLine.unitPrice * finalQuantity;
    const { taxAmount: childTax } = parentHasGst
      ? calculateTaxAmounts(childSubtotal, GST_CONFIG.rate)
      : { taxAmount: 0 };
    await Invoice.updateOne(
      { _id: child._id },
      {
        $set: {
          "lineItems.0.quantity": finalQuantity,
          "lineItems.0.totalPrice": childSubtotal,
          subtotal: childSubtotal,
          tax: childTax,
          totalAmount: childSubtotal + childTax - (child.discount || 0),
        },
      },
    );
  }

  // Mirror the mutations onto the in-memory parent so callers reading
  // `parent.nextDueDate` (e.g. generateProratedAddInvoice) see the
  // healed values without a refetch.
  if (parent.lineItems[0]) {
    parent.lineItems[0].quantity = finalQuantity;
    parent.lineItems[0].totalPrice = newSubtotal;
    if (setFields["lineItems.0.originalCurrency"]) {
      (parent.lineItems[0] as any).originalCurrency = "USD";
    }
  }
  if (setFields.itemCurrency) {
    (parent as any).itemCurrency = "USD";
  }
  parent.subtotal = newSubtotal;
  parent.tax = newTax;
  parent.totalAmount = newSubtotal + newTax - (parent.discount || 0);
  if (needsDueDate) {
    parent.nextDueDate = setFields.nextDueDate;
  }
  if (needsPaidFlip) {
    parent.status = "paid" as any;
    parent.paidAt = setFields.paidAt;
  }

  console.log(
    `[rooms] auto-healed parent ${parent.invoiceNumber} for org ${orgId}: qty→${finalQuantity}, status→paid, nextDueDate→${parent.nextDueDate?.toISOString?.() || parent.nextDueDate}`,
  );
  return true;
}

/**
 * Find-or-create the parent rooms invoice, increment its quantity by N,
 * and generate the prorated one-off invoice for the partial cycle.
 * Returns the prorated invoice (founder is redirected there to pay).
 */
export async function applyAddRoomsBilling(
  orgId: string,
  founderUserId: string,
  roomsAdded: number
): Promise<{ parent: IInvoice; proratedInvoice: IInvoice }> {
  let parent = await findRoomsParentInvoice(orgId);
  let justCreated = false;
  if (!parent) {
    // Create at final quantity (roomsAdded) — schema requires qty >= 1.
    // Skips both the qty=0 intermediate AND the subsequent bump.
    parent = await createInitialRoomsParentInvoice(
      orgId,
      founderUserId,
      roomsAdded,
    );
    justCreated = true;
  }
  if (!justCreated) {
    // Existing parent: self-heal legacy stuck-draft / no-nextDueDate rows.
    // When heal fires it already lands the parent at its correct AFTER-
    // add state (final quantity = totalActive − 1), so the caller must
    // NOT bump again — that would over-count. Heal returns true when it
    // applied the delta inline; only bump when it didn't.
    const healApplied = await autoHealParentIfNeeded(
      parent,
      orgId,
      roomsAdded,
    );
    if (!healApplied) {
      await bumpRoomsParentQuantity(parent, roomsAdded);
    }
  }
  const proratedInvoice = await generateProratedAddInvoice(
    parent,
    founderUserId,
    roomsAdded
  );
  return { parent, proratedInvoice };
}

/**
 * Cancel a single room. The room stays active until the end of the
 * paid cycle (set on `scheduledDeactivationAt`); parent quantity is
 * decremented immediately so next cycle bills the right count. No
 * refund — founder paid for the cycle, room stays until it's over.
 *
 * When the decrement takes the parent to 0 rooms, we fully cancel the
 * recurring subscription using the canonical `cancelSubscription`
 * helper in services/invoice.ts. That helper does the right thing on
 * three fronts at once: (a) sets `cancelledAt` on the parent so the
 * cron stops generating future cycles, (b) sweeps any pending/draft
 * child invoices to `status: "cancelled"` so the founder isn't asked
 * to pay for the now-empty next cycle, (c) cancels any platform
 * coupon redemption attached to the parent.
 *
 * Returns the cycle-end date so the FE can show "active until X".
 */
export async function applyCancelRoomBilling(
  orgId: string,
  roomId: string
): Promise<{ activeUntil: Date | null; parentCancelled: boolean }> {
  const parent = await findRoomsParentInvoice(orgId);
  if (!parent) {
    // No parent invoice means this room was never billed (likely the
    // included free room being deleted directly). Just soft-delete.
    await ConferenceRoom.updateOne(
      { _id: new Types.ObjectId(roomId) },
      { isActive: false }
    );
    return { activeUntil: null, parentCancelled: false };
  }
  const cycleEnd = parent.nextDueDate ? new Date(parent.nextDueDate) : null;
  // Keep the room visible until cycle end. Lazy prune in
  // `GET /conference-rooms` will flip isActive to false on/after cycleEnd.
  await ConferenceRoom.updateOne(
    { _id: new Types.ObjectId(roomId) },
    cycleEnd
      ? { scheduledDeactivationAt: cycleEnd }
      : { isActive: false }
  );
  // Decrement parent quantity (and sync any pending child invoice in
  // the 5-day cron lookahead — see bumpRoomsParentQuantity for why).
  const newQuantity = await bumpRoomsParentQuantity(parent, -1);
  let parentCancelled = false;
  if (newQuantity === 0) {
    // No more paid rooms — fully cancel the parent subscription using
    // the canonical helper so pending-child cleanup + coupon redemption
    // cleanup happen consistently with every other subscription cancel
    // in the codebase. Note: cancelSubscription requires status: "paid";
    // for an unpaid parent (founder cancelled before paying the very
    // first cycle), fall through to direct field updates.
    if (parent.status === "paid") {
      const { cancelSubscription } = await import("./invoice");
      await cancelSubscription(parent._id.toString(), parent.userId.toString());
    } else {
      parent.status = "cancelled";
      parent.cancelledAt = new Date();
      await parent.save();
      // Also sweep pending children manually for the unpaid-parent path
      // so we match the canonical helper's contract.
      await Invoice.updateMany(
        { parentInvoiceId: parent._id, status: { $in: ["draft", "pending"] } },
        { $set: { status: "cancelled", cancelledAt: new Date() } }
      );
    }
    parentCancelled = true;
  }
  return { activeUntil: cycleEnd, parentCancelled };
}

/**
 * Lazy prune. Flips `isActive` to false on any room whose
 * `scheduledDeactivationAt` has passed. Safe to call on every list
 * request (idempotent + no-op when there's nothing to prune).
 */
export async function pruneExpiredRoomsForOrg(orgId: string): Promise<number> {
  const now = new Date();
  const res = await ConferenceRoom.updateMany(
    {
      orgId: new Types.ObjectId(orgId),
      isActive: true,
      scheduledDeactivationAt: { $lte: now },
    },
    { isActive: false }
  );
  return res.modifiedCount || 0;
}

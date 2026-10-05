import { Types } from "mongoose";
import { resolveBuyerGstRegion } from "../utils/gstBuyerRegion";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { Workshop } from "../models/workshop.model";

/**
 * Auto-enrol India-based users into "Your Freedom Webinar".
 *
 * WHO COUNTS AS INDIAN
 *   Exactly the determination that decides whether to charge GST —
 *   `resolveBuyerGstRegion`. Reusing it means the webinar cohort and the
 *   tax cohort can never disagree, and we inherit its handling of "India" /
 *   "IN" / casing / trailing whitespace, its PIN-code and state fallbacks,
 *   and its correct REJECTION of "British Indian Ocean Territory".
 *
 *   `paymentCurrency` is deliberately not passed: its "INR ⇒ India" fallback
 *   makes sense at a checkout where the buyer picked a currency, but here
 *   there is no payment and it would amount to a guess.
 *
 * WHY IT IS CALLED FROM PROFILE WRITES, NOT SIGNUP
 *   Country is almost never known at account creation — there are several
 *   signup paths (OTP, invite, downline enrolment, shell accounts minted at
 *   checkout) and most set country later, during profile completion. A hook
 *   on user-create would miss nearly everyone; a hook on profile write
 *   catches them at the moment we first learn where they are.
 *
 * NO EMAIL, NO INVOICE
 *   The interactive `registerForWorkshop()` path also mints a $0
 *   "workshop_checkout" invoice with `notifyBuyer: true`. That is right for
 *   someone who clicked Register; it is wrong for an automatic enrolment the
 *   user did not ask for. Access is granted by the registration row alone.
 *
 * Fire-and-forget: never throws, never blocks the profile save.
 */

/** "Your Freedom Webinar" — free, daily-recurring, Asia/Kolkata. */
export const INDIA_AUTO_ENROL_WORKSHOP_ID = "6a8c430abf0ad3c0ff3ef431";

export async function autoEnrolIndiaWebinar(
  userOrId: any,
): Promise<"enrolled" | "already" | "not_india" | "skipped"> {
  try {
    const workshopId = new Types.ObjectId(INDIA_AUTO_ENROL_WORKSHOP_ID);

    const region = await resolveBuyerGstRegion(
      typeof userOrId === "string" || userOrId instanceof Types.ObjectId
        ? { buyerUserId: String(userOrId) }
        : { buyerUser: userOrId },
    );
    if (!region.inIndia) return "not_india";

    const userId = new Types.ObjectId(
      typeof userOrId === "string" || userOrId instanceof Types.ObjectId
        ? String(userOrId)
        : String(userOrId._id),
    );

    // WorkshopRegistration has NO unique index — the model notes uniqueness
    // is "enforced via application logic" — so this check is the only thing
    // preventing duplicate rows on a repeat profile save.
    const existing = await WorkshopRegistration.findOne({ workshopId, userId })
      .select("_id")
      .lean();
    if (existing) return "already";

    const workshop: any = await Workshop.findById(workshopId)
      .select("organizationId orgId isFree")
      .lean();
    if (!workshop) return "skipped";

    const now = new Date();
    await WorkshopRegistration.create({
      workshopId,
      userId,
      orgId: new Types.ObjectId(String(workshop.organizationId || workshop.orgId)),
      status: "registered",
      hasPaid: true, // free webinar
      registeredAt: now,
      enrolledAt: now,
      enrollmentType: "full",
    });

    console.log(
      `[india-webinar] auto-enrolled ${userId} (${region.source}=${region.country})`,
    );
    return "enrolled";
  } catch (err: any) {
    // Must never cost the user their profile save.
    console.error("[india-webinar] auto-enrol failed:", err?.message);
    return "skipped";
  }
}

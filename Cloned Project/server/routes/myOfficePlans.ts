// GET /me/offices/plans — every org the caller is a founder of, with
// its current OfficeSubscription plan + Cryptosub state + cryptobrand
// flag. Powers the "my crypto offices" grid so the FE can render a card
// per office with the right upgrade CTA.
//
// Read-only, per-user. Non-founder memberships are excluded — this is
// specifically the "which of my offices need Pro / Cryptosub"
// dashboard question.

import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { getOfficePlanStatusForOrg } from "../services/officePlanStatus";
import { hasActiveAddon } from "../services/officeAddonSubscription";

const router = Router();

router.get(
  "/offices/plans",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };

      // Pull the user's founder memberships in one query. The org ids
      // are then hydrated in bulk so we don't fan out one Organization
      // query per org.
      const user: any = await User.findById(me.userId)
        .select("organizations")
        .lean();
      const founderOrgIds: Types.ObjectId[] = (user?.organizations || [])
        .filter((m: any) => m?.role === "founder")
        .map((m: any) => new Types.ObjectId(String(m.organization)))
        .filter((oid: any) => Types.ObjectId.isValid(oid));

      if (founderOrgIds.length === 0) {
        return res.json({ success: true, offices: [] });
      }

      const orgs: any[] = await Organization.find({
        _id: { $in: founderOrgIds },
      })
        .select("_id name icon officeCreatedFromCryptobrand whitelabelRequested")
        .lean();

      // Fetch each org's plan status. Small N (a founder rarely holds
      // more than a handful of offices), so serial-per-org is fine and
      // keeps memory pressure predictable.
      const offices = await Promise.all(
        orgs.map(async (org) => {
          const [status, whitelabelActive] = await Promise.all([
            getOfficePlanStatusForOrg(
              String(org._id),
              !!org.officeCreatedFromCryptobrand,
            ),
            hasActiveAddon(String(org._id), "white-label"),
          ]);
          return {
            orgId: String(org._id),
            orgName: org.name,
            orgIcon: org.icon || null,
            isCryptobrand: !!org.officeCreatedFromCryptobrand,
            planSlug: status.planSlug,
            planName: status.planName,
            subscriptionStatus: status.subscriptionStatus,
            isTrial: status.isTrial,
            cryptosubActive: status.cryptosubActive,
            needsUpgradeToPro: status.needsUpgradeToPro,
            // Whitelabel bundle state — set at office creation, granted
            // when the cryptosub invoice is paid.
            whitelabelRequested: !!org.whitelabelRequested,
            whitelabelActive,
          };
        }),
      );

      // Sort: cryptobrand orgs first, then anything that needs upgrade
      // (so the FE can render them at the top without extra work), then
      // the rest alphabetically.
      offices.sort((a, b) => {
        if (a.isCryptobrand !== b.isCryptobrand)
          return a.isCryptobrand ? -1 : 1;
        if (a.needsUpgradeToPro !== b.needsUpgradeToPro)
          return a.needsUpgradeToPro ? -1 : 1;
        return (a.orgName || "").localeCompare(b.orgName || "");
      });

      return res.json({ success: true, offices });
    } catch (err: any) {
      console.error("[me/offices/plans]", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

export default router;

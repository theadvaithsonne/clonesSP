// Cryptobrand checkout status route — GET /org/:orgId/cryptobrand-checkout.
//
// Server-authoritative "does this cryptobrand org still owe its Pro or
// Cryptosub bootstrap?" query. Replaces the seller FE's session-storage
// tracking (which is empty on login and dropped when picking an
// existing org). Returns the pending invoice(s) if any are unpaid, so
// the FE can redirect the founder straight into the invoice pay page.

import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { getCryptobrandCheckoutStatus } from "../services/cryptobrandCheckoutStatus";
import { getOfficePlanStatusForOrg } from "../services/officePlanStatus";
import {
  mintProOfficeInvoice,
  mintCryptosubInvoice,
} from "../services/cryptobrandOfficeBootstrap";
import { hasActiveAddon } from "../services/officeAddonSubscription";
import { CRYPTOSUB_ADDON } from "../config/cryptosubAddon";

const router = Router();

/** Founders are identified via User.organizations[{organization,
 *  role:"founder"}]. Same pattern used by whitelabel/cryptosub. */
async function isOrgFounder(userId: string, orgId: string): Promise<boolean> {
  const hit = await User.exists({
    _id: new Types.ObjectId(userId),
    organizations: {
      $elemMatch: {
        organization: new Types.ObjectId(orgId),
        role: "founder",
      },
    },
  });
  return !!hit;
}

router.get(
  "/:orgId/cryptobrand-checkout",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { orgId } = req.params;

      if (!Types.ObjectId.isValid(orgId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid orgId" });
      }
      const org: any = await Organization.findById(orgId)
        .select("_id officeCreatedFromCryptobrand")
        .lean();
      if (!org) {
        return res
          .status(404)
          .json({ success: false, error: "Organization not found" });
      }
      if (!org.officeCreatedFromCryptobrand) {
        return res.status(403).json({
          success: false,
          error: "This organization is not a cryptobrand office",
        });
      }
      if (!(await isOrgFounder(me.userId, orgId))) {
        return res
          .status(403)
          .json({ success: false, error: "Founder access required" });
      }

      const cryptobrandCheckout = await getCryptobrandCheckoutStatus(
        orgId,
        me.userId,
      );
      return res.json({ success: true, cryptobrandCheckout });
    } catch (err: any) {
      console.error("[cryptobrand-checkout]", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

// ─── POST /org/:orgId/cryptobrand-upgrade ──────────────────────────
//
// "If my office is on Starter (or has no subscription at all), mint
// the Pro + Cryptosub bootstrap invoices — same shape create-first-time
// hands to a brand-new cryptobrand org — so the founder can complete
// the upgrade via the standard invoice pay page."
//
// Different from GET /:orgId/cryptobrand-checkout, which gates on
// "was the bootstrap invoice paid". This one gates on the LIVE
// OfficeSubscription — so an org that had Pro, cancelled it, and now
// wants to come back also flows through cleanly.
//
// This endpoint is OPEN to non-cryptobrand orgs too — founder opts an
// existing standard office INTO the cryptobrand flow by hitting this
// upgrade path. On success the org's `officeCreatedFromCryptobrand`
// flag is flipped so downstream cryptobrand wallet provisioning +
// investment features light up.

router.post(
  "/:orgId/cryptobrand-upgrade",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const me = (req as any).user as { userId: string };
      const { orgId } = req.params;

      if (!Types.ObjectId.isValid(orgId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid orgId" });
      }
      const org: any = await Organization.findById(orgId)
        .select("_id name officeCreatedFromCryptobrand")
        .lean();
      if (!org) {
        return res
          .status(404)
          .json({ success: false, error: "Organization not found" });
      }
      if (!(await isOrgFounder(me.userId, orgId))) {
        return res
          .status(403)
          .json({ success: false, error: "Founder access required" });
      }

      const status = await getOfficePlanStatusForOrg(
        orgId,
        !!org.officeCreatedFromCryptobrand,
      );

      // Already on Pro (and possibly already has Cryptosub) → no bootstrap.
      // Still surface the current state so the caller can render "you're
      // all set" without a second round-trip.
      if (!status.needsUpgradeToPro && status.cryptosubActive) {
        return res.json({
          success: true,
          needsUpgrade: false,
          currentPlanSlug: status.planSlug,
          cryptosubActive: status.cryptosubActive,
          officeInvoice: null,
          cryptosubInvoice: null,
        });
      }

      // Flip the cryptobrand flag once — a founder upgrading their
      // standard office to Pro + Cryptosub is effectively opting into
      // the cryptobrand product. Downstream helpers
      // (ensureCryptobrandWallets, /wallet/all, etc.) key on this flag,
      // so flipping it here lights up the sibling INR/ETH/BTC wallets
      // the moment the founder starts the upgrade.
      if (!org.officeCreatedFromCryptobrand) {
        await Organization.updateOne(
          { _id: org._id },
          { $set: { officeCreatedFromCryptobrand: true } },
        );
      }

      // Mint only what's actually missing. mintProOfficeInvoice /
      // mintCryptosubInvoice both use createInvoice's pending-dedup, so
      // a repeat call returns the same pending invoice unchanged.
      const officeInvoice = status.needsUpgradeToPro
        ? await mintProOfficeInvoice({ orgId, founderUserId: me.userId })
        : null;

      // Guard cryptosub against a stale "hasActiveAddon" read racing
      // with a still-processing purchase — re-check inside the branch.
      const cryptosubStillNeeded = !(await hasActiveAddon(
        orgId,
        CRYPTOSUB_ADDON.slug,
      ));
      const cryptosubInvoice = cryptosubStillNeeded
        ? await mintCryptosubInvoice({ orgId, founderUserId: me.userId })
        : null;

      return res.json({
        success: true,
        needsUpgrade: true,
        currentPlanSlug: status.planSlug,
        cryptosubActive: !cryptosubStillNeeded,
        officeInvoice,
        cryptosubInvoice,
        cryptobrandFlagFlipped: !org.officeCreatedFromCryptobrand,
      });
    } catch (err: any) {
      console.error("[cryptobrand-upgrade]", err);
      return res
        .status(500)
        .json({ success: false, error: err?.message || "Server error" });
    }
  },
);

export default router;

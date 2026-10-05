import { Router, Request, Response, NextFunction } from "express";
import { GarageAdminModel } from "../models/garageAdmin.model";
import { User } from "../models/user.model";
import multer from "multer";
import {
  inviteGarageAdmin,
  requestGarageAdminOtp,
  loginGarageAdmin,
  getGarageAdminProfile,
  listGarageAdmins,
  toggleGarageAdminActive,
  getAllOrganizations,
  getOrganizationById,
  assignAdminToOrganization,
  listInvoicesForOrganization,
  listSellableItemsForOrganization,
  getAllFounders,
  getAllStakeholders,
  getAllUnilevelPlusLicenseHolders,
  listPlatformFeeOverrides,
  setPlatformFeeOverride,
  removePlatformFeeOverride,
  listAllUsers,
  listUserPurchases,
  listUserPurchasedProducts,
  extendUserOffer,
  getUserWalletsForAdmin,
  adminMoveUpline,
  listAllUserWallets,
  adminInitiateWithdrawal,
  adminQuoteWithdrawal,
  listWithdrawals,
  getWithdrawalStats,
  adminCompleteWithdrawal,
  adminRejectWithdrawal,
  getAdminPageCatalogue,
  listGarageAdminRoles,
  createGarageAdminRole,
  updateGarageAdminRole,
  deleteGarageAdminRole,
  updateGarageAdminAccess,
} from "../controllers/garageAdmin.controller";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
} from "../middleware/garageAdminAuth";
import { ensureGarageSuperAdmin } from "../services/ensureGarageAdmin";
import { s3Service } from "../services/s3";

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common image formats AND PDF — admins need PDF support for
    // bank-transfer receipts on the withdrawal completion flow.
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

const router = Router();

/**
 * Header search (?q=) for the Citizens/People list tabs.
 *
 * These list controllers (founders, stakeholders, organizations, admins) live
 * in garageAdmin.controller.ts and each returns the FULL result set via
 * ok(array) with no server-side pagination. Rather than reach into the shared
 * controller file, we wrap the handler here (the route layer this file owns)
 * and filter the `data` array in-place before it's flushed to the client — so
 * the universal admin header search narrows the active tab server-side.
 *
 * When no `q` is present the handler runs untouched. On error we log and let
 * the original (unfiltered) payload through so search never breaks a tab.
 */
function withListSearch(
  handler: (req: Request, res: Response, next: NextFunction) => any,
  matches: (row: any, re: RegExp) => boolean
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const q = String((req.query.q as string) || "").trim();
    if (!q) return handler(req, res, next);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const originalJson = res.json.bind(res);
    (res as any).json = (body: any) => {
      try {
        if (body && Array.isArray(body.data)) {
          body = { ...body, data: body.data.filter((row: any) => matches(row, re)) };
        }
      } catch (err) {
        console.error("[garage-admin] header-search filter error:", err);
      }
      return originalJson(body);
    };
    return handler(req, res, next);
  };
}

// People rows carry name/email/phone; admins carry name/email; orgs carry a
// name plus a resolved founders[] (name/email) — match across those fields.
const matchPerson = (r: any, re: RegExp) =>
  re.test(r?.name || "") || re.test(r?.email || "") || re.test(r?.phone || "");
const matchAdmin = (r: any, re: RegExp) =>
  re.test(r?.name || "") || re.test(r?.email || "");
const matchOrg = (r: any, re: RegExp) =>
  re.test(r?.name || "") ||
  (Array.isArray(r?.founders) &&
    r.founders.some(
      (f: any) => re.test(f?.name || "") || re.test(f?.email || "")
    ));

// Public routes
router.post("/request-otp", requestGarageAdminOtp);
router.post("/login", loginGarageAdmin);
router.post("/ensure-admin", async (req, res) => {
  try {
    const admin = await ensureGarageSuperAdmin();
    res.json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Protected routes
router.get("/profile", requireGarageAdminAuth, getGarageAdminProfile);
router.get(
  "/admins",
  requireGarageAdminAuth,
  withListSearch(listGarageAdmins, matchAdmin)
);
// The support-agent assign picker's roster. Same data as /admins, but a
// grantable read: the mount-level gate (ADMIN_PATH_RULES) lets a One Time
// Affiliates / NetworkChain Subs manager list who they can assign, without
// opening the super-admin-only Admins page. Non-super managers only need to
// SEE the roster here; assigning is separately guarded on the assign route.
router.get(
  "/assignable-agents",
  requireGarageAdminAuth,
  withListSearch(listGarageAdmins, matchAdmin)
);

/**
 * GET /garage-admin/library-affiliate
 *
 * The affiliate identity the ADMIN funnel library is authored under.
 *
 * Funnel CTAs normally store identity only and the viewing affiliate's own ref
 * is applied at render. "General" platform links are the exception: they have
 * no resolvable item, so the picker stores a pre-built href with an affiliate
 * id baked into it. In the library that must never be the editing admin's —
 * every affiliate adopts these templates, so a personal id would divert their
 * traffic.
 *
 * Resolved rather than configured: the garage SUPER ADMIN is the platform
 * identity, so this looks that role up and returns the matching user's
 * affiliateId. A hardcoded id (or an env var holding one) goes stale the
 * moment the super admin changes or their affiliate id is reissued, and
 * nothing would tell us.
 *
 * Returns affiliateId: null when the role has no holder or that admin has no
 * user/affiliate row. The caller must then author the link WITHOUT a ref
 * rather than falling back to whoever is signed in.
 */
router.get(
  "/library-affiliate",
  requireGarageAdminAuth,
  async (_req: Request, res: Response) => {
    try {
      const sup = await GarageAdminModel.findOne({ role: "garage-super-admin" })
        .select("email")
        .lean();
      if (!sup?.email) {
        return res.json({ success: true, affiliateId: null, email: null });
      }
      // Admins and users are separate collections keyed by the same email.
      const user = await User.findOne({ email: sup.email })
        .select("affiliateId")
        .lean();
      return res.json({
        success: true,
        affiliateId: (user as any)?.affiliateId || null,
        email: sup.email,
      });
    } catch (error) {
      console.error("[garage-admin/library-affiliate] error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to resolve library affiliate" });
    }
  }
);
router.get(
  "/organizations",
  requireGarageAdminAuth,
  withListSearch(getAllOrganizations, matchOrg)
);
router.get("/organizations/:id", requireGarageAdminAuth, getOrganizationById);
// Assign (or clear) a garage admin as the account owner for an org.
// Super-admin only — regular garage admins can view the assignment but
// only the super can create/change it.
router.post(
  "/organizations/:id/assign-admin",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  assignAdminToOrganization,
);
router.get(
  "/organizations/:id/invoices",
  requireGarageAdminAuth,
  listInvoicesForOrganization
);
router.get(
  "/organizations/:id/sellable-items",
  requireGarageAdminAuth,
  listSellableItemsForOrganization
);
router.get(
  "/founders",
  requireGarageAdminAuth,
  withListSearch(getAllFounders, matchPerson)
);
router.get(
  "/stakeholders",
  requireGarageAdminAuth,
  withListSearch(getAllStakeholders, matchPerson)
);
// Was super-admin only; moved to regular garage-admin access on 2026-07-04
// so any garage admin (not just super) can audit Unilevel Plus license
// holders + reserves from the admin panel.
router.get(
  "/unilevel-plus-license-holders",
  requireGarageAdminAuth,
  getAllUnilevelPlusLicenseHolders
);

// Users → wallets → payout accounts.
// List moved to regular garage-admin access on 2026-07-06 so any garage
// admin can browse "All Users" (parity with "All Organizations",
// "Founders", "Stakeholders"). Wallet/payout detail also opened so the
// list rows keep their existing click-into-detail behaviour.
router.get(
  "/users",
  requireGarageAdminAuth,
  listAllUsers
);
router.get(
  "/users/:userId/wallets",
  requireGarageAdminAuth,
  getUserWalletsForAdmin
);
// Drill-downs for the "N Purchases →" + "N Products →" columns on the
// admin users table. Purchases = non-product paid invoices; Products =
// paid ProductOrder rows (buyer perspective). See listAllUsers for the
// aggregate columns that these drawers detail.
router.get(
  "/users/:userId/purchases",
  requireGarageAdminAuth,
  listUserPurchases
);
router.get(
  "/users/:userId/products",
  requireGarageAdminAuth,
  listUserPurchasedProducts
);
// Extend (or re-open) the 24-hour welcome-offer window for a specific user.
// Sets the new expiry to `now + hours` regardless of the current window
// state — works whether the offer is open, expired, or the user never
// completed their profile. Never shortens (see comboWindow.ts).
router.post(
  "/users/:userId/extend-offer",
  requireGarageAdminAuth,
  extendUserOffer
);
// Re-parent a member in the referral tree (change their upline). Privileged
// version of /affiliate/change-referrer — no profile-complete gate. Only
// affects FUTURE commissions; the historical ledger is immutable.
router.post(
  "/users/:userId/move-upline",
  requireGarageAdminAuth,
  adminMoveUpline
);
// Global wallet list across all users — powers the "User Wallets" admin page.
router.get(
  "/user-wallets",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  listAllUserWallets
);

// Withdrawals (super-admin)
router.get(
  "/withdrawals",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  listWithdrawals
);
router.get(
  "/withdrawals/stats",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  getWithdrawalStats
);
router.post(
  "/withdrawals/quote",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  adminQuoteWithdrawal
);
router.post(
  "/withdrawals",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  adminInitiateWithdrawal
);
router.post(
  "/withdrawals/:id/complete",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  adminCompleteWithdrawal
);
router.post(
  "/withdrawals/:id/reject",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  adminRejectWithdrawal
);

// Platform fee overrides — super-admin only
router.get(
  "/platform-fee-overrides",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  listPlatformFeeOverrides
);
router.put(
  "/platform-fee-overrides/:orgId",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  setPlatformFeeOverride
);
router.delete(
  "/platform-fee-overrides/:orgId",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  removePlatformFeeOverride
);

// Super admin only routes
router.post(
  "/invite",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  inviteGarageAdmin
);
router.patch(
  "/admins/:id/toggle",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  toggleGarageAdminActive
);
// Role + per-page access for one admin. Super admin only — handing this
// out would let a delegated admin widen their own permissions.
router.patch(
  "/admins/:id/access",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  updateGarageAdminAccess
);
// Roles currently in use, so the invite dialog can offer them for reuse.
router.get(
  "/admin-roles",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  listGarageAdminRoles
);
// Define a role up front, before anyone holds it. Super-admin only, like
// every other route that shapes who can reach what.
router.post(
  "/admin-roles",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  createGarageAdminRole
);
router.patch(
  "/admin-roles/:name",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  updateGarageAdminRole
);
router.delete(
  "/admin-roles/:name",
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  deleteGarageAdminRole
);
// The catalogue of delegatable pages + presets. Just page names, so any
// authenticated admin may read it (see ALWAYS_ALLOWED_ADMIN_PATHS).
router.get("/admin-pages", requireGarageAdminAuth, getAdminPageCatalogue);

// Upload endpoint for garage admin
router.post(
  "/upload",
  requireGarageAdminAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const garageAdmin = (req as any).garageAdmin as {
        garageAdminId: string;
        role: string;
      };

      if (!req.file) {
        console.error(
          "Upload failed: No file provided or file type not allowed"
        );
        return res.status(400).json({
          error: "No file provided or file type not allowed",
          allowedTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
          ],
        });
      }

      const { buffer, originalname, mimetype, size } = req.file;

      console.log(
        `Garage Admin uploading file: ${originalname} (${mimetype}, ${size} bytes)`
      );

      // Generate file key for garage admin uploads
      const fileKey = s3Service.generateFileKey(
        garageAdmin.garageAdminId,
        "garage-admin",
        originalname
      );

      // Upload to S3
      await s3Service.uploadFile(fileKey, buffer, mimetype, {
        originalName: originalname,
        uploadedBy: garageAdmin.garageAdminId,
        uploadedAt: new Date().toISOString(),
        uploadType: "garage-admin",
      });

      // Generate public URL
      const fileUrl = s3Service.getPublicUrl(fileKey);

      console.log(`Garage Admin file uploaded successfully: ${fileKey}`);

      res.json({
        url: fileUrl,
        key: fileKey,
        fileName: originalname,
        fileSize: size,
        fileType: mimetype,
      });
    } catch (error) {
      console.error("Garage Admin upload error:", error);
      res
        .status(500)
        .json({ error: "Upload failed", details: (error as Error).message });
    }
  }
);

export default router;

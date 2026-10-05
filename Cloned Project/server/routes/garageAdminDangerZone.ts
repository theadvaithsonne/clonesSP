import { Router, Response } from "express";
import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";

/**
 * Destructive super-admin operations, driven from the row selection on the
 * garage-admin tables: delete a company, delete a user (verified or not), and
 * complete a user's profile on their behalf.
 *
 * ── Why these deletes are dangerous, and what we do about it ──────────────
 *
 * 141 of the 332 collections in this database carry a `userId`, and 171 carry
 * an `orgId` — invoices, wallets, subscriptions, payroll, withdrawals. Neither
 * User nor Organization has a soft-delete field, and adding one would be
 * cosmetic: several hundred existing queries don't filter on it, so a
 * "deleted" record would keep working everywhere except the admin table.
 *
 * So the delete is real and irreversible. What protects the admin is the
 * preview: before anything is removed, `/delete-preview` counts the dependent
 * records and the UI shows them. Deleting is a decision made with the blast
 * radius on screen, not a blind confirm.
 *
 * The dependents are deliberately NOT cascaded. Removing an invoice or a
 * wallet transaction because someone deleted an account would destroy
 * financial history that has to survive the account. The one exception is
 * embedded org membership (see the org delete) — that lives inside the user
 * document and would otherwise break the member's own app.
 */

const router = Router();

/**
 * Every route here is super-admin only — attached PER ROUTE, deliberately.
 *
 * `router.use(...)` would look equivalent and is not: this router is mounted
 * on the bare `/garage-admin` prefix (ahead of the main admin router, so its
 * DELETE leaves aren't shadowed), and router-level middleware runs before
 * route matching. A blanket `use` therefore ran on EVERY `/garage-admin/*`
 * request — including `request-otp` and `verify-otp`, which are the login
 * itself and carry no token yet — and rejected them with "No token provided",
 * locking everyone out of the admin panel.
 *
 * As an array on each route, the guards only run when a path here actually
 * matches; anything else falls straight through to the next router.
 */
const superAdminOnly = [requireGarageAdminAuth, requireGarageSuperAdmin];

/**
 * Collections worth showing an admin before they delete.
 *
 * A curated list, not all 141: counting every collection would make the
 * preview slow enough that people click through it, which defeats the point.
 * These are the ones that represent money, access, or content someone would
 * miss.
 */
const USER_DEPENDENTS: Array<{ collection: string; field: string; label: string }> = [
  { collection: "invoices", field: "userId", label: "Invoices" },
  { collection: "wallets", field: "userId", label: "Wallets" },
  { collection: "wallettransactions", field: "userId", label: "Wallet transactions" },
  { collection: "withdrawals", field: "userId", label: "Withdrawals" },
  { collection: "subscriptions", field: "userId", label: "Subscriptions" },
  {
    collection: "networkchain_subscriptions",
    field: "userId",
    label: "NetworkChain subscriptions",
  },
  { collection: "unilevelpluspurchases", field: "userId", label: "Unilevel Plus purchases" },
  { collection: "productorders", field: "userId", label: "Orders" },
  { collection: "courseenrollments", field: "userId", label: "Course enrolments" },
  { collection: "workshopregistrations", field: "userId", label: "Webinar registrations" },
  { collection: "channelmemberships", field: "userId", label: "Channel memberships" },
  { collection: "contacts", field: "userId", label: "Rolodex contacts" },
  { collection: "deals", field: "userId", label: "Deals" },
  { collection: "funnels", field: "userId", label: "Funnels" },
  { collection: "products", field: "createdBy", label: "Products created" },
  { collection: "workshops", field: "createdBy", label: "Webinars created" },
  { collection: "webinarmessages", field: "userId", label: "Chat messages" },
  { collection: "devicetokens", field: "userId", label: "Devices" },
];

const ORG_DEPENDENTS: Array<{ collection: string; field: string; label: string }> = [
  { collection: "invoices", field: "orgId", label: "Invoices" },
  { collection: "storeproducts", field: "orgId", label: "Store products" },
  { collection: "products", field: "organizationId", label: "Products" },
  { collection: "productorders", field: "orgId", label: "Orders" },
  { collection: "workshops", field: "orgId", label: "Webinars" },
  { collection: "courses", field: "orgId", label: "Courses" },
  { collection: "channels", field: "orgId", label: "Channels" },
  { collection: "subscriptions", field: "orgId", label: "Subscriptions" },
  { collection: "officesubscriptions", field: "orgId", label: "Office subscriptions" },
  { collection: "organizationfiles", field: "orgId", label: "Cabinet files" },
  { collection: "posts", field: "orgId", label: "Posts" },
  { collection: "customers", field: "orgId", label: "Customers" },
  { collection: "withdrawals", field: "orgId", label: "Withdrawals" },
  { collection: "walletaccounts", field: "orgId", label: "Wallet accounts" },
  { collection: "teamforceemployeeprofiles", field: "orgId", label: "Employees" },
  { collection: "meets", field: "orgId", label: "Meetings" },
];

/**
 * Count dependents, tolerating collections that don't exist on this
 * deployment. A missing collection is a zero, not a failed preview — the
 * admin still needs to see the rest.
 */
const COUNT_CAP = 10000;

async function countDependents(
  defs: Array<{ collection: string; field: string; label: string }>,
  id: Types.ObjectId
): Promise<{
  items: Array<{ label: string; count: number; capped: boolean }>;
  total: number;
  capped: boolean;
}> {
  const { connection } = await import("mongoose");
  const db = connection.db;
  if (!db) return { items: [], total: 0, capped: false };

  const results = await Promise.all(
    defs.map(async (d) => {
      try {
        const count = await db
          .collection(d.collection)
          .countDocuments({ [d.field]: id }, { limit: COUNT_CAP });
        // The cap keeps the preview fast, but a capped number reported as
        // exact would understate the damage. Flag it so the UI can say
        // "10,000+" instead of a confident, wrong "10,000".
        return { label: d.label, count, capped: count >= COUNT_CAP };
      } catch {
        return { label: d.label, count: 0, capped: false };
      }
    })
  );

  const items = results.filter((r) => r.count > 0);
  return {
    items,
    total: items.reduce((sum, r) => sum + r.count, 0),
    capped: items.some((r) => r.capped),
  };
}

/* ── Users ──────────────────────────────────────────────────────────────── */

/**
 * GET /garage-admin/users/:id/delete-preview
 *
 * What deleting this user would leave behind. Drives the confirmation alert.
 */
router.get("/users/:id/delete-preview", superAdminOnly, async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const user = await User.findById(id)
      .select("name email isVerified phoneVerified profileComplete organizations createdAt")
      .lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const { items, total, capped } = await countDependents(
      USER_DEPENDENTS,
      new Types.ObjectId(id)
    );

    res.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name || null,
        email: user.email || null,
        isVerified: !!user.isVerified,
        profileComplete: !!user.profileComplete,
        organizations: (user.organizations || []).length,
        createdAt: user.createdAt,
      },
      dependents: items,
      totalDependents: total,
      countsCapped: capped,
      /** Nothing is cascaded — these records survive without their owner. */
      cascades: false,
    });
  } catch (err) {
    console.error("[admin] user delete-preview failed:", err);
    res.status(500).json({ error: "Failed to build delete preview" });
  }
});

/**
 * DELETE /garage-admin/users/:id
 *
 * Removes the user document. Irreversible, and does not touch dependents —
 * see the note at the top of this file for why financial history is left
 * intact rather than cascaded away.
 *
 * `confirmEmail` must match the account being deleted. The admin UI asks the
 * operator to type it, and the server re-checks rather than trusting that a
 * dialog was shown: a mis-selected row is the realistic failure here.
 */
router.delete("/users/:id", superAdminOnly, async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmEmail } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const user = await User.findById(id).select("email name isVerified").lean<any>();
    if (!user) return res.status(404).json({ error: "User not found" });

    // The confirmation the operator types. Normally the email, but plenty of
    // broken signups have NO email (the app let them in without recording one)
    // and those were previously impossible to delete. Fall back to the name,
    // then to a literal "DELETE" when there's neither — so every account can be
    // removed, while a mis-selected row is still caught.
    const email = String(user.email || "").trim();
    const name = String(user.name || "").trim();
    const kind = email ? "email" : name ? "name" : "phrase";
    const expected = (email || name || "DELETE").toLowerCase();
    const provided = String(confirmEmail ?? (req.body || {}).confirm ?? "")
      .trim()
      .toLowerCase();
    if (!provided || provided !== expected) {
      return res.status(400).json({
        error:
          kind === "email"
            ? "Confirmation does not match this user's email"
            : kind === "name"
              ? "Confirmation does not match this user's name"
              : 'Type "DELETE" to confirm',
        confirmKind: kind,
      });
    }

    await User.deleteOne({ _id: new Types.ObjectId(id) });

    console.warn(
      `[admin] user DELETED id=${id} email=${user.email} verified=${!!user.isVerified} by=${req.garageAdmin?.email}`
    );

    res.json({
      success: true,
      deleted: { id, email: user.email, isVerified: !!user.isVerified },
    });
  } catch (err) {
    console.error("[admin] user delete failed:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/**
 * DELETE /garage-admin/users/:id/phone
 *
 * Clear a user's phone number and drop them back to unverified.
 *
 * Unlike the deletes above this is recoverable — the user can re-run
 * `POST /auth/phone/request-otp` and verify a number again — so it takes no
 * typed confirmation, just the UI's confirm. What it is NOT is cosmetic:
 * `phone` is the number that received the OTP, so clearing it without also
 * clearing `phoneVerified` would leave an account marked as having verified a
 * number it no longer has. The two always move together.
 *
 * Nothing else is touched. `phoneVerified` is advisory — no route enforces it
 * (see the comment at auth.ts:598) — so this cannot lock anyone out of their
 * account; login is by email OTP. It only re-arms the "verify your phone"
 * prompt in the app.
 */
router.delete("/users/:id/phone", superAdminOnly, async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const user = await User.findById(id).select("email phone phoneVerified").lean<any>();
    if (!user) return res.status(404).json({ error: "User not found" });

    const had = user.phone || null;

    // $unset rather than setting "" so the field is absent, matching an
    // account that never had one — several queries test for existence.
    await User.updateOne(
      { _id: new Types.ObjectId(id) },
      { $unset: { phone: "" }, $set: { phoneVerified: false } }
    );

    console.warn(
      `[admin] phone REMOVED user=${id} email=${user.email} phone=${had} wasVerified=${!!user.phoneVerified} by=${req.garageAdmin?.email}`
    );

    res.json({
      success: true,
      user: { id, email: user.email ?? null, phone: null, phoneVerified: false },
      removed: had,
    });
  } catch (err) {
    console.error("[admin] phone removal failed:", err);
    res.status(500).json({ error: "Failed to remove phone number" });
  }
});

/**
 * PATCH /garage-admin/users/:id/email-verification
 *
 * Flip a user's email verification flag by hand.
 *
 * `isVerified` is normally set by the user themselves: it turns true the first
 * time they complete an email OTP login (auth.ts:408). This is the manual
 * override for the cases that never get there — a founder whose mailbox bounces
 * the OTP, an imported account, support confirming an address out of band.
 *
 * Fully reversible in both directions, so no typed confirmation.
 *
 * Note what this does NOT do: it does not log anyone in, and it does not skip
 * the OTP. Login still issues and checks a code every time; nothing reads
 * `isVerified` as permission. It only reflects "this address has been
 * confirmed" in the admin table and the app's own prompts, which is why it is
 * safe to set — and why setting it is not a way in to someone's account.
 *
 * Verifying an address that doesn't exist is meaningless, so verify=true on a
 * user with no email is a 400 rather than a silently useless write.
 */
router.patch(
  "/users/:id/email-verification",
  superAdminOnly,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const { verified } = (req.body ?? {}) as { verified?: unknown };
      if (typeof verified !== "boolean") {
        return res.status(400).json({ error: "`verified` must be true or false" });
      }

      const user = await User.findById(id).select("email isVerified").lean<any>();
      if (!user) return res.status(404).json({ error: "User not found" });

      if (verified && !user.email) {
        return res
          .status(400)
          .json({ error: "This user has no email address to verify" });
      }

      await User.updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { isVerified: verified } }
      );

      console.warn(
        `[admin] email verification ${verified ? "SET" : "CLEARED"} user=${id} ` +
          `email=${user.email} was=${!!user.isVerified} by=${req.garageAdmin?.email}`
      );

      res.json({
        success: true,
        user: { id, email: user.email ?? null, isVerified: verified },
      });
    } catch (err) {
      console.error("[admin] email verification change failed:", err);
      res.status(500).json({ error: "Failed to update email verification" });
    }
  }
);

/**
 * PATCH /garage-admin/users/:id/complete-profile
 *
 * Fill in a user's profile on their behalf.
 *
 * `profileCompletedAt` is stamped only when it isn't already set, because
 * that timestamp opens the 24-hour free-first-cycle offer window
 * (services/comboWindow.ts). Re-stamping it would silently hand someone a
 * second window, so an admin completing a profile starts the clock exactly
 * once — the same rule the user's own first save follows.
 */
router.patch(
  "/users/:id/complete-profile",
  superAdminOnly,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { name, phone, country, state, city, postalCode, startOfferWindow } =
        req.body || {};

      const fields: Record<string, unknown> = { name, phone, country, state, city, postalCode };
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value === "string" && value.trim()) {
          user.set(key, value.trim());
        }
      }

      // Mirrors PUT /profile — the profile is complete once the required
      // fields are present.
      const missing = ["name", "phone", "country", "state", "city", "postalCode"].filter(
        (f) => !String(user.get(f) || "").trim()
      );
      if (missing.length > 0) {
        return res.status(400).json({
          error: "Profile is still incomplete",
          missing,
        });
      }

      // Check if phone number is already assigned to another user
      const currentPhone = String(user.get("phone") || "").trim();
      if (currentPhone) {
        const holder: any = await User.findOne({
          phone: currentPhone,
          _id: { $ne: user._id },
        })
          .select("_id")
          .lean();
        if (holder) {
          return res.status(409).json({
            error: "That phone number is already on another account.",
          });
        }
      }

      user.set("profileComplete", true);
      user.set("phoneVerified", true);

      // Opt-in, and only ever once. See the note above.
      const alreadyStamped = !!user.get("profileCompletedAt");
      if (startOfferWindow === true && !alreadyStamped) {
        user.set("profileCompletedAt", new Date());
      }

      await user.save();

      console.warn(
        `[admin] profile completed for id=${id} email=${user.get("email")} by=${req.garageAdmin?.email}`
      );

      // Same support-chat hook as a self-completed profile (routes/profile.ts).
      void import("../services/supportChat").then(({ ensureSupportGroup }) =>
        ensureSupportGroup(user._id)
      );

      res.json({
        success: true,
        user: {
          id: String(user._id),
          email: user.get("email"),
          phone: user.get("phone") || null,
          phoneVerified: true,
          profileComplete: true,
          profileCompletedAt: user.get("profileCompletedAt") || null,
          offerWindowStarted: !alreadyStamped && startOfferWindow === true,
        },
      });
    } catch (err: any) {
      console.error("[admin] complete-profile failed:", err);
      if (err?.code === 11000) {
        return res.status(409).json({
          error: "That phone number is already on another account.",
        });
      }
      res.status(500).json({ error: err?.message || "Failed to complete profile" });
    }
  }
);

/**
 * PATCH /garage-admin/users/:id/phone-verification
 *
 * Flip a user's phone verification flag by hand.
 *
 * `phoneVerified` is normally set by completing phone OTP (/auth/phone/verify-otp).
 * This is the manual override for admins when confirming a phone number out of band.
 *
 * Verifying a phone number that doesn't exist is meaningless, so verify=true on a
 * user with no phone is a 400 rather than a silently useless write.
 */
router.patch(
  "/users/:id/phone-verification",
  superAdminOnly,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }

      const { verified } = (req.body ?? {}) as { verified?: unknown };
      if (typeof verified !== "boolean") {
        return res.status(400).json({ error: "`verified` must be true or false" });
      }

      const user = await User.findById(id).select("email phone phoneVerified").lean<any>();
      if (!user) return res.status(404).json({ error: "User not found" });

      if (verified && !user.phone) {
        return res
          .status(400)
          .json({ error: "This user has no phone number to verify" });
      }

      await User.updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { phoneVerified: verified } }
      );

      console.warn(
        `[admin] phone verification ${verified ? "SET" : "CLEARED"} user=${id} ` +
          `phone=${user.phone} was=${!!user.phoneVerified} by=${req.garageAdmin?.email}`
      );

      res.json({
        success: true,
        user: { id, email: user.email ?? null, phone: user.phone ?? null, phoneVerified: verified },
      });
    } catch (err) {
      console.error("[admin] phone verification change failed:", err);
      res.status(500).json({ error: "Failed to update phone verification" });
    }
  }
);

/* ── Organizations ──────────────────────────────────────────────────────── */

/**
 * GET /garage-admin/organizations/:id/delete-preview
 */
router.get(
  "/organizations/:id/delete-preview",
  superAdminOnly,
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid organization id" });
      }

      const org = await Organization.findById(id).select("name slug createdAt").lean();
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const oid = new Types.ObjectId(id);
      const { items, total, capped } = await countDependents(ORG_DEPENDENTS, oid);

      // Membership lives inside the user document, so it's counted (and
      // cleaned) separately from the collections above.
      const members = await User.countDocuments({ "organizations.orgId": oid });

      res.json({
        success: true,
        organization: {
          id: String(org._id),
          name: (org as any).name || null,
          slug: (org as any).slug || null,
          createdAt: (org as any).createdAt,
        },
        dependents: items,
        totalDependents: total,
        countsCapped: capped,
        members,
        cascades: false,
      });
    } catch (err) {
      console.error("[admin] org delete-preview failed:", err);
      res.status(500).json({ error: "Failed to build delete preview" });
    }
  }
);

/**
 * DELETE /garage-admin/organizations/:id
 *
 * Removes the organization. `confirmName` must match its name.
 *
 * The one thing that IS cleaned up is membership: `user.organizations[]` is
 * an embedded array, and a member left pointing at a deleted org gets a
 * broken workspace switcher rather than merely an orphaned row. Everything
 * else — invoices, products, files — is left in place on purpose.
 */
router.delete("/organizations/:id", superAdminOnly, async (req: GarageAdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmName } = req.body || {};

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid organization id" });
    }

    const org = await Organization.findById(id).select("name").lean();
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const expected = String((org as any).name || "").trim().toLowerCase();
    if (!confirmName || String(confirmName).trim().toLowerCase() !== expected) {
      return res.status(400).json({
        error: "Confirmation does not match this company's name",
      });
    }

    const oid = new Types.ObjectId(id);

    const membership = await User.updateMany(
      { "organizations.orgId": oid },
      { $pull: { organizations: { orgId: oid } } }
    );

    await Organization.deleteOne({ _id: oid });

    console.warn(
      `[admin] organization DELETED id=${id} name=${(org as any).name} members_detached=${membership.modifiedCount} by=${req.garageAdmin?.email}`
    );

    res.json({
      success: true,
      deleted: { id, name: (org as any).name },
      membersDetached: membership.modifiedCount,
    });
  } catch (err) {
    console.error("[admin] org delete failed:", err);
    res.status(500).json({ error: "Failed to delete organization" });
  }
});

export default router;

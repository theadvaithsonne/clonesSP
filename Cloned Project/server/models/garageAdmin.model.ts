import { Schema, model, InferSchemaType } from "mongoose";
import { ADMIN_PAGES, ADMIN_PAGE_LEVELS } from "../config/adminPages";

// One `none | view | manage` field per entry in ADMIN_PAGES, built off that
// config so the two can never drift. Read it through
// normalizePagePermissions — `.lean()` reads skip these defaults and yield
// undefined, and rows written before a page existed have no key at all.
// strict:false so per-action grants ("<pageKey>:<actionKey>", e.g.
// "one_time_affiliates:assign-agent") survive alongside the fixed page fields.
// Page keys keep their enum/default; action keys are validated in code
// (sanitizePagePermissions / normalizePagePermissions) rather than the schema.
const PagePermissionsSchema = new Schema(
  Object.fromEntries(
    ADMIN_PAGES.map((page) => [
      page.key,
      {
        type: String,
        enum: ADMIN_PAGE_LEVELS as unknown as string[],
        default: "none",
      },
    ])
  ),
  { _id: false, strict: false }
);

const GarageAdminSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true },
    // Free-text label now, not an enum — a super admin can mint any role
    // name ("Support Agent", "Finance", …) and attach a permission map to
    // it. Two values still mean something to the code:
    //   "garage-super-admin" → unrestricted, bypasses pagePermissions
    //   "garage-admin"       → the default label for a delegated admin
    // isReservedRoleName() in config/adminPages keeps the first one from
    // being typed in through the invite form.
    role: {
      type: String,
      default: "garage-admin",
      trim: true,
    },
    // Per-page access for everyone who is not a super admin. Ignored
    // entirely for role === "garage-super-admin", so it stays all-"none"
    // on those rows.
    pagePermissions: {
      type: PagePermissionsSchema,
      default: () => ({}),
    },
    // False on every row that existed before page-RBAC shipped, and on
    // any row nobody has since edited. Those admins keep the access the
    // old sidebar gave them (LEGACY_ADMIN_PERMISSIONS) instead of being
    // read as "all none" and logged into an empty console.
    //
    // Flipped to true the first time a super admin saves a map, which is
    // also what makes "deliberately all none" distinguishable from "never
    // configured" — mongoose fills the sub-document defaults in on
    // hydration, so the map alone can't tell them apart.
    pagePermissionsSet: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // Optional avatar URL — used by the Assign-Admin dropdown on the
    // garage-admin companies table + the admin's own profile menu.
    // Null for admins onboarded before this field existed.
    profilePicture: { type: String },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
      required: false,
    },
    invitedAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },

    // Hard cutoff for this admin's tokens: any JWT issued before this
    // instant is refused by the auth middleware. Stamped when a step-up
    // verification runs out of attempts, which is what makes "just log him
    // out" mean something — the holder of the token is the one being
    // signed out, so clearing their browser storage would achieve nothing.
    sessionsInvalidatedAt: { type: Date },

    // ============ Step-up verification (the "Verify your admin" gate) ============
    // A second factor asked once per login, on top of the email OTP. Only
    // admins who have `questions` seeded are gated — see
    // services/adminVerification. That makes the feature opt-in per account:
    // seeding one admin can never lock the other nine out.
    //
    // `answerHash` is bcrypt over PEPPER + the normalized answer. The pepper
    // lives only in the production environment, so reading this collection
    // (or this file) tells you nothing — the answers are short enough that a
    // bare hash would fall to a wordlist in seconds.
    //
    // select:false so the hashes never ride along on an ordinary admin read
    // (the admin list, the profile endpoint, the Assign-Admin dropdown).
    verification: {
      type: new Schema(
        {
          questions: [
            {
              _id: false,
              id: { type: String, required: true },
              prompt: { type: String, required: true },
              answerHash: { type: String, required: true },
            },
          ],
          // Wrong answers within the current login. Exhausting them signs
          // the admin out (see sessionsInvalidatedAt) rather than locking
          // the account — there is no lock state to be stranded in, and a
          // fresh attempt costs a new OTP email.
          failedAttempts: { type: Number, default: 0 },
          lastVerifiedAt: { type: Date },
          lastFailedAt: { type: Date },
        },
        { _id: false }
      ),
      select: false,
    },
  },
  { timestamps: true }
);

GarageAdminSchema.index({ email: 1 }, { unique: true });

export type GarageAdmin = InferSchemaType<typeof GarageAdminSchema>;
export const GarageAdminModel = model<GarageAdmin>(
  "GarageAdmin",
  GarageAdminSchema
);

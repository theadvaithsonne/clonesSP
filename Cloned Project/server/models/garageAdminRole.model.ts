import { Schema, model, models, Types } from "mongoose";
import { ADMIN_PAGES, ADMIN_PAGE_LEVELS } from "../config/adminPages";

/**
 * A named admin role that exists on its own, independent of anyone holding
 * it.
 *
 * Roles used to be derived: `listGarageAdminRoles` grouped existing admins
 * by their `role` string, so a role only existed once somebody had it.
 * That made it impossible to define roles up front — you could type "NVC"
 * in the invite dialog, but until an invite was actually sent there was
 * nothing to remember, and a refresh lost it.
 *
 * This stores the name and a permission template. The template is a
 * STARTING POINT copied into an admin when the role is chosen, not a live
 * link: changing a role later deliberately does not re-permission everyone
 * already holding it. Access stays a property of the admin, which is what
 * every authorization check in the codebase reads.
 */
const GarageAdminRoleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    /**
     * Lowercased `name`, carrying the uniqueness constraint so "Finance"
     * and "finance" can't both exist. Kept as its own field because Mongo's
     * collation support on unique indexes is easy to get wrong in a way
     * that only shows up as duplicates in production.
     */
    nameLower: { type: String, required: true, lowercase: true, trim: true },
    permissions: {
      // strict:false so per-action grants ("<pageKey>:<actionKey>") persist in
      // the role template beside the fixed page fields (validated in code via
      // sanitizePagePermissions, same as the admin document).
      type: new Schema(
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
      ),
      default: () => ({}),
    },
    createdBy: { type: Types.ObjectId, ref: "GarageAdmin" },
  },
  { timestamps: true }
);

GarageAdminRoleSchema.index({ nameLower: 1 }, { unique: true });

export const GarageAdminRole =
  models.GarageAdminRole || model("GarageAdminRole", GarageAdminRoleSchema);

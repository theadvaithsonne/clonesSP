import { Schema, model, Types, InferSchemaType } from "mongoose";

/**
 * Admin-managed taxonomy for `Organization.category`. Founders pick from
 * this list in the office-creation + ManageOrg pickers. The garage-admin
 * panel is the sole source of truth — no free-text input in either FE
 * picker anymore.
 *
 * `Organization.category` is kept as a plain string matching this
 * collection's `name` (not a ref), so every existing read site — discover
 * facets, affiliate leaderboards, public office projection — keeps
 * working unchanged. Rename + delete propagate to the org collection via
 * a single `Organization.updateMany` cascade.
 *
 * `slug` is derived from `name` (kebab-case, ASCII) and used only for
 * dedup + URL-safety; consumers ignore it.
 *
 * `createdByAdminId` is nullable — rows inserted by the seed script have
 * no admin attribution.
 */
const OrgCategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    createdByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
      default: null,
    },
  },
  { timestamps: true },
);

// Case-insensitive uniqueness on name — mirrors the FE picker experience
// ("Tech" and "tech" should not both exist). Enforced with a collation
// index; MongoDB rejects the second insert with a duplicate-key error.
OrgCategorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export type OrgCategory = InferSchemaType<typeof OrgCategorySchema> & {
  _id: Types.ObjectId;
};

export const OrgCategory = model<OrgCategory>(
  "OrgCategory",
  OrgCategorySchema,
);

/**
 * Convert a category display name into a URL-safe slug. Strips diacritics
 * + non-alphanumerics, collapses whitespace to single hyphens.
 * "Real Estate" → "real-estate", "Consulting & Advisory" → "consulting-advisory".
 */
export function slugifyCategoryName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

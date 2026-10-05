import { Types } from "mongoose";
import { OrgCategory, slugifyCategoryName } from "../models/orgCategory.model";
import { Organization } from "../models/organization.model";

/**
 * True when `name` matches an existing OrgCategory (case-insensitive).
 * Empty string is treated as "untagged" and passes — an org can have no
 * category. Called by the three org write endpoints (create-first-time,
 * upsert, PUT /:orgId) before persist.
 */
export async function isValidCategoryName(
  name: string | undefined | null,
): Promise<boolean> {
  const trimmed = (name || "").trim();
  if (trimmed === "") return true;
  const hit = await OrgCategory.findOne({
    name: trimmed,
  })
    .collation({ locale: "en", strength: 2 })
    .select("_id")
    .lean();
  return !!hit;
}

/**
 * List every category name currently in the taxonomy, sorted by name asc.
 * Backs both the public picker endpoint and the affiliate leaderboard
 * filter. Returns names only — consumers store the string on Organization.
 */
export async function listCategoryNames(): Promise<string[]> {
  const rows = await OrgCategory.find({})
    .sort({ name: 1 })
    .select("name")
    .lean();
  return rows.map((r) => r.name);
}

export interface CategoryWithCount {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  orgCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Admin table view: every category + how many orgs currently use it.
 * `orgCount` is aggregated in one round-trip against Organization.
 */
export async function listCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const [cats, counts] = await Promise.all([
    OrgCategory.find({}).sort({ name: 1 }).lean(),
    Organization.aggregate([
      {
        $match: {
          category: { $exists: true, $ne: "" as any },
        },
      },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
  ]);

  // Case-insensitive lookup so "Tech" on an org matches "tech" in the
  // collection — matches the way createOrgCategory dedupes on insert.
  const countByLower = new Map<string, number>();
  for (const c of counts) {
    countByLower.set(String(c._id).toLowerCase(), c.count);
  }

  return cats.map((c) => ({
    _id: c._id as Types.ObjectId,
    name: c.name,
    slug: c.slug,
    orgCount: countByLower.get(c.name.toLowerCase()) || 0,
    createdAt: (c as any).createdAt,
    updatedAt: (c as any).updatedAt,
  }));
}

/**
 * Create a new category. Rejects duplicates (case-insensitive on name).
 * Auto-derives + de-dupes the slug — if `foo` and `foo-2` both exist,
 * next collision becomes `foo-3`.
 */
export async function createOrgCategory(input: {
  name: string;
  createdByAdminId?: string | null;
}): Promise<{ _id: Types.ObjectId; name: string; slug: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name required");

  // Case-insensitive duplicate check
  const dup = await OrgCategory.findOne({ name })
    .collation({ locale: "en", strength: 2 })
    .select("_id name")
    .lean();
  if (dup) throw new Error(`Category "${dup.name}" already exists`);

  const slug = await resolveUniqueSlug(slugifyCategoryName(name) || "category");

  const created = await OrgCategory.create({
    name,
    slug,
    createdByAdminId: input.createdByAdminId
      ? new Types.ObjectId(input.createdByAdminId)
      : null,
  });

  return { _id: created._id, name: created.name, slug: created.slug };
}

/**
 * Rename a category. Cascades the new name onto every Organization that
 * had the old name. Returns the updated category + how many orgs were
 * touched, so the FE can toast "Renamed — 12 offices updated".
 *
 * Rejects if the new name collides with an existing category (case-ins).
 */
export async function renameOrgCategory(
  categoryId: string,
  newName: string,
): Promise<{
  category: { _id: Types.ObjectId; name: string; slug: string };
  orgsUpdated: number;
}> {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new Error("Invalid category id");
  }
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Category name required");

  const cat = await OrgCategory.findById(categoryId);
  if (!cat) throw new Error("Category not found");

  const oldName = cat.name;
  if (oldName === trimmed) {
    // No-op — return without touching anything
    return {
      category: { _id: cat._id, name: cat.name, slug: cat.slug },
      orgsUpdated: 0,
    };
  }

  // Reject collision with a DIFFERENT existing category
  const dup = await OrgCategory.findOne({
    name: trimmed,
    _id: { $ne: cat._id },
  })
    .collation({ locale: "en", strength: 2 })
    .select("_id name")
    .lean();
  if (dup) throw new Error(`Category "${dup.name}" already exists`);

  const newSlug = await resolveUniqueSlug(
    slugifyCategoryName(trimmed) || "category",
    cat._id,
  );

  cat.name = trimmed;
  cat.slug = newSlug;
  await cat.save();

  // Cascade to every org holding the old string. Case-insensitive so
  // legacy typos ("tech" vs "Tech") also get normalized to the new name.
  const result = await Organization.updateMany(
    { category: oldName },
    { $set: { category: trimmed } },
    { collation: { locale: "en", strength: 2 } },
  );

  return {
    category: { _id: cat._id, name: cat.name, slug: cat.slug },
    orgsUpdated: result.modifiedCount || 0,
  };
}

/**
 * Merge every org that uses `sourceCategoryId` into `targetCategoryId`,
 * then delete the source. Both ids must exist and be different — no
 * orphaning, no self-merge.
 *
 * Returns the target row + count of orgs reassigned so the FE can
 * confirm the operation.
 */
export async function mergeAndDeleteOrgCategory(
  sourceCategoryId: string,
  targetCategoryId: string,
): Promise<{
  deleted: true;
  orgsReassigned: number;
  mergedInto: { _id: Types.ObjectId; name: string };
}> {
  if (
    !Types.ObjectId.isValid(sourceCategoryId) ||
    !Types.ObjectId.isValid(targetCategoryId)
  ) {
    throw new Error("Invalid category id");
  }
  if (sourceCategoryId === targetCategoryId) {
    throw new Error("Cannot merge a category into itself");
  }

  const [source, target] = await Promise.all([
    OrgCategory.findById(sourceCategoryId),
    OrgCategory.findById(targetCategoryId).lean(),
  ]);
  if (!source) throw new Error("Source category not found");
  if (!target) throw new Error("Target category not found");

  // Cascade every org using the source's name onto the target's name.
  const result = await Organization.updateMany(
    { category: source.name },
    { $set: { category: target.name } },
    { collation: { locale: "en", strength: 2 } },
  );

  await OrgCategory.deleteOne({ _id: source._id });

  return {
    deleted: true,
    orgsReassigned: result.modifiedCount || 0,
    mergedInto: { _id: target._id, name: target.name },
  };
}

/**
 * Pick a slug that doesn't collide with any existing category. Appends
 * `-2`, `-3`, … until it finds a free one. `excludeId` is honored so
 * rename can keep its own slug when the base is unchanged.
 */
async function resolveUniqueSlug(
  base: string,
  excludeId?: Types.ObjectId,
): Promise<string> {
  let candidate = base;
  let n = 2;
  while (true) {
    const q: any = { slug: candidate };
    if (excludeId) q._id = { $ne: excludeId };
    const hit = await OrgCategory.findOne(q).select("_id").lean();
    if (!hit) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
}

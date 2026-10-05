import { Organization } from "../models/organization.model";

/**
 * Generate URL-friendly slug from organization name
 * Example: "My Awesome Company" -> "my-awesome-company"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 50); // Max length
}

/**
 * Ensure slug is unique by appending number if needed
 * Example: "my-company" -> "my-company-2" if "my-company" exists
 */
export async function ensureUniqueSlug(
  slug: string,
  excludeOrgId?: string
): Promise<string> {
  let uniqueSlug = slug;
  let counter = 1;

  while (true) {
    const filter: Record<string, any> = { "store.slug": uniqueSlug };
    if (excludeOrgId) {
      filter._id = { $ne: excludeOrgId };
    }

    const existing = await Organization.findOne(filter).lean();
    if (!existing) {
      return uniqueSlug;
    }

    counter++;
    uniqueSlug = `${slug}-${counter}`;
  }
}

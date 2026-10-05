import { Organization } from "../models/organization.model";
import { Channel } from "../models/channel.model";
import { User } from "../models/user.model";
import { generateSlug, ensureUniqueSlug } from "../utils/storeSlug";

/**
 * Create store for organization with default channel (Members)
 * Note: Previously created Employees + Customers channels, now only creates Members
 */
export async function createStoreForOrganization(orgId: string): Promise<void> {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }

  if (org.store?.slug) {
    console.log(`Store already exists for organization ${org.name}`);
    return;
  }

  // Generate unique slug
  const baseSlug = generateSlug(org.name);
  const slug = await ensureUniqueSlug(baseSlug, orgId);

  // Create store
  org.store = {
    name: org.name,
    slug,
    description: org.description || "",
    headingText: org.headingText || "",
    subHeadingText: org.subHeadingText || "",
    icon: org.icon || "",
    coverPhoto: org.coverPhoto || "",
    promoVideoLink: org.promoVideoLink || "",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await org.save();
  console.log(`✅ Created store for ${org.name} with slug: ${slug}`);

  // Find founder to set as channel creator
  const founder = await User.findOne({
    $or: [
      { organization: orgId, role: { $in: ["admin", "founder"] } },
      { "organizations.organization": orgId, "organizations.role": "founder" },
    ],
  }).lean();

  if (!founder) {
    console.error(`⚠️ Founder not found for organization ${org.name}, skipping channel creation`);
    return;
  }

  // Check if default channel already exists (Members for new orgs, or Employees/Customers for existing)
  const existingChannels = await Channel.countDocuments({ storeId: org._id });
  if (existingChannels >= 1) {
    console.log(`Default channel(s) already exist for ${org.name}`);
    return;
  }

  // OLD: Create Employees and Customers channels (commented out - keeping for reference)
  // await Channel.create({
  //   title: "Employees",
  //   description: "For team members of this organization",
  //   price: 0,
  //   currency: "USD",
  //   isActive: true,
  //   isFree: true,
  //   isSubscription: false,
  //   allowPayWhatYouWant: false,
  //   storeId: org._id,
  //   createdBy: founder._id,
  // });
  // await Channel.create({
  //   title: "Customers",
  //   description: "For customers and clients",
  //   price: 0,
  //   currency: "USD",
  //   isActive: true,
  //   isFree: true,
  //   isSubscription: false,
  //   allowPayWhatYouWant: false,
  //   storeId: org._id,
  //   createdBy: founder._id,
  // });

  // NEW: Create single "Members" channel for all members
  await Channel.create({
    title: "Members",
    description: "Default channel for all members of this organization",
    price: 0,
    currency: "USD",
    isActive: true,
    isFree: true,
    isSubscription: false,
    allowPayWhatYouWant: false,
    isDefault: true,
    storeId: org._id,
    createdBy: founder._id,
  });

  console.log(`✅ Created default channel (Members) for ${org.name}`);
}

/**
 * Update store information
 */
export async function updateStore(
  orgId: string,
  updates: {
    name?: string;
    description?: string;
    headingText?: string;
    subHeadingText?: string;
    icon?: string;
    coverPhoto?: string;
    promoVideoLink?: string;
  }
): Promise<void> {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }

  if (!org.store) {
    // If no store exists, create one
    await createStoreForOrganization(orgId);
    return;
  }

  // Update store fields
  if (updates.name) org.store.name = updates.name;
  if (updates.description !== undefined) org.store.description = updates.description;
  if (updates.headingText !== undefined) org.store.headingText = updates.headingText;
  if (updates.subHeadingText !== undefined) org.store.subHeadingText = updates.subHeadingText;
  if (updates.icon !== undefined) org.store.icon = updates.icon;
  if (updates.coverPhoto !== undefined) org.store.coverPhoto = updates.coverPhoto;
  if (updates.promoVideoLink !== undefined) org.store.promoVideoLink = updates.promoVideoLink;

  org.store.updatedAt = new Date();

  await org.save();
  console.log(`✅ Updated store for organization ${orgId}`);
}

/**
 * Get organization by store slug
 */
export async function getStoreBySlug(slug: string) {
  return await Organization.findOne({ "store.slug": slug }).lean();
}

/**
 * Get store info for an organization
 */
export async function getStoreInfo(orgId: string) {
  const org = await Organization.findById(orgId).lean();
  if (!org || !org.store) {
    return null;
  }

  return {
    storeId: org._id.toString(),
    name: org.store.name,
    slug: org.store.slug,
    description: org.store.description,
    headingText: org.store.headingText,
    subHeadingText: org.store.subHeadingText,
    icon: org.store.icon,
    coverPhoto: org.store.coverPhoto,
    promoVideoLink: org.store.promoVideoLink,
    isActive: org.store.isActive,
  };
}

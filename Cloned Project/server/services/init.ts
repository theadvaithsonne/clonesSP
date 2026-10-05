import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { Floor } from "../models/floor.model";
import { initializeGarageSuperAdmin } from "./garageAdminInit";
import { generateAffiliateId } from "../utils/affiliateId";
import { createStoreForOrganization } from "./store";
import { initializeOfficeAddons } from "./officeAddonSubscription";
import {
  autoJoinMembersChannel,
  autoJoinDefaultChannel,
  autoJoinMandatoryChannels,
} from "./channel";

/**
 * Initialize GARAGE HQ organization and founder user
 * This ensures the parent organization always exists
 */
export async function initializeGarageHQ() {
  try {
    // Check if GARAGE HQ already exists
    let garageHQ = await Organization.findOne({ parent: true });

    if (!garageHQ) {
      // Create GARAGE HQ organization
      garageHQ = await Organization.create({
        name: "GARAGE HQ",
        parent: true,
        size: "Enterprise",
        location: "Global",
        icon: "https://35yqu70ay5.ufs.sh/f/RAEZ8dOTgh6ZSsAZZMh9buHQYWG2nXrMzg4DFh1deKZ3Licm",
      });
      console.log("✅ Created GARAGE HQ organization");
    } else {
      console.log("✅ GARAGE HQ organization already exists");
    }

    // Ensure parent HQ has the two default floors (Floor 1 and Floor 2)
    const existingHQFloors = await Floor.find({ orgId: garageHQ._id })
      .sort({ level: 1 })
      .lean();
    if (existingHQFloors.length === 0) {
      await Floor.insertMany([
        { orgId: garageHQ._id, level: 1, name: "Floor 1", departments: [] },
        { orgId: garageHQ._id, level: 2, name: "Floor 2", departments: [] },
      ]);
      console.log("✅ Created default floors for GARAGE HQ: Floor 1 & Floor 2");
    }

    // Check if founder user exists
    let founder = await User.findOne({ email: "shorupan@gmail.com" });

    if (!founder) {
      // Create founder user with affiliate ID
      const founderAffiliateId = await generateAffiliateId();
      founder = await User.create({
        email: "shorupan@gmail.com",
        name: "Shorupan",
        isVerified: true,
        affiliateId: founderAffiliateId, // Root affiliate ID for the system
        organizations: [
          {
            organization: garageHQ._id,
            role: "founder",
            joinedAt: new Date(),
          },
        ],
        // Legacy fields for backward compatibility
        organization: garageHQ._id,
        role: "founder",
      });
      console.log("✅ Created founder user (Shorupan) with affiliate ID:", founderAffiliateId);
    } else {
      // Ensure founder has affiliate ID
      if (!founder.affiliateId) {
        founder.affiliateId = await generateAffiliateId();
        await founder.save();
        console.log("✅ Generated affiliate ID for Shorupan:", founder.affiliateId);
      }

      // Ensure founder is a member of GARAGE HQ
      const existingMembership = founder.organizations?.find(
        (membership: any) =>
          membership.organization.toString() === garageHQ._id.toString()
      );

      if (!existingMembership) {
        founder.organizations = founder.organizations || [];
        founder.organizations.push({
          organization: garageHQ._id,
          role: "founder",
          joinedAt: new Date(),
        });
        await founder.save();
        console.log("✅ Added founder to GARAGE HQ organization");
      } else {
        console.log("✅ Founder already member of GARAGE HQ");
      }
    }

    // Ensure GARAGE HQ has a native store
    if (!garageHQ.store?.slug) {
      try {
        await createStoreForOrganization(garageHQ._id.toString());
        console.log("✅ Created native store for GARAGE HQ");
      } catch (storeError) {
        console.log("⚠️ Could not create store for GARAGE HQ:", storeError);
      }
    }

    // Initialize garage super admin
    await initializeGarageSuperAdmin();

    // Initialize office add-ons (white-label, etc.)
    await initializeOfficeAddons();

    return { garageHQ, founder };
  } catch (error) {
    console.error("❌ Error initializing GARAGE HQ:", error);
    throw error;
  }
}

/**
 * Add a user to GARAGE HQ as a stakeholder.
 * Called whenever a new user is created (regular signup, channel/workshop
 * checkout, guest auth, and — since the recent fix — enrolled downlines).
 *
 * @param userId  Mongo _id of the user to add.
 * @param opts.guest  When true, the HQ membership is stamped with
 *   `guest: true`. This is what the /downlines/enroll flow needs so an
 *   enrolled downline stays a guest across ALL their memberships (HQ +
 *   chosen office), matching what the enrollment route sets on the
 *   chosen-org membership. Without this flag they'd end up as a full
 *   stakeholder of Garage HQ with access to founder-only surfaces.
 *   Defaults to false to preserve the existing behavior for every other
 *   caller (regular signup produces non-guest stakeholders).
 */
/**
 * Join a new user to a SPECIFIC office, mirroring the Garage HQ onboarding.
 *
 * Used for white-label signups: someone registering on a client's domain
 * belongs in that client's office, not in Garage HQ. Same shape as
 * addUserToGarageHQ — guest stakeholder, first floor, default communities —
 * so a white-label member is set up exactly like a Garage one, just in the
 * right org.
 *
 * Never throws: signup must not fail because a floor or channel is missing.
 */
export async function addUserToOrg(
  userId: string,
  orgId: string,
  opts?: { guest?: boolean }
): Promise<boolean> {
  const guest = opts?.guest === true;
  try {
    const org = await Organization.findById(orgId);
    if (!org) {
      console.error("❌ Org not found, cannot add user:", orgId);
      return false;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error("❌ User not found:", userId);
      return false;
    }

    const already = user.organizations?.find(
      (mem: any) => mem.organization.toString() === org._id.toString()
    );
    if (already) return true;

    const firstFloor = await Floor.find({ orgId: org._id })
      .sort({ level: 1 })
      .limit(1)
      .lean();

    user.organizations = user.organizations || [];
    user.organizations.push({
      organization: org._id,
      role: "stakeholder",
      floorId: firstFloor[0]?._id,
      joinedAt: new Date(),
      ...(guest ? { guest: true } : {}),
    } as any);
    await user.save();
    console.log(
      `✅ Added user ${user.email} to ${org.name} as ${guest ? "guest stakeholder" : "stakeholder"}`
    );

    // That office's own communities — not Garage's. Joining Garage's here is
    // what made "Welcome To Garage" follow white-label signups around.
    try {
      await autoJoinMembersChannel(userId, org._id.toString());
      await autoJoinDefaultChannel(userId, org._id.toString());
      // Every community the founder marked mandatory. Self-contained and
      // never throws, so it cannot cost the user the joins above.
      await autoJoinMandatoryChannels(userId, org._id.toString());
    } catch (channelErr) {
      console.error("⚠️ Could not auto-join org channels:", channelErr);
    }
    return true;
  } catch (err) {
    console.error("❌ addUserToOrg failed:", err);
    return false;
  }
}

export async function addUserToGarageHQ(
  userId: string,
  opts?: { guest?: boolean }
) {
  const guest = opts?.guest === true;
  try {
    const garageHQ = await Organization.findOne({ parent: true });
    if (!garageHQ) {
      console.error("❌ GARAGE HQ not found, cannot add user");
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error("❌ User not found:", userId);
      return;
    }

    // Resolve default floor as the first (lowest level) floor
    const defaultHQFloor = await Floor.find({ orgId: garageHQ._id })
      .sort({ level: 1 })
      .limit(1)
      .lean();
    const defaultHQFloorId = defaultHQFloor[0]?._id;

    // Check if user is already a member of GARAGE HQ
    const existingMembership = user.organizations?.find(
      (membership: any) =>
        membership.organization.toString() === garageHQ._id.toString()
    );

    if (!existingMembership) {
      user.organizations = user.organizations || [];
      user.organizations.push({
        organization: garageHQ._id,
        role: "stakeholder",
        floorId: defaultHQFloorId, // assign first floor by default
        joinedAt: new Date(),
        ...(guest ? { guest: true } : {}),
      } as any);
      await user.save();
      console.log(
        `✅ Added user ${user.email} to GARAGE HQ as ${guest ? "guest stakeholder" : "stakeholder"}`
      );

      // Auto-subscribe to the default Members channel
      try {
        await autoJoinMembersChannel(userId, garageHQ._id.toString());
        await autoJoinDefaultChannel(userId, garageHQ._id.toString());
        await autoJoinMandatoryChannels(userId, garageHQ._id.toString());
      } catch (channelErr) {
        console.error("⚠️ Could not auto-join Members channel:", channelErr);
      }
    } else {
      // If membership exists but floor is missing or invalid (e.g., floors changed),
      // place them on the first available floor.
      if (defaultHQFloorId) {
        const floorsForHQ = await Floor.find({ orgId: garageHQ._id })
          .select("_id")
          .lean();
        const validFloorIds = new Set(
          floorsForHQ.map((f: any) => String(f._id))
        );
        const currentFloorId = existingMembership.floorId
          ? String(existingMembership.floorId)
          : null;
        if (!currentFloorId || !validFloorIds.has(currentFloorId)) {
          existingMembership.floorId = defaultHQFloorId;
          await user.save();
          console.log(
            `🔁 Updated ${user.email}'s HQ floor assignment to first floor`
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ Error adding user to GARAGE HQ:", error);
  }
}

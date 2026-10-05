import { GarageAdminModel } from "../models/garageAdmin.model";

export async function initializeGarageSuperAdmin() {
  try {
    const superAdminEmail = "shorupan@gmail.com";

    // Check if super admin already exists
    const existingSuperAdmin = await GarageAdminModel.findOne({
      email: superAdminEmail,
    });

    if (existingSuperAdmin) {
      console.log("✅ Garage Super Admin already exists:", superAdminEmail);
      return existingSuperAdmin;
    }

    // Create super admin
    const superAdmin = await GarageAdminModel.create({
      email: superAdminEmail,
      name: "Super Admin",
      role: "garage-super-admin",
      isActive: true,
    });

    console.log("✅ Garage Super Admin created successfully:", {
      id: superAdmin._id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: superAdmin.role,
    });

    return superAdmin;
  } catch (error) {
    console.error("❌ Error initializing Garage Super Admin:", error);
    throw error;
  }
}

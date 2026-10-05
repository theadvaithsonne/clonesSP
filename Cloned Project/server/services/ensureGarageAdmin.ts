import { GarageAdminModel } from "../models/garageAdmin.model";

export async function ensureGarageSuperAdmin() {
  try {
    const superAdminEmail = "shorupan@gmail.com";

    // Check if super admin already exists
    let existingSuperAdmin = await GarageAdminModel.findOne({
      email: superAdminEmail,
    });

    if (existingSuperAdmin) {
      console.log("✅ Garage Super Admin already exists:", {
        id: existingSuperAdmin._id,
        email: existingSuperAdmin.email,
        name: existingSuperAdmin.name,
        role: existingSuperAdmin.role,
        isActive: existingSuperAdmin.isActive,
      });
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
      isActive: superAdmin.isActive,
    });

    return superAdmin;
  } catch (error) {
    console.error("❌ Error ensuring Garage Super Admin:", error);
    throw error;
  }
}

import { Cabinet, File } from "../models/cabinet.model";
import {
  UserCabinet,
  UserFile,
  FloorCabinet,
  FloorFile,
} from "../models/cabinet.model";

/**
 * Migration script to clean up duplicate cabinets and separate user/floor data
 */
export async function migrateCabinetData() {
  try {
    console.log("Starting cabinet data migration...");

    // Step 1: Find all existing cabinets
    const allCabinets = await Cabinet.find({});
    console.log(`Found ${allCabinets.length} existing cabinets`);

    // Step 2: Group cabinets by owner and organization
    const cabinetGroups = allCabinets.reduce((acc: any, cabinet) => {
      const key = `${cabinet.owner}_${cabinet.organization}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(cabinet);
      return acc;
    }, {});

    let migratedCabinets = 0;
    let migratedFiles = 0;

    // Step 3: Process each group
    for (const [key, cabinets] of Object.entries(cabinetGroups)) {
      const [ownerId, orgId] = key.split("_");

      // Find default cabinets (name: "My Files")
      const defaultCabinets = (cabinets as any[]).filter(
        (c) => c.name === "My Files" && c.cabinetType === "user"
      );

      // Find other user cabinets
      const userCabinets = (cabinets as any[]).filter(
        (c) => c.cabinetType === "user" && c.name !== "My Files"
      );

      // Find floor cabinets
      const floorCabinets = (cabinets as any[]).filter(
        (c) => c.cabinetType === "floor"
      );

      // Step 4: Handle default cabinets - keep only one
      if (defaultCabinets.length > 0) {
        // Sort by creation date, keep the oldest
        defaultCabinets.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        const keepDefault = defaultCabinets[0];
        const deleteDefaults = defaultCabinets.slice(1);

        // Move files from duplicate default cabinets to the kept one
        for (const duplicateCabinet of deleteDefaults) {
          const files = await File.find({ cabinet: duplicateCabinet._id });
          for (const file of files) {
            await File.updateOne(
              { _id: file._id },
              { cabinet: keepDefault._id }
            );
          }

          // Delete duplicate cabinet
          await Cabinet.findByIdAndDelete(duplicateCabinet._id);
          console.log(
            `Deleted duplicate default cabinet: ${duplicateCabinet._id}`
          );
        }

        // Update the kept default cabinet
        await Cabinet.updateOne({ _id: keepDefault._id }, { isDefault: true });

        migratedCabinets += defaultCabinets.length;
      }

      // Step 5: Migrate user cabinets to UserCabinet collection
      for (const cabinet of userCabinets) {
        const existingUserCabinet = await UserCabinet.findOne({
          owner: cabinet.owner,
          organization: cabinet.organization,
          path: cabinet.path,
        });

        if (!existingUserCabinet) {
          const newUserCabinet = new UserCabinet({
            name: cabinet.name,
            description: cabinet.description,
            owner: cabinet.owner,
            organization: cabinet.organization,
            parentCabinet: cabinet.parentCabinet,
            path: cabinet.path,
            isRoot: cabinet.isRoot,
            isDefault: cabinet.name === "My Files",
            permissions: cabinet.permissions || {},
            metadata: cabinet.metadata || {},
            createdAt: cabinet.createdAt,
            updatedAt: cabinet.updatedAt,
          });

          await newUserCabinet.save();

          // Migrate files
          const files = await File.find({ cabinet: cabinet._id });
          for (const file of files) {
            const newUserFile = new UserFile({
              name: file.name,
              originalName: file.originalName,
              description: file.description,
              owner: file.owner,
              organization: file.organization,
              cabinet: newUserCabinet._id,
              s3Key: file.s3Key,
              s3Bucket: file.s3Bucket,
              s3Region: file.s3Region,
              mimeType: file.mimeType,
              size: file.size,
              extension: file.extension,
              path: file.path,
              isPublic: file.isPublic || false,
              permissions: file.permissions || {},
              tags: file.tags || [],
              metadata: file.metadata || {},
              status: file.status || "uploaded",
              version: file.version || 1,
              parentFile: file.parentFile,
              createdAt: file.createdAt,
              updatedAt: file.updatedAt,
            });

            await newUserFile.save();
            migratedFiles++;
          }

          console.log(`Migrated user cabinet: ${cabinet.name}`);
        }
      }

      // Step 6: Migrate floor cabinets to FloorCabinet collection
      for (const cabinet of floorCabinets) {
        const existingFloorCabinet = await FloorCabinet.findOne({
          floorId: cabinet.floorId,
          organization: cabinet.organization,
        });

        if (!existingFloorCabinet) {
          const newFloorCabinet = new FloorCabinet({
            name: cabinet.name,
            description: cabinet.description,
            owner: cabinet.owner,
            organization: cabinet.organization,
            floorId: cabinet.floorId,
            parentCabinet: cabinet.parentCabinet,
            path: cabinet.path,
            isRoot: cabinet.isRoot,
            permissions: cabinet.permissions || {},
            metadata: cabinet.metadata || {},
            createdAt: cabinet.createdAt,
            updatedAt: cabinet.updatedAt,
          });

          await newFloorCabinet.save();

          // Migrate floor files
          const files = await File.find({ cabinet: cabinet._id });
          for (const file of files) {
            const newFloorFile = new FloorFile({
              name: file.name,
              originalName: file.originalName,
              description: file.description,
              owner: file.owner,
              organization: file.organization,
              cabinet: newFloorCabinet._id,
              floorId: cabinet.floorId,
              s3Key: file.s3Key,
              s3Bucket: file.s3Bucket,
              s3Region: file.s3Region,
              mimeType: file.mimeType,
              size: file.size,
              extension: file.extension,
              path: file.path,
              isPublic: file.isPublic || false,
              permissions: file.permissions || {},
              tags: file.tags || [],
              metadata: file.metadata || {},
              status: file.status || "uploaded",
              version: file.version || 1,
              parentFile: file.parentFile,
              createdAt: file.createdAt,
              updatedAt: file.updatedAt,
            });

            await newFloorFile.save();
            migratedFiles++;
          }

          console.log(`Migrated floor cabinet: ${cabinet.name}`);
        }
      }
    }

    console.log(`Migration completed:`);
    console.log(`- Migrated ${migratedCabinets} cabinets`);
    console.log(`- Migrated ${migratedFiles} files`);

    return {
      success: true,
      migratedCabinets,
      migratedFiles,
    };
  } catch (error) {
    console.error("Migration failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateCabinetData()
    .then((result) => {
      console.log("Migration result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Migration error:", error);
      process.exit(1);
    });
}

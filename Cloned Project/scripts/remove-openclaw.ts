import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const OPENCLAW_USER_ID = "699547cf3638d85bf2a7e05b";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Connected to MongoDB");

  // Delete from users collection
  const result = await mongoose.connection.collection("users").deleteOne({
    _id: new mongoose.Types.ObjectId(OPENCLAW_USER_ID),
  });
  console.log("Deleted users:", result.deletedCount);

  // Remove from all org memberships
  const orgResult = await (mongoose.connection.collection("organizations") as any).updateMany(
    {},
    { $pull: { members: { userId: new mongoose.Types.ObjectId(OPENCLAW_USER_ID) } } }
  );
  console.log("Orgs updated:", orgResult.modifiedCount);

  // Remove from all groups
  const groupResult = await (mongoose.connection.collection("groups") as any).updateMany(
    {},
    { $pull: { members: { userId: new mongoose.Types.ObjectId(OPENCLAW_USER_ID) } } }
  );
  console.log("Groups updated:", groupResult.modifiedCount);

  console.log("Done. openclaw@yopmail.com user removed.");
  await mongoose.disconnect();
}

run().catch(console.error);

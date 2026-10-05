/**
 * Adds bat test user 10 → bat test user 19 to the Garage database and
 * enrolls them in the bat246 organisation.
 *
 * Run:  npx ts-node src/bat246/scripts/addTestUsers10to19.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../../models/user.model";
import { setSignupOffersEnabled } from "../../services/signupOffer";

// Bulk test-user creation must not fire the sign-up offer email per user.
setSignupOffersEnabled(false);
import { Product } from "../../models/product.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

const TEST_USERS = Array.from({ length: 10 }, (_, i) => {
  const n = i + 10; // 10 → 19
  return {
    name:  `bat test user ${n}`,
    email: `battestuser${n}@yopmail.com`,
  };
});

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Resolve the bat246 organisation from the entry product
  const entryProduct = await Product.findOne({ tags: "bat246_entry" })
    .select("organizationId name").lean() as any;
  if (!entryProduct?.organizationId) {
    console.error("No product with tag 'bat246_entry' found — run seedBat246Product.ts first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const orgId = entryProduct.organizationId;
  console.log(`bat246 org: ${orgId}  (product: ${entryProduct.name})\n`);

  let created  = 0;
  let existing = 0;

  for (const { name, email } of TEST_USERS) {
    let user = await User.findOne({ email }).lean() as any;

    if (user) {
      console.log(`  SKIP create — ${email} already exists`);
      existing++;
    } else {
      user = await User.create({
        name,
        email,
        role: "user",
        isVerified: true,
        organizations: [{ organization: orgId, role: "stakeholder" }],
      });
      console.log(`  CREATED — ${email}`);
      created++;
      continue; // org already added in create
    }

    // Existing user — ensure they are in the bat246 org
    const alreadyMember = (user.organizations ?? []).some(
      (o: any) => o.organization?.toString() === orgId.toString()
    );
    if (!alreadyMember) {
      await User.updateOne(
        { _id: user._id },
        { $addToSet: { organizations: { organization: orgId, role: "stakeholder" } } }
      );
      console.log(`  ADDED TO ORG — ${email}`);
    } else {
      console.log(`  ALREADY IN ORG — ${email}`);
    }
  }

  console.log(`\nDone. Created: ${created}  Already existed: ${existing}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

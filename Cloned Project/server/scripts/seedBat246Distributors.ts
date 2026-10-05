/**
 * Seeds 7 demo BAT246 qualified distributors (Bat246-1 through Bat246-7).
 * Run: npx tsx src/scripts/seedBat246Distributors.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../models/user.model";
import { setSignupOffersEnabled } from "../services/signupOffer";

// Seeding creates real User docs, which would otherwise each fire a
// NetworkChain offer email off the post-save hook.
setSignupOffersEnabled(false);
import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import { Bat246Player } from "../bat246/models/bat246Player.model";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/garage";

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB\n");

  for (let i = 1; i <= 7; i++) {
    const name  = `Bat246-${i}`;
    const email = `bat246-${i}@demo.com`;

    // Upsert user
    let user = await User.findOne({ email }).lean() as any;
    if (!user) {
      user = await User.create({
        name,
        email,
        password: "$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0YUF1QkQkiW", // "Demo@1234"
        isVerified: true,
        role: "user",
      });
      console.log(`Created user: ${email}`);
    } else {
      console.log(`User exists: ${email}`);
    }

    const userId = user._id ?? user.id;

    // Upsert bat246 player
    let player = await Bat246Player.findOne({ userId });
    if (!player) {
      const count = await Bat246Player.countDocuments();
      player = await Bat246Player.create({
        userId,
        playerIdNo: `${3000 + count}HI`,
        nickname: name,
        email,
        memberSince: new Date(),
      });
      console.log(`Created player: ${name}`);
    }

    // Upsert distributor as fully qualified
    await Bat246Distributor.updateOne(
      { userId },
      {
        $set: {
          userId,
          playerId: player._id,
          isGarageAffiliate: true,
          isOfficeMember: true,
          hasBat246Membership: true,
          hasPurchasedProduct: true,
          isQualified: true,
          qualifiedAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`Qualified distributor: ${name} (${email})`);
  }

  console.log("\nDone — 7 demo distributors seeded.");
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });

# Database Migrations Guide

This document lists all migration scripts that need to be run when setting up a new environment or switching branches.

## Prerequisites

```bash
cd roam-backend
npm install
```

Ensure your `.env` file has the correct `MONGODB_URI` for the target database.

---

## Migration Scripts (Run in Order)

### 1. Affiliate System Migration

**Script:** `src/scripts/migrate-affiliate.ts`

This is the main migration script that handles:
- Generates `affiliateId` for all users
- Sets `referredBy` for founders (→ shorupan@gmail.com)
- Sets `referredBy` for stakeholders (→ their org's founder)
- Creates stores for all organizations (with unique slugs)
- Creates default channels (Employees, Customers) for each store
- Creates channel memberships for existing stakeholders

```bash
npx ts-node src/scripts/migrate-affiliate.ts
```

**Expected Output:**
```
✅ Generated X affiliate IDs
✅ Set referredBy for X founders
✅ Set referredBy for X stakeholders
✅ Created X stores
✅ Created X channels
✅ Created X channel memberships
```

---

### 2. Convert referredBy to ObjectId

**Purpose:** Converts `referredBy` field from affiliateId string to User ObjectId reference.

This was a schema change made after the initial affiliate migration.

```bash
npx ts-node src/scripts/migrate-referredby-objectid.ts
```

Or run inline:

```bash
npx ts-node -e '
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const db = mongoose.connection.db;

  // Find users with string referredBy (old format)
  const users = await db?.collection("users").find({
    referredBy: { $type: "string" }
  }).toArray();

  console.log("Users to migrate:", users?.length || 0);

  for (const user of users || []) {
    const referrerAffiliateId = user.referredBy;
    const referrer = await db?.collection("users").findOne({ affiliateId: referrerAffiliateId });

    if (referrer) {
      await db?.collection("users").updateOne(
        { _id: user._id },
        { $set: { referredBy: referrer._id } }
      );
      console.log("Migrated:", user.email, "->", referrer.email);
    }
  }

  await mongoose.disconnect();
  console.log("Done!");
}
migrate();
'
```

---

### 3. Wallet Migration

**Script:** `src/scripts/migrate-wallets.ts`

Creates wallets for all existing users:
- Creates **affiliate wallet** for each user (balance: 0, currency: INR)
- Creates **store wallet** for each user-organization membership (balance: 0, currency: INR)

```bash
npx ts-node src/scripts/migrate-wallets.ts
```

**Expected Output:**
```
🚀 Starting wallet migration...

✅ Connected to database

Found X users to process

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processing users...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ Created affiliate wallet for user@example.com
  ✅ Created store wallet for user@example.com in org 68e36741...
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 MIGRATION COMPLETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  - Users processed: X
  - Affiliate wallets created: X
  - Store wallets created: X
  - Errors: 0
```

**New Collections Created:**
- `storewallets` - One per user per organization
- `affiliatewallets` - One per user (global)
- `wallettransactions` - Transaction history

---

### 4. Remove Legacy EarnGPT Data

**Script:** `src/scripts/migrate-remove-earngpt.ts`

Removes all legacy EarnGPT third-party integration data that has been replaced by the native affiliate system:
- Removes `earnGPT` field from users
- Removes `earngpt_employee` field from users
- Removes `referralCode` field from users (replaced by `referredBy` ObjectId)
- Removes `earngpt_data` field from organizations

```bash
npx ts-node src/scripts/migrate-remove-earngpt.ts
```

**Expected Output:**
```
🚀 Starting EarnGPT data removal migration...

✅ Connected to database

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Removing EarnGPT fields from users...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Found X users with EarnGPT data

  ✅ Removed EarnGPT fields from X users

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: Removing earngpt_data from organizations...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Found X organizations with earngpt_data

  ✅ Removed earngpt_data from X organizations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 EARNGPT REMOVAL MIGRATION COMPLETED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Quick Migration Checklist

Run these commands in order on a fresh database:

```bash
# 1. Main affiliate migration
npx ts-node src/scripts/migrate-affiliate.ts

# 2. Convert referredBy to ObjectId
npx ts-node src/scripts/migrate-referredby-objectid.ts

# 3. Wallet migration (after wallet system is implemented)
npx ts-node src/scripts/migrate-wallets.ts

# 4. Remove legacy EarnGPT data
npx ts-node src/scripts/migrate-remove-earngpt.ts
```

---

## Verification

After running migrations, verify the data:

```bash
npx ts-node -e '
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const db = mongoose.connection.db;

  // Check users
  const totalUsers = await db?.collection("users").countDocuments();
  const usersWithAffiliateId = await db?.collection("users").countDocuments({ affiliateId: { $exists: true, $ne: null } });
  const usersWithReferredBy = await db?.collection("users").countDocuments({ referredBy: { $exists: true, $ne: null } });

  // Check orgs
  const totalOrgs = await db?.collection("organizations").countDocuments();
  const orgsWithStore = await db?.collection("organizations").countDocuments({ "store.slug": { $exists: true } });

  // Check channels
  const totalChannels = await db?.collection("channels").countDocuments();

  console.log("=== Migration Verification ===");
  console.log("Users:", totalUsers);
  console.log("  - With affiliateId:", usersWithAffiliateId);
  console.log("  - With referredBy:", usersWithReferredBy);
  console.log("Organizations:", totalOrgs);
  console.log("  - With store:", orgsWithStore);
  console.log("Channels:", totalChannels);

  await mongoose.disconnect();
}
verify();
'
```

---

## Rollback

If you need to rollback the affiliate migration:

```bash
npx ts-node src/scripts/rollback-affiliate.ts
```

**Warning:** This will remove all affiliate data. Use with caution.

---

## Notes

- Always backup your database before running migrations
- Migrations are idempotent - safe to run multiple times
- Check the console output for any errors or warnings
- The `GARAGE HQ` organization (parent: true) is created by the server on startup via `initializeGarageHQ()`

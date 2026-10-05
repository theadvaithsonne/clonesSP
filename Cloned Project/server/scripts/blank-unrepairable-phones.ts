/**
 * Clears phone numbers that cannot be repaired, so the user is asked again.
 *
 * These are values with a country code that libphonenumber rejects and for
 * which no mechanical reconstruction exists — digits are genuinely missing
 * ("+912958245" is nine digits where India needs ten), or the value would
 * repair onto a number another account already holds.
 *
 * Blanking rather than guessing is the point: a wrong-but-plausible number
 * routes an OTP to a stranger. An empty field prompts the real owner.
 *
 * `phoneVerified` is cleared alongside — a verified flag with no number
 * behind it makes every downstream "has this user verified?" check lie.
 *
 *   npx tsx src/scripts/blank-unrepairable-phones.ts [--apply]
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import fs from "fs";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { User } = await import("../models/user.model");
  console.log(APPLY ? "=== APPLY ===\n" : "=== DRY RUN — pass --apply to write ===\n");

  const users: any[] = await User.find({ phone: { $nin: ["", null] } })
    .select("email name phone phoneVerified").lean();

  const bad = users.filter((u) => {
    const p = parsePhoneNumberFromString(String(u.phone).trim());
    return !p || !p.isValid();
  });

  console.log(`unrepairable numbers to blank: ${bad.length}\n`);
  for (const u of bad)
    console.log(`   ${String(u.phone).padEnd(18)} ${String(u.email).padEnd(38)}${u.phoneVerified ? " [was marked verified]" : ""}`);

  if (!APPLY) { console.log("\nNothing written."); await mongoose.disconnect(); return; }

  const log: any[] = [];
  for (const u of bad) {
    await User.updateOne({ _id: u._id }, { $unset: { phone: "" }, $set: { phoneVerified: false } });
    log.push({ userId: String(u._id), email: u.email, blankedPhone: String(u.phone),
      wasVerified: !!u.phoneVerified, at: new Date().toISOString() });
  }
  fs.writeFileSync("phone-blank-log.json", JSON.stringify(log, null, 2));
  console.log(`\nBlanked ${log.length} numbers. Reversal log: phone-blank-log.json`);
  await mongoose.disconnect();
})();

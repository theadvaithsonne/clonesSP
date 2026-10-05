/**
 * Stamps +91 onto phone numbers stored without a country code.
 *
 * 349 accounts hold a bare number ("7416708117"). services/twoFactorSms.ts
 * already assumes +91 for these at SEND time; this makes that assumption
 * explicit in the data so `phone` can carry a unique index.
 *
 * ── This is a decision, not a derivation ─────────────────────────────────
 * 187 of these are syntactically valid as BOTH +91 and +1. We are choosing
 * India because that is where the user base is, NOT because the data says so.
 * The reversal log records every original value, and any user whose number is
 * actually foreign will correct it the next time they verify.
 *
 * Only writes when "+91<digits>" is a VALID Indian number — a bare value that
 * is not a real Indian number is left for the blanking pass rather than being
 * turned into a plausible-looking wrong one.
 *
 * Does NOT touch phoneVerified: guessing a country code verifies nothing.
 *
 *   npx tsx src/scripts/normalize-bare-phones.ts [--apply]
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
    .select("email phone phoneVerified createdAt").lean();

  // Numbers already stated with a country code — the collision surface.
  const held = new Map<string, any>();
  for (const u of users) {
    const raw = String(u.phone).trim();
    if (!raw.startsWith("+")) continue;
    const p = parsePhoneNumberFromString(raw);
    if (p?.isValid()) held.set(p.number, u);
  }

  const bare = users.filter((u) => !String(u.phone).trim().startsWith("+"));
  const write: any[] = [], invalid: any[] = [], collide: any[] = [];

  for (const u of bare) {
    const d = String(u.phone).replace(/\D/g, "");
    // A bare 12-digit value beginning 91 already carries the code, unprefixed.
    const candidate = d.length === 12 && d.startsWith("91") ? `+${d}` : `+91${d}`;
    const p = parsePhoneNumberFromString(candidate);
    if (!p?.isValid()) { invalid.push({ u, d, candidate }); continue; }
    const clash = held.get(p.number);
    // Record the clash but STILL write: the dedupe pass that runs next needs
    // both accounts to hold the same value in order to resolve them by age.
    if (clash && String(clash._id) !== String(u._id)) collide.push({ u, to: p.number, with: clash });
    write.push({ u, from: String(u.phone), to: p.number });
  }

  console.log(`bare numbers: ${bare.length}`);
  console.log(`  will be stamped +91          : ${write.length}`);
  console.log(`  not valid as Indian, skipped : ${invalid.length}`);
  for (const i of invalid) console.log(`      ${String(i.u.phone).padEnd(16)} (${i.d.length} digits)  ${i.u.email}`);
  console.log(`\n  of the stamped, NEWLY colliding with a stated +CC number: ${collide.length}`);
  for (const c of collide)
    console.log(`      ${c.to}  ${c.u.email} (bare)  vs  ${c.with.email} (${c.with.phoneVerified ? "VERIFIED" : "unverified"})`);
  console.log(`\n  -> run dedupe-shared-phones.ts next to resolve those`);

  if (!APPLY) { console.log("\nNothing written."); await mongoose.disconnect(); return; }

  const log: any[] = [];
  for (const w of write) {
    await User.updateOne({ _id: w.u._id }, { $set: { phone: w.to } });
    log.push({ userId: String(w.u._id), email: w.u.email, from: w.from, to: w.to, countryAssumed: "IN", at: new Date().toISOString() });
  }
  fs.writeFileSync("phone-normalize-log.json", JSON.stringify(log, null, 2));
  console.log(`\nStamped ${log.length} numbers with +91. Reversal log: phone-normalize-log.json`);
  await mongoose.disconnect();
})();

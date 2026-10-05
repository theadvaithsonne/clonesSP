/**
 * Rewrites every stored phone to strict E.164 — "+917416708117", never
 * "+91 7416708117".
 *
 * The earlier cleanup validated numbers but did not canonicalise their
 * FORMAT, because libphonenumber happily calls "+91 7416708117" valid. That
 * is fine for display and for SMS delivery, and fatal for identity:
 *
 *   - `User.findOne({ phone })` is an exact string match. A user typing their
 *     number logs in against the canonical form, which never equals a stored
 *     value containing a space, so login-by-phone silently fails for them.
 *   - The unique index compares strings too, so "+91 7416708117" and
 *     "+917416708117" are two different keys and both can exist.
 *
 * Refuses to run if canonicalising would collide two accounts onto one number.
 *
 *   npx tsx src/scripts/canonicalize-phone-format.ts [--apply]
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import fs from "fs";
import os from "os";
import path from "path";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { User } = await import("../models/user.model");
  console.log(APPLY ? "=== APPLY ===\n" : "=== DRY RUN — pass --apply to write ===\n");

  const users: any[] = await User.find({ phone: { $nin: ["", null] } })
    .select("email phone")
    .lean();

  const changes: any[] = [];
  const invalid: any[] = [];
  const canon = new Map<string, string[]>();

  for (const u of users) {
    const raw = String(u.phone).trim();
    const p = parsePhoneNumberFromString(raw);
    if (!p?.isValid()) {
      invalid.push(u);
      continue;
    }
    if (!canon.has(p.number)) canon.set(p.number, []);
    canon.get(p.number)!.push(u.email || String(u._id));
    if (p.number !== raw) {
      changes.push({ userId: String(u._id), email: u.email, from: raw, to: p.number });
    }
  }

  const clash = [...canon.entries()].filter(([, a]) => a.length > 1);
  console.log(`users with a phone      : ${users.length}`);
  console.log(`already canonical       : ${users.length - changes.length - invalid.length}`);
  console.log(`to rewrite              : ${changes.length}`);
  console.log(`invalid (left alone)    : ${invalid.length}`);
  for (const c of changes.slice(0, 12))
    console.log(`   "${c.from}" -> "${c.to}"   ${c.email}`);
  if (changes.length > 12) console.log(`   … ${changes.length - 12} more`);

  if (clash.length) {
    console.log(`\nABORT — canonicalising would put these numbers on 2+ accounts:`);
    for (const [n, a] of clash) console.log(`   ${n}: ${a.join(", ")}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\nNothing written.");
    await mongoose.disconnect();
    return;
  }

  for (const c of changes) {
    await User.updateOne({ _id: c.userId }, { $set: { phone: c.to } });
  }

  // Outside the repo: these rows carry live user PII (emails + numbers) and a
  // previous run of a sibling script leaked exactly that into a commit.
  const logPath = path.join(os.tmpdir(), `phone-canonicalize-${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(changes, null, 2));
  console.log(`\nRewrote ${changes.length} numbers. Reversal log: ${logPath}`);
  await mongoose.disconnect();
})();

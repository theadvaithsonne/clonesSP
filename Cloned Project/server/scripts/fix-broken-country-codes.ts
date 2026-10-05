/**
 * Repairs phone numbers whose COUNTRY CODE is corrupted.
 *
 * The damage this fixes comes from the country picker prepending a dial code
 * onto a number that already carried one:
 *     "+91+12048812505"     picker added +91 to a typed +1 number
 *     "+34 34642227423"     ES code doubled
 *     "+91917349143724"     +91 in front of 91…
 *     "+91 09890952662"     national trunk 0 left in after the code
 *
 * ── The safety rule ──────────────────────────────────────────────────────
 * For each broken value we build every plausible reconstruction and validate
 * each with libphonenumber. A row is repaired ONLY when exactly ONE candidate
 * is valid. Two valid candidates means we would be guessing which country the
 * person is in — that is how you silently move someone's account to another
 * country — so those are reported for a human instead.
 *
 * A repair is also refused if the result collides with a number already held
 * by a different account: this migration exists to make phone unique, and a
 * "fix" that creates a duplicate defeats it.
 *
 * Dry run by default. Pass --apply to write. Every change is logged with the
 * before value so it can be reversed from the console output.
 *
 *   npx tsx src/scripts/fix-broken-country-codes.ts
 *   npx tsx src/scripts/fix-broken-country-codes.ts --apply
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import fs from "fs";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const APPLY = process.argv.includes("--apply");

/** Every dial code we actually have users on, longest first so +91 beats +9. */
const DIAL_CODES = [
  "1","7","20","27","30","31","33","34","39","40","41","44","49","52","55","60","61","62","63",
  "64","65","66","81","82","84","86","90","91","92","94","95","98","212","213","216","234","251",
  "254","255","256","260","263","353","358","507","880","886","960","961","962","965","966","968",
  "971","972","973","974","977","994","998",
].sort((a, b) => b.length - a.length);

const valid = (s: string) => {
  const p = parsePhoneNumberFromString(s);
  return p && p.isValid() ? p.number : null;
};

/**
 * Reconstructions of a mangled value, restricted to corruptions we can PROVE.
 *
 * An earlier, more generous version also tried "maybe the remainder is itself
 * a complete international number". That reads "+91449021170043" as a valid
 * GB number and, being the only candidate produced, promotes a coincidence to
 * a certainty — it would have moved an Indian user to the United Kingdom.
 * Three of twenty-nine proposed fixes were wrong that way.
 *
 * So only mechanical, self-evidencing damage is repaired here:
 *   - a dial code that appears twice in a row
 *   - a picker's code prefixed onto a number that already had a "+"
 *   - a national trunk "0" left between the code and the subscriber number
 * Anything else is reported for a human. Under-repairing is recoverable;
 * silently relocating someone's phone number is not.
 */
function candidates(raw: string): Set<string> {
  const out = new Set<string>();
  const add = (s: string | null) => { if (s) out.add(s); };
  const t = String(raw || "").trim();

  // The picker prefixed its code onto a number the user had already typed
  // with its own "+". The segment after the LAST "+" is what they entered.
  if ((t.match(/\+/g) || []).length > 1) {
    const lastPlus = t.lastIndexOf("+");
    add(valid("+" + t.slice(lastPlus + 1).replace(/\D/g, "")));
  }

  const digits = t.replace(/\D/g, "");
  if (!digits) return out;

  for (const cc of DIAL_CODES) {
    if (!digits.startsWith(cc)) continue;
    const rest = digits.slice(cc.length);
    // Dial code written twice: "+254 254710896129" -> "+254710896129".
    if (rest.startsWith(cc)) add(valid("+" + cc + rest.slice(cc.length)));
    // Trunk prefix retained: "+91 09890952662" -> "+919890952662".
    if (rest.startsWith("0")) add(valid("+" + cc + rest.replace(/^0+/, "")));
  }
  return out;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { User } = await import("../models/user.model");
  console.log(APPLY ? "=== APPLY — writing ===\n" : "=== DRY RUN — pass --apply to write ===\n");

  const users: any[] = await User.find({ phone: { $nin: ["", null] } })
    .select("email name phone phoneVerified").lean();

  // Numbers already held by exactly one account, so a repair can't collide.
  const taken = new Map<string, string>();
  for (const u of users) {
    const p = parsePhoneNumberFromString(String(u.phone).trim());
    if (p?.isValid()) taken.set(p.number, String(u._id));
  }

  const broken = users.filter((u) => {
    const raw = String(u.phone).trim();
    if (!raw.startsWith("+")) return false;      // no country code = a different list
    const p = parsePhoneNumberFromString(raw);
    return !p || !p.isValid();
  });

  const fix: any[] = [], ambiguous: any[] = [], collide: any[] = [], hopeless: any[] = [];
  for (const u of broken) {
    const raw = String(u.phone).trim();
    const c = [...candidates(raw)];
    if (c.length === 0) { hopeless.push({ u, raw }); continue; }
    if (c.length > 1) { ambiguous.push({ u, raw, c }); continue; }
    const owner = taken.get(c[0]);
    if (owner && owner !== String(u._id)) { collide.push({ u, raw, to: c[0], owner }); continue; }
    fix.push({ u, raw, to: c[0], country: parsePhoneNumberFromString(c[0])!.country });
  }

  console.log(`broken country codes found: ${broken.length}\n`);
  console.log(`SAFE TO FIX (exactly one valid reconstruction): ${fix.length}`);
  for (const f of fix)
    console.log(`   ${f.raw.padEnd(22)} -> ${f.to.padEnd(16)} [${f.country}]  ${f.u.email}`);

  console.log(`\nAMBIGUOUS — more than one country would be valid, NOT touched: ${ambiguous.length}`);
  for (const a of ambiguous)
    console.log(`   ${a.raw.padEnd(22)} -> ${a.c.join(" OR ")}   ${a.u.email}`);

  console.log(`\nWOULD COLLIDE with another account's number, NOT touched: ${collide.length}`);
  for (const c of collide)
    console.log(`   ${c.raw.padEnd(22)} -> ${c.to} already on ${c.owner}   ${c.u.email}`);

  console.log(`\nUNREPAIRABLE — no valid reading exists (digits missing), NOT touched: ${hopeless.length}`);
  for (const h of hopeless)
    console.log(`   ${h.raw.padEnd(22)} ${h.u.email}${h.u.phoneVerified ? "  [was marked verified]" : ""}`);

  // Two broken values can repair to the SAME number — the `taken` map is built
  // from pre-existing valid numbers and cannot see that. Catch it here rather
  // than creating the duplicate this whole migration exists to remove.
  const seen = new Map<string, any>();
  const clash: any[] = [];
  for (const f of [...fix]) {
    const prev = seen.get(f.to);
    if (prev) {
      clash.push([prev, f]);
      const i = fix.indexOf(f); if (i > -1) fix.splice(i, 1);
    } else seen.set(f.to, f);
  }
  if (clash.length) {
    console.log(`\nTWO BROKEN NUMBERS REPAIR TO THE SAME VALUE — later one skipped: ${clash.length}`);
    for (const [a, b] of clash)
      console.log(`   ${a.to}  <-  "${a.raw}" (${a.u.email})  AND  "${b.raw}" (${b.u.email})`);
  }

  if (!APPLY) { console.log("\nNothing written."); await mongoose.disconnect(); return; }

  const log: any[] = [];
  for (const f of fix) {
    await User.updateOne({ _id: f.u._id }, { $set: { phone: f.to } });
    log.push({ userId: String(f.u._id), email: f.u.email, from: f.raw, to: f.to, at: new Date().toISOString() });
  }
  fs.writeFileSync("phone-cc-repair-log.json", JSON.stringify(log, null, 2));
  console.log(`\nRepaired ${fix.length} numbers. Reversal log: phone-cc-repair-log.json`);
  await mongoose.disconnect();
})();

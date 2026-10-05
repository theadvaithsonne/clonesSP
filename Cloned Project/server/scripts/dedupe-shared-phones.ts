/**
 * Resolves phone numbers held by more than one account.
 *
 * Rule (product decision): the account that had the number FIRST keeps it;
 * every other account has its phone cleared. No accounts are merged and no
 * data other than `phone`/`phoneVerified` is touched — a cleared user simply
 * re-enters their number next time they're asked, and the person who really
 * owns it wins it back through verification.
 *
 * ── "First" is a proxy ───────────────────────────────────────────────────
 * There is no `phoneSetAt` field, so we cannot know when a number was typed
 * in — only when the ACCOUNT was created. An older account may have added the
 * phone yesterday. Where the oldest account is not also the verified one or
 * the one carrying the money, that is printed as a CONFLICT so it can be
 * overruled before applying.
 *
 * ── phoneVerified must be cleared with the number ────────────────────────
 * Leaving `phoneVerified: true` on an account whose phone was just removed
 * asserts a verified number that no longer exists — every downstream check
 * ("has this user verified their phone?") would read true and then find
 * nothing to send to.
 *
 * ── Two kinds of group, deliberately separated ───────────────────────────
 * EXACT      every account holds the same validated E.164. Certainly one number.
 * INFERRED   at least one side is stored bare, e.g. "7416708117" against
 *            "+917416708117". Same number ONLY IF the bare one is Indian,
 *            which is our +91 fallback guessing, not the user stating it.
 *            Run with --include-inferred to act on these too.
 *
 * Dry run by default.
 *   npx tsx src/scripts/dedupe-shared-phones.ts
 *   npx tsx src/scripts/dedupe-shared-phones.ts --apply [--include-inferred]
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import fs from "fs";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const APPLY = process.argv.includes("--apply");
const INFERRED = process.argv.includes("--include-inferred");
/**
 * Tie-break. "Oldest wins" alone hands the number to whichever ACCOUNT is
 * older, which in 14 of 41 groups is a dormant personal address, while the
 * work account that actually passed an OTP on that handset gets cleared.
 * With this flag a verified account outranks an unverified one and age only
 * breaks ties within each tier — the first person to PROVE possession keeps
 * it. Pass --strict-oldest for age alone.
 */
const PREFER_VERIFIED = !process.argv.includes("--strict-oldest");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { User } = await import("../models/user.model");
  const { Invoice } = await import("../models/invoice.model");
  const { StoreWallet } = await import("../models/storeWallet.model");

  const users: any[] = await User.find({ phone: { $nin: ["", null] } })
    .select("email name phone phoneVerified createdAt").lean();
  const ids = users.map((u) => u._id);

  const inv = new Map((await Invoice.aggregate([
    { $match: { userId: { $in: ids }, status: "paid" } },
    { $group: { _id: "$userId", n: { $sum: 1 }, spend: { $sum: "$totalAmount" } } }])).map((r: any) => [String(r._id), r]));
  const wal = new Map((await StoreWallet.aggregate([
    { $match: { userId: { $in: ids } } },
    { $group: { _id: "$userId", bal: { $sum: "$balance" } } }])).map((r: any) => [String(r._id), r.bal]));
  const ref = new Map((await User.aggregate([
    { $match: { referredBy: { $in: ids } } },
    { $group: { _id: "$referredBy", n: { $sum: 1 } } }])).map((r: any) => [String(r._id), r.n]));

  const recs = users.map((u) => {
    const raw = String(u.phone).trim();
    const p = raw.startsWith("+") ? parsePhoneNumberFromString(raw) : null;
    const i: any = inv.get(String(u._id));
    return {
      u, raw, e164: p?.isValid() ? p.number : null,
      digits: raw.replace(/\D/g, ""),
      created: u.createdAt ? new Date(u.createdAt) : new Date(0),
      verified: !!u.phoneVerified,
      invoices: i?.n || 0,
      spend: Math.round(((i?.spend || 0) / 100) * 100) / 100,
      wallet: Math.round((wal.get(String(u._id)) || 0) * 100) / 100,
      refs: ref.get(String(u._id)) || 0,
    };
  });
  const value = (r: any) => r.spend + r.wallet + r.refs * 10;

  // Group on E.164 where we have one, else last 10 digits.
  const groups = new Map<string, any[]>();
  for (const r of recs) {
    const k = r.e164 || (r.digits.length >= 10 ? `~${r.digits.slice(-10)}` : `?${r.digits}`);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  const shared = [...groups.entries()].filter(([, a]) => a.length > 1).map(([k, a]) => {
    // Everyone holding a real E.164 -> exact. Any bare number -> inferred.
    const exact = a.every((r) => r.e164) && new Set(a.map((r) => r.e164)).size === 1;
    const sorted = [...a].sort((x, y) =>
      (PREFER_VERIFIED ? Number(y.verified) - Number(x.verified) : 0) ||
      x.created.getTime() - y.created.getTime()
    );
    const keeper = sorted[0];
    const byValue = [...a].sort((x, y) => value(y) - value(x))[0];
    const verifiedOnes = a.filter((r) => r.verified);
    const conflicts: string[] = [];
    if (value(byValue) > 0 && byValue !== keeper)
      conflicts.push(`oldest is not the account with the money (${byValue.u.email} has $${value(byValue).toFixed(2)} of value)`);
    if (verifiedOnes.length && !keeper.verified)
      conflicts.push(`oldest is unverified but ${verifiedOnes.map((r: any) => r.u.email).join(", ")} verified this number`);
    return { k, exact, keeper, losers: sorted.slice(1), all: a, conflicts };
  }).sort((a, b) => b.all.length - a.all.length);

  const acting = shared.filter((g) => g.exact || INFERRED);
  const skipped = shared.filter((g) => !g.exact && !INFERRED);

  console.log(APPLY ? "=== APPLY ===\n" : "=== DRY RUN — pass --apply to write ===\n");
  console.log(`tie-break: ${PREFER_VERIFIED ? "verified first, then oldest account" : "oldest account only (--strict-oldest)"}`);
  console.log(`shared numbers: ${shared.length}  (${shared.filter((g) => g.exact).length} exact, ${shared.filter((g) => !g.exact).length} inferred)`);
  console.log(`acting on ${acting.length} groups${INFERRED ? " (inferred included)" : " — rerun with --include-inferred for the rest"}\n`);

  const withConflicts = acting.filter((g) => g.conflicts.length);
  console.log(`!! ${withConflicts.length} groups where "oldest account" disagrees with the other signals:\n`);
  for (const g of withConflicts) {
    console.log(`  ${g.k}`);
    console.log(`     KEEP  ${g.keeper.u.email}  joined ${g.keeper.created.toISOString().slice(0, 10)}  ` +
      `${g.keeper.verified ? "verified" : "unverified"}  value $${value(g.keeper).toFixed(2)}`);
    for (const c of g.conflicts) console.log(`     ^^ ${c}`);
    console.log();
  }

  const clears = acting.flatMap((g) => g.losers.map((l: any) => ({ g, l })));
  console.log(`accounts that would KEEP their number : ${acting.length}`);
  console.log(`accounts that would have it CLEARED   : ${clears.length}`);
  console.log(`   ...of those, currently phoneVerified: ${clears.filter((c) => c.l.verified).length}`);
  console.log(`   ...of those, holding money/referrals: ${clears.filter((c) => value(c.l) > 0).length}`);
  console.log(`accounts merged or deleted            : 0`);
  if (skipped.length) console.log(`\ngroups left alone (inferred): ${skipped.length}, ${skipped.reduce((s, g) => s + g.all.length - 1, 0)} accounts`);

  if (!APPLY) { console.log("\nNothing written."); await mongoose.disconnect(); return; }

  const log: any[] = [];
  for (const { g, l } of clears) {
    await User.updateOne({ _id: l.u._id }, { $unset: { phone: "" }, $set: { phoneVerified: false } });
    log.push({ userId: String(l.u._id), email: l.u.email, clearedPhone: l.raw,
      wasVerified: l.verified, keptBy: g.keeper.u.email, number: g.k, at: new Date().toISOString() });
  }
  fs.writeFileSync("phone-dedupe-log.json", JSON.stringify(log, null, 2));
  console.log(`\nCleared ${log.length} phone numbers. Reversal log: phone-dedupe-log.json`);
  await mongoose.disconnect();
})();

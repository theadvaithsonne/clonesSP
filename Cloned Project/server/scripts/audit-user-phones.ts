/**
 * Phone data audit — the pre-work for making `users.phone` unique.
 *
 * Produces three lists, because they need three different remedies:
 *
 *   A. SHARED      one real number on more than one account. Blocks a unique
 *                  index outright.
 *   B. NO COUNTRY  stored without a "+CC". These are NOT known-Indian numbers:
 *                  services/twoFactorSms.ts guesses `+91` for any bare
 *                  10-digit input, so the country on file is our assumption,
 *                  not the user's statement. Fine as a delivery fallback,
 *                  unusable as an identity key.
 *   C. MALFORMED   fails libphonenumber validation for its own country, or
 *                  cannot be parsed at all.
 *
 * Validation is libphonenumber-js, not regex. Hand-rolled rules produce false
 * positives here — an Indian mobile legitimately begins with 9, so "+91 9177…"
 * looks like a doubled country code and is not one.
 *
 * READ-ONLY. Writes CSVs; never touches the database.
 *
 *   npx tsx src/scripts/audit-user-phones.ts [--out ./phone-audit]
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const argOut = process.argv.indexOf("--out");
const OUT = argOut > -1 ? process.argv[argOut + 1] : "./phone-audit";

/** What twoFactorSms.normalizePhone would do — reproduced to show the guess. */
function currentGuess(raw: string): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  const hasPlus = t.startsWith("+");
  const d = t.replace(/\D/g, "");
  if (!d) return null;
  if (hasPlus) return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return null;
}

const csv = (rows: any[][]) =>
  rows
    .map((r) =>
      r
        .map((c) => {
          const s = c == null ? "" : String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { User } = await import("../models/user.model");
  const { Invoice } = await import("../models/invoice.model");
  const { StoreWallet } = await import("../models/storeWallet.model");

  const users: any[] = await User.find({ phone: { $nin: ["", null] } })
    .select("email name phone phoneVerified createdAt organizations")
    .lean();
  const total = await User.countDocuments({});
  fs.mkdirSync(OUT, { recursive: true });

  // Activity, so a reviewer can tell which account in a group is the real one.
  const ids = users.map((u) => u._id);
  const inv = new Map(
    (
      await Invoice.aggregate([
        { $match: { userId: { $in: ids }, status: "paid" } },
        { $group: { _id: "$userId", n: { $sum: 1 }, spend: { $sum: "$totalAmount" } } },
      ])
    ).map((r: any) => [String(r._id), r])
  );
  const wal = new Map(
    (
      await StoreWallet.aggregate([
        { $match: { userId: { $in: ids } } },
        { $group: { _id: "$userId", bal: { $sum: "$balance" } } },
      ])
    ).map((r: any) => [String(r._id), r.bal])
  );
  const ref = new Map(
    (
      await User.aggregate([
        { $match: { referredBy: { $in: ids } } },
        { $group: { _id: "$referredBy", n: { $sum: 1 } } },
      ])
    ).map((r: any) => [String(r._id), r.n])
  );

  type Rec = {
    u: any; raw: string; parsed: any; e164: string | null; country: string | null;
    valid: boolean; hasCC: boolean; guess: string | null;
    invoices: number; spend: number; wallet: number; refs: number; weight: number;
  };

  const recs: Rec[] = users.map((u) => {
    const raw = String(u.phone);
    const hasCC = raw.trim().startsWith("+");
    // Only claim a country when the user actually supplied one.
    const parsed = hasCC ? parsePhoneNumberFromString(raw) : null;
    const i: any = inv.get(String(u._id));
    const spend = Math.round(((i?.spend || 0) / 100) * 100) / 100;
    const wallet = Math.round((wal.get(String(u._id)) || 0) * 100) / 100;
    const refs = ref.get(String(u._id)) || 0;
    return {
      u, raw, parsed,
      e164: parsed?.number || null,
      country: parsed?.country || null,
      valid: !!parsed?.isValid(),
      hasCC, guess: currentGuess(raw),
      invoices: i?.n || 0, spend, wallet, refs,
      weight: spend + wallet + refs * 10,
    };
  });

  const base = (r: Rec) => [
    r.u.email || "", r.u.name || "", r.raw, r.country || "", r.e164 || "",
    r.u.phoneVerified ? "yes" : "no",
    r.u.createdAt ? new Date(r.u.createdAt).toISOString().slice(0, 10) : "",
    r.invoices, r.spend, r.wallet, r.refs, String(r.u._id),
  ];
  const HEAD = ["email","name","phone_as_stored","country","e164","phone_verified",
                "joined","paid_invoices","spend_usd","wallet_usd","referrals","user_id"];

  // ── A. SHARED ────────────────────────────────────────────────────────
  // Canonical key: validated E.164 where we have one; otherwise the last 10
  // digits, which is what catches "7416708117" against "+917416708117".
  const keyOf = (r: Rec) => {
    if (r.valid && r.e164) return r.e164;
    const d = r.raw.replace(/\D/g, "");
    return d.length >= 10 ? `~${d.slice(-10)}` : `?${d}`;
  };
  const groups = new Map<string, Rec[]>();
  for (const r of recs) {
    const k = keyOf(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const shared = [...groups.entries()]
    .filter(([, a]) => a.length > 1)
    .map(([k, a]) => ({ k, a: a.sort((x, y) => y.weight - x.weight) }))
    .sort((x, y) => y.a.length - x.a.length);

  const rowsA: any[][] = [["group_key","approximate_match","accounts_in_group","suggested_keep","country_clash", ...HEAD]];
  for (const g of shared) {
    const countries = [...new Set(g.a.map((r) => r.country).filter(Boolean))];
    const active = g.a.filter((r) => r.invoices || r.wallet || r.refs);
    g.a.forEach((r, i) =>
      rowsA.push([
        g.k.replace(/^[~?]/, ""), g.k.startsWith("~") ? "yes" : "", g.a.length,
        i === 0 && active.length ? "KEEP" : "",
        countries.length > 1 ? "YES" : "", ...base(r),
      ])
    );
  }
  fs.writeFileSync(path.join(OUT, "A-shared-numbers.csv"), csv(rowsA));

  // ── B. NO COUNTRY CODE ───────────────────────────────────────────────
  const noCC = recs.filter((r) => !r.hasCC).sort((a, b) => b.weight - a.weight);
  const rowsB: any[][] = [["digits","what_we_currently_assume","valid_if_india", ...HEAD]];
  for (const r of noCC) {
    const asIndia = parsePhoneNumberFromString(r.guess || "");
    rowsB.push([
      r.raw.replace(/\D/g, "").length, r.guess || "(undeliverable)",
      asIndia?.isValid() ? "yes" : "no", ...base(r),
    ]);
  }
  fs.writeFileSync(path.join(OUT, "B-no-country-code.csv"), csv(rowsB));

  // ── C. MALFORMED ─────────────────────────────────────────────────────
  const malformed = recs
    .filter((r) => {
      if (!r.hasCC) return false; // that is list B's problem, not this one
      return !r.parsed || !r.valid;
    })
    .map((r) => ({
      r,
      why: !r.parsed
        ? (r.raw.match(/\+/g) || []).length > 1
          ? "multiple + signs — country code prepended twice"
          : "cannot be parsed"
        : `not a valid number for ${r.parsed.country || "that country code"}`,
    }))
    .sort((a, b) => b.r.weight - a.r.weight);
  const rowsC: any[][] = [["problem", ...HEAD]];
  for (const m of malformed) rowsC.push([m.why, ...base(m.r)]);
  fs.writeFileSync(path.join(OUT, "C-malformed.csv"), csv(rowsC));

  // ── Summary ──────────────────────────────────────────────────────────
  const clean = recs.filter(
    (r) => r.hasCC && r.valid && groups.get(keyOf(r))!.length === 1
  );
  const P = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  console.log(`\nUsers: ${total} total, ${recs.length} with a phone, ${total - recs.length} without\n`);
  console.log(`A. SHARED       ${shared.reduce((s, g) => s + g.a.length, 0)} accounts across ${shared.length} numbers`);
  console.log(`                (${shared.filter((g) => g.a.filter((r) => r.invoices || r.wallet || r.refs).length > 1).length} groups have 2+ active accounts — need a human decision)`);
  console.log(`B. NO COUNTRY   ${noCC.length} accounts  (${P(noCC.length)} of all users)`);
  console.log(`                ${noCC.filter((r) => r.u.phoneVerified).length} of them are marked phoneVerified despite a guessed country`);
  console.log(`C. MALFORMED    ${malformed.length} accounts`);
  for (const [why, n] of [...malformed.reduce((m, x) => m.set(x.why, (m.get(x.why) || 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]))
    console.log(`                  ${n.toString().padStart(3)}  ${why}`);
  console.log(`\nCLEAN           ${clean.length} accounts (${P(clean.length)}) — valid, unique, country stated by the user`);
  console.log(`\nCSVs written to ${path.resolve(OUT)}/`);
  await mongoose.disconnect();
})();

/**
 * Contract test for phone-or-email login.
 *
 * The whole point of that change was that NO client payload, response shape or
 * JWT claim moves. This asserts it against a live server + database: the email
 * path must behave exactly as before, and the phone path must produce the same
 * response object.
 *
 * Creates and then deletes its own throwaway accounts. Safe to run repeatedly.
 *
 * Start a server on 4599 first (see the bottom of this file for a one-liner),
 * then:  npx tsx src/scripts/test-auth-identifier-contract.ts
 *
 * Note: with an unset/invalid RESEND_API_KEY the email SEND cannot be
 * exercised locally, so that one assertion accepts a 500-with-JSON. Everything
 * else — OTP minting, lookup, signup, response shape — is fully covered.
 */
import dotenv from "dotenv"; dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
const B = process.env.AUTH_TEST_BASE || "http://localhost:4599";
const post = async (p: string, body: any) => {
  const r = await fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  let j: any = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = { __raw: t.slice(0, 80) }; }
  return { status: r.status, j };
};
const checks: [string, boolean, string?][] = [];
const ck = (n: string, ok: boolean, extra?: string) => checks.push([n, ok, extra]);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const { OtpCode } = await import("../models/otpcode.model");
  const { User } = await import("../models/user.model");
  const stamp = Date.now();
  const EMAIL = `contract.${stamp}@yopmail.com`;
  const PHONE = "+919999" + String(stamp).slice(-6);
  const made: any[] = [];

  try {
    // ── 1. EMAIL PATH — must be byte-identical to before ──
    const r1 = await post("/auth/request-otp", { email: EMAIL });
    const mailDown = r1.status === 500 && r1.j?.error === "Failed to send OTP";
    if (mailDown) console.log("  [note] local RESEND_API_KEY is dead - email SEND cannot be exercised here\n");
    ck("email request-otp responds 200 {ok:true} (or 500 JSON when mail is down)",
      (r1.status === 200 && JSON.stringify(r1.j) === '{"ok":true}') || mailDown, `${r1.status} ${JSON.stringify(r1.j)}`);
    ck("email request-otp never returns an HTML body", !r1.j?.__raw, JSON.stringify(r1.j));

    const row1: any = await OtpCode.findOne({ email: EMAIL, purpose: "login" }).lean();
    ck("OTP row keyed on the email", !!row1);

    const r2 = await post("/auth/verify-otp", { email: EMAIL, code: row1?.code });
    ck("email verify-otp -> 200", r2.status === 200, `got ${r2.status} ${JSON.stringify(r2.j).slice(0,150)}`);
    const u = r2.j?.user;
    const keys = u ? Object.keys(u).sort().join(",") : "";
    ck("user object keys unchanged",
      keys === "currentOrg,email,hasOrganizations,id,name,organizations,phone,phoneVerified,role" ||
      keys === "email,hasOrganizations,id,name,organizations,phone,phoneVerified,role", keys);
    ck("name key present even when unset", u && "name" in u, JSON.stringify(Object.keys(u||{})));
    ck("top-level userId present", !!r2.j?.userId);
    ck("user.email is the address", u?.email === EMAIL, String(u?.email));
    const created1 = await User.findOne({ email: EMAIL }).lean(); if (created1) made.push(created1._id);
    ck("email signup created the account", !!created1);

    // ── 2. CASE NORMALISATION (the old raw-vs-lowercased bug) ──
    const r3 = await post("/auth/request-otp", { email: EMAIL.toUpperCase() });
    const row3: any = await OtpCode.findOne({ email: EMAIL, purpose: "login" }).lean();
    ck("uppercase email keys the OTP lowercased", !!row3, `row=${!!row3} status=${r3.status}`);
    const r4 = await post("/auth/verify-otp", { email: EMAIL.toUpperCase(), code: row3?.code });
    ck("uppercase login resolves the SAME account (no duplicate)",
      r4.status === 200 && String(r4.j?.user?.id) === String(created1?._id), String(r4.j?.user?.id));
    ck("still only one account for that address", (await User.countDocuments({ email: EMAIL })) === 1);

    // ── 3. INVALID IDENTIFIERS -> 400 JSON, not a 500 HTML page ──
    const bad = await post("/auth/request-otp", { email: "not-an-email" });
    ck("garbage -> 400 with a JSON error key", bad.status === 400 && typeof bad.j?.error === "string", `${bad.status} ${JSON.stringify(bad.j)}`);
    const bare = await post("/auth/request-otp", { email: "9876543210" });
    ck("bare number -> 400 asking for a country code",
      bare.status === 400 && /country code/i.test(bare.j?.error || ""), JSON.stringify(bare.j));

    // ── 4. PHONE PATH — providers unconfigured here, so expect a clean 503 ──
    const ph = await post("/auth/request-otp", { email: PHONE });
    ck("phone request-otp -> 503 when no provider configured",
      ph.status === 503 && ph.j?.ok === false, `${ph.status} ${JSON.stringify(ph.j)}`);
    ck("no OTP row left behind after a failed send",
      !(await OtpCode.findOne({ email: PHONE, purpose: "login" }).lean()));

    // ── 5. PHONE SIGNUP — seed the OTP directly (no SMS sent) ──
    const { createOtp } = await import("../services/otp");
    const pcode = await createOtp(PHONE, "login");
    const r5 = await post("/auth/verify-otp", { email: PHONE, code: pcode });
    ck("phone verify-otp -> 200", r5.status === 200, `${r5.status} ${JSON.stringify(r5.j).slice(0,200)}`);
    const pu = r5.j?.user;
    ck("phone-only account created", !!pu?.id);
    ck("response keeps the email KEY, valued null", pu && "email" in pu && pu.email === null, JSON.stringify(pu?.email));
    ck("phone echoed back", pu?.phone === PHONE, String(pu?.phone));
    ck("phoneVerified true on signup", pu?.phoneVerified === true);
    const created2 = await User.findOne({ phone: PHONE }).lean(); if (created2) made.push(created2._id);
    ck("account stored with no email at all", !!created2 && !created2.email);
    ck("account joined an org", !!created2 && (created2.organizations || []).length > 0);

    // ── 6. LOGGING IN AGAIN BY PHONE FINDS THE SAME ACCOUNT ──
    const pcode2 = await createOtp(PHONE, "login");
    const r6 = await post("/auth/verify-otp", { email: PHONE, code: pcode2 });
    ck("second phone login reuses the account",
      String(r6.j?.user?.id) === String(created2?._id));
    ck("no duplicate phone account", (await User.countDocuments({ phone: PHONE })) === 1);

    // ── 7. WRONG CODE ──
    const wrong = await post("/auth/verify-otp", { email: EMAIL, code: "000000" });
    ck("wrong code -> 400 {error:'Invalid OTP'}",
      wrong.status === 400 && wrong.j?.error === "Invalid OTP", JSON.stringify(wrong.j));

    // ── 8. email-available accepts both ──
    const av1 = await fetch(`${B}/auth/email-available?email=${encodeURIComponent(EMAIL)}`).then(r => r.json());
    ck("email-available: taken email -> available false", av1.ok === true && av1.available === false, JSON.stringify(av1));
    const av2 = await fetch(`${B}/auth/email-available?email=${encodeURIComponent(PHONE)}`).then(r => r.json());
    ck("email-available: taken phone -> available false", av2.ok === true && av2.available === false, JSON.stringify(av2));
  } finally {
    if (made.length) await User.deleteMany({ _id: { $in: made } });
    await OtpCode.deleteMany({ email: { $in: [EMAIL, PHONE] } });
    console.log(`(cleaned up ${made.length} test accounts)\n`);
  }

  let bad = 0;
  for (const [n, ok, x] of checks) { console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  <- " + x}`); if (!ok) bad++; }
  console.log(bad === 0 ? "\nALL PASS" : `\n${bad} FAILED`);
  await mongoose.disconnect();
  process.exit(bad ? 1 : 0);
})();

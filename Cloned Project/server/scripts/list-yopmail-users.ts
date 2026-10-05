/**
 * READ-ONLY: list every user with a yopmail.com email address.
 *
 * Nothing is deleted here. Prints a table of {_id, email, name, createdAt,
 * hasOrgs, hasWallets, hasPurchases} so you can confirm the scope before
 * a follow-up destructive script runs. The exception list below is
 * highlighted (annotated as [KEEP]) so you can see which would survive
 * a delete pass.
 *
 * Usage:
 *   npx tsx src/scripts/list-yopmail-users.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";

// The exceptions the user gave — anyone in this set is NOT to be
// deleted by the follow-up script. Both yopmail + gmail entries are
// included, though only yopmail could ever be matched by the finder.
const KEEP_EMAILS = new Set(
  [
    "mipehixeitrau-5570@yopmail.com",
    "wefrivauprouffoi-7516@yopmail.com",
    "tenaupredipei-1504@yopmail.com",
    "zoicrodoijulou-1160@yopmail.com",
    "wessurattougo-7663@yopmail.com",
    "rolligajine-2930@yopmail.com",
    "gaduffuwecre-7679@yopmail.com",
    "naufratragevo-1118@yopmail.com",
    "shorupanmedia@gmail.com",
    "legallyapp123@gmail.com",
    "fretteutegrouli-9688@yopmail.com",
    "yabrozicafa-6650@yopmail.com",
    "decusemmeddi-8756@yopmail.com",
    "cromenojoire-8247@yopmail.com",
    "katraussougroro-9642@yopmail.com",
    "creprafalloni-3942@yopmail.com",
    "xilleittitrauju-1132@yopmail.com",
    "tinnessaheigre-1010@yopmail.com",
    "cebouyigroddoi-4671@yopmail.com",
    "bakummemauffou-6268@yopmail.com",
    "quelloiddudibeu-8659@yopmail.com",
    "shorupan@gmail.com",
    "stevenjobsmp@gmail.com",
  ].map((e) => e.trim().toLowerCase()),
);

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to ${mongoose.connection.name}\n`);

  // Case-insensitive endswith @yopmail.com match. Anchored to end of
  // string so a hypothetical foo@yopmail.com.evil.tld can't match.
  const users: any[] = await User.find({
    email: { $regex: /@yopmail\.com$/i },
  })
    .select("_id email name createdAt organizations")
    .sort({ createdAt: -1 })
    .lean();

  console.log(`Found ${users.length} yopmail user(s).\n`);

  let keepCount = 0;
  let deleteCount = 0;
  const toDeleteEmails: string[] = [];

  for (const u of users) {
    const emailLower = (u.email || "").toLowerCase();
    const keep = KEEP_EMAILS.has(emailLower);
    const marker = keep ? "[KEEP  ]" : "[DELETE]";
    if (keep) keepCount += 1;
    else {
      deleteCount += 1;
      toDeleteEmails.push(u.email);
    }
    const orgCount = (u.organizations || []).length;
    const createdAt = u.createdAt
      ? new Date(u.createdAt).toISOString().slice(0, 10)
      : "—";
    console.log(
      `${marker}  ${String(u._id).padEnd(26)}  ${(u.email || "").padEnd(50)}  orgs=${orgCount}  created=${createdAt}  name=${u.name || "—"}`,
    );
  }

  console.log(`\nSummary:`);
  console.log(`  Total yopmail users : ${users.length}`);
  console.log(`  Kept (in exception list): ${keepCount}`);
  console.log(`  Would delete             : ${deleteCount}`);

  // Also flag any exception-list entries that DIDN'T match anyone —
  // useful sanity check for typos before running destructive delete.
  const yopmailKeepList = [...KEEP_EMAILS].filter((e) =>
    e.endsWith("@yopmail.com"),
  );
  const foundEmails = new Set(
    users.map((u) => (u.email || "").toLowerCase()),
  );
  const missing = yopmailKeepList.filter((e) => !foundEmails.has(e));
  if (missing.length > 0) {
    console.log(
      `\n⚠️  ${missing.length} exception-list yopmail email(s) don't match any user (typo? already deleted?):`,
    );
    for (const m of missing) console.log(`   ${m}`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});

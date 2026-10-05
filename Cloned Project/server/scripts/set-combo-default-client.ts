/**
 * Names the third-party client that the Unilevel Plus combo offer sells.
 *
 * The free-first-month fallback used to identify that client by it being the
 * ONLY active one. Activating a second client (GarageGo, 10 Sep 2026) made
 * that condition false, and from that moment bare-licence buyers silently
 * stopped getting both their UPI mandate and their free month.
 *
 * services/comboClient.ts now resolves it by an explicit `isComboDefault`
 * flag, falling back to the old sole-active rule. This script sets the flag,
 * which is what makes the fix take effect on an installation that already has
 * more than one active client.
 *
 *   npx tsx src/scripts/set-combo-default-client.ts                    (dry run)
 *   npx tsx src/scripts/set-combo-default-client.ts --apply
 *   npx tsx src/scripts/set-combo-default-client.ts --name GarageGo --apply
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const nameIdx = process.argv.indexOf("--name");
const TARGET = nameIdx > -1 ? process.argv[nameIdx + 1] : "NetworkChain";

(async () => {
  // autoIndex off: this tree's user.model declares a unique phone index the
  // deployed code has no guard for yet.
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
  const { resolveComboClient, comboClientProblem } = await import(
    "../services/comboClient"
  );

  console.log(APPLY ? "=== APPLY ===\n" : "=== DRY RUN — pass --apply to write ===\n");

  const all: any[] = await ThirdPartyClient.find({})
    .select("name isActive isComboDefault productConfig.productCode")
    .lean();
  console.log("third-party clients:");
  for (const c of all) {
    console.log(
      `  ${String(c.name).padEnd(16)} active=${String(!!c.isActive).padEnd(5)} ` +
        `comboDefault=${String(!!c.isComboDefault).padEnd(5)} ` +
        `productCode=${c.productConfig?.productCode ?? "-"}`,
    );
  }

  const before = await resolveComboClient();
  console.log(
    `\nBEFORE: ${before.client ? `${(before.client as any).name} (by ${before.reason})` : `UNRESOLVED — ${comboClientProblem(before.reason)}`}`,
  );

  const target: any = await ThirdPartyClient.findOne({ name: TARGET });
  if (!target) {
    console.log(`\nABORT — no client named "${TARGET}"`);
    await mongoose.disconnect();
    process.exit(1);
  }
  if (!target.isActive) {
    console.log(`\nABORT — "${TARGET}" is not active; the resolver only considers active clients.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!APPLY) {
    console.log(`\nWould set isComboDefault=true on "${TARGET}"`);
    console.log(`Would clear it on ${all.filter((c) => c.isComboDefault && String(c.name) !== TARGET).length} other client(s)`);
    console.log("\nNothing written.");
    await mongoose.disconnect();
    return;
  }

  // Exactly one client may carry the flag, or the resolver is ambiguous again.
  await ThirdPartyClient.updateMany(
    { _id: { $ne: target._id } },
    { $set: { isComboDefault: false } },
  );
  await ThirdPartyClient.updateOne(
    { _id: target._id },
    { $set: { isComboDefault: true } },
  );

  const after = await resolveComboClient();
  console.log(
    `\nAFTER : ${after.client ? `${(after.client as any).name} (by ${after.reason})` : `UNRESOLVED — ${comboClientProblem(after.reason)}`}`,
  );
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("FAILED:", err?.message || err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

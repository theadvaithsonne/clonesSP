/**
 * Seed (or clear) the "Verify your admin" step-up questions for one admin.
 *
 *   npx tsx src/scripts/set-admin-verification.ts --email shorupan@gmail.com
 *   npx tsx src/scripts/set-admin-verification.ts --email … --status
 *   npx tsx src/scripts/set-admin-verification.ts --email … --clear
 *
 * Answers are typed at the prompt, never passed as arguments — argv is
 * visible in `ps` and lands in shell history. They are hashed with bcrypt
 * over ADMIN_VERIFY_PEPPER and are not recoverable afterwards, from this
 * script or anywhere else. Losing them means re-running with --clear.
 *
 * --clear is the recovery path when the gate locks the only super admin
 * out; ADMIN_VERIFY_ENFORCE=off in the environment is the faster one.
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import readline from "readline";
import { hashAnswer, normalizeAnswer } from "../services/adminVerification";
import { GarageAdminModel } from "../models/garageAdmin.model";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const EMAIL = arg("email");
const CLEAR = process.argv.includes("--clear");
const STATUS = process.argv.includes("--status");

/**
 * Question prompt, answered either at a terminal (hidden as you type) or
 * from piped input.
 *
 * Piped input is read in one go up front. readline starts consuming stdin
 * the moment it exists, so with a pipe it hits end-of-input and closes
 * itself while the script is still connecting to the database — every
 * later question then throws ERR_USE_AFTER_CLOSE. Draining first sidesteps
 * that entirely, and keeps the hidden-typing behaviour where it matters.
 */
const interactive = !!process.stdin.isTTY;
let piped: string[] = [];
let rl: readline.Interface | null = null;

async function drainStdin(): Promise<void> {
  if (interactive) return;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  piped = Buffer.concat(chunks).toString("utf8").split("\n");
}

function ask(question: string, hidden = false): Promise<string> {
  if (!interactive) {
    const line = piped.length ? piped.shift()! : "";
    // Echo the prompt so a piped run still reads as a transcript, but
    // never the answer.
    console.log(`${question}${hidden ? "••••" : line}`);
    return Promise.resolve(line.replace(/\r$/, ""));
  }
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  const iface = rl;
  return new Promise((resolve) => {
    if (!hidden) {
      iface.question(question, resolve);
      return;
    }
    // Stop the terminal echoing the answer to anyone standing behind you.
    const out = process.stdout as any;
    const writeRaw = out.write.bind(out);
    let muted = false;
    out.write = (chunk: any, ...rest: any[]) =>
      muted && typeof chunk === "string" ? true : writeRaw(chunk, ...rest);
    writeRaw(question);
    muted = true;
    iface.question("", (answer) => {
      muted = false;
      out.write = writeRaw;
      writeRaw("\n");
      resolve(answer);
    });
  });
}

function closeInput() {
  rl?.close();
  rl = null;
}

(async () => {
  if (!EMAIL) throw new Error("--email is required");
  // No pepper env var is required: it falls back to a value derived from
  // JWT_SECRET (see services/adminVerification). But it must be the SAME
  // JWT_SECRET the server runs with, or nothing seeded here will verify —
  // so run this against the production environment's .env, not a local one.
  if (!process.env.ADMIN_VERIFY_PEPPER && !process.env.JWT_SECRET) {
    throw new Error("Set JWT_SECRET (or ADMIN_VERIFY_PEPPER) before seeding.");
  }
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });

  const admin = await GarageAdminModel.findOne({ email: EMAIL }).select(
    "+verification"
  );
  if (!admin) throw new Error(`no garage admin with email ${EMAIL}`);
  const state: any = (admin as any).verification;

  console.log(`\n${admin.name} <${admin.email}>  ·  ${admin.role}`);

  if (STATUS) {
    closeInput();
    if (!state?.questions?.length) console.log("  gate: NOT configured (this admin is not asked to verify)");
    else {
      console.log(`  gate: configured · ${state.questions.length} question(s)`);
      for (const q of state.questions) console.log(`    - [${q.id}] ${q.prompt}`);
      console.log(`  failed attempts this login: ${state.failedAttempts ?? 0}`);
      console.log(`  last verified: ${state.lastVerifiedAt ? new Date(state.lastVerifiedAt).toISOString() : "never"}`);
    }
    await mongoose.disconnect();
    return;
  }

  if (CLEAR) {
    closeInput();
    await GarageAdminModel.updateOne({ _id: admin._id }, { $unset: { verification: 1 } });
    console.log("  ✅ cleared — this admin will no longer be asked to verify");
    await mongoose.disconnect();
    return;
  }

  // Only now, once we know we're actually asking: draining stdin when
  // nothing is piped would block forever (--status / --clear need no input).
  await drainStdin();
  console.log("\nEnter the questions. Blank prompt to finish.\n");
  const questions: { id: string; prompt: string; answerHash: string }[] = [];
  for (let i = 1; ; i++) {
    const prompt = (await ask(`  Question ${i} prompt: `)).trim();
    if (!prompt) break;
    const answer = await ask(`  Answer (hidden): `, true);
    const normalized = normalizeAnswer(answer);
    if (!normalized) {
      console.log("  ↳ empty after normalization, skipped\n");
      continue;
    }
    const again = await ask(`  Confirm answer (hidden): `, true);
    if (normalizeAnswer(again) !== normalized) {
      console.log("  ↳ the two answers don't match, skipped\n");
      continue;
    }
    // Shown so you can see what will actually be compared — "7" and
    // "seven" are different answers, and punctuation/case are folded away.
    console.log(`  ↳ stored as a hash of: "${normalized}"\n`);
    questions.push({ id: `q${i}`, prompt, answerHash: await hashAnswer(answer) });
  }

  closeInput();
  if (!questions.length) {
    console.log("nothing entered — no change");
    await mongoose.disconnect();
    return;
  }

  await GarageAdminModel.updateOne(
    { _id: admin._id },
    { $set: { verification: { questions, failedAttempts: 0 } } }
  );
  console.log(`✅ ${questions.length} question(s) saved for ${admin.email}.`);
  console.log("   They are asked once per login, at random, before the console will answer.");
  await mongoose.disconnect();
})();

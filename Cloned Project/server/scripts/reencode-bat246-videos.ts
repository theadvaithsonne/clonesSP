// src/scripts/reencode-bat246-videos.ts
//
// Re-encode the four oversized BAT 246 intro videos and replace them on S3.
//
// Measured problem (28 Sep 2026): four of the seven clips were uploaded as
// near-master exports — ~9 Mb/s, up to 570 MB — while the three that play
// fine sit at 0.8-2.6 Mb/s. Measured throughput to the bucket is ~6.2 Mb/s,
// so the heavy files cannot download as fast as they play. The buffering is
// not intermittent; it is arithmetic.
//
// They also have the `moov` atom at 99.9% of the file, so the player must
// range-request the tail of a 570 MB file before it can decode a single
// frame. `-movflags +faststart` moves it to the front.
//
// Safety: every original is copied to `public/bat246/originals/` on S3 BEFORE
// its key is overwritten, so this is reversible with a single copy back. The
// live URLs are unchanged, so no frontend edit is needed.
//
//   npx tsx src/scripts/reencode-bat246-videos.ts            # dry run
//   npx tsx src/scripts/reencode-bat246-videos.ts --confirm  # encode + upload

import "dotenv/config";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const BUCKET = "nela-app";
const PREFIX = "public/bat246/";
const BACKUP_PREFIX = "public/bat246/originals/";

/** Only the four that are too heavy. The other three already play fine. */
const TARGETS = [
  "bat246-video-all-products-pass-the-grandma-test.mp4",
  "bat246-video-who-wants-to-be-a-millionaire.mp4",
  "bat246-video-your-board-never-stops-moving.mp4",
  "bat246-video-the-secret-formula.mp4",
];

/**
 * CRF 23 at 720p with faststart — the settings that produce roughly the same
 * bitrate as the three clips already streaming without complaint. `-vf scale`
 * only shrinks: a source already at or below 1280 wide is left alone.
 */
const FFMPEG_ARGS = (i: string, o: string) => [
  "-y", "-i", i,
  "-c:v", "libx264", "-crf", "23", "-preset", "slow",
  "-vf", "scale='min(1280,iw)':-2",
  "-c:a", "aac", "-b:a", "128k",
  "-movflags", "+faststart",
  o,
];

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = String(d).slice(-400); });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}: ${err}`))));
  });
}

/** Duration + whether `moov` precedes `mdat`, straight from ffprobe. */
async function probe(file: string) {
  const out = await new Promise<string>((res, rej) => {
    const p = spawn("ffprobe", [
      "-v", "error", "-show_entries", "format=duration,bit_rate", "-of", "json", file,
    ]);
    let s = "";
    p.stdout.on("data", (d) => (s += d));
    p.on("close", (c) => (c === 0 ? res(s) : rej(new Error("ffprobe failed"))));
  });
  const f = JSON.parse(out).format || {};
  const fd = fs.openSync(file, "r");
  const head = Buffer.alloc(64);
  fs.readSync(fd, head, 0, 64, 0);
  fs.closeSync(fd);
  const firstSize = head.readUInt32BE(0);
  const second = head.subarray(firstSize + 4, firstSize + 8).toString("latin1");
  return {
    duration: Number(f.duration) || 0,
    bitrate: Number(f.bit_rate) || 0,
    faststart: second === "moov",
  };
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials missing from env.");
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bat246-"));
  console.log(`${confirm ? "RUNNING" : "DRY RUN"} — working dir ${tmp}\n`);

  const results: any[] = [];
  for (const key of TARGETS) {
    const srcKey = PREFIX + key;
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: srcKey }));
    const before = head.ContentLength || 0;
    console.log(`${key}\n   original ${mb(before)}`);

    // Already converted on an earlier run? The presence of a backup is the
    // marker. Without this a re-run would re-encode the ALREADY re-encoded
    // file and then copy it over `originals/`, destroying the only master —
    // the run is resumable precisely because it refuses to do that.
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: BACKUP_PREFIX + key }));
      console.log(`   already done (backup present) — skipping\n`);
      results.push({ key, before, after: before, skipped: true });
      continue;
    } catch {
      /* no backup yet — this one still needs converting */
    }

    if (!confirm) { results.push({ key, before, after: 0 }); console.log(""); continue; }

    // 1. download
    const inFile = path.join(tmp, key);
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: srcKey }));
    await new Promise<void>((res, rej) => {
      const w = fs.createWriteStream(inFile);
      (obj.Body as any).pipe(w).on("finish", res).on("error", rej);
    });

    // 2. encode
    const outFile = path.join(tmp, "out-" + key);
    const t0 = Date.now();
    await run("ffmpeg", FFMPEG_ARGS(inFile, outFile));
    const after = fs.statSync(outFile).size;
    const p = await probe(outFile);
    const mbps = p.duration ? (after * 8) / p.duration / 1e6 : 0;
    console.log(
      `   encoded  ${mb(after)}  (${(before / after).toFixed(1)}x smaller, ` +
        `${mbps.toFixed(2)} Mb/s, faststart=${p.faststart ? "yes" : "NO"}, ` +
        `${Math.round((Date.now() - t0) / 1000)}s)`
    );

    // Refuse to ship something that would not fix the problem.
    if (!p.faststart) throw new Error(`${key}: moov still not at the front — aborting.`);
    if (after >= before) throw new Error(`${key}: re-encode is not smaller — aborting.`);
    if (mbps > 4) throw new Error(`${key}: still ${mbps.toFixed(1)} Mb/s — aborting.`);

    // 3. back up the original, then replace it
    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET, CopySource: `/${BUCKET}/${srcKey}`, Key: BACKUP_PREFIX + key,
      MetadataDirective: "COPY",
    }));
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: srcKey, Body: fs.createReadStream(outFile),
      ContentType: "video/mp4",
      // Was absent entirely, so every replay re-downloaded the whole file.
      CacheControl: "public, max-age=31536000, immutable",
      ContentLength: after,
    }));
    console.log(`   uploaded -> ${srcKey}  (original kept at ${BACKUP_PREFIX + key})\n`);
    results.push({ key, before, after });
    fs.unlinkSync(inFile); fs.unlinkSync(outFile);
  }

  const tb = results.reduce((s, r) => s + r.before, 0);
  const ta = results.reduce((s, r) => s + r.after, 0);
  console.log(`TOTAL  ${mb(tb)} -> ${ta ? mb(ta) : "(dry run)"}`);
  if (!confirm) console.log("\nDry run only. Re-run with --confirm.");
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}

main().catch((e) => { console.error("FAILED:", e?.message || e); process.exit(1); });

import mongoose from "mongoose";
import { env } from "../config/env";
import { initializeGarageHQ } from "../services/init";

export async function connectMongo() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is missing");

  // ─── autoIndex safety ────────────────────────────────────────────
  // Mongoose defaults autoIndex to true — every schema's declared
  // indexes are (re-)created on connect. That's fine in dev where
  // collections are tiny, but on prod a NEW index against a large
  // collection (e.g. WalletTransaction, millions of rows) kicks off
  // a background `createIndex` that pins CPU on the DB tier for
  // hours. If the backend shares CPU with the DB (managed cluster
  // burst tier), the backend cores go with it and every wallet
  // endpoint slows down until the build finishes.
  //
  // Fix: disable autoIndex on prod. Index changes ship with a
  // deliberate migration (`npm run indexes:sync`) run during a
  // low-traffic window instead of firing silently on the next
  // deploy. Dev still gets the auto behaviour so first-time model
  // work stays friction-free.
  //
  // Opt-out override: MONGO_AUTO_INDEX=true forces autoIndex on
  // regardless of NODE_ENV (useful for a first-boot on a fresh
  // prod cluster that has never had indexes built).
  const forceAutoIndex =
    (process.env.MONGO_AUTO_INDEX || "").toLowerCase() === "true";
  const autoIndex = forceAutoIndex || env.NODE_ENV !== "production";
  await mongoose.connect(env.MONGODB_URI, { autoIndex });
  console.log(
    `[mongo] connected (NODE_ENV=${env.NODE_ENV}, autoIndex=${autoIndex}${forceAutoIndex ? " — forced by MONGO_AUTO_INDEX" : ""})`,
  );
  mongoose.connection.on("connected", () => console.log("Mongo connected"));
  mongoose.connection.on("error", (e) => console.error("Mongo error:", e));

  // Initialize GARAGE HQ and founder user
  try {
    await initializeGarageHQ();
  } catch (error) {
    console.error("Failed to initialize GARAGE HQ:", error);
  }
}

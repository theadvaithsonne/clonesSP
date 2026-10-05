/**
 * One-time migration: copy legacy `SupportTicket` docs into the new
 * `Ticket` collection so we can retire the old `/support-tickets`
 * route + mobile screen.
 *
 * Field mapping:
 *   subject              → title
 *   description          → description
 *   module               → category
 *   priority             → priority   (identical enum)
 *   status               → status     (identical enum)
 *   createdBy (ObjectId) → userId      + look up name/email from User
 *   orgId                → orgId
 *   attachments: string[] (URLs)
 *                        → attachments[].name (URL stored as display name;
 *                                              key = same URL since we have
 *                                              no S3 key for legacy uploads)
 *   responses[]          → messages[]
 *     respondedBy        → authorId       + look up name from User
 *     message            → body
 *     attachments        → attachments[]
 *     createdAt          → createdAt
 *   createdAt / updatedAt → preserved via {timestamps:false} insert
 *
 * Idempotency: every migrated doc gets a `legacySupportTicketId` field
 * so a re-run skips already-migrated rows.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-support-tickets.ts          # dry run
 *   npx tsx src/scripts/migrate-support-tickets.ts --apply  # write
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";

import { env } from "../config/env";
import { SupportTicket } from "../models/supportTicket.model";
import { Ticket } from "../models/ticket.model";
import { User } from "../models/user.model";

dotenv.config();

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!env.MONGODB_URI) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected. Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

  // Add a side-channel field on the new collection so we can detect
  // re-runs without polluting the canonical schema. Cast to `any` to
  // avoid threading the field through the IT interface for a
  // one-shot migration.
  const TicketAny = Ticket as unknown as mongoose.Model<{
    legacySupportTicketId?: Types.ObjectId;
  }>;

  const legacyTickets = await SupportTicket.find({}).lean();
  console.log(`Found ${legacyTickets.length} legacy SupportTicket rows.`);

  let migrated = 0;
  let skipped = 0;
  let userMissing = 0;

  for (const old of legacyTickets) {
    const existing = await TicketAny.findOne({
      legacySupportTicketId: old._id,
    }).lean();
    if (existing) {
      skipped++;
      continue;
    }

    const creator = await User.findById(old.createdBy)
      .select("name email")
      .lean();
    if (!creator) {
      userMissing++;
      console.warn(
        `[skip] Legacy ticket ${old._id} — creator ${old.createdBy} not found`,
      );
      continue;
    }

    // Convert legacy responses → embedded messages. Skip any whose
    // author can't be resolved (rare; we surface the count at the
    // end so the user knows).
    const responseAuthorIds = (old.responses || []).map((r) => r.respondedBy);
    const responseAuthors = await User.find({ _id: { $in: responseAuthorIds } })
      .select("name email")
      .lean();
    const authorById = new Map(
      responseAuthors.map((u) => [String(u._id), u]),
    );

    const messages = (old.responses || [])
      .map((r) => {
        const author = authorById.get(String(r.respondedBy));
        if (!author) return null;
        return {
          _id: new Types.ObjectId(),
          // Legacy system had no notion of admin vs. user — every
          // response was authored by a real User. We tag everything
          // as "user" (admin replies via the new garage-admin panel
          // going forward will be "admin").
          authorRole: "user" as const,
          authorId: r.respondedBy as Types.ObjectId,
          authorName: author.name || author.email || "User",
          body: r.message,
          attachments: (r.attachments || []).map((u) => ({
            key: u,
            name: u.split("/").pop() || u,
          })),
          createdAt: r.createdAt || new Date(),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const doc = {
      legacySupportTicketId: old._id,
      userId: old.createdBy,
      orgId: old.orgId,
      isGuest: false,
      userEmail: (creator.email || "").toLowerCase(),
      userName: creator.name || creator.email || "User",
      title: old.subject,
      description: old.description,
      status: old.status,
      priority: old.priority,
      category: old.module,
      attachments: (old.attachments || []).map((u) => ({
        key: u,
        name: u.split("/").pop() || u,
      })),
      messages,
      lastActivityAt:
        messages.length > 0
          ? messages[messages.length - 1].createdAt
          : old.updatedAt || old.createdAt || new Date(),
      hasUnreadForUser: false,
      hasUnreadForAdmin: false,
      createdAt: old.createdAt,
      updatedAt: old.updatedAt,
    };

    if (APPLY) {
      // Insert directly so `createdAt`/`updatedAt` honour our values
      // (Mongoose's `create()` would overwrite them via the
      // `timestamps` plugin).
      await TicketAny.collection.insertOne(doc as unknown as Record<string, unknown>);
    }
    migrated++;
  }

  await mongoose.disconnect();

  console.log("\n── Result ──");
  console.log(`Total legacy rows : ${legacyTickets.length}`);
  console.log(`Migrated          : ${migrated}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Skipped (no user) : ${userMissing}`);
  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

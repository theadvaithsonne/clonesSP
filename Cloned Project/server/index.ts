// MUST be first — installs Sentry auto-instrumentation before any lib loads.
import "./instrument";
import http from "http";
import mongoose from "mongoose";
// Side-effect import: initialises the PostHog client (or no-ops if the
// POSTHOG_KEY env var isn't set — this file is safe to deploy without
// any env changes). Do NOT await captures anywhere; the SDK batches
// (flushAt: 20, flushInterval: 3s) and never blocks a request.
import { shutdownPostHog } from "./lib/posthog";
import app from "./app";
import { initSocket } from "./realtime/socket";
import { installOpenClawWsProxy } from "./realtime/openclawWs";
import { connectMongo } from "./db/mongo";
import { env } from "./config/env";
import { initializeOfficePlans } from "./services/officeSubscription";
import { initializeOfficeAddons } from "./services/officeAddonSubscription";
import { initializeUnilevelPlusPlan } from "./services/unilevelPlusCommission";
import { ensureReviewIndexes } from "./services/review";
import { createMediasoupWorker } from "./services/mediasoup";
import { s3Service } from "./services/s3";
import { ensureKycCors } from "./services/orgKycStorage";
import { refreshRates } from "./fx/fxService";

// optional: see DB ops while debugging
// mongoose.set("debug", (coll, method, query, doc) => {
//   console.log(
//     `[MONGO] ${coll}.${method}`,
//     JSON.stringify(query),
//     doc ? JSON.stringify(doc) : ""
//   );
// });


/**
 * Attach the backend's realtime layer to an HTTP server: Socket.IO on
 * /socket.io/* and the OpenClaw WebSocket proxy on /openclaw-ws/:channel.
 * Standalone mode (below) passes a server that wraps only the Express app;
 * the combined server (server/main.ts) passes the one it shares with Next.js.
 */
export function attachRealtime(server: http.Server): void {
  initSocket(server, env.FRONTEND_URL || "http://localhost:3000");
  // Proxy OpenClawApi realtime channels (tasks/crons/activity) with RBAC
  // filtering. Browser connects to ws(s)://<roam-backend>/openclaw-ws/:channel
  // with a JWT in the query; this handler verifies it, resolves the user's
  // accessible agent_ids, and only forwards events for those agents.
  installOpenClawWsProxy(server);
}

/**
 * BACKGROUND_JOBS=off keeps the sweepers, crons and queue workers below from
 * starting in this process; the HTTP API, Socket.IO and the boot tasks are
 * unaffected. Unset (the default) runs everything, exactly as before.
 */
export function backgroundJobsEnabled(): boolean {
  const v = (process.env.BACKGROUND_JOBS ?? "").trim().toLowerCase();
  return !["off", "false", "0", "no"].includes(v);
}

/**
 * Everything the backend does between process start and listen(): connect
 * Mongo, run the idempotent boot tasks and schedule the background jobs, in
 * the same order as the original standalone boot.
 */
export async function startBackend(): Promise<void> {
  const jobs = backgroundJobsEnabled();
  if (!jobs) {
    console.warn(
      "[jobs] BACKGROUND_JOBS=off — sweepers, crons and queue workers are NOT running in this process"
    );
  }

  await connectMongo();

  // Sync and clean review indexes
  try {
    await ensureReviewIndexes();
  } catch (err) {
    console.error("[ReviewIndexes] Failed to verify review indexes:", err);
  }

  // Initialize office plans (creates in Razorpay + DB if they don't exist)
  try {
    const plans = await initializeOfficePlans();
    console.log(`[OfficePlans] Initialized ${plans.length} office plans`);
  } catch (err) {
    console.error("[OfficePlans] Failed to initialize office plans:", err);
    // Don't exit - plans can be created later via admin endpoint
  }

  // Initialize office add-ons (creates in Razorpay + DB if they don't exist)
  try {
    const addons = await initializeOfficeAddons();
    console.log(`[OfficeAddons] Initialized ${addons.length} office add-ons`);
  } catch (err) {
    console.error("[OfficeAddons] Failed to initialize office add-ons:", err);
    // Don't exit - addons can be created later
  }

  // Initialize global Unilevel Plus plan
  try {
    const upPlan = await initializeUnilevelPlusPlan();
    console.log(`[UnilevelPlus] Initialized plan: ${upPlan.name} ($${upPlan.productPrice})`);
  } catch (err) {
    console.error("[UnilevelPlus] Failed to initialize UP plan:", err);
  }

  // Initialize Mediasoup worker for webinar SFU
  try {
    await createMediasoupWorker();
    console.log("[Mediasoup] Worker initialized");
  } catch (err) {
    console.error("[Mediasoup] Failed to create worker:", err);
  }

  if (jobs) await scheduleBackgroundJobs();

  // Ensure S3 bucket has CORS configured for browser uploads
  try {
    await s3Service.ensureCors();
  } catch (err) {
    console.error("[S3] CORS setup error:", err);
    // Non-fatal: uploads may fail but the rest of the app is fine
  }

  // Same, for the separate private KYC bucket — a fresh bucket has no CORS
  // and the browser's presigned PUT dies before it reaches S3 without one.
  try {
    await ensureKycCors();
  } catch (err) {
    console.error("[orgKycStorage] CORS setup error:", err);
  }

  if (jobs) await startDispatchers();
}

// Interval/timeout-driven sweepers and ticks, plus the Note-Taker BullMQ
// workers. Each block guards itself: a failure is logged and the rest go on.
async function scheduleBackgroundJobs(): Promise<void> {
  // Start Note-Taker BullMQ workers (summarize + distribute)
  try {
    const { startSummarizeWorker } = await import("./note-taker/jobs/summarize.worker");
    const { startDistributeWorker } = await import("./note-taker/jobs/distribute.worker");
    startSummarizeWorker();
    startDistributeWorker();
    console.log("[NoteTaker] workers started");
  } catch (err) {
    console.error("[NoteTaker] Failed to start workers:", err);
  }

  // Stale live-meet sweeper — marks any Meet with status=live but endTime in
  // the past as ended. Catches sessions where the host closed the browser
  // without hitting /stop.
  try {
    const { Meet } = await import("./models/meet.model");
    const sweepStaleMeets = async () => {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - 8 * 60 * 60 * 1000); // 8h ago
      const result = await Meet.updateMany(
        {
          status: "live",
          $or: [
            { endTime: { $lt: now } },
            // Meetings with no endTime that have been "live" for 8+ hours
            { endTime: null, startedAt: { $lt: staleThreshold } },
            { endTime: { $exists: false }, startedAt: { $lt: staleThreshold } },
          ],
        },
        { $set: { status: "ended", endedAt: now } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[MeetSweeper] Marked ${result.modifiedCount} stale meeting(s) as ended`);
      }
    };
    await sweepStaleMeets();
    setInterval(() => sweepStaleMeets().catch(() => {}), 30 * 60 * 1000);
    console.log("[MeetSweeper] Stale-meet sweeper scheduled");
  } catch (err) {
    console.error("[MeetSweeper] Failed to start sweeper:", err);
  }

  // Public FX rate refresh (src/fx/fxService.ts, backs /public/fx/*) —
  // boot warm-up so the very first request after a deploy/restart has a
  // fresh snapshot rather than falling through to the static fallback
  // table, then an hourly refresh to keep it current. refreshRates()
  // never throws, but this is still fire-and-forget + defensively
  // wrapped, matching the other sweepers in this file.
  try {
    refreshRates().catch((err) => console.error("[FX] boot warm-up failed:", err));
    setInterval(() => refreshRates().catch((err) => console.error("[FX] hourly refresh failed:", err)), 60 * 60 * 1000);
    console.log("[FX] rate refresh scheduled");
  } catch (err) {
    console.error("[FX] Failed to schedule rate refresh:", err);
  }

  // Module-RBAC permission-grant expiry sweeper — retires pending grants the
  // member never answered within 24h. This is HOUSEKEEPING, not enforcement:
  // every read and accept path in routes/rbac.ts already checks expiresAt
  // lazily (services/permissionGrant.ts#expireIfLapsed), so a stalled sweeper
  // can leave stale-looking rows in the founder's audit list but can never
  // leak access. Rows are flipped, never deleted — the grant history is the
  // audit trail.
  try {
    const { PermissionGrant } = await import("./models/permissionGrant.model");
    const sweepExpiredPermissionGrants = async () => {
      const result = await PermissionGrant.updateMany(
        {
          action: "grant",
          status: "pending",
          expiresAt: { $lt: new Date() },
        },
        { $set: { status: "expired", respondedAt: new Date() } }
      );
      if (result.modifiedCount > 0) {
        console.log(
          `[PermissionGrantSweeper] Expired ${result.modifiedCount} unanswered permission grant(s)`
        );
      }
    };
    await sweepExpiredPermissionGrants();
    setInterval(
      () => sweepExpiredPermissionGrants().catch(() => {}),
      30 * 60 * 1000
    );
    console.log("[PermissionGrantSweeper] Grant expiry sweeper scheduled");
  } catch (err) {
    console.error("[PermissionGrantSweeper] Failed to start sweeper:", err);
  }

  // Cancelled-channel-membership expiry sweeper — flips memberships that
  // hit their nextPaymentDate from the "cancelling this cycle" batch
  // (status: "active", subscriptionStatus: "cancelled") to fully expired
  // (status: "inactive", subscriptionStatus: "expired"). The 30-minute
  // cadence caps the worst-case "still has access after cycle end" window
  // at 30 minutes, which is acceptable for a soft SaaS-style cutoff. The
  // query hits the compound index we added on ChannelMembership.
  try {
    const { ChannelMembership } = await import(
      "./models/channelMembership.model"
    );
    const sweepExpiredChannelMemberships = async () => {
      const now = new Date();
      // Find first so we have the row payload to feed the Unsub Log
      // insert. `updateMany` alone wouldn't tell us which rows moved.
      const filter = {
        subscriptionStatus: "cancelled",
        status: "active",
        nextPaymentDate: { $lte: now, $ne: null },
      } as const;
      const toExpire = await ChannelMembership.find(filter)
        .select(
          "_id userId channelId orgId joinedAt cancelledAt nextPaymentDate"
        )
        .lean();
      if (toExpire.length === 0) return;

      const result = await ChannelMembership.updateMany(filter, {
        $set: { status: "inactive", subscriptionStatus: "expired" },
      });

      // Log the expiry — one ChannelMembershipEvent row per flipped
      // membership. Best-effort: errors surface via console but don't
      // stop the sweeper. Deduplicated inside emitExpiredEvents so a
      // crash-restart won't double-log.
      try {
        const { emitExpiredEvents } = await import(
          "./services/channelMembershipEvent"
        );
        await emitExpiredEvents(toExpire as any[]);
      } catch (err: any) {
        console.error(
          "[MembershipSweeper] Failed to write expired events:",
          err?.message ?? err
        );
      }

      if (result.modifiedCount > 0) {
        console.log(
          `[MembershipSweeper] Expired ${result.modifiedCount} cancelled channel membership(s)`
        );
      }
    };
    await sweepExpiredChannelMemberships();
    setInterval(
      () => sweepExpiredChannelMemberships().catch(() => {}),
      30 * 60 * 1000
    );
    console.log(
      "[MembershipSweeper] Cancelled-membership expiry sweeper scheduled"
    );
  } catch (err) {
    console.error("[MembershipSweeper] Failed to start sweeper:", err);
  }

  // Channel-payment-default sweeper — revokes community access the moment
  // a recurring child invoice hits its due date unpaid. Complements the
  // cancel-at-cycle-end sweeper above (which only covers MANUAL cancels);
  // this one covers INVOLUNTARY lapses on our-managed recurring subs.
  //
  // Scope: parents where paymentPlatform !== "razorpay". Razorpay-managed
  // subs are auto-charged by Razorpay itself; their halt path is the
  // subscription.halted webhook → revokeSubscriptionAccess (currently a
  // TODO stub — separate follow-up).
  //
  // Key derivation: child invoices are minted with
  // `expiresAt = thisCycleDue + 7 days` (services/invoice.ts:3226). So
  // `expiresAt <= now + 7 days` is exactly "due date has passed". No
  // computed dueDate field needed.
  //
  // Effects per revocation:
  //   1. Parent.cancelledAt = now — stops generateDueRecurringInvoices
  //      from minting cycle N+1 (that cron filters on cancelledAt null).
  //   2. ChannelMembership.status = "inactive", subscriptionStatus =
  //      "expired", cancelledAt = now — cuts feed/read access.
  //   3. ChannelMembershipEvent with eventType "payment_defaulted" for
  //      the founder Unsub Log.
  //
  // The pending child invoice's own status is deliberately left as
  // draft/pending; expireStaleInvoices flips it to "expired" naturally
  // at its expiresAt (dueDate + 7d). Keeps founder-side collectible
  // metrics honest for those 7 days without leaking access (already
  // cut).
  try {
    const { ChannelMembership } = await import(
      "./models/channelMembership.model"
    );
    const { Invoice } = await import("./models/invoice.model");
    const { default: mongoose } = await import("mongoose");

    const sweepChannelPaymentDefaults = async () => {
      const now = new Date();
      // dueDate = expiresAt - 7d, so dueDate <= now ⇔ expiresAt <= now + 7d
      const dueThreshold = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
      );

      // Single trip. Filter is narrow enough that we don't need pagination
      // for typical loads (sweeper batches are small — few defaults per
      // 30-min tick).
      const candidates = await Invoice.find({
        isRecurring: true,
        parentInvoiceId: { $ne: null },
        status: { $in: ["draft", "pending"] },
        "lineItems.itemType": "channel",
        expiresAt: { $lte: dueThreshold },
      })
        .select(
          "_id userId organizationId parentInvoiceId lineItems status expiresAt",
        )
        .lean();

      if (candidates.length === 0) return;

      // Batch-fetch the parents so we can filter by paymentPlatform +
      // cancelledAt without a per-row query.
      const parentIdSet = new Set(
        candidates.map((c: any) => c.parentInvoiceId.toString()),
      );
      const parentIds = Array.from(parentIdSet).map(
        (id) => new mongoose.Types.ObjectId(id),
      );
      const parents = await Invoice.find({ _id: { $in: parentIds } })
        .select("_id userId paymentPlatform cancelledAt")
        .lean();
      const parentById = new Map(
        parents.map((p: any) => [p._id.toString(), p]),
      );

      // Filter down to revocable candidates.
      const revocations: Array<{
        invoice: any;
        parent: any;
        channelId: any;
      }> = [];
      for (const inv of candidates as any[]) {
        const parent = parentById.get(inv.parentInvoiceId.toString());
        if (!parent) continue;
        if (parent.cancelledAt) continue; // already handled elsewhere
        if (parent.paymentPlatform === "razorpay") continue; // out of scope
        const channelId = inv.lineItems?.[0]?.itemId;
        if (!channelId) continue;
        revocations.push({ invoice: inv, parent, channelId });
      }
      if (revocations.length === 0) return;

      // Apply revocations. Loop is small (few per tick); serial writes
      // keep the code readable and don't stress Mongo.
      const collected: Array<{ membership: any; parent: any }> = [];
      for (const { invoice, parent, channelId } of revocations) {
        // 1. Stamp parent.cancelledAt so no further cycles mint.
        //    Idempotent — the `cancelledAt: null` guard means a
        //    concurrent manual-cancel that already stamped it wins.
        await Invoice.updateOne(
          { _id: parent._id, cancelledAt: null },
          { $set: { cancelledAt: now } },
        );

        // 2. Flip the ChannelMembership. `status: "active"` in the
        //    filter makes this a no-op if the row is already inactive
        //    (crash-restart safety).
        const flipped = await ChannelMembership.findOneAndUpdate(
          {
            userId: parent.userId,
            channelId,
            status: "active",
          },
          {
            $set: {
              status: "inactive",
              subscriptionStatus: "expired",
              cancelledAt: now,
            },
          },
          { new: true },
        ).lean();

        if (flipped) {
          collected.push({ membership: flipped, parent });
        }
      }

      // 3. Emit Unsub Log rows. Best-effort — don't take down the
      //    sweeper if the log insert fails.
      if (collected.length > 0) {
        try {
          const { emitPaymentDefaultedEvents } = await import(
            "./services/channelMembershipEvent"
          );
          await emitPaymentDefaultedEvents(
            collected.map(({ membership, parent }) => ({
              membership: {
                _id: membership._id,
                userId: membership.userId,
                channelId: membership.channelId,
                orgId: membership.orgId,
                joinedAt: membership.joinedAt,
              },
              parent: { _id: parent._id },
            })),
          );
        } catch (err: any) {
          console.error(
            "[PaymentDefaultSweeper] Failed to write payment_defaulted events:",
            err?.message ?? err,
          );
        }
      }

      console.log(
        `[PaymentDefaultSweeper] Revoked ${collected.length} community membership(s) for payment default`,
      );
    };

    await sweepChannelPaymentDefaults();
    setInterval(
      () => sweepChannelPaymentDefaults().catch(() => {}),
      30 * 60 * 1000,
    );
    console.log(
      "[PaymentDefaultSweeper] Channel payment-default sweeper scheduled",
    );
  } catch (err) {
    console.error(
      "[PaymentDefaultSweeper] Failed to start sweeper:",
      err,
    );
  }

  // Webinar recording orphan-segment sweeper. Runs once 2 min after boot
  // (lets the mediasoup worker settle first) and then every 6 hours.
  // Deletes segment files older than 2 days that never got cleaned up by
  // a successful stop (e.g. server crash during concat).
  try {
    const { sweepOrphanSegments } = await import("./services/webinarRecording");
    setTimeout(() => sweepOrphanSegments().catch(() => {}), 2 * 60 * 1000);
    setInterval(() => sweepOrphanSegments().catch(() => {}), 6 * 60 * 60 * 1000);
    console.log("[WebinarRecording] orphan segment sweeper scheduled");
  } catch (err) {
    console.error("[WebinarRecording] sweeper init failed:", err);
  }

  // Content Rewards payout sweeper. Hourly tick refreshes views on
  // approved-but-not-fully-settled submissions, recomputes earnings, and
  // atomically pays the delta from CampaignWallet → ContentRewardsWallet.
  // Cadence matches the existing 1h /refresh-views rate-limit guard.
  try {
    const { sweepContentPayouts } = await import("./services/contentPayoutSweeper");
    setTimeout(
      () =>
        sweepContentPayouts().catch((e) =>
          console.error("[ContentPayouts]", e)
        ),
      60 * 1000
    );
    setInterval(
      () =>
        sweepContentPayouts().catch((e) =>
          console.error("[ContentPayouts]", e)
        ),
      60 * 60 * 1000
    );
    console.log("[ContentPayouts] hourly payout sweeper scheduled");
  } catch (err) {
    console.error("[ContentPayouts] sweeper init failed:", err);
  }

  // NetworkChain monthly rank bonus. Ticks hourly and ensures the current
  // month has a run: on the 1st it fires within the hour, and a mid-month
  // deploy picks that month up immediately rather than skipping it. The
  // RankRun `periodKey` unique index plus the per-payee dedupeKey make the
  // repeated attempts harmless.
  //
  // Unlike every other job here this one takes a DISTRIBUTED lease
  // (services/cronLease.ts) rather than a process-local boolean: a duplicated
  // replica running a process-local guard would happily pay everyone twice.
  //
  // Ships report-only. Money moves only when RANK_BONUS_PAYOUTS_ENABLED=true.
  try {
    const { rankBonusTick } = await import("./services/rankBonus/run");
    setTimeout(
      () => rankBonusTick().catch((e) => console.error("[RankBonus]", e)),
      2 * 60 * 1000
    );
    setInterval(
      () => rankBonusTick().catch((e) => console.error("[RankBonus]", e)),
      60 * 60 * 1000
    );
    console.log(
      `[RankBonus] monthly rank-bonus tick scheduled (payouts ${
        process.env.RANK_BONUS_PAYOUTS_ENABLED === "true" ? "ENABLED" : "DRY RUN"
      })`
    );
  } catch (err) {
    console.error("[RankBonus] scheduler init failed:", err);
  }

  // Genealogy page: freeze each user's NC status / qualification / volume at
  // month close (drives the "active this month" Δ). Hourly + lease, like the
  // rank bonus; first period GENEALOGY_SNAPSHOT_FIRST_PERIOD (default 2026-09).
  try {
    const { genealogySnapshotTick } = await import("./services/genealogy/snapshot");
    setTimeout(
      () => genealogySnapshotTick().catch((e) => console.error("[GenealogySnapshot]", e)),
      3 * 60 * 1000,
    );
    setInterval(
      () => genealogySnapshotTick().catch((e) => console.error("[GenealogySnapshot]", e)),
      60 * 60 * 1000,
    );
  } catch (err) {
    console.error("[GenealogySnapshot] scheduler init failed:", err);
  }

  // NetworkChain offer reminders — the 18h / 12h / 6h / 1h countdown emails on
  // an unclaimed magic link.
  //
  // Every 15 minutes rather than hourly so the 1-hour mark lands inside its
  // hour rather than up to 59 minutes late. The sweep is idempotent per
  // (link, mark) via an atomic $addToSet claim, so a duplicated replica
  // cannot double-send, and a backlog collapses to one email instead of four.
  try {
    const { sweepOfferReminders } = await import(
      "./services/magicLinkReminders"
    );
    const tick = () =>
      sweepOfferReminders().catch((e) =>
        console.error("[OfferReminder] sweep failed:", e?.message || e)
      );
    setTimeout(tick, 90 * 1000);
    setInterval(tick, 15 * 60 * 1000);
    console.log("[OfferReminder] 18/12/6/1-hour offer reminder sweep scheduled");
  } catch (err) {
    console.error("[OfferReminder] scheduler init failed:", err);
  }

  // Garage Jobs sweeper: scheduled publishes, closing dates (releasing held
  // referral rewards), delayed rejection emails, offer expiry and referral
  // reward payouts once a hire's guarantee period ends. Every step claims its
  // rows with a conditional update, so overlapping instances can't double-act.
  try {
    const { sweepJobs } = await import("./services/jobsSweeper");
    const tick = () =>
      sweepJobs().catch((e) => console.error("[JobsSweeper] sweep failed:", e?.message || e));
    setTimeout(tick, 2 * 60 * 1000);
    setInterval(tick, 10 * 60 * 1000);
    console.log("[JobsSweeper] Garage Jobs sweep scheduled every 10 minutes");
  } catch (err) {
    console.error("[JobsSweeper] scheduler init failed:", err);
  }

  // Taskroom member reconcile. Group syncs otherwise only run on link and on
  // membership changes, so a board whose people never change would never pick
  // up a fixed or changed profile photo (members show as initials on cards).
  // The sync is a reconcile, so re-running it is always safe.
  try {
    const { Group } = await import("./models/group.model");
    const { requestGroupTaskroomSync } = await import("./services/groupTaskroom");
    const tick = async () => {
      const linked = await Group.find({
        "taskroom.roomId": { $exists: true },
        "taskroom.status": { $ne: "broken" },
        kind: { $ne: "support" },
      })
        .select("_id")
        .lean();
      for (const g of linked as any[]) requestGroupTaskroomSync(String(g._id));
      console.log(`[TaskroomReconcile] Queued member sync for ${linked.length} linked group(s)`);
    };
    const run = () => tick().catch((e) => console.error("[TaskroomReconcile]", e?.message || e));
    setTimeout(run, 3 * 60 * 1000);
    setInterval(run, 6 * 60 * 60 * 1000);
  } catch (err) {
    console.error("[TaskroomReconcile] scheduler init failed:", err);
  }

  // Group message retention sweeper. Soft-deletes messages older than each
  // group's configured retention window (messageRetentionDays > 0). Matches
  // the soft-delete shape of the user-triggered DELETE /:groupId/message route.
  try {
    const { Group } = await import("./models/group.model");
    const { GroupMessage } = await import("./models/groupMessage.model");
    const sweepGroupRetention = async () => {
      const groups = await Group.find({
        messageRetentionDays: { $gt: 0 },
      })
        .select("_id messageRetentionDays")
        .lean();
      let total = 0;
      for (const g of groups as any[]) {
        const cutoff = new Date(
          Date.now() - g.messageRetentionDays * 86400000
        );
        const r = await GroupMessage.updateMany(
          {
            groupId: g._id,
            createdAt: { $lt: cutoff },
            deletedAt: null,
          },
          {
            $set: {
              deletedAt: new Date(),
              text: "",
              attachments: [],
              mentions: [],
              reactions: {},
            },
          }
        );
        total += r.modifiedCount || 0;
      }
      if (total > 0) {
        console.log(`[GroupRetention] soft-deleted ${total} message(s)`);
      }
    };
    setTimeout(() => sweepGroupRetention().catch((e) => console.error("[GroupRetention]", e)), 5 * 60 * 1000);
    setInterval(() => sweepGroupRetention().catch((e) => console.error("[GroupRetention]", e)), 24 * 60 * 60 * 1000);
    console.log("[GroupRetention] daily retention sweeper scheduled");

    // DM retention, same shape as the group sweep above. A DM has no
    // conversation document — only Message rows sharing a `convId` — so the
    // window is read from the DmSettings collection rather than from a parent
    // doc. Only conversations with retention switched ON are scanned.
    const { DmSettings } = await import("./models/dmSettings.model");
    const { Message } = await import("./models/message.model");
    const sweepDmRetention = async () => {
      const convs = await DmSettings.find({
        messageRetentionDays: { $gt: 0 },
      })
        .select("convId messageRetentionDays")
        .lean();
      let total = 0;
      for (const c of convs as any[]) {
        const cutoff = new Date(
          Date.now() - c.messageRetentionDays * 86400000
        );
        const r = await Message.updateMany(
          {
            convId: c.convId,
            createdAt: { $lt: cutoff },
            deletedAt: null,
          },
          {
            $set: {
              deletedAt: new Date(),
              text: "",
              attachments: [],
              reactions: {},
            },
          }
        );
        total += r.modifiedCount || 0;
      }
      if (total > 0) {
        console.log(`[DmRetention] soft-deleted ${total} message(s)`);
      }
    };
    // Offset from the group sweep so the two don't contend on startup.
    setTimeout(() => sweepDmRetention().catch((e) => console.error("[DmRetention]", e)), 6 * 60 * 1000);
    setInterval(() => sweepDmRetention().catch((e) => console.error("[DmRetention]", e)), 24 * 60 * 60 * 1000);
    console.log("[DmRetention] daily retention sweeper scheduled");
  } catch (err) {
    console.error("[GroupRetention] sweeper init failed:", err);
  }

  // Bat246 monthly membership billing — charges $12 to anyone whose free
  // 2-month trial (or previous monthly cycle) has ended, per the new
  // free-trial-then-$12/month model (2026-08-18, replaces the old one-time
  // $20/year purchase for new users). Debits the member's own Bat246 store
  // wallet (allowed to go negative on purpose — see
  // directDebitStoreWalletAllowNegative), credits Alan K's wallet. Only
  // players who came through activateFreeTrialMembership are ever touched —
  // legacy $20/year purchasers have no nextBillingAt and are skipped by the
  // query itself. 6h cadence: plenty tight for a monthly charge, loose
  // enough to never matter performance-wise.
  try {
    const { runDueMembershipBilling } = await import(
      "./bat246/services/bat246MembershipBilling.service"
    );
    const sweepMembershipBilling = async () => {
      const { billed, skipped } = await runDueMembershipBilling();
      if (billed > 0) {
        console.log(`[Bat246MembershipBilling] Charged ${billed} member(s)${skipped > 0 ? `, skipped ${skipped}` : ""}`);
      }
    };
    setTimeout(() => sweepMembershipBilling().catch((e) => console.error("[Bat246MembershipBilling]", e)), 60 * 1000);
    setInterval(() => sweepMembershipBilling().catch((e) => console.error("[Bat246MembershipBilling]", e)), 6 * 60 * 60 * 1000);
    console.log("[Bat246MembershipBilling] monthly billing sweeper scheduled");
  } catch (err) {
    console.error("[Bat246MembershipBilling] sweeper init failed:", err);
  }

  // Whitelabel add-on renewal — daily. Scans subscriptions whose
  // currentEnd falls within the renewal lead window (7d), mints the
  // next $600 invoice, and off_session charges the founder's saved
  // card. Idempotent via metadata.renewalInFlightAt lease.
  try {
    const { runWhitelabelRenewalTick } = await import(
      "./services/whitelabelAddonPurchase"
    );
    const sweepWhitelabelRenewals = async () => {
      const r = await runWhitelabelRenewalTick();
      if (r.scannedCount > 0) {
        console.log(
          `[WhitelabelRenewal] scanned=${r.scannedCount} minted=${r.mintedCount} skipped=${r.skippedCount} errors=${r.errors.length}`,
        );
      }
    };
    setTimeout(
      () => sweepWhitelabelRenewals().catch((e) => console.error("[WhitelabelRenewal]", e)),
      2 * 60 * 1000,
    );
    setInterval(
      () => sweepWhitelabelRenewals().catch((e) => console.error("[WhitelabelRenewal]", e)),
      24 * 60 * 60 * 1000,
    );
    console.log("[WhitelabelRenewal] daily renewal sweeper scheduled");
  } catch (err) {
    console.error("[WhitelabelRenewal] sweeper init failed:", err);
  }

  // HiFi bond payout engine — hourly tick. Settles due interest
  // payments, retries failures with backoff up to
  // BOND_PAYOUT_MAX_ATTEMPTS, and auto-redeems matured holdings.
  //
  // Live on deploy with no env flag: the tick only touches
  // bond_payout_events, which exist only after a founder publishes a
  // bond and an investor buys it. With no instruments it is a no-op.
  //
  // Safe under multiple instances despite there being no leader
  // election: every payout event is pre-created with a unique dedupeKey
  // and claimed with a conditional update before money moves.
  try {
    const { runBondPayoutTick } = await import("./services/bondPayoutEngine");
    const tick = async () => {
      const r = await runBondPayoutTick();
      if (r.due > 0 || r.redeemed > 0 || r.errors.length > 0) {
        console.log(
          `[BondPayouts] due=${r.due} paid=${r.paid} ` +
            `failed=${r.failed} exhausted=${r.exhausted} redeemed=${r.redeemed}` +
            (r.errors.length ? ` errors=${r.errors.length}` : ""),
        );
        for (const e of r.errors.slice(0, 5)) console.error("[BondPayouts]", e);
      }
    };
    setTimeout(() => tick().catch((e) => console.error("[BondPayouts]", e)), 4 * 60 * 1000);
    setInterval(() => tick().catch((e) => console.error("[BondPayouts]", e)), 60 * 60 * 1000);
    console.log("[BondPayouts] hourly payout tick scheduled");
  } catch (err) {
    console.error("[BondPayouts] tick init failed:", err);
  }

  // Whitelabel monthly volume bonus — hourly tick. Settles the
  // last-closed calendar month once, then no-ops until the next month
  // rolls over. Money only moves when WHITELABEL_MONTHLY_BONUS_ENABLED
  // === "true"; otherwise the qualifier list is computed + stored
  // (dry-run-like) and no wallet transactions fire.
  try {
    const { whitelabelMonthlyBonusTick } = await import(
      "./services/whitelabelMonthlyBonus/run"
    );
    const tick = async () => {
      const r = await whitelabelMonthlyBonusTick();
      if ("skipped" in r && r.skipped) return; // quiet no-op
      const outcome = r as any;
      if (outcome?.qualifiedReferrers > 0 || outcome?.failed > 0) {
        console.log(
          `[WhitelabelMonthlyBonus] settled period=${outcome.run?.periodKey} qualified=${outcome.qualifiedReferrers} paidUsd=$${outcome.paidUsd?.toFixed?.(2) ?? outcome.paidUsd} failed=${outcome.failed}`,
        );
      }
    };
    setTimeout(
      () => tick().catch((e) => console.error("[WhitelabelMonthlyBonus]", e)),
      3 * 60 * 1000,
    );
    setInterval(
      () => tick().catch((e) => console.error("[WhitelabelMonthlyBonus]", e)),
      60 * 60 * 1000,
    );
    console.log(
      "[WhitelabelMonthlyBonus] hourly volume-bonus tick scheduled",
    );
  } catch (err) {
    console.error("[WhitelabelMonthlyBonus] tick init failed:", err);
  }

  // Founder Pro-sub monthly volume bonus — hourly tick. Sibling of the
  // whitelabel monthly bonus. Money only moves when
  // FOUNDER_SUB_MONTHLY_BONUS_ENABLED === "true".
  try {
    const { founderSubMonthlyBonusTick } = await import(
      "./services/founderSubMonthlyBonus/run"
    );
    const tick = async () => {
      const r = await founderSubMonthlyBonusTick();
      if ("skipped" in r && r.skipped) return;
      const outcome = r as any;
      if (outcome?.qualifiedReferrers > 0 || outcome?.failed > 0) {
        console.log(
          `[FounderSubMonthlyBonus] settled period=${outcome.run?.periodKey} qualified=${outcome.qualifiedReferrers} paidUsd=$${outcome.paidUsd?.toFixed?.(2) ?? outcome.paidUsd} failed=${outcome.failed}`,
        );
      }
    };
    setTimeout(
      () => tick().catch((e) => console.error("[FounderSubMonthlyBonus]", e)),
      3 * 60 * 1000,
    );
    setInterval(
      () => tick().catch((e) => console.error("[FounderSubMonthlyBonus]", e)),
      60 * 60 * 1000,
    );
    console.log(
      "[FounderSubMonthlyBonus] hourly volume-bonus tick scheduled",
    );
  } catch (err) {
    console.error("[FounderSubMonthlyBonus] tick init failed:", err);
  }

  // Cryptosub renewal — daily. Sibling of the whitelabel renewal.
  try {
    const { runCryptosubRenewalTick } = await import(
      "./services/cryptosubAddonPurchase"
    );
    const sweepCryptosubRenewals = async () => {
      const r = await runCryptosubRenewalTick();
      if (r.scannedCount > 0) {
        console.log(
          `[CryptosubRenewal] scanned=${r.scannedCount} minted=${r.mintedCount} skipped=${r.skippedCount} errors=${r.errors.length}`,
        );
      }
    };
    setTimeout(
      () => sweepCryptosubRenewals().catch((e) => console.error("[CryptosubRenewal]", e)),
      2 * 60 * 1000,
    );
    setInterval(
      () => sweepCryptosubRenewals().catch((e) => console.error("[CryptosubRenewal]", e)),
      24 * 60 * 60 * 1000,
    );
    console.log("[CryptosubRenewal] daily renewal sweeper scheduled");
  } catch (err) {
    console.error("[CryptosubRenewal] sweeper init failed:", err);
  }

  // Cryptosub monthly volume bonus — hourly tick. Mirror of whitelabel.
  try {
    const { cryptosubMonthlyBonusTick } = await import(
      "./services/cryptosubMonthlyBonus/run"
    );
    const tick = async () => {
      const r = await cryptosubMonthlyBonusTick();
      if ("skipped" in r && r.skipped) return;
      const outcome = r as any;
      if (outcome?.qualifiedReferrers > 0 || outcome?.failed > 0) {
        console.log(
          `[CryptosubMonthlyBonus] settled period=${outcome.run?.periodKey} qualified=${outcome.qualifiedReferrers} paidUsd=$${outcome.paidUsd?.toFixed?.(2) ?? outcome.paidUsd} failed=${outcome.failed}`,
        );
      }
    };
    setTimeout(
      () => tick().catch((e) => console.error("[CryptosubMonthlyBonus]", e)),
      3 * 60 * 1000,
    );
    setInterval(
      () => tick().catch((e) => console.error("[CryptosubMonthlyBonus]", e)),
      60 * 60 * 1000,
    );
    console.log(
      "[CryptosubMonthlyBonus] hourly volume-bonus tick scheduled",
    );
  } catch (err) {
    console.error("[CryptosubMonthlyBonus] tick init failed:", err);
  }
}

// Long-running dispatchers that start after the bucket CORS checks.
async function startDispatchers(): Promise<void> {
  // Catalog outbox dispatcher — delivers signed catalog change webhooks to
  // NetworkChainApi. No-op if OPENCLAW_GARAGE_WEBHOOK_SECRET / OPENCLAW_NC_URL
  // aren't set, or when CATALOG_OUTBOX_DISPATCH_DISABLED=true.
  try {
    const { startCatalogDispatcher } = await import(
      "./services/catalogOutbox.dispatcher"
    );
    startCatalogDispatcher();
  } catch (err) {
    console.error("[CatalogDispatcher] failed to start:", err);
  }

  // ─── Crypto background jobs — EXTRACTED to garage-crypto-backend ─
  // Every crypto watcher / poller / reconciler / sweeper / gas-float
  // health check that used to boot here now runs on the sibling
  // service at https://crypto.garage.app (see the CRYPTO_BACKEND_URL
  // proxy for /garage-admin/sweeper in src/app.ts). Only payment
  // REQUEST creation (createRequest) still runs on main, and it does
  // not need a cron. Detection + settlement fires from the crypto
  // backend and calls back via POST /internal/invoices/:id/fulfill-paid.
  //
  // Rollback: `git reset --hard origin/crypto-backup` gives you every
  // deleted service file + the boot block back. See
  // CRYPTO_EXTRACTION_CLEANUP_PLAN.md.

  // Auction win settlement — every 60s, drains the AuctionSettlement queue
  // that garage-store-backend fills when an auction resolves with a winner.
  // Releases the winner's escrow from the platform store wallet, mints a PAID
  // invoice for exactly that amount, and runs it through fulfillInvoice so the
  // seller payout + commission distribution are identical to a normal sale.
  // Idles harmlessly when the queue is empty.
  try {
    const { startAuctionSettlementCron } = await import(
      "./services/auctionSettlement"
    );
    startAuctionSettlementCron();
  } catch (err) {
    console.error("[AuctionSettlement] failed to start:", err);
  }

  // Teamforce simulated clock-in / clock-out daemon: REMOVED.
  //
  // It registered IST cron jobs at 09:45 and 19:00 that wrote TimeTracking
  // entries for a hardcoded participant list, and ran a catch-up on boot so
  // a mid-day restart could fire one immediately. Deleted along with
  // services/teamforce/simulatedClock.ts so no clock entry is ever created
  // automatically — real clock-ins now only come from the authenticated
  // /betty/clock-in and /betty/time-tracking routes, or the manual
  // teamforce-backfill-clock script.
}

// Standalone backend: its own HTTP server. BACKEND_PORT lets it run beside
// `npm run dev:web` when the shared .env sets PORT for the combined server;
// otherwise it uses PORT (default 4000) as it always did.
async function main() {
  const port = Number(process.env.BACKEND_PORT) || env.PORT;

  // Create ONE server and attach Socket.IO to THIS server
  const server = http.createServer(app);
  attachRealtime(server);

  await startBackend();

  server.listen(port, () => {
    console.log(`[HTTP] Listening on :${port} (CORS ${env.FRONTEND_URL})`);
  });
}

/** Flush queued PostHog events (3 s hard cap inside shutdownPostHog). */
export async function stopBackend(): Promise<void> {
  try {
    await shutdownPostHog();
  } catch (err) {
    console.error("[shutdown] posthog flush failed:", err);
  }
}

// Graceful shutdown — pm2 sends SIGINT (default) then SIGKILL after the
// kill timeout. Flush queued PostHog events with a 3 s hard cap so a
// slow/unreachable PostHog can't block a clean restart.
async function shutdown(signal: string): Promise<void> {
  console.log(`[shutdown] received ${signal}, flushing PostHog…`);
  await stopBackend();
  process.exit(0);
}

// Boot only when run directly (`tsx server/index.ts`, `node dist/index.js`).
// server/main.ts imports this module for the pieces above instead.
if (require.main === module) {
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  main().catch((err) => {
    console.error("Fatal boot error:", err);
    process.exit(1);
  });
}

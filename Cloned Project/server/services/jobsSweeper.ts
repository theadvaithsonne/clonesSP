// src/services/jobsSweeper.ts
//
// Time-driven Garage Jobs work, run from index.ts every few minutes:
//   • scheduled postings go live at their publish time
//   • postings past their closing date expire and release any held rewards
//   • delayed rejection emails go out
//   • unanswered offers expire
//   • stage owners hear about applications idle past a stage's "no action for
//     N days" auto-action
//   • job-alert digests (instant / daily / weekly) go to members
//   • referral rewards whose guarantee ended are paid (services/jobRewards.ts)
//
// Every step claims its rows with a conditional update before acting, so two
// instances sweeping at once (local + production) cannot act twice, and every
// step is isolated so one failing never stops the rest.

import { JobPosting } from "../models/jobPosting.model";
import { JobApplication } from "../models/jobApplication.model";
import { JobOffer } from "../models/jobOffer.model";
import { JobAlert } from "../models/jobAlert.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { releaseJobHold, sweepJobRewards } from "./jobRewards";
import { frontendUrl, notifyUsersByEmail, sendCandidateEmail } from "./jobs";
import { buildJobSearchFilter } from "./jobSearch";
import { EMAIL_FROM_NOTIFICATION, sendMail } from "./mailer";

async function step(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err: any) {
    console.error(`[JobsSweeper] ${name} failed:`, err?.message || err);
  }
}

export async function sweepJobs(now = new Date()): Promise<void> {
  await step("scheduled publishes", () => publishScheduled(now));
  await step("closing dates", () => expireClosed(now));
  await step("rejection emails", () => sendDelayedRejections(now));
  await step("offer expiry", () =>
    JobOffer.updateMany({ status: "sent", expiresAt: { $lte: now } }, { $set: { status: "expired" } })
  );
  await step("idle reminders", () => sendIdleReminders(now));
  await step("job alerts", () => sendJobAlerts(now));
  await step("reward payouts", () => sweepJobRewards(now));
}

async function publishScheduled(now: Date) {
  await JobPosting.updateMany(
    { status: "scheduled", publishAt: { $lte: now }, deletedAt: null },
    { $set: { status: "live", publishedAt: now } }
  );
}

async function expireClosed(now: Date) {
  const expiring = await JobPosting.find({
    status: { $in: ["live", "paused", "scheduled"] },
    closesAt: { $lte: now },
    deletedAt: null,
  })
    .select("_id")
    .limit(200)
    .lean();
  for (const job of expiring) {
    const r = await JobPosting.updateOne(
      { _id: job._id, status: { $in: ["live", "paused", "scheduled"] } },
      { $set: { status: "expired", closedAt: now } }
    );
    if (r.modifiedCount) {
      await releaseJobHold(job._id, "closing date passed").catch((e) =>
        console.error(`[JobsSweeper] releasing hold for ${job._id} failed:`, e?.message)
      );
    }
  }
}

async function sendDelayedRejections(now: Date) {
  const rejections = await JobApplication.find({
    status: "rejected",
    "rejection.emailDueAt": { $lte: now },
    "rejection.emailSentAt": null,
  })
    .select("_id jobId orgId profile")
    .limit(100)
    .lean<any[]>();
  for (const app of rejections) {
    const claimed = await JobApplication.updateOne(
      { _id: app._id, status: "rejected", "rejection.emailSentAt": null },
      { $set: { "rejection.emailSentAt": now } }
    );
    if (!claimed.modifiedCount) continue;
    const [job, org] = await Promise.all([
      JobPosting.findById(app.jobId).select("title").lean<any>(),
      Organization.findById(app.orgId).select("name").lean<any>(),
    ]);
    await sendCandidateEmail({
      orgId: String(app.orgId),
      kind: "rejection",
      to: app.profile?.email,
      vars: {
        candidate_name: app.profile?.fullName || "there",
        job_title: job?.title || "the role",
        company: org?.name || "The team",
      },
    });
  }
}

/**
 * Stage auto-action "no action for N days → remind the owner". One email per
 * stage per sweep listing every newly idle candidate; each application is
 * reminded once per stage entry (`idleRemindedAt` claimed atomically).
 */
async function sendIdleReminders(now: Date) {
  const postings = await JobPosting.find({
    deletedAt: null,
    status: { $in: ["live", "paused"] },
    "stages.autoActions.trigger": "idle_days",
  })
    .select("orgId title stages")
    .limit(500)
    .lean<any[]>();

  for (const job of postings) {
    for (const stage of job.stages || []) {
      if (!stage.ownerId) continue;
      const days = (stage.autoActions || [])
        .filter((a: any) => a.trigger === "idle_days" && a.action === "remind_owner" && a.value > 0)
        .map((a: any) => Number(a.value))
        .sort((a: number, b: number) => a - b)[0];
      if (!days) continue;

      const cutoff = new Date(now.getTime() - days * 86400000);
      const idle = await JobApplication.find({
        jobId: job._id,
        stageId: stage.id,
        status: "active",
        isDraft: false,
        lastActivityAt: { $lt: cutoff },
      })
        .select("_id profile stageEnteredAt idleRemindedAt lastActivityAt")
        .limit(200)
        .lean<any[]>();

      const claimedNames: string[] = [];
      for (const app of idle) {
        const entered: Date | undefined = app.stageEnteredAt;
        const due = !app.idleRemindedAt || (entered && new Date(app.idleRemindedAt) < new Date(entered));
        if (!due) continue;
        const claim = await JobApplication.updateOne(
          {
            _id: app._id,
            $or: [
              { idleRemindedAt: null },
              ...(entered ? [{ idleRemindedAt: { $lt: entered } }] : []),
            ],
          },
          { $set: { idleRemindedAt: now } }
        );
        if (claim.modifiedCount) claimedNames.push(app.profile?.fullName || "A candidate");
      }
      if (!claimedNames.length) continue;

      const list = claimedNames.slice(0, 20).map((n) => `• ${n}`).join("\n");
      const more = claimedNames.length > 20 ? `\n…and ${claimedNames.length - 20} more` : "";
      await notifyUsersByEmail(
        String(job.orgId),
        [String(stage.ownerId)],
        `${claimedNames.length} candidate${claimedNames.length === 1 ? "" : "s"} waiting in ${stage.name} · ${job.title}`,
        `No action for ${days} day${days === 1 ? "" : "s"} on these ${stage.name} candidates for ${job.title}:\n\n${list}${more}\n\nReview them in Garage Jobs: ${frontendUrl("/workspace")}`
      );
    }
  }
}

function alertDue(alert: any, now: Date): boolean {
  const last = alert.lastSentAt ? new Date(alert.lastSentAt).getTime() : null;
  if (alert.frequency === "instant") return true;
  if (alert.frequency === "daily") return last === null || now.getTime() - last >= 24 * 3600000;
  if (alert.frequency === "weekly") {
    if (now.getUTCDay() !== (typeof alert.weekday === "number" ? alert.weekday : 1)) return false;
    return last === null || now.getTime() - last >= 6 * 86400000;
  }
  return false;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Job-alert digests. An alert is claimed (lastSentAt advanced) with a
 * conditional update on its previous lastSentAt before the email goes out; an
 * alert with no new matches is left untouched so its window keeps growing.
 */
async function sendJobAlerts(now: Date) {
  const dayAgo = new Date(now.getTime() - 24 * 3600000);
  const sixDaysAgo = new Date(now.getTime() - 6 * 86400000);
  const cursor = JobAlert.find({
    active: true,
    $or: [
      { frequency: "instant" },
      { frequency: "daily", $or: [{ lastSentAt: null }, { lastSentAt: { $lte: dayAgo } }] },
      { frequency: "weekly", $or: [{ lastSentAt: null }, { lastSentAt: { $lte: sixDaysAgo } }] },
    ],
  })
    .limit(1000)
    .lean<any[]>()
    .cursor();

  for await (const alert of cursor) {
    try {
      if (!alertDue(alert, now)) continue;
      const since: Date = alert.lastSentAt || alert.createdAt;
      const filter = await buildJobSearchFilter(alert.criteria || {}, { publishedAfter: since });
      const matches = await JobPosting.find(filter).sort({ publishedAt: -1 }).limit(10).lean<any[]>();
      if (!matches.length) continue;

      const claimed = await JobAlert.updateOne(
        { _id: alert._id, active: true, lastSentAt: alert.lastSentAt ?? null },
        { $set: { lastSentAt: now } }
      );
      if (!claimed.modifiedCount) continue;

      const user = await User.findById(alert.userId).select("email name").lean<any>();
      if (!user?.email) continue;
      const total = await JobPosting.countDocuments(filter);
      const orgs = await Organization.find({ _id: { $in: matches.map((m) => m.orgId) } })
        .select("name")
        .lean<any[]>();
      const orgName = new Map(orgs.map((o) => [String(o._id), o.name]));

      const lines = matches.map((m) => {
        const where = m.workplace === "remote" ? "Remote" : (m.locations || [])[0] || "";
        return {
          title: m.title,
          company: orgName.get(String(m.orgId)) || "",
          where,
          url: frontendUrl(`/workspace?openApp=jobs&jobId=${m._id}`),
        };
      });
      const subject = `${total} new job${total === 1 ? "" : "s"} for “${alert.name}”`;
      const text = `Hi ${user.name || "there"},\n\nNew roles matching your alert “${alert.name}”:\n\n${lines
        .map((l) => `• ${l.title} — ${[l.company, l.where].filter(Boolean).join(" · ")}\n  ${l.url}`)
        .join("\n")}${total > lines.length ? `\n\n…and ${total - lines.length} more in Garage Jobs.` : ""}\n\nManage your alerts in Garage Jobs → Saved → Job alerts.`;
      const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#111;max-width:560px">
<p style="margin:0 0 14px">Hi ${escapeHtml(user.name || "there")},</p>
<p style="margin:0 0 14px">New roles matching your alert <strong>${escapeHtml(alert.name)}</strong>:</p>
${lines
  .map(
    (l) =>
      `<p style="margin:0 0 12px"><a href="${escapeHtml(l.url)}" style="color:#111;font-weight:600">${escapeHtml(l.title)}</a><br/><span style="color:#555">${escapeHtml(
        [l.company, l.where].filter(Boolean).join(" · ")
      )}</span></p>`
  )
  .join("")}
${total > lines.length ? `<p style="margin:0 0 14px;color:#555">…and ${total - lines.length} more in Garage Jobs.</p>` : ""}
<p style="margin:16px 0 0;color:#777;font-size:12px">Manage your alerts in Garage Jobs → Saved → Job alerts.</p>
</div>`;
      await sendMail(user.email, subject, html, text, EMAIL_FROM_NOTIFICATION).catch((e: any) =>
        console.error(`[JobsSweeper] alert ${alert._id} email failed:`, e?.message)
      );
    } catch (err: any) {
      console.error(`[JobsSweeper] alert ${alert?._id} failed:`, err?.message || err);
    }
  }
}

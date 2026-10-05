import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { Workshop } from "../models/workshop.model";
import { User } from "../models/user.model";
import { Floor } from "../models/floor.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Channel } from "../models/channel.model";
import { Organization } from "../models/organization.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, EMAIL_FROM_OTP, senderForHost} from "../services/mailer";
import { signJwt } from "../services/jwt";
import { addUserToGarageHQ } from "../services/init";
import { autoJoinDefaultChannel } from "../services/channel";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import {
  ensureUserHasAffiliateId,
  setReferredBy,
  setReferredByAffiliateId,
} from "../services/affiliate";
import { Meet } from "../models/meet.model";
import { isStreamStaff } from "../services/webinarHost";
import { rooms } from "../services/mediasoup";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import {
  hasSessionAccess,
  registerForFreeWorkshop,
} from "../services/workshop";
import {
  calculateSessions,
  isValidSessionDate,
  getNextSession,
} from "../utils/recurrence";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { s3Service } from "../services/s3";
import {
  isSessionDeleted,
  sessionDayKey,
  computeSessionWindow,
  deriveClockStatus,
} from "../utils/workshopStatus";
import {
  resolveEffectiveSession,
  resolveSessionPricing,
} from "../utils/sessionOverlay";
import { createInvoice } from "../services/invoice";

const router = Router();

// ── Onboard participant (duplicated from publicMeet to avoid coupling) ────

async function onboardParticipant(params: {
  email: string;
  orgId: any;
  channelIds?: any[];
  affiliateId?: string;
  displayName?: string;
}): Promise<{ user: any; onboarded: boolean; isNew: boolean }> {
  const { email, orgId, channelIds, affiliateId, displayName } = params;
  const normalizedEmail = email.toLowerCase().trim();

  let user = await User.findOne({ email: normalizedEmail });
  const isNew = !user;

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      name: displayName?.trim() || undefined,
      guest: true,
      isVerified: true,
    });
    console.log(`[Public Webinar] Created new user: ${normalizedEmail}`);
  } else if (!user.name && displayName?.trim()) {
    user.name = displayName.trim();
    await user.save();
  }

  const isMember = user.organizations?.some(
    (m: any) => m.organization.toString() === orgId.toString()
  );

  if (isMember) {
    return { user, onboarded: false, isNew };
  }

  const firstFloor = await Floor.findOne({ orgId }).sort({ level: 1 }).lean();

  user.organizations = user.organizations || [];
  user.organizations.push({
    organization: orgId,
    role: "stakeholder",
    guest: true,
    floorId: firstFloor?._id || undefined,
    joinedAt: new Date(),
  } as any);
  await user.save();
  console.log(
    `[Public Webinar] Added user ${normalizedEmail} to org ${orgId} as guest stakeholder`
  );

  // Guest, always — a webinar viewer is a customer of GARAGE HQ, exactly like
  // a direct my.garage.app signup. Without the flag this minted full
  // stakeholders, and every webinar-onboarded user wore an "Employee" badge
  // (and the Employee menu) for the platform org.
  await addUserToGarageHQ(user._id.toString(), { guest: true });

  if (affiliateId) {
    const wasSet = await setReferredByAffiliateId(
      user._id.toString(),
      affiliateId
    );
    if (!wasSet) {
      await setReferredBy(user._id.toString());
    }
  } else {
    const founder = await User.findOne({
      organizations: {
        $elemMatch: { organization: orgId, role: "founder" },
      },
    })
      .select("_id affiliateId")
      .lean();

    if (founder?.affiliateId) {
      const wasSet = await setReferredByAffiliateId(
        user._id.toString(),
        founder.affiliateId
      );
      if (!wasSet) {
        await setReferredBy(user._id.toString());
      }
    } else {
      await setReferredBy(user._id.toString());
    }
  }

  await ensureUserHasAffiliateId(user._id.toString());

  if (isNew) {
    sendWelcomeEmail(user._id.toString(), orgId.toString()).catch((err) =>
      console.error("[WelcomeEmail] Failed:", err)
    );
  }

  if (channelIds && channelIds.length > 0) {
    // Auto-join FREE channels only. Paid channels require their own invoice
    // (chained ahead of the workshop invoice in prepare-join). Handing out
    // paid communities here for free was the bug this replaces.
    const freeChannels = await Channel.find({
      _id: { $in: channelIds },
      $or: [{ isFree: true }, { price: { $in: [null, 0] } }],
    })
      .select("_id")
      .lean();
    const { addUserToChannel } = await import("../services/channel");
    for (const ch of freeChannels) {
      // Through the service, not a direct write — that is what mints the $0
      // invoice for each bundled community join.
      await addUserToChannel(
        user._id.toString(),
        String(ch._id),
        orgId.toString(),
        { source: "bundled" },
      );
    }
  }

  // The org's founder-designated default community, when one exists — the
  // same landing every other join flow gives a new member (guest auth,
  // profile completion, channel checkout). The linked free channels above
  // are the workshop's own; this one belongs to the office. No-op without
  // a designated default, and never fatal to onboarding.
  try {
    await autoJoinDefaultChannel(user._id.toString(), orgId.toString());
  } catch (chErr) {
    console.warn(
      "[Public Webinar] default community join failed:",
      (chErr as Error).message
    );
  }

  return { user, onboarded: true, isNew };
}

// ── GET /public/webinar/debug?id={workshopId} (temporary diagnostic) ──────

router.get("/debug", (req: Request, res: Response) => {
  const id = req.query.id as string;
  const room = rooms.get(id);
  if (!room) {
    return res.json({ roomExists: false, allRooms: Array.from(rooms.keys()) });
  }
  const peers = Array.from(room.peers.entries()).map(([sid, p]) => ({
    socketId: sid,
    userId: p.userId,
    name: p.name,
    role: p.role,
    producers: Array.from(p.producers.keys()),
    transports: Array.from(p.transports.keys()),
  }));
  return res.json({ roomExists: true, peerCount: peers.length, peers });
});

// ── GET /public/webinar/validate?id={workshopId} ─────────────────────────

router.get("/validate", async (req: Request, res: Response) => {
  // The resolved session date is computed relative to "now", so this response
  // must never be cached — a browser/CDN holding an old copy is exactly why a
  // link that's correct in a fresh browser still showed yesterday's date where
  // it had been opened before.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  const schema = z.object({
    id: z.string().min(1, "Webinar ID is required"),
    // Which session of a recurring series the viewer landed on. Optional —
    // omitted (or unparseable) falls back to whatever the series says, which
    // is exactly the pre-per-session-editing behaviour.
    sessionDate: z.string().optional(),
  });

  try {
    schema.parse({ id: req.query.id, sessionDate: req.query.sessionDate });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid request",
      errors: error instanceof z.ZodError ? error.issues : [],
    });
  }

  const id = req.query.id as string;
  const sessionDateParam = req.query.sessionDate as string | undefined;

  try {
    if (!Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid webinar ID" });
    }

    const workshop = await Workshop.findById(id)
      .populate("createdBy", "name email affiliateId profilePicture")
      .populate("speakers", "name profilePicture designation")
      .lean();

    if (!workshop) {
      return res
        .status(404)
        .json({ success: false, message: "Webinar not found" });
    }

    const host = workshop.createdBy as any;
    const org = await Organization.findById(workshop.orgId, {
      icon: 1,
      colored_icon: 1,
      white_icon: 1,
      name: 1,
      branding: 1,
    }).lean();

    // Check if webinar is live:
    // 1. mediasoup room exists in memory (host connected to this instance), OR
    // 2. Meet record has status "live" (works across server restarts / instances)
    let isLive = rooms.has(id);
    if (!isLive && workshop.meetingId) {
      const meet = await Meet.findById(workshop.meetingId).select("status").lean();
      if (meet?.status === "live") isLive = true;
    }

    /**
     * Which session is this page about, and what does that session say?
     *
     * Resolution order: the explicit `?sessionDate=` the founder's per-session
     * link carries, then the session the host has actually started. Neither
     * present (or the workshop isn't recurring) → the series, unchanged.
     *
     * The title/cover below then come from the SESSION, so a viewer landing on
     * an edited occurrence sees its own name rather than the series template.
     */
    let sessionOverride: any = null;
    let sessionKey: Date | null = null;
    if (workshop.isRecurring) {
      // Which occurrence this page describes:
      //   1. explicit ?sessionDate= (a per-session link) wins;
      //   2. else, if a session is LIVE right now, the one the host started;
      //   3. else the NEXT upcoming occurrence computed from the recurrence
      //      relative to now.
      //
      // (3) is the fix for share links showing a stale date: they carry no
      // ?sessionDate=, and `currentSessionDate` is only the last session a host
      // *started* — it never rolls forward on its own, so a daily series sat on
      // yesterday's (or the series' original start) date. Deriving the next
      // occurrence live keeps the shared link on today's/next session.
      let anchor: Date | null = null;
      if (sessionDateParam) {
        anchor = new Date(sessionDateParam);
      } else if (isLive && (workshop as any).currentSessionDate) {
        anchor = new Date((workshop as any).currentSessionDate);
      } else {
        const next = getNextSession(
          (workshop as any).recurrencePattern,
          (workshop as any).recurrenceStartDate || (workshop.date as Date),
          (workshop as any).startTime,
          (workshop as any).endTime,
          (workshop as any).timezone,
          (workshop as any).recurrenceEndDate,
        );
        anchor =
          next?.date ??
          ((workshop as any).currentSessionDate
            ? new Date((workshop as any).currentSessionDate)
            : null);
      }
      if (anchor && !isNaN(anchor.getTime())) {
        sessionKey = sessionDayKey(anchor);
        sessionOverride = await WorkshopSessionOverride.findOne({
          workshopId: workshop._id,
          sessionDate: sessionKey,
        }).lean();
      }
    }
    const effective = resolveEffectiveSession(
      workshop as any,
      sessionKey || (workshop.date as Date),
      sessionOverride
    );

    return res.status(200).json({
      success: true,
      webinar: {
        id: workshop._id.toString(),
        title: effective.title,
        description: effective.description || null,
        coverPhoto: effective.thumbnail || null,
        orgIcon:
          org?.icon ||
          (org as any)?.colored_icon ||
          (org as any)?.white_icon ||
          null,
        orgName: org?.name || null,
        // The mobile waiting room's "View enrolled webinar" switches the
        // viewer into this org before opening its Live tab.
        orgId: workshop.orgId ? workshop.orgId.toString() : null,
        brandColor: (org as any)?.branding?.primaryColor || null,
        // For a recurring series these must be the RESOLVED occurrence, not the
        // series' original start date — otherwise a client that renders
        // `startTime` shows the very first session (e.g. the series start) no
        // matter which occurrence this page is really about.
        startTime: sessionKey ? effective.startDateTime : workshop.date,
        endTime: sessionKey ? effective.endDateTime : workshop.date,
        startTimeStr: effective.startTime,
        endTimeStr: effective.endTime,
        timezone: effective.timezone,
        // Identity of the occurrence this page is describing, so a client can
        // tell "the series" from "session N" without re-deriving it. Null on
        // non-recurring streams and when no session could be resolved.
        sessionDate: sessionKey ? sessionKey.toISOString() : null,
        sessionStartDateTime: sessionKey
          ? effective.startDateTime.toISOString()
          : null,
        sessionEndDateTime: sessionKey
          ? effective.endDateTime.toISOString()
          : null,
        sessionIsEdited: effective.isEdited,
        sessionSpeakerName: effective.speakerName || null,
        sessionSpeakerBio: effective.speakerBio || null,
        sessionSpeakerAvatar: effective.speakerAvatar || null,
        hostName: host?.name || "Host",
        hostEmail: host?.email || "",
        hostAvatar: host?.profilePicture || null,
        hostAffiliateId: host?.affiliateId || null,
        // The founder's billed speakers, for the page's About section.
        speakers: (((workshop as any).speakers || []) as any[])
          .filter((sp) => sp && typeof sp === "object" && sp.name)
          .map((sp) => ({
            id: sp._id.toString(),
            name: sp.name,
            avatar: sp.profilePicture || null,
            title: sp.designation || null,
          })),
        isLive,
        status: isLive ? "live" : "scheduled",
        isRecurring: workshop.isRecurring || false,
        // Funnel content for the mobile join page — the founder authors
        // these in create-webinar; public info by design.
        learningPoints: (workshop as any).learningPoints || [],
        faqs: ((workshop as any).faqs || []).map((f: any) => ({
          question: f.question,
          answer: f.answer,
        })),
        // Session pricing only diverges in per_session mode — see
        // resolveSessionPricing. `once` resolves to the series price.
        isFree:
          (workshop as any).enrollmentType === "per_session"
            ? effective.isFree
            : !!workshop.isFree || (workshop.price || 0) <= 0,
        price:
          (workshop as any).enrollmentType === "per_session"
            ? effective.price
            : (workshop.price ?? 0),
        currency: (workshop as any).currency || "USD",
      },
    });
  } catch (error) {
    console.error("[Public Webinar] Error validating webinar:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to validate webinar" });
  }
});

// ── POST /public/webinar/join-request-otp ─────────────────────────────────

router.post("/join-request-otp", async (req: Request, res: Response) => {
  const schema = z.object({
    webinarId: z.string().min(1, "Webinar ID is required"),
    email: z.string().email("Valid email is required"),
  });

  try {
    schema.parse(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid request",
      errors: error instanceof z.ZodError ? error.issues : [],
    });
  }

  const { webinarId, email } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    if (!Types.ObjectId.isValid(webinarId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid webinar ID" });
    }

    const workshop = await Workshop.findById(webinarId)
      .select("title")
      .lean();
    if (!workshop) {
      return res
        .status(404)
        .json({ success: false, message: "Webinar not found" });
    }

    const otp = await createOtp(normalizedEmail, "guest-login");

    await sendMail(
      normalizedEmail,
      `Your Webinar Verification Code - ${workshop.title}`,
      `<p>Your verification code for joining <b>${workshop.title}</b> is <b>${otp}</b> (valid 10 minutes)</p>`,
      `Your verification code is ${otp}`,
      await senderForHost(req, EMAIL_FROM_OTP)
    );

    console.log(
      `[Public Webinar] Sent join OTP to ${normalizedEmail} for webinar ${webinarId}`
    );

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    console.error("[Public Webinar] Error sending join OTP:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send verification code" });
  }
});

// ── POST /public/webinar/join-verify-otp ──────────────────────────────────

router.post("/join-verify-otp", async (req: Request, res: Response) => {
  const schema = z.object({
    webinarId: z.string().min(1, "Webinar ID is required"),
    email: z.string().email("Valid email is required"),
    otp: z.string().length(6, "OTP must be 6 digits"),
    affiliateId: z.string().optional(),
    displayName: z.string().optional(),
  });

  try {
    schema.parse(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid request",
      errors: error instanceof z.ZodError ? error.issues : [],
    });
  }

  const { webinarId, email, otp, affiliateId, displayName } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    if (!Types.ObjectId.isValid(webinarId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid webinar ID" });
    }

    const workshop = await Workshop.findById(webinarId).lean();
    if (!workshop) {
      return res
        .status(404)
        .json({ success: false, message: "Webinar not found" });
    }

    // Verify OTP
    const isValid = await verifyOtp(normalizedEmail, otp, "guest-login");
    if (isValid === false) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired verification code" });
    }

    // Onboard participant (add to org, affiliate tracking, channel subscriptions)
    let onboarded = false;
    let user = await User.findOne({ email: normalizedEmail });
    const isMember = user?.organizations?.some(
      (m: any) => m.organization.toString() === workshop.orgId.toString()
    );

    if (!isMember) {
      try {
        const onboardResult = await onboardParticipant({
          email: normalizedEmail,
          orgId: workshop.orgId,
          channelIds: workshop.channelIds || [],
          affiliateId: affiliateId || undefined,
          displayName: displayName?.trim(),
        });
        user = onboardResult.user;
        onboarded = onboardResult.onboarded;
      } catch (onboardError) {
        console.error(
          "[Public Webinar] Error during onboarding (non-blocking):",
          onboardError
        );
      }
    }

    // Re-fetch user to get affiliateId (may have been set during onboarding)
    if (user) {
      user = (await User.findById(user._id)
        .select("name email affiliateId")
        .lean()) as any;
    }

    const guestName =
      displayName?.trim() || user?.name || normalizedEmail.split("@")[0];

    // Prefer a real user JWT (with userId + orgId) so the same token works
    // for both the webinar socket and authenticated REST endpoints like
    // /api/invoices/generate. Fall back to a guest-only token only if we
    // somehow couldn't resolve a User record.
    let token: string;
    let guestId: string | undefined;
    if (user?._id) {
      token = signJwt(
        {
          userId: user._id.toString(),
          orgId: workshop.orgId.toString(),
          name: guestName,
          email: user.email || normalizedEmail,
        },
        { expiresIn: "12h" }
      );
    } else {
      guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      token = signJwt(
        {
          isGuest: true,
          guestId,
          eventId: webinarId,
          displayName: guestName,
          email: normalizedEmail,
        },
        { expiresIn: "12h" }
      );
    }

    console.log(
      `[Public Webinar] OTP verified for ${normalizedEmail}, webinar ${webinarId}, onboarded=${onboarded}`
    );

    return res.status(200).json({
      success: true,
      verified: true,
      token,
      guestId,
      userId: user?._id?.toString() || null,
      orgId: workshop.orgId.toString(),
      displayName: guestName,
      // Whether the ACCOUNT actually has a name, as opposed to guestName
      // above — which falls back to the email's local part and so is never
      // empty. Clients use this to decide whether to ask for a display
      // name: a returning user shouldn't be asked, a new one must be.
      hasName: !!user?.name,
      userAffiliateId: user?.affiliateId || null,
      onboarded,
    });
  } catch (error) {
    console.error("[Public Webinar] Error verifying OTP:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to verify code" });
  }
});

// ── POST /public/webinar/join-anonymous ───────────────────────────────────
// No email / OTP required. Returns a guest JWT scoped to the webinar.

router.post("/join-anonymous", async (req: Request, res: Response) => {
  const schema = z.object({
    webinarId: z.string().min(1, "Webinar ID is required"),
    displayName: z.string().optional(),
    affiliateId: z.string().optional(),
  });

  try {
    schema.parse(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid request",
      errors: error instanceof z.ZodError ? error.issues : [],
    });
  }

  const { webinarId, displayName, affiliateId } = req.body;

  try {
    if (!Types.ObjectId.isValid(webinarId)) {
      return res.status(400).json({ success: false, message: "Invalid webinar ID" });
    }

    const workshop = await Workshop.findById(webinarId).select("orgId title").lean();
    if (!workshop) {
      return res.status(404).json({ success: false, message: "Webinar not found" });
    }

    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const guestName = displayName?.trim() || `Guest${randomSuffix}`;

    const token = signJwt(
      {
        isGuest: true,
        guestId,
        eventId: webinarId,
        displayName: guestName,
        affiliateId: affiliateId?.trim() || undefined,
      },
      { expiresIn: "12h" }
    );

    return res.json({
      success: true,
      token,
      guestId,
      displayName: guestName,
      affiliateId: affiliateId?.trim() || undefined,
    });
  } catch (error) {
    console.error("[Public Webinar] Error generating anonymous token:", error);
    return res.status(500).json({ success: false, message: "Failed to generate token" });
  }
});

/** Playback URL for an evergreen webinar. Uploads are streamed from S3 via a
 *  short-lived presigned URL generated per request; a LiveKit recording keeps
 *  whatever URL the egress webhook stored. */
async function resolveEvergreenVideoUrl(eg: any): Promise<string | undefined> {
  if (eg?.videoS3Key) {
    try {
      // Comfortably longer than any session, short enough not to be a durable
      // hotlink if the response is shared.
      return await s3Service.getPresignedStreamUrl(eg.videoS3Key, 60 * 60 * 6);
    } catch (err) {
      console.error("[Public Webinar] evergreen stream URL failed:", err);
      return undefined;
    }
  }
  return eg?.videoUrl || undefined;
}

// ── GET /public/webinar/:id/evergreen-state ────────────────────────────────
// The clock for evergreen (pre-recorded, scheduled) webinars.
//
// This endpoint is the ONLY source of playback position: the client never
// computes it. That is what makes every viewer agree on the same moment and
// makes client clock skew irrelevant — join ten minutes late and you are ten
// minutes in, exactly like a broadcast.
//
// Additive by construction: a workshop without `evergreen.enabled` returns
// `{ enabled: false }` and every caller falls straight back to the normal live
// path. See docs/superpowers/specs/2026-09-07-evergreen-webinars-design.md.
router.get("/:id/evergreen-state", async (req: Request, res: Response) => {
  // Time-dependent, exactly like /validate — never let a CDN or browser hold
  // a copy, or a late joiner would resume at somebody else's position.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid webinar ID" });
    }

    const workshop: any = await Workshop.findById(id).lean();
    if (!workshop) {
      return res.status(404).json({ success: false, message: "Webinar not found" });
    }

    const eg = workshop.evergreen;
    if (!eg?.enabled) {
      // Not an evergreen webinar — the caller keeps its existing live behaviour.
      return res.json({ success: true, enabled: false });
    }

    const durationSec = Number(eg.durationSec) || 0;
    if (!durationSec || (!eg.videoUrl && !eg.videoS3Key)) {
      // Enabled but not configured. Reported rather than thrown so the room can
      // show a clear state instead of silently falling through to a live join.
      return res.json({
        success: true,
        enabled: true,
        status: "unconfigured",
        message: "Evergreen is on but no video/duration is set",
      });
    }

    // Resolve which occurrence we are in, using the same rules as /validate so
    // the two can never disagree about "which session is this".
    const sessionDateParam = req.query.sessionDate as string | undefined;
    let sessionKey: Date | null = null;
    if (workshop.isRecurring) {
      let anchorDate: Date | null = null;
      if (sessionDateParam) {
        anchorDate = new Date(sessionDateParam);
      } else {
        // The occurrence containing NOW is the one whose start is <= now; asking
        // for the "next" session from (now - duration) yields it, and otherwise
        // rolls forward to the upcoming one.
        // getNextSession() always searches from "now", which would skip the
        // occurrence already in progress. calculateSessions() takes an explicit
        // fromDate, so searching from (now - duration) returns the session we
        // are currently inside, and otherwise rolls forward to the next one.
        const from = new Date(Date.now() - durationSec * 1000);
        const [cur] = calculateSessions(
          workshop.recurrencePattern,
          workshop.recurrenceStartDate || workshop.date,
          workshop.startTime,
          workshop.endTime,
          from,
          1,
          false,
          workshop.timezone,
          workshop.recurrenceEndDate
        );
        anchorDate = cur?.date ?? null;
      }
      if (anchorDate && !isNaN(anchorDate.getTime())) sessionKey = sessionDayKey(anchorDate);
    }

    const override = sessionKey
      ? await WorkshopSessionOverride.findOne({
          workshopId: workshop._id,
          sessionDate: sessionKey,
        }).lean()
      : null;

    const effective = resolveEffectiveSession(
      workshop,
      sessionKey || (workshop.date as Date),
      override as any
    );

    const serverNow = Date.now();
    const sessionStart = new Date(effective.startDateTime).getTime();
    const sessionEnd = new Date(effective.endDateTime).getTime();
    const elapsedSec = Math.floor((serverNow - sessionStart) / 1000);

    // Looping is the default (and `!== false` so webinars configured before
    // the field existed loop too). The video repeats for the whole scheduled
    // slot, so a 2-minute clip fills a 2-hour session instead of leaving it
    // "ended" for 1h58m. With looping off, the video's length IS the session.
    const loop = eg.loop !== false;
    const slotSec = Math.max(0, Math.floor((sessionEnd - sessionStart) / 1000));
    // A slot that is missing or inverted (bad data) must not shorten the
    // session below the video itself.
    const airSec = loop && slotSec > durationSec ? slotSec : durationSec;

    let status: "upcoming" | "live" | "ended";
    if (elapsedSec < 0) status = "upcoming";
    else if (elapsedSec < airSec) status = "live";
    else status = "ended";

    // Position WITHIN the video: wraps on each repeat while `elapsedSec`
    // keeps counting the session. Everyone still lands on the same second of
    // the same repetition, which is what keeps the broadcast illusion.
    const positionSec = loop && durationSec > 0 ? elapsedSec % durationSec : elapsedSec;

    const joinWindowMin =
      eg.joinWindowMin === null || eg.joinWindowMin === undefined
        ? null
        : Number(eg.joinWindowMin);
    const joinWindowClosed =
      status === "live" && joinWindowMin !== null && elapsedSec > joinWindowMin * 60;

    // Next occurrence strictly after the one we just resolved, for the
    // "you missed it — next session at ..." screen.
    let nextSessionAt: string | null = null;
    if (workshop.isRecurring) {
      const after = getNextSession(
        workshop.recurrencePattern,
        workshop.recurrenceStartDate || workshop.date,
        workshop.startTime,
        workshop.endTime,
        workshop.timezone,
        workshop.recurrenceEndDate
      );
      if (after?.startDateTime) nextSessionAt = new Date(after.startDateTime).toISOString();
    }

    return res.json({
      success: true,
      enabled: true,
      status,
      serverNow,
      sessionStart: new Date(sessionStart).toISOString(),
      sessionEnd: new Date(sessionStart + airSec * 1000).toISOString(),
      loop,
      elapsedSec: Math.max(0, elapsedSec),
      sessionDate: sessionKey ? sessionKey.toISOString() : null,
      // Clamped so a client can seek with it directly without range checks.
      positionSec: Math.max(0, Math.min(positionSec, durationSec)),
      durationSec,
      joinWindowClosed,
      nextSessionAt,
      // Withheld unless the session is actually running, so the asset URL is
      // not harvestable from an upcoming session page. Minted fresh per
      // request for uploads — a stored presigned URL would expire (7 days max
      // on S3) and silently break playback.
      videoUrl: status === "live" ? await resolveEvergreenVideoUrl(eg) : undefined,
      simulatedChat: status === "live" ? eg.simulatedChat || [] : [],
      simulatedViewers: eg.simulatedViewers?.enabled
        ? { enabled: true, peak: eg.simulatedViewers.peak || 0 }
        : { enabled: false },
    });
  } catch (error) {
    console.error("[Public Webinar] evergreen-state error:", error);
    return res.status(500).json({ success: false, message: "Failed to load session state" });
  }
});

// ── GET /public/webinar/:id/simulated-audience ────────────────────────────
// The fabricated audience for a session that is CURRENTLY running, revealed
// progressively.
//
// Server-filtered on purpose: returning the whole script would let anyone read
// every "spontaneous" message before it appears, straight from devtools. Only
// lines whose moment has passed are sent, the same reasoning that withholds
// the evergreen video URL until a session is live.
router.get("/:id/simulated-audience", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  try {
    const id = req.params.id;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid webinar ID" });
    }
    const workshop: any = await Workshop.findById(id).lean();
    if (!workshop) return res.status(404).json({ success: false, message: "Webinar not found" });

    const sim = workshop.simulatedAudience;
    if (!sim?.enabled) return res.json({ success: true, enabled: false });

    // When the host actually went live — NOT the scheduled time. A webinar
    // that starts 12 minutes late must not open with 12 minutes of chat
    // dumped in at once.
    const sessionKey = sessionDayKey(workshop.currentSessionDate || workshop.date);
    const override: any = await WorkshopSessionOverride.findOne({
      workshopId: workshop._id,
      sessionDate: sessionKey,
    }).lean();

    const startedAt = override?.manualStartedAt
      ? new Date(override.manualStartedAt).getTime()
      : null;
    if (!startedAt) {
      // Not started yet: the roster is safe to send (the People list needs it
      // the moment someone joins), the script is not.
      return res.json({
        success: true,
        enabled: true,
        started: false,
        elapsedSec: 0,
        people: sim.people || [],
        chat: [],
        viewers: sim.viewers?.enabled ? { enabled: true, peak: sim.viewers.peak || 0 } : { enabled: false },
      });
    }

    const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const chat = (sim.chat || []).filter((m: any) => m.atSec <= elapsedSec);

    return res.json({
      success: true,
      enabled: true,
      started: true,
      serverNow: Date.now(),
      startedAt: new Date(startedAt).toISOString(),
      elapsedSec,
      people: sim.people || [],
      chat,
      viewers: sim.viewers?.enabled ? { enabled: true, peak: sim.viewers.peak || 0 } : { enabled: false },
    });
  } catch (error) {
    console.error("[Public Webinar] simulated-audience error:", error);
    return res.status(500).json({ success: false, message: "Failed to load audience" });
  }
});

// ── POST /public/webinar/demo-host-join ────────────────────────────────────
// Name-only, no email/OTP — mints a token that webinarRoutes.ts's
// livekit-token route and mediasoupHandlers.ts's webinar:joinRoom both treat
// as eligible to be HOST (not just attendee), via a `demoHost: true` claim on
// a synthetic (not a real User) ObjectId identity.
//
// This is intentionally narrow: the org check below is the actual security
// boundary, not the client-supplied webinarId. Only the Bat246 funnel org's
// webinars can ever come back from this route with a usable token — every
// other webinar 403s, regardless of what a client sends.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

router.post("/demo-host-join", async (req: Request, res: Response) => {
  const schema = z.object({
    webinarId: z.string().min(1, "Webinar ID is required"),
    displayName: z.string().min(1, "Name is required"),
  });

  try {
    schema.parse(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid request",
      errors: error instanceof z.ZodError ? error.issues : [],
    });
  }

  const { webinarId, displayName } = req.body;

  try {
    if (!Types.ObjectId.isValid(webinarId)) {
      return res.status(400).json({ success: false, message: "Invalid webinar ID" });
    }

    const workshop = await Workshop.findById(webinarId).select("orgId").lean();
    if (!workshop) {
      return res.status(404).json({ success: false, message: "Webinar not found" });
    }

    if ((workshop as any).orgId?.toString() !== BAT246_ORG_ID) {
      return res.status(403).json({ success: false, message: "Not available for this webinar" });
    }

    const demoUserId = new Types.ObjectId().toString();
    const name = displayName.trim().slice(0, 80);

    const token = signJwt(
      { userId: demoUserId, name, demoHost: true },
      { expiresIn: "12h" }
    );

    return res.json({ success: true, token, displayName: name });
  } catch (error) {
    console.error("[Public Webinar] Error generating demo host token:", error);
    return res.status(500).json({ success: false, message: "Failed to generate token" });
  }
});

// ── POST /public/webinar/prepare-join ─────────────────────────────────────
// Pre-flight gate before the user joins the webinar. Auth = the JWT the
// OTP-verify step issued (userId + orgId payload).
//
// Response shape (union):
//   { ready: true }                                    — user can join now
//   { ready: false, needsSessionPick: true,
//     upcomingSessions: [...] }                         — per-session workshop
//                                                        with no active
//                                                        session; FE shows a
//                                                        picker.
//   { ready: false, invoiceId: string,
//     sessionDate?: string }                            — invoice created;
//                                                        FE opens the iframe.
router.post(
  "/prepare-join",
  requireAuth,
  async (req: Request, res: Response) => {
    const schema = z.object({
      webinarId: z.string().min(1),
      sessionDate: z.string().optional(),
      affiliateId: z.string().optional(),
      // When the buyer already has paid enrolments for DIFFERENT
      // sessions of this workshop, the first prepare-join call returns
      // a warning payload instead of an invoice. The FE re-calls with
      // confirmPay: true after the buyer clicks "Pay for this session
      // anyway".
      confirmPay: z.boolean().optional(),
    });

    try {
      schema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
        errors: error instanceof z.ZodError ? error.issues : [],
      });
    }

    const me = (req as any).user as { userId: string; orgId?: string };
    const { webinarId, sessionDate, affiliateId, confirmPay } = req.body as {
      webinarId: string;
      sessionDate?: string;
      affiliateId?: string;
      confirmPay?: boolean;
    };

    try {
      if (!Types.ObjectId.isValid(webinarId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid webinar ID" });
      }
      const workshop = await Workshop.findById(webinarId).lean();
      if (!workshop) {
        return res
          .status(404)
          .json({ success: false, message: "Webinar not found" });
      }

      const enrollmentType =
        (workshop as any).enrollmentType === "per_session"
          ? "per_session"
          : "once";
      const orgIdStr = workshop.orgId.toString();

      // Bootstrap the user's org membership BEFORE any early return below.
      // Opening a webinar link is what registers a signed-in viewer to the
      // workshop's office — that must hold even when this request ends in
      // needsSessionPick (per-session workshop with no live session), which
      // used to bail out before ever reaching this block, leaving the office
      // out of the viewer's HQs. join-verify-otp handles guests; this is
      // belt-and-braces for pre-existing users hitting a workshop for a new
      // org. The invoice branches further down also rely on it.
      {
        const bootstrapUser = await User.findById(me.userId);
        if (bootstrapUser) {
          const alreadyMember = bootstrapUser.organizations?.some(
            (m: any) => m.organization.toString() === orgIdStr
          );
          if (!alreadyMember) {
            const firstFloor = await Floor.findOne({ orgId: workshop.orgId })
              .sort({ level: 1 })
              .lean();
            bootstrapUser.organizations = bootstrapUser.organizations || [];
            bootstrapUser.organizations.push({
              organization: workshop.orgId,
              role: "stakeholder",
              guest: true,
              floorId: firstFloor?._id || undefined,
              joinedAt: new Date(),
            } as any);
            await bootstrapUser.save();
            try {
              await addUserToGarageHQ(bootstrapUser._id.toString(), { guest: true });
            } catch (hqErr) {
              console.warn("[prepare-join] HQ add failed:", (hqErr as Error).message);
            }
            if (affiliateId) {
              const set = await setReferredByAffiliateId(
                bootstrapUser._id.toString(),
                affiliateId
              );
              if (!set) await setReferredBy(bootstrapUser._id.toString());
            } else {
              await setReferredBy(bootstrapUser._id.toString());
            }
            try {
              await ensureUserHasAffiliateId(bootstrapUser._id.toString());
            } catch {}
          }
        }
      }

      // Channel wiring the guest path (onboardParticipant) gives a new
      // member and this signed-in shortcut used to skip entirely: the
      // workshop's linked FREE channels (paid ones are gated by the
      // community invoice below) and the org's founder-designated default
      // community. Runs on every hit, not just first enrolment — every
      // write is an upsert, and that heals viewers who were enrolled into
      // the office before this fix without any channels. Must never fail
      // the gate: the viewer is on their way into a webinar.
      try {
        if (Array.isArray(workshop.channelIds) && workshop.channelIds.length > 0) {
          const freeLinkedChannels = await Channel.find({
            _id: { $in: workshop.channelIds },
            $or: [{ isFree: true }, { price: { $in: [null, 0] } }],
          })
            .select("_id")
            .lean();
          const { addUserToChannel } = await import("../services/channel");
          for (const ch of freeLinkedChannels) {
            // Through the service, not a direct write — that is what mints the
            // $0 invoice for each bundled community join.
            await addUserToChannel(
              me.userId,
              String(ch._id),
              String(workshop.orgId),
              { source: "bundled" },
            );
          }
        }
        await autoJoinDefaultChannel(me.userId, orgIdStr);
      } catch (chErr) {
        console.warn(
          "[prepare-join] channel auto-join failed:",
          (chErr as Error).message
        );
      }

      // ── Determine sessionDate for recurring workshops ────────────
      // Shared between the free and paid branches. Cases:
      //   sessionDate passed → validate against recurrence pattern.
      //   sessionDate missing + currentSessionDate set → auto-pick it.
      //   sessionDate missing + no active session → picker (per_session)
      //     or next upcoming session (once).
      let effectiveSessionDate: Date | undefined;
      // Runs for EVERY recurring workshop, not just per_session ones. An
      // enrollmentType "once" buyer holds the whole series, but the timing
      // gate below still needs the date of the session they are joining —
      // leaving it unset fell back to workshop.date (the series start,
      // often months old) and answered every join with alreadyEnded.
      if (workshop.isRecurring) {
        if (sessionDate) {
          const parsed = new Date(sessionDate);
          if (isNaN(parsed.getTime())) {
            return res.status(400).json({
              success: false,
              message: "Invalid sessionDate",
            });
          }
          const pattern = (workshop as any).recurrencePattern;
          const startAt =
            (workshop as any).recurrenceStartDate || (workshop as any).date;
          const endAt = (workshop as any).recurrenceEndDate
            ? new Date((workshop as any).recurrenceEndDate)
            : undefined;
          if (
            !pattern ||
            !startAt ||
            !isValidSessionDate(parsed, pattern, new Date(startAt), endAt)
          ) {
            return res.status(400).json({
              success: false,
              message: "The requested date is not a valid session",
            });
          }
          // Trashed session → treat as invalid and prompt the FE to pick
          // another session. Buyers should not be able to join a session
          // the founder has moved to Trash.
          const trashedOverride = await WorkshopSessionOverride.findOne({
            workshopId: workshop._id,
            sessionDate: sessionDayKey(parsed),
          }).lean();
          if (isSessionDeleted(trashedOverride as any)) {
            const upcomingSessions =
              pattern && startAt
                ? calculateSessions(
                    pattern,
                    new Date(startAt),
                    workshop.startTime,
                    workshop.endTime,
                    new Date(),
                    500,
                    false,
                    workshop.timezone,
                    endAt
                  )
                    .filter((s) => {
                      // Exclude trashed dates from the picker too.
                      return true;
                    })
                    .map((s) => ({
                      date: s.date,
                      dateString: s.dateString,
                      startDateTime: s.startDateTime,
                      endDateTime: s.endDateTime,
                      isToday: s.isToday,
                    }))
                : [];
            return res.json({
              ready: false,
              needsSessionPick: true,
              upcomingSessions,
            });
          }
          effectiveSessionDate = parsed;
        } else if ((workshop as any).currentSessionDate) {
          // Auto-pick when the host has started a session — the buyer's
          // intent when they land on /webinar/{id} while it's live is
          // "the one running now".
          effectiveSessionDate = new Date((workshop as any).currentSessionDate);
        } else {
          // No session in flight → FE picker (per_session), or the next
          // upcoming session (once — nothing to pick, they own them all).
          const pattern = (workshop as any).recurrencePattern;
          const startAt =
            (workshop as any).recurrenceStartDate || (workshop as any).date;
          const trashedDates = await WorkshopSessionOverride.find({
            workshopId: workshop._id,
            deletedAt: { $ne: null },
          }).lean();
          const trashedKeys = new Set(
            (trashedDates as any[])
              .filter((o) => isSessionDeleted(o))
              .map((o) =>
                sessionDayKey(o.sessionDate).toISOString().slice(0, 10)
              )
          );
          const upcomingSessions =
            pattern && startAt
              ? calculateSessions(
                  pattern,
                  new Date(startAt),
                  workshop.startTime,
                  workshop.endTime,
                  new Date(),
                  500,
                  false,
                  workshop.timezone,
                  (workshop as any).recurrenceEndDate
                    ? new Date((workshop as any).recurrenceEndDate)
                    : undefined
                )
                  .filter((s) => !trashedKeys.has(s.dateString))
                  .map((s) => ({
                    date: s.date,
                    dateString: s.dateString,
                    startDateTime: s.startDateTime,
                    endDateTime: s.endDateTime,
                    isToday: s.isToday,
                  }))
              : [];
          if (enrollmentType === "per_session") {
            return res.json({
              ready: false,
              needsSessionPick: true,
              upcomingSessions,
            });
          }
          // enrollmentType "once": aim the gate at the next session that
          // has not been trashed. If the series has no future session
          // left, effectiveSessionDate stays unset and the gate falls
          // back to workshop.date as before.
          if (upcomingSessions.length > 0) {
            effectiveSessionDate = new Date(upcomingSessions[0].startDateTime);
          }
        }
      }

      // Pricing is resolved against the SESSION being joined, not the series.
      // Only per_session enrolment can differ per session — in `once` mode the
      // buyer purchases the whole series, so a session-level price would be
      // charging for something they aren't buying.
      const sessionPricingOverride =
        enrollmentType === "per_session" && effectiveSessionDate
          ? await WorkshopSessionOverride.findOne({
              workshopId: workshop._id,
              sessionDate: sessionDayKey(effectiveSessionDate),
            }).lean()
          : null;
      const sessionPricing = resolveSessionPricing(
        workshop as any,
        sessionPricingOverride as any
      );
      const isFreeWorkshop = sessionPricing.isFree;

      // ── Paid community gate ───────────────────────────────────────
      // If the workshop is linked to a PAID community and the buyer is
      // not already an active member, they must pay for the community
      // BEFORE we mint the workshop invoice / register them.
      // Founder rule (enforced in WorkshopsPage FE at creation time):
      // at most ONE paid community per workshop, so at most one channel
      // invoice happens here. Legacy workshops with multiple paid
      // communities are grandfathered — the first unpaid one is billed
      // this round; a subsequent prepare-join call catches the next.
      let allPaidChannels: any[] = [];
      let paidCommunityChannel: any = null;
      if (Array.isArray(workshop.channelIds) && workshop.channelIds.length > 0) {
        allPaidChannels = await Channel.find({
          _id: { $in: workshop.channelIds },
          isFree: false,
          price: { $gt: 0 },
        }).lean();
        for (const ch of allPaidChannels) {
          const membership = await ChannelMembership.findOne({
            userId: new Types.ObjectId(me.userId),
            channelId: ch._id,
            status: "active",
          }).lean();
          if (!membership) {
            paidCommunityChannel = ch;
            break;
          }
        }
      }

      // Total payment steps this WORKSHOP requires — a static property of
      // the workshop's configuration, NOT of the current buyer's payment
      // state. This keeps the "Step X of Y" banner stable across the
      // community→workshop chain: after paying for the community, the
      // workshop invoice still shows "Step 2 of 2" instead of collapsing
      // to "Step 1 of 1" (which would make the banner disappear mid-flow).
      // Legacy workshops with multiple paid communities extend totalSteps
      // so each community payment gets its own numbered step.
      const totalSteps =
        allPaidChannels.length + (isFreeWorkshop ? 0 : 1);
      // How many paid communities the buyer has already completed. Used
      // to compute stepNumber for whichever invoice we mint below.
      const paidCommunitiesCompleted = paidCommunityChannel
        ? allPaidChannels.findIndex(
            (c) => String(c._id) === String(paidCommunityChannel._id),
          )
        : allPaidChannels.length;

      if (paidCommunityChannel) {
        const ch = paidCommunityChannel;
        const chListedPrice = ch.price || 0;
        const chUnitPriceCents = Math.round(chListedPrice * 100);
        const user = await User.findById(me.userId).select("email name").lean();

        // GST mirrors the /feed/channels/:id/create-order + create-subscription
        // flows so a community sold via webinar collects the same tax as one
        // sold from the feed: gated on the BUYER's location, with the
        // founder's gstInclusive answer deciding only whether the listed
        // price already contains the tax.
        const { applyGstToLine: chApplyGst } = await import("../utils/gstTax");
        const {
          resolveBuyerGstRegion: chResolveRegion,
          gstSkippedMetadata: chSkipped,
        } = await import("../utils/gstBuyerRegion");
        const chGstInclusive = !!(ch as any).gstInclusive;
        // buyerUserId (not the `user` doc above) — that one is selected down
        // to email+name and carries no country field.
        const chGstRegion = await chResolveRegion({
          buyerUserId: me.userId,
          paymentCurrency: ch.currency || "USD",
        });
        const chLine =
          chUnitPriceCents > 0
            ? chApplyGst({
                listedAmountMinor: chUnitPriceCents,
                gstInclusive: chGstInclusive,
                buyerInIndia: chGstRegion.inIndia,
              })
            : {
                lineUnitPrice: chUnitPriceCents,
                taxTotal: 0,
                chargeTotal: 0,
                gstMetadata: undefined,
              };
        const chLineItemUnitPrice = chLine.lineUnitPrice;
        const chInvoiceTaxCents = chLine.taxTotal;
        const chGstMetadata = chLine.gstMetadata
          ? {
              ...chLine.gstMetadata,
              buyerCountry: chGstRegion.country,
              buyerRegion: "IN" as const,
              regionSource: chGstRegion.source,
            }
          : undefined;
        const chGstSkipped = chLine.gstMetadata
          ? undefined
          : chSkipped(chGstRegion, "buyer_outside_india");

        const chInvoice = await createInvoice({
          organizationId: orgIdStr,
          sellerId: (ch.createdBy || workshop.createdBy).toString(),
          userId: me.userId,
          customerEmail: (user as any)?.email || "",
          customerName: (user as any)?.name || undefined,
          lineItems: [
            {
              itemType: "channel",
              itemId: ch._id.toString(),
              itemName: ch.title,
              itemDescription: ch.description || undefined,
              itemImage: ch.thumbnail || undefined,
              quantity: 1,
              unitPrice: chLineItemUnitPrice,
              originalCurrency: ch.currency || "USD",
            },
          ],
          itemCurrency: ch.currency || "USD",
          isRecurring: !!ch.isSubscription,
          recurringPeriod: ch.isSubscription
            ? (ch.subscriptionPeriod || "monthly")
            : undefined,
          tax: chInvoiceTaxCents || undefined,
          referralId: affiliateId || undefined,
          metadata: {
            type: "webinar_prepare_join_community",
            workshopId: webinarId,
            ...(effectiveSessionDate
              ? { sessionDate: effectiveSessionDate.toISOString() }
              : {}),
            ...(chGstMetadata ? { gst: chGstMetadata } : {}),
            ...(chGstSkipped ? { gstSkipped: chGstSkipped } : {}),
            ...(ch.isSubscription
              ? { gstAppliedToEachCycle: !!chGstMetadata }
              : {}),
          },
        });
        return res.json({
          ready: false,
          invoiceId: chInvoice._id.toString(),
          stage: "community",
          // Which paid community this is in the ordered sequence (1-based).
          // Matches allPaidChannels order so a legacy 3-paid workshop gets
          // Step 1, 2, 3 as the buyer clears each one.
          stepNumber: paidCommunitiesCompleted + 1,
          totalSteps,
          itemName: ch.title,
          itemPrice: chListedPrice,
          itemCurrency: ch.currency || "USD",
          sessionDate: effectiveSessionDate
            ? effectiveSessionDate.toISOString()
            : undefined,
        });
      }

      // ── Access + registration ─────────────────────────────────────
      // Free workshops: register the user idempotently so they're on
      // the roster regardless of whether the session is live yet.
      // Paid workshops: check paid access.
      // The timing gate below runs for BOTH kinds — a free-workshop
      // buyer clicking a link before start-time should ALSO see the
      // come-back-later screen, not get dropped into a pre-live room.
      const accessDate = effectiveSessionDate || new Date(workshop.date);
      let hasAccess = false;
      // Stream staff — the creator and anyone the founder delegated
      // `live_streams` to — are not buyers and hold no enrolment. Without this
      // the person who did NOT start the session gets quoted a price to enter
      // their own org's stream. Checked first so no payment path is touched.
      const staff = await isStreamStaff(workshop as any, me.userId);
      if (staff) {
        hasAccess = true;
      } else if (isFreeWorkshop) {
        try {
          await registerForFreeWorkshop(
            me.userId,
            webinarId,
            orgIdStr,
            effectiveSessionDate
              ? { sessionDate: effectiveSessionDate }
              : undefined
          );
        } catch (regErr) {
          console.warn(
            "[prepare-join] free workshop register failed:",
            (regErr as Error).message
          );
        }
        hasAccess = true;
      } else {
        const access = await hasSessionAccess(me.userId, webinarId, accessDate);
        hasAccess = access.hasAccess;
      }

      // ── Timing gate — applies to ALL workshop types once access is
      // established. Uses the SAME derivation as the founder's session
      // accordion so the buyer's view and the founder's status agree.
      // Founder-started-early → live regardless of scheduled window.
      // Founder-ended-early   → completed regardless of scheduled window.
      // Otherwise → clock-based against the scheduled window.
      if (hasAccess) {
        // Loaded before the window is computed: a rescheduled session runs at
        // a different time than its slot, and the gate has to test against the
        // time it actually runs. The same document then supplies the
        // manualStartedAt / manualEndedAt that outrank the clock below.
        const targetOverride = await WorkshopSessionOverride.findOne({
          workshopId: workshop._id,
          sessionDate: sessionDayKey(accessDate),
        }).lean();
        const win = computeSessionWindow(
          workshop,
          accessDate,
          targetOverride as any
        );
        // Fail-closed for per_session recurring workshops when the target
        // session date can't be resolved to a live window. In principle
        // isValidSessionDate() upstream catches this — but if a mismatch
        // ever slips through, we must NOT drop the buyer into an active
        // room they don't have a scheduled time for. Non-recurring
        // workshops always resolve (computeSessionWindow derives from
        // workshop.date directly).
        if (
          !win &&
          workshop.isRecurring &&
          enrollmentType === "per_session"
        ) {
          console.warn(
            `[prepare-join] computeSessionWindow returned null for per_session workshop ${webinarId} sessionDate ${accessDate.toISOString()} — rejecting`
          );
          return res.status(400).json({
            success: false,
            message: "Could not resolve session time",
          });
        }
        if (win) {
          const now = new Date();
          const status = deriveClockStatus(
            {
              startDateTime: win.startDateTime,
              endDateTime: win.endDateTime,
            },
            targetOverride as any,
            now
          );
          // Diagnostic log — one line per prepare-join hit inside the
          // timing gate. Makes prod misroutes ("why did Steven land on
          // Jul 14 details for Jul 15 URL?") one grep away. Purely
          // additive; no behaviour change.
          console.log(
            `[prepare-join] gate userId=${me.userId} webinarId=${webinarId} ` +
              `sessionDate=${accessDate.toISOString().slice(0, 10)} ` +
              `hasAccess=${hasAccess} status=${status} ` +
              `override=${targetOverride ? "yes" : "no"} ` +
              `currentSessionDate=${
                (workshop as any).currentSessionDate
                  ? new Date((workshop as any).currentSessionDate)
                      .toISOString()
                      .slice(0, 10)
                  : "none"
              }`
          );
          if (status === "live") {
            // Founder is actively running this session (either the clock
            // says so, or they hit Start early). Let the buyer in.
            return res.json({ ready: true });
          }
          if (status === "completed") {
            // Founder ended early OR scheduled end has passed.
            return res.json({
              ready: false,
              notYetStarted: true,
              alreadyEnded: true,
              sessionDate: accessDate.toISOString(),
              startDateTime: win.startDateTime.toISOString(),
              endDateTime: win.endDateTime.toISOString(),
            });
          }
          // status === "yet-to-happen" — future session logic below.
          if (now < win.startDateTime) {
            // Future session. For per_session recurring, if the buyer
            // also has access to a CURRENTLY-LIVE session (different
            // date), surface a chooser instead of forcing them to wait.
            if (
              workshop.isRecurring &&
              enrollmentType === "per_session" &&
              effectiveSessionDate
            ) {
              const liveDate = (workshop as any).currentSessionDate as
                | Date
                | undefined;
              const targetKey = sessionDayKey(effectiveSessionDate).toISOString();
              const liveKey = liveDate
                ? sessionDayKey(liveDate).toISOString()
                : null;
              if (liveKey && liveKey !== targetKey) {
                const liveAccess = await hasSessionAccess(
                  me.userId,
                  webinarId,
                  new Date(liveDate!)
                );
                if (liveAccess.hasAccess) {
                  const liveOverride = await WorkshopSessionOverride.findOne({
                    workshopId: workshop._id,
                    sessionDate: sessionDayKey(new Date(liveDate!)),
                  }).lean();
                  const liveWin = computeSessionWindow(
                    workshop,
                    new Date(liveDate!),
                    liveOverride as any
                  );
                  if (liveWin) {
                    return res.json({
                      ready: false,
                      needsSessionChoice: true,
                      liveOption: {
                        sessionDate: new Date(liveDate!).toISOString(),
                        startDateTime: liveWin.startDateTime.toISOString(),
                        endDateTime: liveWin.endDateTime.toISOString(),
                      },
                      upcomingOption: {
                        sessionDate: accessDate.toISOString(),
                        startDateTime: win.startDateTime.toISOString(),
                        endDateTime: win.endDateTime.toISOString(),
                      },
                    });
                  }
                }
              }
            }
            return res.json({
              ready: false,
              notYetStarted: true,
              sessionDate: accessDate.toISOString(),
              startDateTime: win.startDateTime.toISOString(),
              endDateTime: win.endDateTime.toISOString(),
            });
          }
          // "completed" / "live" cases already handled above via
          // deriveClockStatus. Falling through here means status is
          // yet-to-happen AND now >= scheduledStart — an inconsistent
          // state that shouldn't occur, but be safe.
        }
        return res.json({ ready: true });
      }

      // ── Wrong-session guard (per_session only) ────────────────────
      // The buyer has NO access to the active/picked session but may
      // have paid enrolments for OTHER sessions of this same workshop.
      // Show them a confirmation before creating a second invoice — the
      // buyer likely meant to attend on the day they already paid for.
      // Bypassed when the FE re-calls with confirmPay: true.
      if (
        workshop.isRecurring &&
        enrollmentType === "per_session" &&
        !confirmPay
      ) {
        const { WorkshopRegistration } = await import(
          "../models/workshopRegistration.model"
        );
        const otherPaid = await WorkshopRegistration.find({
          workshopId: new Types.ObjectId(webinarId),
          userId: new Types.ObjectId(me.userId),
          status: { $ne: "cancelled" },
          hasPaid: true,
          enrollmentType: "session",
          sessionDate: { $ne: effectiveSessionDate },
        })
          .select("sessionDate")
          .lean();
        if (otherPaid.length > 0) {
          return res.json({
            ready: false,
            needsConfirmPay: true,
            paidSessions: otherPaid
              .map((r: any) => r.sessionDate?.toISOString())
              .filter(Boolean),
            currentSessionDate: effectiveSessionDate?.toISOString(),
          });
        }
      }

      // ── Create invoice for the enrolment ─────────────────────────
      // Mirrors the GST + line-item math in workshopCheckout.ts:483.
      // We DON'T handle coupons here — coupons remain a checkout-page
      // affordance. The user can revisit the checkout page for that.
      const price = sessionPricing.price;
      const unitPriceCents = Math.round(price * 100);

      // Gated on the BUYER's location, not the workshop's currency —
      // mirrors workshopCheckout.ts.
      const { applyGstToLine } = await import("../utils/gstTax");
      const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
        "../utils/gstBuyerRegion"
      );
      const gstInclusive = !!(workshop as any).gstInclusive;
      const gstRegion = await resolveBuyerGstRegion({
        buyerUserId: me.userId,
        paymentCurrency: workshop.currency || "USD",
      });
      const gstLine = applyGstToLine({
        listedAmountMinor: unitPriceCents,
        gstInclusive,
        buyerInIndia: gstRegion.inIndia,
      });
      const lineItemUnitPrice = gstLine.lineUnitPrice;
      const invoiceTaxCents = gstLine.taxTotal;
      const gstMetadata = gstLine.gstMetadata
        ? {
            ...gstLine.gstMetadata,
            buyerCountry: gstRegion.country,
            buyerRegion: "IN" as const,
            regionSource: gstRegion.source,
          }
        : undefined;
      const gstSkipped = gstLine.gstMetadata
        ? undefined
        : gstSkippedMetadata(gstRegion, "buyer_outside_india");

      // Org bootstrap already done at the top of the handler (before the
      // community/workshop invoice branches). Fetch the user record only
      // for the customerEmail/customerName fields on the invoice.
      const user = await User.findById(me.userId).select("email name").lean();

      const invoice = await createInvoice({
        organizationId: orgIdStr,
        sellerId: workshop.createdBy.toString(),
        userId: me.userId,
        customerEmail: (user as any)?.email || "",
        customerName: (user as any)?.name || undefined,
        lineItems: [
          {
            itemType: "workshop",
            itemId: webinarId,
            itemName: (sessionPricingOverride as any)?.title || workshop.title,
            itemDescription:
              (sessionPricingOverride as any)?.description ||
              workshop.description ||
              undefined,
            itemImage:
              (sessionPricingOverride as any)?.thumbnail ||
              workshop.thumbnail ||
              undefined,
            quantity: 1,
            unitPrice: lineItemUnitPrice,
            originalCurrency: workshop.currency || "USD",
          },
        ],
        itemCurrency: workshop.currency || "USD",
        tax: invoiceTaxCents || undefined,
        referralId: affiliateId || undefined,
        metadata: {
          type: "webinar_prepare_join",
          ...(effectiveSessionDate
            ? { sessionDate: effectiveSessionDate.toISOString() }
            : {}),
          ...(gstMetadata ? { gst: gstMetadata } : {}),
          ...(gstSkipped ? { gstSkipped } : {}),
        },
      });

      return res.json({
        ready: false,
        invoiceId: invoice._id.toString(),
        stage: "workshop",
        // Workshop is always the LAST step. totalSteps was decided before
        // the community gate short-circuited (community=step 1, workshop
        // =step 2 when both apply; workshop=step 1 when standalone paid).
        stepNumber: totalSteps,
        totalSteps,
        itemName: (sessionPricingOverride as any)?.title || workshop.title,
        itemPrice: price,
        itemCurrency: sessionPricing.currency,
        sessionDate: effectiveSessionDate
          ? effectiveSessionDate.toISOString()
          : undefined,
      });
    } catch (err) {
      console.error("[prepare-join] error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to prepare join" });
    }
  }
);

/**
 * GET /public/webinar/:workshopId/messages
 *
 * Room chat for a FINISHED broadcast, so the public watch page can replay it
 * alongside the recording. Public because that page is — the recording is
 * already served without a login, and the chat happened in the same room.
 *
 * Restricted to workshops that have ended: a live room's chat is served over
 * the socket to people who actually joined, and shouldn't be readable by
 * polling an unauthenticated URL mid-broadcast.
 */
router.get("/:workshopId/messages", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshopId" });
    }

    // "Has it finished?" is answered by the recording, not the workshop doc —
    // these carry no endedAt/isLive/status at all, only scheduled start and
    // end strings. A filed recording exists exactly when the egress has
    // completed, which is also the only case where a replay is being watched.
    const { OrganizationFile } = await import("../models/cabinet.model");
    const hasRecording = await OrganizationFile.exists({
      "metadata.workshopId": workshopId,
      status: "ready",
    });
    if (!hasRecording) {
      return res.status(403).json({
        success: false,
        error: "Chat is available once the recording is ready",
      });
    }

    const { WebinarMessage } = await import("../models/webinarMessage.model");
    const messages = await WebinarMessage.find({ workshopId })
      .sort({ timestamp: 1 })
      .limit(5000)
      .lean();

    res.json({
      success: true,
      messages: messages.map((m: any) => ({
        id: m._id.toString(),
        userId: String(m.userId),
        name: m.userName,
        text: m.text,
        replyTo: m.replyTo,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    console.error("[Public Webinar] Error fetching messages:", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

/**
 * GET /public/webinar/:workshopId/pins
 *
 * The products the host actually put on screen during a finished broadcast.
 *
 * The Shop tab otherwise lists whatever the storefront sells today, which for
 * a recording is the wrong answer twice over: it omits what was being sold in
 * the video, and it shows things that were never mentioned. The pins are the
 * durable trace of the live-selling state, and they carry timestamps, so the
 * watch page can also say when each one went up.
 *
 * Same gate as the chat replay — a filed recording is what marks the session
 * as over. See the messages route above for why that's the signal.
 */
router.get("/:workshopId/pins", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshopId" });
    }

    const { OrganizationFile } = await import("../models/cabinet.model");
    const hasRecording = await OrganizationFile.exists({
      "metadata.workshopId": workshopId,
      status: "ready",
    });
    if (!hasRecording) {
      return res.status(403).json({
        success: false,
        error: "Pinned products are available once the recording is ready",
      });
    }

    const { WebinarProductPin } = await import(
      "../models/webinarProductPin.model"
    );
    const pins = await WebinarProductPin.find({ workshopId })
      .sort({ firstPinnedAt: 1 })
      .limit(200)
      .lean();

    const { getSellable } = await import("../services/sellables");

    const items = await Promise.all(
      pins.map(async (pin: any) => {
        // The pin row is a snapshot taken at pin time: name and price are
        // always there, an image never is. Re-reading the item gets the
        // picture and the storefront slug the Shop tab links with.
        //
        // It can also come back null — the lookups filter on status
        // "active", so anything archived or deleted since the stream is
        // gone. That's exactly when the snapshot has to carry the row: a
        // product pulled from sale still appeared in the video, and
        // dropping it would leave the recording referring to something the
        // Shop tab doesn't list.
        let live: any = null;
        try {
          live = await getSellable(
            String(pin.orgId),
            pin.itemType,
            String(pin.itemId)
          );
        } catch {
          /* fall through to the snapshot */
        }

        return {
          id: String(pin._id),
          itemType: pin.itemType,
          itemId: String(pin.itemId),
          name: live?.name || pin.itemName || "Product",
          price: typeof live?.price === "number" ? live.price : pin.price ?? 0,
          currency: live?.currency || pin.currency || "USD",
          image: live?.image || null,
          storeSlug: live?.storeSlug || null,
          storeName: live?.storeName || null,
          /** False when the item is no longer for sale — the UI says so. */
          available: !!live,
          firstPinnedAt: pin.firstPinnedAt,
          lastPinnedAt: pin.lastPinnedAt,
          pinCount: pin.pinCount ?? 1,
          sessionDate: pin.sessionDate,
        };
      })
    );

    res.json({ success: true, items });
  } catch (error) {
    console.error("[Public Webinar] Error fetching pins:", error);
    res.status(500).json({ success: false, error: "Failed to fetch pins" });
  }
});

/**
 * GET /public/webinar/:workshopId/attendees
 *
 * Who was actually in the room during a finished broadcast, for the public
 * watch page's People tab.
 *
 * Before attendance was recorded the tab could only be rebuilt from chat
 * authors — provably present, but only the people who typed. This is the real
 * roster.
 *
 * Deliberately reduced for a public audience: names and role only. No email,
 * no user id, no watch duration — that belongs to the host's own report
 * (`GET /webinar/:id/analytics`), not to anyone who opens a recording.
 *
 * Same gate as the chat and pin replays: a filed recording is what marks the
 * session as over.
 */
router.get("/:workshopId/attendees", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshopId" });
    }

    const { OrganizationFile } = await import("../models/cabinet.model");
    const hasRecording = await OrganizationFile.exists({
      "metadata.workshopId": workshopId,
      status: "ready",
    });
    if (!hasRecording) {
      return res.status(403).json({
        success: false,
        error: "Attendees are available once the recording is ready",
      });
    }

    const { WebinarAttendance } = await import(
      "../models/webinarAttendance.model"
    );
    const rows = await WebinarAttendance.find({
      workshopId: new Types.ObjectId(workshopId),
    })
      .sort({ firstJoinedAt: 1 })
      .limit(2000)
      .lean();

    res.json({
      success: true,
      attendees: rows.map((a: any) => ({
        // Not the user id — this is public. Enough to key a list, no more.
        id: String(a._id),
        name: a.name || null,
        role: a.role || "attendee",
        sessionDate: a.sessionDate,
        firstJoinedAt: a.firstJoinedAt,
      })),
    });
  } catch (error) {
    console.error("[Public Webinar] Error fetching attendees:", error);
    res.status(500).json({ success: false, error: "Failed to fetch attendees" });
  }
});

/**
 * GET /public/webinar/for-org/:orgId
 *
 * The webinar a white-label landing page should send visitors to.
 *
 * Exists so a landing page can link to "the webinar" without hard-coding an
 * id: a workshop that gets replaced would otherwise leave a dead button, and
 * the id is not something a founder can edit.
 *
 * Preference order is deliberate — a session running right now beats one
 * scheduled later, which beats the most recently created. Public because the
 * page it serves is: no auth, and it returns only what a landing card needs.
 */
router.get("/for-org/:orgId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ success: false, error: "Invalid orgId" });
    }

    const oid = new Types.ObjectId(orgId);

    // Live now — currentSessionDate is set while a session is running and
    // unset when it ends (see mediasoupHandlers endWebinar).
    let workshop = await Workshop.findOne({
      orgId: oid,
      currentSessionDate: { $exists: true, $ne: null },
    })
      .select("title date startTime endTime isRecurring")
      .lean<any>();

    let live = !!workshop;

    if (!workshop) {
      // Otherwise the most recently created one. Deliberately not filtered on
      // a future date: these carry startTime/endTime as strings rather than a
      // reliable timestamp, so date filtering here has historically excluded
      // everything (see the recording-gate comment above).
      workshop = await Workshop.findOne({ orgId: oid })
        .sort({ _id: -1 })
        .select("title date startTime endTime isRecurring")
        .lean<any>();
    }

    if (!workshop) {
      return res.json({ success: true, webinar: null });
    }

    res.json({
      success: true,
      webinar: {
        id: String(workshop._id),
        title: workshop.title || "Webinar",
        startTime: workshop.startTime || null,
        endTime: workshop.endTime || null,
        isRecurring: !!workshop.isRecurring,
        live,
      },
    });
  } catch (error) {
    console.error("[Public Webinar] for-org failed:", error);
    res.status(500).json({ success: false, error: "Failed to load webinar" });
  }
});

export default router;

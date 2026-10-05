import { Router, Request, Response } from 'express';
import { Meet } from '../models/meet.model';
import { MeetParticipant } from '../models/meetParticipant.model';
import { Workshop } from '../models/workshop.model';
import { WorkshopRegistration } from '../models/workshopRegistration.model';
import { User } from '../models/user.model';
import { Floor } from '../models/floor.model';
import { ChannelMembership } from '../models/channelMembership.model';
import { Organization } from '../models/organization.model';
import { verifyMeetJoinCode, isHostEmail, isScheduledInterviewMeet } from '../utils/meetCode';
import { createOtp, verifyOtp } from '../services/otp';
import { sendMail, EMAIL_FROM_OTP, senderForHost} from '../services/mailer';
import { generateGuestSocketToken } from '../services/jwt';
import { createRoom, createParticipantToken, deleteRoom, toLivekitRoomName, setRecordingContext, getLivekitUrl } from '../services/livekit';
import { emitWorkshopPreviewUpdate } from '../services/socket';
import { addUserToGarageHQ } from '../services/init';
import { sendWelcomeEmail } from '../services/welcomeEmail';
import { ensureUserHasAffiliateId, setReferredBy, setReferredByAffiliateId } from '../services/affiliate';
import { z } from 'zod';

const router = Router();

// Validation schemas
const validateCodeSchema = z.object({
  code: z.string().min(1, 'Code is required')
});

const hostRequestOtpSchema = z.object({
  code: z.string().min(1, 'Code is required')
});

const hostVerifyOtpSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  otp: z.string().length(6, 'OTP must be 6 digits')
});

const joinMeetSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  displayName: z.string().min(1, 'Display name is required').max(100).trim(),
  email: z.string().email('Valid email is required'),
  affiliateId: z.string().optional(),
});

const startMeetSchema = z.object({
  code: z.string().min(1, 'Code is required')
});

const screenShareSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  participantId: z.string().min(1, 'Participant ID is required')
});

/**
 * Onboard a participant into a workshop's organization.
 * Handles: find/create user, add to org, GARAGE HQ, referral, affiliate ID, channel subscriptions.
 * If no affiliateId is provided, the org founder is used as the referrer.
 * Idempotent: skips if user is already an org member.
 */
async function onboardParticipant(params: {
  email: string;
  orgId: any;
  channelIds?: any[];
  affiliateId?: string;
  displayName?: string;
}): Promise<{ user: any; onboarded: boolean; isNew: boolean }> {
  const { email, orgId, channelIds, affiliateId, displayName } = params;
  const normalizedEmail = email.toLowerCase().trim();

  // Find or create user
  let user = await User.findOne({ email: normalizedEmail });
  const isNew = !user;

  if (!user) {
    user = await User.create({
      email: normalizedEmail,
      name: displayName?.trim() || undefined,
      guest: true,
      isVerified: true,
    });
    console.log(`[Public Meet] Created new user: ${normalizedEmail}`);
  } else if (!user.name && displayName?.trim()) {
    user.name = displayName.trim();
    await user.save();
  }

  // Check if already a member of this org
  const isMember = user.organizations?.some(
    (m: any) => m.organization.toString() === orgId.toString()
  );

  if (isMember) {
    return { user, onboarded: false, isNew };
  }

  // Get the first floor of the organization
  const firstFloor = await Floor.findOne({ orgId }).sort({ level: 1 }).lean();

  // Add to organization as guest stakeholder
  user.organizations = user.organizations || [];
  user.organizations.push({
    organization: orgId,
    role: 'stakeholder',
    guest: true,
    floorId: firstFloor?._id || undefined,
    joinedAt: new Date(),
  } as any);
  await user.save();
  console.log(`[Public Meet] Added user ${normalizedEmail} to org ${orgId} as guest stakeholder`);

  // Add to GARAGE HQ — as a guest: a meet viewer is a customer of the
  // platform org, same as a direct signup (and the webinar flow).
  await addUserToGarageHQ(user._id.toString(), { guest: true });
  console.log(`[Public Meet] Added user ${normalizedEmail} to GARAGE HQ`);

  // Must happen BEFORE sendWelcomeEmail so referredBy is set when the upline notification fires
  if (affiliateId) {
    // Use provided affiliate ID
    const wasSet = await setReferredByAffiliateId(user._id.toString(), affiliateId);
    if (!wasSet) {
      await setReferredBy(user._id.toString());
    }
  } else {
    // No affiliate ID — find org founder and use their affiliate ID
    const founder = await User.findOne({
      organizations: { $elemMatch: { organization: orgId, role: 'founder' } }
    }).select('_id affiliateId').lean();

    if (founder?.affiliateId) {
      const wasSet = await setReferredByAffiliateId(user._id.toString(), founder.affiliateId);
      if (!wasSet) {
        await setReferredBy(user._id.toString());
      }
    } else {
      await setReferredBy(user._id.toString());
    }
  }

  // Generate affiliate ID for the new user
  await ensureUserHasAffiliateId(user._id.toString());
  console.log(`[Public Meet] Set affiliate info for user ${normalizedEmail}`);

  // Send welcome email for new users (fire-and-forget)
  if (isNew) {
    sendWelcomeEmail(user._id.toString(), orgId.toString()).catch((err) =>
      console.error('[WelcomeEmail] Failed:', err)
    );
  }

  // Subscribe to the meeting's FREE channels only. This had no price filter at
  // all — it upserted membership for every channelId, handing out PAID
  // communities for free. Same guard the other join flows use.
  if (channelIds && channelIds.length > 0) {
    const { Channel } = await import('../models/channel.model');
    const { addUserToChannel } = await import('../services/channel');
    const freeChannels = await Channel.find({
      _id: { $in: channelIds },
      $or: [{ isFree: true }, { price: { $in: [null, 0] } }],
    })
      .select('_id')
      .lean();
    for (const ch of freeChannels) {
      // Through the service, not a direct write — that is what mints the $0
      // invoice for each bundled community join.
      await addUserToChannel(
        user._id.toString(),
        String(ch._id),
        orgId.toString(),
        { source: 'bundled' },
      );
    }
    console.log(
      `[Public Meet] Subscribed user to ${freeChannels.length} free channels (skipped ${channelIds.length - freeChannels.length} paid)`,
    );
  }

  return { user, onboarded: true, isNew };
}

/**
 * Validate a meet join code and get meet details
 * GET /public/meet/validate?code={code}
 */
router.get(
  '/validate',
  async (req: Request, res: Response) => {
    try {
      validateCodeSchema.parse({ code: req.query.code });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code } = req.query;

    try {
      const result = await verifyMeetJoinCode(code as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      const now = new Date();
      let meetStartTime = new Date(result.meet.startTime);
      let meetEndTime = new Date(result.meet.endTime);
      let meetStatus = result.meet.status;
      let meetIsHostVerified = result.meet.isHostVerified;

      // Look up the associated workshop for timezone and recurrence info
      const workshop = await Workshop.findOne({ meetingId: result.meetId }).lean();

      // For ANY workshop, recalculate meet times from workshop.startTime/endTime + timezone
      // This ensures times are always correct even if the workshop timezone was changed after meet creation
      if (workshop && workshop.startTime && workshop.endTime) {
        const { getTimezoneOffsetMinutes } = await import('../utils/recurrence');

        if (workshop.isRecurring && workshop.isRecurrenceActive && workshop.recurrencePattern) {
          // For recurring workshops, get the next session
          const { getNextSession } = await import('../utils/recurrence');
          const nextSession = getNextSession(
            workshop.recurrencePattern,
            workshop.recurrenceStartDate || workshop.date,
            workshop.startTime,
            workshop.endTime,
            workshop.timezone,
            workshop.recurrenceEndDate
          );
          if (nextSession) {
            meetStartTime = nextSession.startDateTime;
            meetEndTime = nextSession.endDateTime;

            // Compare session DATE (not exact time) to decide if we moved to a new session.
            // This prevents resetting status when only the time shifts (e.g., timezone fix).
            const storedDateStr = new Date(result.meet.startTime).toISOString().slice(0, 10);
            const newDateStr = nextSession.dateString;
            const isNewSessionDay = storedDateStr !== newDateStr;

            if (isNewSessionDay) {
              // New session day: reset status so host can start fresh
              // BUT don't reset if the meeting is currently live (host already started
              // this session via /start before validate updated the stored date)
              if (meetStatus === 'live') {
                await Meet.updateOne(
                  { _id: result.meetId },
                  { startTime: meetStartTime, endTime: meetEndTime }
                );
              } else {
                await Meet.updateOne(
                  { _id: result.meetId },
                  { startTime: meetStartTime, endTime: meetEndTime, status: 'scheduled', isHostVerified: false }
                );
                meetStatus = 'scheduled';
                meetIsHostVerified = false;
              }
            } else {
              // Same session day: only update times (timezone correction), keep status intact
              await Meet.updateOne(
                { _id: result.meetId },
                { startTime: meetStartTime, endTime: meetEndTime }
              );
            }
          }
        } else {
          // Non-recurring workshop: recalculate times from workshop fields + timezone
          const workshopDate = new Date(workshop.date);
          const [startH, startM] = workshop.startTime.split(':').map(Number);
          const [endH, endM] = workshop.endTime.split(':').map(Number);

          const startDt = new Date(workshopDate);
          startDt.setUTCHours(startH, startM, 0, 0);
          const endDt = new Date(workshopDate);
          endDt.setUTCHours(endH, endM, 0, 0);
          if (endDt <= startDt) endDt.setUTCDate(endDt.getUTCDate() + 1);

          // Convert from workshop timezone to UTC
          if (workshop.timezone) {
            const offset = getTimezoneOffsetMinutes(startDt, workshop.timezone);
            startDt.setMinutes(startDt.getMinutes() - offset);
            endDt.setMinutes(endDt.getMinutes() - offset);
          }

          meetStartTime = startDt;
          meetEndTime = endDt;

          // Update the meet record so it stays in sync
          await Meet.updateOne(
            { _id: result.meetId },
            { startTime: meetStartTime, endTime: meetEndTime }
          );
        }
      }

      // Check if meeting has ended (a still-scheduled interview's call never is)
      if (now > meetEndTime && !(await isScheduledInterviewMeet(code as string))) {
        // For recurring workshops, show next session info instead of "ended"
        if (workshop && workshop.isRecurring && workshop.isRecurrenceActive && workshop.recurrencePattern) {
          const { calculateSessions } = await import('../utils/recurrence');
          // Get the next session AFTER the current end time
          const futureSessions = calculateSessions(
            workshop.recurrencePattern,
            workshop.recurrenceStartDate || workshop.date,
            workshop.startTime,
            workshop.endTime,
            new Date(meetEndTime.getTime() + 1), // start searching after current session
            1,
            false,
            workshop.timezone
          );
          if (futureSessions.length > 0) {
            const nextFutureSession = futureSessions[0];
            // Look up host affiliate ID for next-session response
            let nextSessionHostAffiliateId: string | undefined;
            const nextSessionHostUser = await User.findOne({ email: result.meet.hostEmail }, { affiliateId: 1 }).lean();
            if (nextSessionHostUser?.affiliateId) {
              nextSessionHostAffiliateId = nextSessionHostUser.affiliateId;
            }

            return res.status(200).json({
              success: true,
              isEnded: true,
              message: 'Current session has ended. Next session is scheduled.',
              meet: {
                id: result.meetId,
                title: result.meet.title,
                description: result.meet.description,
                coverPhoto: workshop.thumbnail || null,
                startTime: nextFutureSession.startDateTime,
                endTime: nextFutureSession.endDateTime,
                status: meetStatus,
                hostEmail: result.meet.hostEmail,
                hostName: result.meet.hostName,
                isHostVerified: meetIsHostVerified,
                isLive: meetStatus === 'live',
                hostAffiliateId: nextSessionHostAffiliateId,
                timezone: workshop.timezone || null,
                isRecurring: true,
                nextSessionInfo: {
                  startDateTime: nextFutureSession.startDateTime,
                  endDateTime: nextFutureSession.endDateTime,
                  dateString: nextFutureSession.dateString
                }
              }
            });
          }
        }

        return res.status(200).json({
          success: true,
          isEnded: true,
          message: 'This meeting has already ended',
          meet: {
            id: result.meetId,
            title: result.meet.title,
            description: result.meet.description,
            coverPhoto: workshop?.thumbnail || null,
            startTime: meetStartTime,
            endTime: meetEndTime,
            status: meetStatus,
            hostEmail: result.meet.hostEmail,
            hostName: result.meet.hostName,
            isHostVerified: meetIsHostVerified,
            isLive: meetStatus === 'live',
            timezone: workshop?.timezone || null,
            isRecurring: workshop?.isRecurring || false
          }
        });
      }

      // Look up the host's affiliate ID so the copy-link button can include it
      let hostAffiliateId: string | undefined;
      const hostUser = await User.findOne({ email: result.meet.hostEmail }, { affiliateId: 1 }).lean();
      if (hostUser?.affiliateId) {
        hostAffiliateId = hostUser.affiliateId;
      }

      // Look up org icon for branding
      const org = await Organization.findById(result.meet.orgId, { icon: 1, colored_icon: 1, white_icon: 1, name: 1, branding: 1 }).lean();

      // Return meet details - let frontend handle the rest
      return res.status(200).json({
        success: true,
        meet: {
          id: result.meetId,
          title: result.meet.title,
          description: result.meet.description,
          coverPhoto: workshop?.thumbnail || null,
          orgIcon: org?.icon || org?.colored_icon || org?.white_icon || null,
          orgName: org?.name || null,
          brandColor: (org as any)?.branding?.primaryColor || null,
          startTime: meetStartTime,
          endTime: meetEndTime,
          status: meetStatus,
          hostEmail: result.meet.hostEmail,
          hostName: result.meet.hostName,
          isHostVerified: meetIsHostVerified,
          isLive: meetStatus === 'live',
          hostAffiliateId,
          timezone: workshop?.timezone || null,
          isRecurring: workshop?.isRecurring || false
        }
      });
    } catch (error) {
      console.error('[Public Meet] Error validating code:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate meeting link'
      });
    }
  }
);

/**
 * Request OTP for host verification
 * POST /public/meet/host-request-otp
 * Body: { code }
 */
router.post(
  '/host-request-otp',
  async (req: Request, res: Response) => {
    try {
      hostRequestOtpSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code } = req.body;

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Generate OTP for the host email
      const otp = await createOtp(result.meet.hostEmail, 'meet-host-verify');

      // Send OTP email to host
      const subject = `Your Meeting Verification Code - ${result.meet.title}`;
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Host Verification</h1>
    </div>
    <div style="padding: 40px 30px;">
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        You're joining as the host of <strong>${result.meet.title}</strong>.
      </p>
      <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        Your verification code is:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="display: inline-block; padding: 20px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 8px; border-radius: 12px;">
          ${otp}
        </span>
      </div>
      <p style="margin: 25px 0 0; color: #666666; font-size: 14px; line-height: 1.6; text-align: center;">
        This code expires in <strong>10 minutes</strong>.
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 25px 30px; text-align: center; border-top: 1px solid #e9ecef;">
      <p style="margin: 0; color: #888888; font-size: 12px;">
        Powered by Roam Workspace
      </p>
    </div>
  </div>
</body>
</html>
`;

      await sendMail(result.meet.hostEmail, subject, html, `Your verification code is: ${otp}`, await senderForHost(req, EMAIL_FROM_OTP));

      console.log(`[Public Meet] Sent host OTP to ${result.meet.hostEmail} for meet ${result.meetId}`);

      return res.status(200).json({
        success: true,
        message: 'Verification code sent to host email',
        hostEmail: maskEmail(result.meet.hostEmail)
      });
    } catch (error) {
      console.error('[Public Meet] Error sending host OTP:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code'
      });
    }
  }
);

/**
 * Verify host OTP and join as host
 * POST /public/meet/host-verify-otp
 * Body: { code, otp }
 */
router.post(
  '/host-verify-otp',
  async (req: Request, res: Response) => {
    try {
      hostVerifyOtpSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code, otp } = req.body;

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Verify the OTP
      const isValid = await verifyOtp(result.meet.hostEmail, otp, 'meet-host-verify');

      if (isValid === false) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      // Get the meet to update
      const meet = await Meet.findById(result.meetId);
      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Mark host as verified and set host name from email
      const hostName = result.meet.hostEmail.split('@')[0]; // Use email prefix as name
      meet.isHostVerified = true;
      meet.hostName = hostName;
      await meet.save();

      // Check if host participant already exists (rejoining after leaving)
      let hostParticipant = await MeetParticipant.findOne({
        meetId: result.meetId,
        email: result.meet.hostEmail,
        isHost: true
      });

      if (hostParticipant) {
        // Host is rejoining - update existing record
        hostParticipant.joinedAt = new Date();
        hostParticipant.leftAt = undefined; // Clear leftAt since they're rejoining
        await hostParticipant.save();
        console.log(`[Public Meet] Host ${result.meet.hostEmail} rejoining meet ${result.meetId}`);
      } else {
        // Create new host participant record
        hostParticipant = await MeetParticipant.create({
          meetId: result.meetId,
          email: result.meet.hostEmail,
          displayName: hostName,
          isHost: true,
          joinedAt: new Date()
        });
      }

      // Delete any existing LiveKit room to clear stale participants from previous sessions,
      // then create a fresh room. Safe for public meets (1 host at a time, no race condition).
      const channelName = meet.agoraChannel;
      const livekitRoomName = toLivekitRoomName(channelName);
      await deleteRoom(livekitRoomName);
      const room = await createRoom(livekitRoomName);
      const livekitToken = await createParticipantToken(livekitRoomName, {
        userId: hostParticipant._id.toString(),
        userName: hostName,
        isOwner: true,
      });

      // Set recording context for webhook-based cabinet upload
      setRecordingContext(livekitRoomName, {
        organizationId: (meet as any).orgId?.toString() || "",
        userId: hostParticipant._id.toString(),
        meetingTitle: (meet as any).title || `Meet-${channelName}`,
        spaceId: channelName,
      });

      // Generate JWT token for socket/video
      const guestSocketToken = generateGuestSocketToken(
        result.meetId,
        hostParticipant._id.toString(),
        hostName,
        result.meet.hostEmail,
        result.meet.endTime
      );

      console.log(`[Public Meet] Host ${result.meet.hostEmail} verified for meet ${result.meetId}`);

      return res.status(200).json({
        success: true,
        message: 'Host verified successfully',
        data: {
          participantId: hostParticipant._id.toString(),
          meetId: result.meetId,
          meetTitle: result.meet.title,
          meetDescription: result.meet.description,
          meetStartTime: result.meet.startTime,
          meetEndTime: result.meet.endTime,
          agoraChannel: meet.agoraChannel,
          livekitServerUrl: getLivekitUrl(),
          livekitToken,
          roomName: channelName,
          displayName: hostName,
          email: result.meet.hostEmail,
          isHost: true,
          guestJWT: guestSocketToken,
          meetStatus: meet.status
        }
      });
    } catch (error) {
      console.error('[Public Meet] Error verifying host OTP:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify host'
      });
    }
  }
);

/**
 * Start a meeting (host only, after verification)
 * POST /public/meet/start
 * Body: { code }
 */
router.post(
  '/start',
  async (req: Request, res: Response) => {
    try {
      startMeetSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code } = req.body;

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      const meet = await Meet.findById(result.meetId);
      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check if host is verified
      if (!meet.isHostVerified) {
        return res.status(403).json({
          success: false,
          message: 'Host must verify with OTP before starting the meeting'
        });
      }

      // Check if already live
      if (meet.status === 'live') {
        return res.status(200).json({
          success: true,
          message: 'Meeting is already live',
          data: { status: 'live', startedAt: meet.startedAt }
        });
      }

      // Allow restarting an ended meeting — reset to live
      // Start (or restart) the meeting and reset screen share state
      meet.status = 'live';
      meet.startedAt = new Date();
      meet.endedAt = undefined; // Clear previous end time on restart
      meet.screenSharingByUid = undefined; // Clear any stale screen share state from previous sessions
      await meet.save();

      console.log(`[Public Meet] Meeting ${result.meetId} started by host`);

      // Emit socket event for workshop preview (if this meeting is linked to a workshop)
      if (meet.orgId) {
        // Find if there's a workshop linked to this meeting
        const linkedWorkshop = await Workshop.findOne({ meetingId: meet._id.toString() }).select('_id title').lean();
        if (linkedWorkshop) {
          emitWorkshopPreviewUpdate(meet.orgId.toString(), 'workshop:preview:live', {
            workshopId: linkedWorkshop._id.toString(),
            meetId: meet._id.toString(),
            title: linkedWorkshop.title
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Meeting started successfully',
        data: {
          status: 'live',
          startedAt: meet.startedAt
        }
      });
    } catch (error) {
      console.error('[Public Meet] Error starting meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to start meeting'
      });
    }
  }
);

/**
 * End a meeting (host only)
 * POST /public/meet/end
 * Body: { code }
 */
router.post(
  '/end',
  async (req: Request, res: Response) => {
    try {
      startMeetSchema.parse(req.body); // Same schema as start
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code } = req.body;

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      const meet = await Meet.findById(result.meetId);
      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // End the meeting and clear screen share state
      meet.status = 'ended';
      meet.endedAt = new Date();
      meet.screenSharingByUid = undefined; // Clear any stale screen share state
      await meet.save();

      // Mark all participants as left
      await MeetParticipant.updateMany(
        { meetId: result.meetId, leftAt: null },
        { leftAt: new Date() }
      );

      console.log(`[Public Meet] Meeting ${result.meetId} ended by host`);

      // Emit socket event for workshop preview (if this meeting is linked to a workshop)
      if (meet.orgId) {
        // Find if there's a workshop linked to this meeting
        const linkedWorkshop = await Workshop.findOne({ meetingId: meet._id.toString() }).select('_id title').lean();
        if (linkedWorkshop) {
          emitWorkshopPreviewUpdate(meet.orgId.toString(), 'workshop:preview:ended', {
            workshopId: linkedWorkshop._id.toString(),
            meetId: meet._id.toString(),
            title: linkedWorkshop.title
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Meeting ended successfully',
        data: {
          status: 'ended',
          endedAt: meet.endedAt
        }
      });
    } catch (error) {
      console.error('[Public Meet] Error ending meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to end meeting'
      });
    }
  }
);

/**
 * Check if a user exists and is already a member of the workshop's org.
 * This is a read-only check — onboarding happens at join-verify-otp.
 * POST /public/meet/check-user
 * Body: { code, email }
 */
router.post(
  '/check-user',
  async (req: Request, res: Response) => {
    const schema = z.object({
      code: z.string().min(1, 'Code is required'),
      email: z.string().email('Valid email is required'),
    });

    try {
      schema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code, email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const result = await verifyMeetJoinCode(code);
      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      const user = await User.findOne({ email: normalizedEmail }, { name: 1, organizations: 1 }).lean();
      if (!user) {
        return res.status(200).json({
          success: true,
          isExistingUser: false,
        });
      }

      // Check if user is a member of the workshop's org
      const workshop = await Workshop.findOne({ meetingId: result.meetId }).lean();
      let isOrgMember = false;
      if (workshop) {
        isOrgMember = user.organizations?.some(
          (m: any) => m.organization.toString() === workshop.orgId.toString()
        ) || false;
      }

      return res.status(200).json({
        success: true,
        isExistingUser: true,
        isOrgMember,
        userName: user.name || null,
      });
    } catch (error) {
      console.error('[Public Meet] Error checking user:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check user'
      });
    }
  }
);

/**
 * Request OTP for participant joining a meeting.
 * OTP is required for ALL participants (not just workshop-linked).
 * POST /public/meet/join-request-otp
 * Body: { code, email }
 */
router.post(
  '/join-request-otp',
  async (req: Request, res: Response) => {
    const schema = z.object({
      code: z.string().min(1, 'Code is required'),
      email: z.string().email('Valid email is required'),
    });

    try {
      schema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code, email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const result = await verifyMeetJoinCode(code);
      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Check if workshop is linked (for response metadata)
      const workshop = await Workshop.findOne({ meetingId: result.meetId }).lean();

      // Always send OTP for all participants
      const otp = await createOtp(normalizedEmail, 'guest-login');

      await sendMail(
        normalizedEmail,
        `Your Meeting Verification Code - ${result.meet.title}`,
        `<p>Your verification code for joining <b>${result.meet.title}</b> is <b>${otp}</b> (valid 10 minutes)</p>`,
        `Your verification code is ${otp}`,
        await senderForHost(req, EMAIL_FROM_OTP)
      );

      console.log(`[Public Meet] Sent join OTP to ${normalizedEmail} for meet ${result.meetId}`);

      return res.status(200).json({
        success: true,
        hasWorkshop: !!workshop,
        message: 'Verification code sent to your email'
      });
    } catch (error) {
      console.error('[Public Meet] Error sending join OTP:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification code'
      });
    }
  }
);

/**
 * Verify OTP for participant joining a workshop-linked meeting.
 * POST /public/meet/join-verify-otp
 * Body: { code, email, otp, affiliateId?, displayName? }
 *
 * Performs onboarding for ALL non-member participants:
 *  - With affiliateId: onboard under that affiliate
 *  - Without affiliateId: onboard under the org founder
 * Existing org members skip onboarding but still verify email.
 */
router.post(
  '/join-verify-otp',
  async (req: Request, res: Response) => {
    const schema = z.object({
      code: z.string().min(1, 'Code is required'),
      email: z.string().email('Valid email is required'),
      otp: z.string().length(6, 'OTP must be 6 digits'),
      affiliateId: z.string().optional(),
      displayName: z.string().optional(),
    });

    try {
      schema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code, email, otp, affiliateId, displayName } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const result = await verifyMeetJoinCode(code);
      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Verify OTP
      const isValid = await verifyOtp(normalizedEmail, otp, 'guest-login');
      if (isValid === false) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      // Check if user exists and is already a member
      const workshop = await Workshop.findOne({ meetingId: result.meetId }).lean();
      let user = await User.findOne({ email: normalizedEmail });
      const isMember = workshop && user?.organizations?.some(
        (m: any) => m.organization.toString() === workshop.orgId.toString()
      );

      // --- Onboard ALL non-member participants (not just affiliate-linked) ---
      let onboarded = false;
      if (workshop && !isMember) {
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
          console.error('[Public Meet] Error during onboarding at OTP verify (non-blocking):', onboardError);
        }
      }

      return res.status(200).json({
        success: true,
        verified: true,
        userId: user?._id?.toString() || null,
        isMember: !!isMember,
        needsProfile: !user || !user.name,
        onboarded,
      });
    } catch (error) {
      console.error('[Public Meet] Error verifying join OTP:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify code'
      });
    }
  }
);

/**
 * Update display name for a user who was created at OTP verify (before meeting goes live)
 * POST /public/meet/update-name
 * Body: { email, displayName }
 */
router.post(
  '/update-name',
  async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email('Valid email is required'),
      displayName: z.string().min(1, 'Display name is required').max(100).trim(),
    });

    try {
      schema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { email, displayName } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const user = await User.findOne({ email: normalizedEmail });
      if (user && !user.name) {
        user.name = displayName.trim();
        await user.save();
        console.log(`[Public Meet] Updated name for user ${normalizedEmail}: ${displayName.trim()}`);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[Public Meet] Error updating name:', error);
      return res.status(500).json({ success: false, message: 'Failed to update name' });
    }
  }
);

/**
 * Join a meeting as a participant (non-host).
 * Only gated on meet.status === 'live' (no time-based check).
 * Onboarding should have already happened at check-user, but
 * includes a safety-net fallback call to onboardParticipant.
 * POST /public/meet/join
 * Body: { code, displayName, email, affiliateId? }
 */
router.post(
  '/join',
  async (req: Request, res: Response) => {
    try {
      joinMeetSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code, displayName, email, affiliateId } = req.body;

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      const meet = await Meet.findById(result.meetId);
      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Only gate on live status — no time-based check
      if (meet.status === 'ended') {
        return res.status(403).json({
          success: false,
          message: 'This meeting has already ended'
        });
      }

      if (meet.status !== 'live') {
        return res.status(403).json({
          success: false,
          message: 'Meeting has not started yet. Please wait for the host to start the meeting.',
          meet: {
            title: result.meet.title,
            startTime: result.meet.startTime,
            hostName: result.meet.hostName,
            status: meet.status
          }
        });
      }

      // Check if this email is the host (they should use host flow)
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail === result.meet.hostEmail) {
        return res.status(400).json({
          success: false,
          message: 'As the host, please use the host verification flow to join'
        });
      }

      // Create participant record
      const participant = await MeetParticipant.create({
        meetId: result.meetId,
        email: normalizedEmail,
        displayName: displayName.trim(),
        isHost: false,
        joinedAt: new Date()
      });

      // Update user name if missing (user may have been created at check-user without a name)
      let onboarded = false;
      if (displayName.trim()) {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser && !existingUser.name) {
          existingUser.name = displayName.trim();
          await existingUser.save();
          console.log(`[Public Meet] Updated name for user ${normalizedEmail}: ${displayName.trim()}`);
        }
      }

      // Safety-net: if user was somehow not onboarded at check-user, do it now
      const linkedWorkshop = await Workshop.findOne({ meetingId: meet._id.toString() }).lean();
      if (linkedWorkshop) {
        try {
          const onboardResult = await onboardParticipant({
            email: normalizedEmail,
            orgId: linkedWorkshop.orgId,
            channelIds: linkedWorkshop.channelIds || [],
            affiliateId: affiliateId || undefined,
            displayName: displayName.trim(),
          });
          onboarded = onboardResult.onboarded;
        } catch (onboardError) {
          console.error('[Public Meet] Error during safety-net onboarding (non-blocking):', onboardError);
        }
      }

      // Create LiveKit room and participant token
      const channelName = meet.agoraChannel;
      const livekitRoomName = toLivekitRoomName(channelName);
      const room = await createRoom(livekitRoomName);
      const livekitToken = await createParticipantToken(livekitRoomName, {
        userId: participant._id.toString(),
        userName: displayName.trim()
      });

      // Generate JWT token for socket/video
      const guestSocketToken = generateGuestSocketToken(
        result.meetId,
        participant._id.toString(),
        displayName.trim(),
        normalizedEmail,
        result.meet.endTime
      );

      console.log(`[Public Meet] Participant ${normalizedEmail} joined meet ${result.meetId}${onboarded ? ' (onboarded to Garage)' : ''}`);

      return res.status(200).json({
        success: true,
        data: {
          participantId: participant._id.toString(),
          meetId: result.meetId,
          meetTitle: result.meet.title,
          meetDescription: result.meet.description,
          meetStartTime: result.meet.startTime,
          meetEndTime: result.meet.endTime,
          agoraChannel: meet.agoraChannel,
          livekitServerUrl: getLivekitUrl(),
          livekitToken,
          roomName: channelName,
          displayName: displayName.trim(),
          email: normalizedEmail,
          isHost: false,
          guestJWT: guestSocketToken,
          onboarded,
        }
      });
    } catch (error) {
      console.error('[Public Meet] Error joining meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to join meeting'
      });
    }
  }
);

/**
 * Get participants in a meeting
 * GET /public/meet/participants?code={code}
 */
router.get(
  '/participants',
  async (req: Request, res: Response) => {
    try {
      validateCodeSchema.parse({ code: req.query.code });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code } = req.query;

    try {
      const result = await verifyMeetJoinCode(code as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Get active participants
      const participants = await MeetParticipant.find({
        meetId: result.meetId,
        leftAt: null
      }).select('displayName email isHost joinedAt');

      // Get the meet status
      const meet = await Meet.findById(result.meetId).select('status').lean();

      return res.status(200).json({
        success: true,
        participants: participants.map(p => ({
          id: p._id.toString(),
          displayName: p.displayName,
          email: p.email,
          isHost: p.isHost,
          joinedAt: p.joinedAt
        }))
      });
    } catch (error) {
      console.error('[Public Meet] Error fetching participants:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch participants'
      });
    }
  }
);

/**
 * Leave a meeting
 * POST /public/meet/leave
 * Body: { code, participantId }
 */
router.post(
  '/leave',
  async (req: Request, res: Response) => {
    const { code, participantId } = req.body;

    if (!code || !participantId) {
      return res.status(400).json({
        success: false,
        message: 'Code and participantId are required'
      });
    }

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid meeting link'
        });
      }

      // Mark participant as left
      await MeetParticipant.findByIdAndUpdate(participantId, {
        leftAt: new Date()
      });

      console.log(`[Public Meet] Participant ${participantId} left meet ${result.meetId}`);

      return res.status(200).json({
        success: true,
        message: 'Left meeting successfully'
      });
    } catch (error) {
      console.error('[Public Meet] Error leaving meeting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to leave meeting'
      });
    }
  }
);

/**
 * Kick a participant from the meeting (host only)
 * POST /public/meet/kick
 * Body: { code, participantId, hostParticipantId }
 */
router.post(
  '/kick',
  async (req: Request, res: Response) => {
    const { code, participantId, hostParticipantId } = req.body;

    if (!code || !participantId || !hostParticipantId) {
      return res.status(400).json({
        success: false,
        message: 'Code, participantId, and hostParticipantId are required'
      });
    }

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid meeting link'
        });
      }

      // Verify the requester is actually the host
      const hostParticipant = await MeetParticipant.findById(hostParticipantId);
      if (!hostParticipant || !hostParticipant.isHost || hostParticipant.meetId.toString() !== result.meetId) {
        return res.status(403).json({
          success: false,
          message: 'Only the host can kick participants'
        });
      }

      // Find the participant to kick
      const participant = await MeetParticipant.findById(participantId);
      if (!participant || participant.meetId.toString() !== result.meetId) {
        return res.status(404).json({
          success: false,
          message: 'Participant not found'
        });
      }

      if (participant.isHost) {
        return res.status(400).json({
          success: false,
          message: 'Cannot kick the host'
        });
      }

      // Mark participant as left (kicked)
      participant.leftAt = new Date();
      await participant.save();

      console.log(`[Public Meet] Host kicked participant ${participantId} from meet ${result.meetId}`);

      return res.status(200).json({
        success: true,
        message: 'Participant kicked successfully',
        data: { participantId }
      });
    } catch (error) {
      console.error('[Public Meet] Error kicking participant:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to kick participant'
      });
    }
  }
);

/**
 * Start screen sharing (host only)
 * POST /public/meet/screen-share/start
 * Body: { code, participantId }
 */
router.post(
  '/screen-share/start',
  async (req: Request, res: Response) => {
    try {
      screenShareSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code, participantId } = req.body;

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Verify the participant is the host
      const participant = await MeetParticipant.findById(participantId);
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'Participant not found'
        });
      }

      if (!participant.isHost) {
        return res.status(403).json({
          success: false,
          message: 'Only the host can share screen'
        });
      }

      // Verify participant belongs to this meeting
      if (participant.meetId.toString() !== result.meetId) {
        return res.status(403).json({
          success: false,
          message: 'Participant does not belong to this meeting'
        });
      }

      // Screen share state is now handled by LiveKit and socket events
      // No need to track screenSharingByUid in the database

      console.log(`[Public Meet] Screen share started by host (participantId: ${participantId}) in meet ${result.meetId}`);

      return res.status(200).json({
        success: true,
        message: 'Screen sharing started',
        data: {
          participantId
        }
      });
    } catch (error) {
      console.error('[Public Meet] Error starting screen share:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to start screen sharing'
      });
    }
  }
);

/**
 * Stop screen sharing (host only)
 * POST /public/meet/screen-share/stop
 * Body: { code, participantId }
 */
router.post(
  '/screen-share/stop',
  async (req: Request, res: Response) => {
    const { code, participantId } = req.body;

    if (!code || !participantId) {
      return res.status(400).json({
        success: false,
        message: 'Code and participantId are required'
      });
    }

    try {
      const result = await verifyMeetJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Verify the participant is the host
      const participant = await MeetParticipant.findById(participantId);
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'Participant not found'
        });
      }

      if (!participant.isHost) {
        return res.status(403).json({
          success: false,
          message: 'Only the host can control screen sharing'
        });
      }

      // Screen share state is now handled by LiveKit and socket events
      console.log(`[Public Meet] Screen share stopped in meet ${result.meetId}`);

      return res.status(200).json({
        success: true,
        message: 'Screen sharing stopped'
      });
    } catch (error) {
      console.error('[Public Meet] Error stopping screen share:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to stop screen sharing'
      });
    }
  }
);

/**
 * Get workshop attendance tracking for a meeting
 * Shows registered users, who joined, and guests (outside attendees)
 * GET /public/meet/attendance?code={code}
 */
router.get(
  '/attendance',
  async (req: Request, res: Response) => {
    try {
      validateCodeSchema.parse({ code: req.query.code });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code } = req.query;

    try {
      const result = await verifyMeetJoinCode(code as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Find workshop linked to this meeting
      const workshop = await Workshop.findOne({ meetingId: result.meetId }).lean();

      if (!workshop) {
        // No workshop linked - just return meeting participants
        const participants = await MeetParticipant.find({
          meetId: result.meetId
        }).select('displayName email isHost joinedAt leftAt').lean();

        return res.status(200).json({
          success: true,
          hasWorkshop: false,
          participants: participants.map(p => ({
            id: p._id.toString(),
            displayName: p.displayName,
            email: p.email,
            isHost: p.isHost,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt,
            isActive: !p.leftAt,
            type: 'guest' as const
          }))
        });
      }

      // Get all workshop registrations (excluding cancelled)
      const registrations = await WorkshopRegistration.find({
        workshopId: workshop._id,
        status: { $ne: 'cancelled' }
      })
        .populate('userId', 'name email profilePicture')
        .lean();

      // Get all meeting participants (both active and those who left)
      const meetParticipants = await MeetParticipant.find({
        meetId: result.meetId
      }).lean();

      // Create email -> participant map (use earliest join time if multiple entries)
      const participantByEmail = new Map<string, typeof meetParticipants[0]>();
      meetParticipants.forEach(p => {
        const email = p.email.toLowerCase();
        const existing = participantByEmail.get(email);
        if (!existing || p.joinedAt < existing.joinedAt) {
          participantByEmail.set(email, p);
        }
      });

      // Create set of registered emails for quick lookup
      const registeredEmails = new Set<string>();
      registrations.forEach(reg => {
        const user = reg.userId as any;
        if (user?.email) {
          registeredEmails.add(user.email.toLowerCase());
        }
      });

      // Build registered users list with attendance status
      const registeredUsers = registrations.map(reg => {
        const user = reg.userId as any;
        if (!user) return null;

        const email = user.email?.toLowerCase();
        const participant = email ? participantByEmail.get(email) : null;

        return {
          id: user._id?.toString(),
          participantId: participant?._id?.toString() || null,
          name: user.name || 'Unknown',
          email: user.email,
          profilePicture: user.profilePicture,
          registeredAt: reg.registeredAt || reg.createdAt,
          hasPaid: reg.hasPaid,
          // Attendance info
          attended: !!participant || reg.status === 'attended',
          joinedAt: participant?.joinedAt,
          leftAt: participant?.leftAt,
          isActive: participant ? !participant.leftAt : false,
          durationMinutes: participant?.joinedAt && participant?.leftAt
            ? Math.round((new Date(participant.leftAt).getTime() - new Date(participant.joinedAt).getTime()) / 60000)
            : participant?.joinedAt
              ? Math.round((Date.now() - new Date(participant.joinedAt).getTime()) / 60000)
              : undefined
        };
      }).filter(Boolean);

      // Find guests (joined meeting but not registered)
      const guests = meetParticipants
        .filter(p => !registeredEmails.has(p.email.toLowerCase()))
        .map(p => ({
          id: p._id.toString(),
          displayName: p.displayName,
          email: p.email,
          isHost: p.isHost,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
          isActive: !p.leftAt,
          durationMinutes: p.joinedAt && p.leftAt
            ? Math.round((new Date(p.leftAt).getTime() - new Date(p.joinedAt).getTime()) / 60000)
            : p.joinedAt
              ? Math.round((Date.now() - new Date(p.joinedAt).getTime()) / 60000)
              : undefined
        }));

      // Calculate stats
      const totalRegistered = registeredUsers.length;
      const attendedCount = registeredUsers.filter(u => u?.attended).length;
      const activeNow = registeredUsers.filter(u => u?.isActive).length + guests.filter(g => g.isActive).length;
      const guestCount = guests.length;

      return res.status(200).json({
        success: true,
        hasWorkshop: true,
        workshop: {
          id: workshop._id.toString(),
          title: workshop.title,
          date: workshop.date,
          startTime: workshop.startTime,
          endTime: workshop.endTime
        },
        stats: {
          totalRegistered,
          attended: attendedCount,
          noShows: totalRegistered - attendedCount,
          guests: guestCount,
          activeNow,
          attendanceRate: totalRegistered > 0 ? Math.round((attendedCount / totalRegistered) * 100) : 0
        },
        registeredUsers,
        guests
      });
    } catch (error) {
      console.error('[Public Meet] Error fetching attendance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance data'
      });
    }
  }
);

// Helper function to mask email
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.substring(0, 3)}***@${domain}`;
}

export default router;

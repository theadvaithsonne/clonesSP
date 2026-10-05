import { randomBytes } from 'crypto';
import { Meet } from '../models/meet.model';
import { Workshop } from '../models/workshop.model';
import { JobInterview } from '../models/jobInterview.model';

/**
 * Generate a unique meet join code
 * Format: meet_{12-char-alphanumeric}
 * @returns A unique shareable code
 */
export function generateMeetJoinCode(): string {
  const randomPart = randomBytes(9).toString('base64url').substring(0, 12);
  return `meet_${randomPart}`;
}

/**
 * Generate Agora channel name for a meet
 * @param meetId - The meet ID
 * @returns Agora channel name
 */
export function generateMeetAgoraChannel(meetId: string): string {
  return `meet:${meetId}`;
}

/**
 * Whether this meet is the call for a Jobs interview that is still scheduled.
 * Such a link lives as long as the interview does — the hiring team and the
 * candidate both keep a Join button until it is completed or cancelled (and
 * cancelling cancels the meet) — so the usual "24h after the end time" expiry
 * and the "already ended" screen don't apply to it.
 */
export async function isScheduledInterviewMeet(code: string): Promise<boolean> {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !!(await JobInterview.exists({ meetingUrl: { $regex: `[?&]code=${escaped}$` }, status: 'scheduled' }));
}

/**
 * Verify a meet join code and get meet details
 * @param code - The meet join code
 * @returns Object with meet details if valid, null if invalid
 */
export async function verifyMeetJoinCode(code: string): Promise<{
  meetId: string;
  meet: {
    id: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    status: string;
    hostEmail: string;
    hostName?: string;
    isHostVerified: boolean;
    orgId: string;
  };
} | null> {
  try {
    const meet = await Meet.findOne({
      joinCode: code,
      status: { $nin: ['cancelled'] }
    });

    if (!meet) {
      return null;
    }

    // Check if code has expired (24 hours after end time)
    // Skip expiry for recurring workshops — their meet links are reused across sessions
    const expiryTime = new Date(meet.endTime);
    expiryTime.setHours(expiryTime.getHours() + 24);

    if (new Date() > expiryTime) {
      const recurringWorkshop = await Workshop.findOne({
        meetingId: meet._id.toString(),
        isRecurring: true,
        isRecurrenceActive: true,
      }).lean();
      if (!recurringWorkshop && !(await isScheduledInterviewMeet(code))) {
        return null;
      }
      // Recurring active workshop or scheduled interview — allow the code even if "expired"
    }

    return {
      meetId: meet._id.toString(),
      meet: {
        id: meet._id.toString(),
        title: meet.title,
        description: meet.description,
        startTime: meet.startTime,
        endTime: meet.endTime,
        status: meet.status,
        hostEmail: meet.hostEmail,
        hostName: meet.hostName,
        isHostVerified: meet.isHostVerified,
        orgId: meet.orgId.toString()
      }
    };
  } catch (error) {
    console.error('Error verifying meet join code:', error);
    return null;
  }
}

/**
 * Check if an email is the host of a meet
 * @param code - The meet join code
 * @param email - The email to check
 * @returns true if the email is the host
 */
export async function isHostEmail(code: string, email: string): Promise<boolean> {
  try {
    const meet = await Meet.findOne({
      joinCode: code,
      hostEmail: email.toLowerCase().trim()
    });
    return !!meet;
  } catch (error) {
    console.error('Error checking host email:', error);
    return false;
  }
}

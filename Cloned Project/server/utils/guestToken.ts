import { randomUUID, randomBytes } from 'crypto';
import { Event } from '../models/event.model';

/**
 * Generate a unique public join code for an event (like Google Meet)
 * Format: evt_{12-char-alphanumeric}
 * @returns A unique shareable code
 */
export function generatePublicJoinCode(): string {
  // Generate 12 random bytes and convert to base64url-safe string
  const randomPart = randomBytes(9).toString('base64url').substring(0, 12);
  return `evt_${randomPart}`;
}

/**
 * Verify a public join code and get event details
 * @param code - The public join code
 * @returns Object with event details if valid, null if invalid
 */
export async function verifyPublicJoinCode(code: string): Promise<{
  eventId: string;
  event: any;
} | null> {
  try {
    // Find the event with this public join code
    const event = await Event.findOne({
      publicJoinCode: code,
      status: { $ne: 'cancelled' }
    }).populate('creatorId', 'name email');

    if (!event) {
      return null;
    }

    // For recurring events, the code never expires based on endTime
    // For non-recurring events, code expires 24 hours after event end
    if (!event.isRepeating) {
      const expiryTime = new Date(event.endTime);
      expiryTime.setHours(expiryTime.getHours() + 24);

      if (new Date() > expiryTime) {
        return null;
      }
    }

    return {
      eventId: event._id.toString(),
      event: {
        id: event._id.toString(),
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        status: event.status,
        creator: event.creatorId,
        orgId: event.orgId
      }
    };
  } catch (error) {
    console.error('Error verifying public join code:', error);
    return null;
  }
}

/**
 * Generate a unique guest token for event access
 * @param eventId - The ID of the event
 * @param email - The guest's email address
 * @returns A unique token string (UUID v4)
 */
export function generateEventGuestToken(eventId: string, email: string): string {
  // Generate a UUID-based token
  const token = `guest_${randomUUID()}`;
  return token;
}

/**
 * Verify a guest token and check if it's valid for the event
 * @param token - The guest token to verify
 * @returns Object with event details if valid, null if invalid
 */
export async function verifyEventGuestToken(token: string): Promise<{
  eventId: string;
  email: string;
  event: any;
} | null> {
  try {
    // Find the event with this guest token
    const event = await Event.findOne({
      'guestInvitations.token': token,
      status: { $ne: 'cancelled' }
    }).populate('creatorId', 'name email');

    if (!event) {
      return null;
    }

    // Find the specific guest invitation
    const guestInvitation = event.guestInvitations.find(
      (inv) => inv.token === token
    );

    if (!guestInvitation) {
      return null;
    }

    // For recurring events, the token never expires based on endTime
    // For non-recurring events, token expires 24 hours after event end
    if (!event.isRepeating) {
      const expiryTime = new Date(event.endTime);
      expiryTime.setHours(expiryTime.getHours() + 24);

      if (new Date() > expiryTime) {
        return null;
      }
    }

    return {
      eventId: event._id.toString(),
      email: guestInvitation.email,
      event: {
        id: event._id.toString(),
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        status: event.status,
        creator: event.creatorId,
        orgId: event.orgId
      }
    };
  } catch (error) {
    console.error('Error verifying guest token:', error);
    return null;
  }
}

/**
 * Check if a guest token is still valid for joining
 * @param token - The guest token
 * @returns true if valid, false otherwise
 */
export async function isGuestTokenValid(token: string): Promise<boolean> {
  const result = await verifyEventGuestToken(token);
  return result !== null;
}

/**
 * Mark a guest invitation as joined
 * @param token - The guest token
 */
export async function markGuestAsJoined(token: string): Promise<void> {
  try {
    await Event.updateOne(
      { 'guestInvitations.token': token },
      {
        $set: {
          'guestInvitations.$.status': 'joined',
          'guestInvitations.$.joinedAt': new Date()
        }
      }
    );
  } catch (error) {
    console.error('Error marking guest as joined:', error);
    throw error;
  }
}

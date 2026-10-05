import { Router, Request, Response } from 'express';
import { verifyEventGuestToken, markGuestAsJoined, verifyPublicJoinCode } from '../utils/guestToken';
import { generateGuestSocketToken } from '../services/jwt';
import { EventGuest } from '../models/eventGuest.model';
import { Event } from '../models/event.model';
import { createRoom, createParticipantToken, toLivekitRoomName, getLivekitUrl } from '../services/livekit';
import { z } from 'zod';

const router = Router();

// Validation schemas
const validateGuestSchema = z.object({
  token: z.string().min(1, 'Token is required')
});

const joinGuestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long').trim()
});

// Public join code schemas
const validateCodeSchema = z.object({
  code: z.string().min(1, 'Code is required')
});

const joinPublicSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long').trim(),
  email: z.string().email('Valid email is required').optional()
});

/**
 * Validate a guest token and get event details
 * GET /public/events/validate-guest?token={token}
 */
router.get(
  '/validate-guest',
  async (req: Request, res: Response) => {
    // Validate request
    try {
      validateGuestSchema.parse({ token: req.query.token });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { token } = req.query;

    try {
      // Verify the guest token
      const result = await verifyEventGuestToken(token as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired guest token'
        });
      }

      // Check if event has already started or ended
      const now = new Date();
      const eventStartTime = new Date(result.event.startTime);
      const eventEndTime = new Date(result.event.endTime);

      // Guests can only join when the meeting has actually started (not before)
      if (now < eventStartTime) {
        return res.status(403).json({
          success: false,
          message: 'Event has not started yet. You can join when the meeting starts.',
          event: {
            title: result.event.title,
            description: result.event.description,
            startTime: result.event.startTime,
            endTime: result.event.endTime,
            creator: result.event.creator
          }
        });
      }

      if (now > eventEndTime) {
        return res.status(403).json({
          success: false,
          message: 'This event has already ended',
          event: {
            title: result.event.title,
            description: result.event.description,
            startTime: result.event.startTime,
            endTime: result.event.endTime,
            creator: result.event.creator
          }
        });
      }

      // Return event details
      return res.status(200).json({
        success: true,
        event: {
          id: result.eventId,
          title: result.event.title,
          description: result.event.description,
          startTime: result.event.startTime,
          endTime: result.event.endTime,
          creator: result.event.creator,
          status: result.event.status
        }
      });
    } catch (error) {
      console.error('Error validating guest token:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate guest token'
      });
    }
  }
);

/**
 * Join an event as a guest
 * POST /public/events/join-guest
 * Body: { token, displayName }
 */
router.post(
  '/join-guest',
  async (req: Request, res: Response) => {
    // Validate request
    try {
      joinGuestSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { token, displayName } = req.body;

    try {
      // Verify the guest token
      const result = await verifyEventGuestToken(token);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired guest token'
        });
      }

      // Check if event is joinable (same validation as validate-guest)
      const now = new Date();
      const eventStartTime = new Date(result.event.startTime);
      const eventEndTime = new Date(result.event.endTime);

      // Guests can only join when the meeting has actually started (not before)
      if (now < eventStartTime) {
        return res.status(403).json({
          success: false,
          message: 'Event has not started yet. You can join when the meeting starts.'
        });
      }

      if (now > eventEndTime) {
        return res.status(403).json({
          success: false,
          message: 'This event has already ended'
        });
      }

      // Create EventGuest record
      const eventGuest = await EventGuest.create({
        eventId: result.eventId,
        email: result.email,
        displayName: displayName.trim(),
        token,
        joinedAt: new Date()
      });

      // Mark guest invitation as joined
      await markGuestAsJoined(token);

      // Generate Socket.IO JWT for the guest
      const guestSocketToken = generateGuestSocketToken(
        result.eventId,
        eventGuest._id.toString(),
        displayName.trim(),
        result.email,
        result.event.endTime
      );

      // Get or create LiveKit room name (same as the old Agora channel name)
      const channelName = `event:${result.eventId}`;

      // Create LiveKit room and participant token
      const livekitRoomName = toLivekitRoomName(channelName);
      const room = await createRoom(livekitRoomName);
      const livekitToken = await createParticipantToken(livekitRoomName, {
        userId: eventGuest._id.toString(),
        userName: displayName.trim()
      });

      // Update event with video call info if not set
      await Event.findByIdAndUpdate(
        result.eventId,
        {
          $setOnInsert: {
            videoCallInfo: {
              agoraChannel: channelName,
              createdAt: new Date()
            }
          }
        },
        { upsert: false }
      );

      // Return guest credentials
      return res.status(200).json({
        success: true,
        data: {
          guestJWT: guestSocketToken,
          guestId: eventGuest._id.toString(),
          eventId: result.eventId,
          eventTitle: result.event.title,
          eventDescription: result.event.description,
          eventStartTime: result.event.startTime,
          eventEndTime: result.event.endTime,
          agoraChannel: channelName,
          livekitServerUrl: getLivekitUrl(),
          livekitToken,
          roomName: livekitRoomName,
          displayName: displayName.trim(),
          email: result.email
        }
      });
    } catch (error) {
      console.error('Error joining event as guest:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to join event'
      });
    }
  }
);

/**
 * Get current participants in an event
 * GET /public/events/participants?token={token}
 */
router.get(
  '/participants',
  async (req: Request, res: Response) => {
    // Validate request
    try {
      validateGuestSchema.parse({ token: req.query.token });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { token } = req.query;

    try {
      // Verify the guest token
      const result = await verifyEventGuestToken(token as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired guest token'
        });
      }

      // Get event with invited users
      const event = await Event.findById(result.eventId)
        .populate('invitedUserIds', 'name email profilePicture')
        .populate('creatorId', 'name email profilePicture');

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Get guests who have joined
      const guests = await EventGuest.find({
        eventId: result.eventId,
        leftAt: null // Only active guests
      }).select('displayName email joinedAt');

      // Format participants
      const internalParticipants = event.invitedUserIds.map((user: any) => ({
        type: 'internal',
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }));

      const guestParticipants = guests.map((guest) => ({
        type: 'guest',
        name: guest.displayName,
        email: guest.email,
        joinedAt: guest.joinedAt
      }));

      return res.status(200).json({
        success: true,
        participants: {
          internal: internalParticipants,
          guests: guestParticipants,
          total: internalParticipants.length + guestParticipants.length
        }
      });
    } catch (error) {
      console.error('Error fetching participants:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch participants'
      });
    }
  }
);

// ========================================
// PUBLIC JOIN CODE ENDPOINTS (Google Meet style)
// ========================================

/**
 * Validate a public join code and get event details
 * GET /public/events/validate-code?code={code}
 */
router.get(
  '/validate-code',
  async (req: Request, res: Response) => {
    // Validate request
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
      // Verify the public join code
      const result = await verifyPublicJoinCode(code as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Check if event is live
      const event = await Event.findById(result.eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const now = new Date();
      let eventStartTime = new Date(result.event.startTime);
      let eventEndTime = new Date(result.event.endTime);

      // For recurring events, the isLive flag is the source of truth
      // If the host has marked the meeting as live, guests can join regardless of scheduled time
      if (event.isRepeating) {
        // If meeting is live, allow guests to join immediately
        if (event.isLive) {
          return res.status(200).json({
            success: true,
            event: {
              id: result.eventId,
              title: result.event.title,
              description: result.event.description,
              startTime: eventStartTime,
              endTime: eventEndTime,
              creator: result.event.creator,
              status: result.event.status,
              isLive: true,
              isRepeating: true
            }
          });
        }

        // Meeting is not live - calculate next occurrence for display purposes
        const duration = eventEndTime.getTime() - eventStartTime.getTime();

        // Find the next/current occurrence (assume weekly recurrence if past)
        while (eventEndTime < now) {
          eventStartTime = new Date(eventStartTime.getTime() + 7 * 24 * 60 * 60 * 1000);
          eventEndTime = new Date(eventStartTime.getTime() + duration);
        }

        // For recurring events that are not live, always tell guest to wait for host
        return res.status(403).json({
          success: false,
          message: 'Event has not started yet. You can join when the host starts the meeting.',
          event: {
            title: result.event.title,
            description: result.event.description,
            startTime: eventStartTime,
            endTime: eventEndTime,
            creator: result.event.creator,
            isLive: false,
            isRepeating: true
          }
        });
      }

      // Non-recurring event: use time-based validation
      // Guests can only join when the meeting has started (not before)
      if (now < eventStartTime) {
        return res.status(403).json({
          success: false,
          message: 'Event has not started yet. You can join when the meeting starts.',
          event: {
            title: result.event.title,
            description: result.event.description,
            startTime: eventStartTime,
            endTime: eventEndTime,
            creator: result.event.creator,
            isLive: event.isLive,
            isRepeating: false
          }
        });
      }

      if (now > eventEndTime) {
        return res.status(403).json({
          success: false,
          message: 'This meeting has already ended',
          event: {
            title: result.event.title,
            description: result.event.description,
            startTime: eventStartTime,
            endTime: eventEndTime,
            creator: result.event.creator,
            isRepeating: false
          }
        });
      }

      // Return event details (non-recurring event that is within time window)
      return res.status(200).json({
        success: true,
        event: {
          id: result.eventId,
          title: result.event.title,
          description: result.event.description,
          startTime: eventStartTime,
          endTime: eventEndTime,
          creator: result.event.creator,
          status: result.event.status,
          isLive: event.isLive,
          isRepeating: false
        }
      });
    } catch (error) {
      console.error('Error validating public join code:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate meeting link'
      });
    }
  }
);

/**
 * Join an event using public join code
 * POST /public/events/join-public
 * Body: { code, displayName, email? }
 */
router.post(
  '/join-public',
  async (req: Request, res: Response) => {
    // Validate request
    try {
      joinPublicSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request',
        errors: error instanceof z.ZodError ? error.issues : []
      });
    }

    const { code, displayName, email } = req.body;

    try {
      // Verify the public join code
      const result = await verifyPublicJoinCode(code);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Check if event is live or has started
      const event = await Event.findById(result.eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const now = new Date();
      let eventStartTime = new Date(result.event.startTime);
      let eventEndTime = new Date(result.event.endTime);

      // For recurring events, the isLive flag is the source of truth
      if (event.isRepeating) {
        // If meeting is not live, don't allow joining
        if (!event.isLive) {
          return res.status(403).json({
            success: false,
            message: 'Event has not started yet. You can join when the host starts the meeting.'
          });
        }
        // If meeting is live, proceed to join (skip time-based checks)
      } else {
        // Non-recurring event: use time-based validation
        if (now < eventStartTime) {
          return res.status(403).json({
            success: false,
            message: 'Event has not started yet. You can join when the meeting starts.'
          });
        }

        if (now > eventEndTime) {
          return res.status(403).json({
            success: false,
            message: 'This meeting has already ended'
          });
        }
      }

      // Create EventGuest record
      const guestEmail = email || `guest_${Date.now()}@guest.local`;
      const eventGuest = await EventGuest.create({
        eventId: result.eventId,
        email: guestEmail,
        displayName: displayName.trim(),
        joinedAt: new Date()
      });

      // Generate Socket.IO JWT for the guest
      const guestSocketToken = generateGuestSocketToken(
        result.eventId,
        eventGuest._id.toString(),
        displayName.trim(),
        guestEmail,
        result.event.endTime
      );

      // Get or create LiveKit room name (same as old Agora channel name)
      const channelName = `event:${result.eventId}`;

      // Create LiveKit room and participant token
      const livekitRoomName = toLivekitRoomName(channelName);
      const room = await createRoom(livekitRoomName);
      const livekitToken = await createParticipantToken(livekitRoomName, {
        userId: eventGuest._id.toString(),
        userName: displayName.trim()
      });

      // Update event with video call info if not set
      await Event.findByIdAndUpdate(
        result.eventId,
        {
          $setOnInsert: {
            videoCallInfo: {
              agoraChannel: channelName,
              createdAt: new Date()
            }
          }
        },
        { upsert: false }
      );

      // Return guest credentials
      return res.status(200).json({
        success: true,
        data: {
          guestJWT: guestSocketToken,
          guestId: eventGuest._id.toString(),
          eventId: result.eventId,
          eventTitle: result.event.title,
          eventDescription: result.event.description,
          eventStartTime: result.event.startTime,
          eventEndTime: result.event.endTime,
          agoraChannel: channelName,
          livekitServerUrl: getLivekitUrl(),
          livekitToken,
          roomName: livekitRoomName,
          displayName: displayName.trim(),
          email: guestEmail
        }
      });
    } catch (error) {
      console.error('Error joining event with public code:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to join meeting'
      });
    }
  }
);

/**
 * Get participants in an event using public code
 * GET /public/events/participants-public?code={code}
 */
router.get(
  '/participants-public',
  async (req: Request, res: Response) => {
    // Validate request
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
      // Verify the public join code
      const result = await verifyPublicJoinCode(code as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired meeting link'
        });
      }

      // Get event with invited users
      const event = await Event.findById(result.eventId)
        .populate('invitedUserIds', 'name email profilePicture')
        .populate('creatorId', 'name email profilePicture');

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      // Get guests who have joined
      const guests = await EventGuest.find({
        eventId: result.eventId,
        leftAt: null // Only active guests
      }).select('displayName email joinedAt');

      // Format participants
      const internalParticipants = event.invitedUserIds.map((user: any) => ({
        type: 'internal',
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }));

      const guestParticipants = guests.map((guest) => ({
        type: 'guest',
        name: guest.displayName,
        email: guest.email,
        joinedAt: guest.joinedAt
      }));

      return res.status(200).json({
        success: true,
        participants: {
          internal: internalParticipants,
          guests: guestParticipants,
          total: internalParticipants.length + guestParticipants.length
        }
      });
    } catch (error) {
      console.error('Error fetching participants:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch participants'
      });
    }
  }
);

export default router;

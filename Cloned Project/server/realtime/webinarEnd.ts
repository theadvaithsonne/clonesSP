import mongoose from "mongoose";
import type { Server } from "socket.io";
import { emitWorkshopPreviewUpdate, getSocketInstance } from "../services/socket";
import { getRoom, removeRoom } from "../services/mediasoup";
import {
  isRecording as isServerRecording,
  stopServerRecording,
} from "../services/webinarRecording";
import { deleteRoom, toLivekitRoomName } from "../services/livekit";
import { clearLiveState } from "../services/webinarLiveState";
import { releaseSessionHost, resolveSessionAnchor } from "../services/webinarHost";
import { Workshop } from "../models/workshop.model";
import { Meet } from "../models/meet.model";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { BotManager } from "../note-taker/agents/bot-manager";

/**
 * Ending a webinar, for every path that can end one.
 *
 * There were two: the host's End button (`webinar:endWebinar`, which told the
 * room) and `POST /webinar/:id/stop` (which did not). The REST route marked
 * the session ended in the database and dropped the in-memory room — and
 * every socket still in that room stayed exactly where it was: LIVE badge,
 * REC badge, "waiting for host video", forever. This module is the one place
 * both go through, and it is also what the host-absent clock calls when a
 * host is gone for good.
 */

/**
 * Tell everyone in the room the session is over and stop what is running.
 * Safe to call when there is no room (nothing to announce).
 */
export function announceWebinarEnded(
  webinarId: string,
  io: Server | null = getSocketInstance()
): void {
  const room = getRoom(webinarId);
  if (!io) return;
  if (room && (room.recording || isServerRecording(webinarId))) {
    room.recording = false;
    io.to(webinarId).emit("webinar:recordingStopped");
    stopServerRecording(webinarId).catch((err) =>
      console.error("[webinarEnd] finalize recording error:", err)
    );
  }
  io.to(webinarId).emit("webinar:webinarEnded");
}

/**
 * Tear the media room down too.
 *
 * The socket event is the primary "it's over" signal, but a viewer whose
 * socket is out at that moment — iOS suspends it in the background, and a
 * reconnect gap is exactly when a host tends to hang up — never hears it,
 * and their LiveKit connection just sits there with the host's tracks gone:
 * "Waiting for host video…", indefinitely. Deleting the room disconnects
 * every participant with ROOM_DELETED, which both clients already treat as
 * the session ending. Best-effort and off the critical path: if this fails,
 * the socket event and the clients' validate poll do the job as before.
 *
 * Call it AFTER the note-taker has been asked to leave, so the bot finalises
 * its transcript on its own terms rather than being kicked mid-flush.
 */
export function dropLivekitRoom(webinarId: string): void {
  deleteRoom(toLivekitRoomName(`webinar-${webinarId}`)).catch((err) =>
    console.warn("[webinarEnd] livekit room not deleted:", err?.message)
  );
}

export interface EndSessionOptions {
  /** Who ended it, for the audit stamp. Absent for an automatic end. */
  endedBy?: string;
  reason: "stop-route" | "host-absent";
}

/**
 * The full stop: announce to the room, mark the Meet and the session row
 * ended, free the host seat, drop persisted live state, and remove the room.
 * Mirrors the DB half of the socket `webinar:endWebinar` handler.
 */
export async function endWebinarSession(
  webinarId: string,
  opts: EndSessionOptions
): Promise<void> {
  console.log(`[webinarEnd] ending ${webinarId} (${opts.reason})`);
  announceWebinarEnded(webinarId);

  const room = getRoom(webinarId);
  const workshop = await Workshop.findById(webinarId)
    .select("meetingId orgId currentSessionDate date isRecurring")
    .lean();

  if (workshop?.meetingId) {
    await Meet.findByIdAndUpdate(workshop.meetingId, {
      $set: { status: "ended", endedAt: new Date() },
    });
  }

  if (workshop) {
    try {
      const sessionDate = resolveSessionAnchor(workshop as any);
      const workshopId = new mongoose.Types.ObjectId(webinarId);
      await WorkshopSessionOverride.findOneAndUpdate(
        { workshopId, sessionDate },
        {
          $set: {
            manualEndedAt: new Date(),
            ...(opts.endedBy && mongoose.isValidObjectId(opts.endedBy)
              ? { "meta.endedBy": new mongoose.Types.ObjectId(opts.endedBy) }
              : {}),
          },
          $setOnInsert: { workshopId, sessionDate },
        },
        { upsert: true }
      );
      await releaseSessionHost(workshop as any);
      await clearLiveState({ workshopId: webinarId, sessionDate: room?.sessionKey ?? sessionDate });
      await Workshop.updateOne({ _id: workshop._id }, { $unset: { currentSessionDate: 1 } });
    } catch (err) {
      console.warn("[webinarEnd] session row not stamped:", err);
    }
    try {
      emitWorkshopPreviewUpdate(
        workshop.orgId?.toString() || "",
        "workshop:preview:ended",
        { workshopId: webinarId }
      );
    } catch (err) {
      console.warn("[webinarEnd] preview update failed:", err);
    }
  }

  // The note-taker follows the session out, and the media room goes once it
  // has. Best-effort, off the critical path.
  (async () => {
    try {
      const botManager = BotManager.getInstance();
      const roomName = toLivekitRoomName(`webinar-${webinarId}`);
      if (botManager.hasBot(roomName)) await botManager.leave(roomName);
      else if (botManager.hasBot(webinarId)) await botManager.leave(webinarId);
    } catch (err) {
      console.error("[webinarEnd] note-taker leave failed:", err);
    }
    dropLivekitRoom(webinarId);
  })();

  removeRoom(webinarId);
}

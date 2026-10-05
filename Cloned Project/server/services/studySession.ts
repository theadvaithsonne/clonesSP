// src/services/studySession.ts
import { StudySession, IStudySession } from "../models/studySession.model";
import { Types } from "mongoose";

const HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes - auto-close if no heartbeat
const MAX_SESSION_DURATION = 8 * 60 * 60; // 8 hours max session length (seconds)

/**
 * Validate that a string is a valid MongoDB ObjectId.
 * Prevents Mongoose CastError crashes on malformed IDs.
 */
function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;
}

/**
 * Close any stale sessions that haven't had a heartbeat in 5 minutes.
 * Uses a bulk updateMany instead of loading all documents into memory.
 */
async function closeStaleSessionsForUser(userId: string, orgId: string): Promise<void> {
  const staleThreshold = new Date(Date.now() - HEARTBEAT_TIMEOUT);

  // For stale sessions, we set endedAt = lastHeartbeat and compute duration.
  // Since duration depends on each document's own startedAt, we need to iterate.
  // However, we limit the query and use lean() for efficiency.
  const staleSessions = await StudySession.find({
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(orgId),
    endedAt: null,
    lastHeartbeat: { $lt: staleThreshold },
  })
    .select("_id startedAt lastHeartbeat")
    .lean();

  if (staleSessions.length === 0) return;

  // Build bulk ops - much more efficient than individual saves
  const bulkOps = staleSessions.map((session) => {
    const duration = Math.floor(
      (session.lastHeartbeat.getTime() - session.startedAt.getTime()) / 1000
    );
    return {
      updateOne: {
        filter: { _id: session._id },
        update: {
          $set: {
            endedAt: session.lastHeartbeat,
            duration: Math.min(Math.max(duration, 0), MAX_SESSION_DURATION),
          },
        },
      },
    };
  });

  await StudySession.bulkWrite(bulkOps);
}

/**
 * Start a new study session. Auto-closes any existing active sessions first.
 */
export async function startSession(data: {
  userId: string;
  organizationId: string;
  courseId: string;
  chapterId?: string;
  sectionId?: string;
  courseTitle: string;
  chapterTitle?: string;
}): Promise<IStudySession> {
  // Validate required ObjectIds
  if (!isValidObjectId(data.userId)) throw new Error("Invalid userId");
  if (!isValidObjectId(data.organizationId)) throw new Error("Invalid organizationId");
  if (!isValidObjectId(data.courseId)) throw new Error("Invalid courseId");

  // Close any stale sessions
  await closeStaleSessionsForUser(data.userId, data.organizationId);

  // Close any existing active session for this user (only one active at a time)
  const existingActive = await StudySession.findOne({
    userId: new Types.ObjectId(data.userId),
    organizationId: new Types.ObjectId(data.organizationId),
    endedAt: null,
  });

  if (existingActive) {
    const duration = Math.floor(
      (Date.now() - existingActive.startedAt.getTime()) / 1000
    );
    existingActive.endedAt = new Date();
    existingActive.duration = Math.min(Math.max(duration, 0), MAX_SESSION_DURATION);
    await existingActive.save();
  }

  // Create new session
  const session = new StudySession({
    userId: new Types.ObjectId(data.userId),
    organizationId: new Types.ObjectId(data.organizationId),
    courseId: new Types.ObjectId(data.courseId),
    chapterId: data.chapterId && isValidObjectId(data.chapterId)
      ? new Types.ObjectId(data.chapterId)
      : undefined,
    sectionId: data.sectionId && isValidObjectId(data.sectionId)
      ? new Types.ObjectId(data.sectionId)
      : undefined,
    startedAt: new Date(),
    lastHeartbeat: new Date(),
    courseTitle: data.courseTitle,
    chapterTitle: data.chapterTitle || "",
  });

  await session.save();
  return session;
}

/**
 * End the current active study session.
 */
export async function endSession(
  userId: string,
  orgId: string,
  sessionId?: string
): Promise<IStudySession | null> {
  if (!isValidObjectId(userId) || !isValidObjectId(orgId)) return null;

  const query: any = {
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(orgId),
    endedAt: null,
  };

  if (sessionId && isValidObjectId(sessionId)) {
    query._id = new Types.ObjectId(sessionId);
  }

  const session = await StudySession.findOne(query).sort({ startedAt: -1 });
  if (!session) return null;

  const duration = Math.floor(
    (Date.now() - session.startedAt.getTime()) / 1000
  );
  session.endedAt = new Date();
  session.duration = Math.min(Math.max(duration, 0), MAX_SESSION_DURATION);
  await session.save();

  return session;
}

/**
 * Heartbeat to keep the session alive. Also updates chapter if changed.
 */
export async function heartbeat(
  userId: string,
  orgId: string,
  data?: { chapterId?: string; sectionId?: string; chapterTitle?: string }
): Promise<IStudySession | null> {
  if (!isValidObjectId(userId) || !isValidObjectId(orgId)) return null;

  const session = await StudySession.findOne({
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(orgId),
    endedAt: null,
  }).sort({ startedAt: -1 });

  if (!session) return null;

  session.lastHeartbeat = new Date();

  // Update chapter if navigated
  if (data?.chapterId && isValidObjectId(data.chapterId)) {
    session.chapterId = new Types.ObjectId(data.chapterId);
  }
  if (data?.sectionId && isValidObjectId(data.sectionId)) {
    session.sectionId = new Types.ObjectId(data.sectionId);
  }
  if (data?.chapterTitle) {
    session.chapterTitle = data.chapterTitle;
  }

  await session.save();
  return session;
}

/**
 * Get dashboard stats for a learner.
 */
export async function getStudyStats(
  userId: string,
  orgId: string
): Promise<{
  weeklyTime: number[]; // minutes per day [Mon..Sun]
  totalTimeToday: number; // minutes
  streakDays: number;
  streakDates: string[]; // ISO date strings of streak days
  recentSessions: {
    courseTitle: string;
    chapterTitle: string;
    startedAt: string;
    endedAt: string;
    duration: number; // seconds
  }[];
  activeSession: {
    sessionId: string;
    courseTitle: string;
    chapterTitle: string;
    startedAt: string;
    elapsedSeconds: number;
  } | null;
}> {
  if (!isValidObjectId(userId) || !isValidObjectId(orgId)) {
    return {
      weeklyTime: [0, 0, 0, 0, 0, 0, 0],
      totalTimeToday: 0,
      streakDays: 0,
      streakDates: [],
      recentSessions: [],
      activeSession: null,
    };
  }

  // Close stale sessions first
  await closeStaleSessionsForUser(userId, orgId);

  const userObjId = new Types.ObjectId(userId);
  const orgObjId = new Types.ObjectId(orgId);

  // Get start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  // Get start of today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Fetch all sessions this week for the bar chart
  const weekSessions = await StudySession.find({
    userId: userObjId,
    organizationId: orgObjId,
    startedAt: { $gte: monday },
    duration: { $gt: 0 },
  }).sort({ startedAt: -1 });

  // Compute weekly time (Mon=0, Tue=1, ..., Sun=6)
  const weeklyTime = [0, 0, 0, 0, 0, 0, 0];
  let totalTimeToday = 0;

  for (const s of weekSessions) {
    const day = s.startedAt.getDay();
    // Convert 0=Sun..6=Sat to 0=Mon..6=Sun
    const idx = day === 0 ? 6 : day - 1;
    const minutes = Math.round(s.duration / 60);
    weeklyTime[idx] += minutes;

    if (s.startedAt >= todayStart) {
      totalTimeToday += minutes;
    }
  }

  // Streak calculation: look at last 90 days of sessions
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const allSessions = await StudySession.find({
    userId: userObjId,
    organizationId: orgObjId,
    startedAt: { $gte: ninetyDaysAgo },
    duration: { $gt: 60 }, // At least 1 minute to count
  })
    .select("startedAt")
    .sort({ startedAt: -1 })
    .lean();

  // Get unique dates (YYYY-MM-DD)
  const uniqueDates = new Set<string>();
  for (const s of allSessions) {
    const dateStr = s.startedAt.toISOString().split("T")[0];
    uniqueDates.add(dateStr);
  }

  // Calculate streak (consecutive days ending today or yesterday)
  const sortedDates = Array.from(uniqueDates).sort().reverse();
  let streakDays = 0;
  const streakDates: string[] = [];
  const todayStr = now.toISOString().split("T")[0];
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Streak must include today or yesterday
  if (sortedDates.length > 0 && (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr)) {
    let checkDate = new Date(sortedDates[0]);

    for (const dateStr of sortedDates) {
      const expectedStr = checkDate.toISOString().split("T")[0];
      if (dateStr === expectedStr) {
        streakDays++;
        streakDates.push(dateStr);
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Recent sessions (last 5 completed — look back 30 days, not just current week)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const recentCompletedSessions = await StudySession.find({
    userId: userObjId,
    organizationId: orgObjId,
    startedAt: { $gte: thirtyDaysAgo },
    endedAt: { $ne: null },
    duration: { $gt: 0 },
  })
    .sort({ startedAt: -1 })
    .limit(5)
    .select("courseTitle chapterTitle startedAt endedAt duration")
    .lean();

  const recentSessions = recentCompletedSessions.map((s) => ({
    courseTitle: s.courseTitle,
    chapterTitle: s.chapterTitle || "",
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt!.toISOString(),
    duration: s.duration,
  }));

  // Check for active session
  const activeSession = await StudySession.findOne({
    userId: userObjId,
    organizationId: orgObjId,
    endedAt: null,
  }).sort({ startedAt: -1 });

  return {
    weeklyTime,
    totalTimeToday,
    streakDays,
    streakDates: streakDates.reverse(),
    recentSessions,
    activeSession: activeSession
      ? {
          sessionId: activeSession._id.toString(),
          courseTitle: activeSession.courseTitle,
          chapterTitle: activeSession.chapterTitle || "",
          startedAt: activeSession.startedAt.toISOString(),
          elapsedSeconds: Math.floor(
            (Date.now() - activeSession.startedAt.getTime()) / 1000
          ),
        }
      : null,
  };
}

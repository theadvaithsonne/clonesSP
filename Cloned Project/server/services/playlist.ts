// src/services/playlist.ts
import { Types } from "mongoose";
import { Playlist, IPlaylist, IVideoEntry } from "../models/playlist.model";
import { Workshop } from "../models/workshop.model";
import { StandaloneVideo } from "../models/standaloneVideo.model";
import { Course } from "../models/course.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";

// ============== BACKWARD COMPAT HELPERS ==============

/**
 * Migrate legacy playlists that only have `videoIds` (no `videoEntries`).
 * Detects the source collection for each ID and builds videoEntries.
 * Saves the migrated data back to the DB so it only runs once per playlist.
 */
async function migrateLegacyVideoIds(
  playlist: any
): Promise<IVideoEntry[]> {
  const legacyIds = (playlist.videoIds || []).map((id: any) => id.toString());
  if (legacyIds.length === 0) return [];

  const objectIds = legacyIds.map((id: string) => new Types.ObjectId(id));

  // Check which collection each ID belongs to
  const [workshopIds, standaloneIds] = await Promise.all([
    Workshop.find({ _id: { $in: objectIds } })
      .select("_id")
      .lean()
      .then((docs) => new Set(docs.map((d) => d._id.toString()))),
    StandaloneVideo.find({ _id: { $in: objectIds } })
      .select("_id")
      .lean()
      .then((docs) => new Set(docs.map((d) => d._id.toString()))),
  ]);

  const entries: IVideoEntry[] = [];
  for (const id of legacyIds) {
    if (workshopIds.has(id)) {
      entries.push({
        videoSource: "workshop",
        videoId: new Types.ObjectId(id),
      } as IVideoEntry);
    } else if (standaloneIds.has(id)) {
      entries.push({
        videoSource: "standalone",
        videoId: new Types.ObjectId(id),
      } as IVideoEntry);
    }
    // Skip IDs that don't exist in either collection (orphaned)
  }

  // Persist migration — write videoEntries and clear videoIds
  if (entries.length > 0 || legacyIds.length > 0) {
    await Playlist.findByIdAndUpdate(playlist._id, {
      $set: {
        videoEntries: entries,
        videoCount: entries.length,
      },
    });
  }

  return entries;
}

/**
 * Get resolved videoEntries for a playlist (handles legacy migration).
 */
async function resolveVideoEntries(playlist: any): Promise<IVideoEntry[]> {
  // If playlist already has videoEntries, use them
  if (playlist.videoEntries && playlist.videoEntries.length > 0) {
    return playlist.videoEntries;
  }

  // If it has legacy videoIds, migrate
  if (playlist.videoIds && playlist.videoIds.length > 0) {
    return migrateLegacyVideoIds(playlist);
  }

  return [];
}

// ============== PLAYLIST CRUD ==============

export async function createPlaylist(data: {
  title: string;
  description?: string;
  coverImage?: string;
  organizationId: string;
  createdBy: string;
  type: "founder" | "learner";
  isPublished?: boolean;
  videoEntries?: {
    videoSource: "workshop" | "standalone" | "courseVideo";
    videoId: string;
    courseId?: string;
    sectionId?: string;
    chapterId?: string;
  }[];
  // Legacy support
  videoIds?: string[];
}): Promise<IPlaylist> {
  // Convert videoEntries to proper ObjectId format
  let entries: IVideoEntry[] = [];
  if (data.videoEntries && data.videoEntries.length > 0) {
    entries = data.videoEntries.map((e) => ({
      videoSource: e.videoSource,
      videoId: new Types.ObjectId(e.videoId),
      courseId: e.courseId ? new Types.ObjectId(e.courseId) : undefined,
      sectionId: e.sectionId ? new Types.ObjectId(e.sectionId) : undefined,
      chapterId: e.chapterId ? new Types.ObjectId(e.chapterId) : undefined,
    })) as IVideoEntry[];
  } else if (data.videoIds && data.videoIds.length > 0) {
    // Legacy fallback: treat all as workshop type (old behavior)
    entries = data.videoIds.map((id) => ({
      videoSource: "workshop" as const,
      videoId: new Types.ObjectId(id),
    })) as IVideoEntry[];
  }

  const playlist = new Playlist({
    title: data.title,
    description: data.description || "",
    coverImage: data.coverImage || "",
    organizationId: new Types.ObjectId(data.organizationId),
    createdBy: new Types.ObjectId(data.createdBy),
    type: data.type,
    isPublished: data.isPublished || false,
    videoEntries: entries,
    videoIds: [], // No longer used for new playlists
  });

  const saved = await playlist.save();

  return Playlist.findById(saved._id)
    .populate("createdBy", "name email avatar profilePicture")
    .lean() as Promise<IPlaylist>;
}

export async function getPlaylistById(
  playlistId: string
): Promise<any | null> {
  const playlist = await Playlist.findById(playlistId)
    .populate("createdBy", "name email avatar profilePicture")
    .lean();

  if (!playlist) return null;

  // Resolve entries (handles legacy migration)
  const entries = await resolveVideoEntries(playlist);

  if (entries.length === 0) {
    return { ...playlist, videos: [], videoEntries: entries };
  }

  // Group entries by source
  const workshopIds: Types.ObjectId[] = [];
  const standaloneIds: Types.ObjectId[] = [];
  const courseVideoEntries: IVideoEntry[] = [];

  for (const entry of entries) {
    if (entry.videoSource === "workshop") {
      workshopIds.push(entry.videoId);
    } else if (entry.videoSource === "standalone") {
      standaloneIds.push(entry.videoId);
    } else if (entry.videoSource === "courseVideo") {
      courseVideoEntries.push(entry);
    }
  }

  // Fetch from collections in parallel
  const courseIds = [
    ...new Set(
      courseVideoEntries
        .filter((e) => e.courseId)
        .map((e) => e.courseId!.toString())
    ),
  ];

  const [workshops, standaloneVideos, courses] = await Promise.all([
    workshopIds.length > 0
      ? Workshop.find({ _id: { $in: workshopIds } })
          .select(
            "title description thumbnail date startTime endTime createdAt"
          )
          .lean()
      : [],
    standaloneIds.length > 0
      ? StandaloneVideo.find({ _id: { $in: standaloneIds } })
          .select(
            "title description thumbnail videoUrl videoS3Key sourceType duration createdAt"
          )
          .lean()
      : [],
    courseIds.length > 0
      ? Course.find({ _id: { $in: courseIds.map((id) => new Types.ObjectId(id)) } })
          .select(
            "title coverImage sections isPaid isFree price currency status"
          )
          .lean()
      : [],
  ]);

  // Build lookup maps
  const workshopMap = new Map<string, any>();
  for (const w of workshops) {
    workshopMap.set(w._id.toString(), w);
  }

  const standaloneMap = new Map<string, any>();
  for (const sv of standaloneVideos) {
    standaloneMap.set(sv._id.toString(), sv);
  }

  const courseMap = new Map<string, any>();
  for (const c of courses) {
    courseMap.set(c._id.toString(), c);
  }

  // Build populated videos array, maintaining order
  const videos: any[] = [];
  for (const entry of entries) {
    if (entry.videoSource === "workshop") {
      const doc = workshopMap.get(entry.videoId.toString());
      if (doc) {
        videos.push({
          ...doc,
          _videoSource: "workshop",
        });
      }
    } else if (entry.videoSource === "standalone") {
      const doc = standaloneMap.get(entry.videoId.toString());
      if (doc) {
        videos.push({
          ...doc,
          _videoSource: "standalone",
        });
      }
    } else if (entry.videoSource === "courseVideo") {
      // Find the chapter inside the course
      const course = entry.courseId
        ? courseMap.get(entry.courseId.toString())
        : null;
      if (course) {
        let foundChapter: any = null;
        let foundSection: any = null;
        for (const section of course.sections || []) {
          const chapter = section.chapters?.find(
            (ch: any) =>
              ch._id.toString() === (entry.chapterId || entry.videoId).toString()
          );
          if (chapter) {
            foundChapter = chapter;
            foundSection = section;
            break;
          }
        }
        if (foundChapter) {
          videos.push({
            _id: foundChapter._id,
            title: foundChapter.title,
            thumbnail: course.coverImage || null,
            duration: foundChapter.duration,
            videoUrl: foundChapter.videoUrl,
            videoS3Key: foundChapter.videoS3Key,
            contentType: foundChapter.contentType,
            _videoSource: "courseVideo",
            courseId: course._id,
            courseTitle: course.title,
            sectionTitle: foundSection?.title,
            isPaid: course.isPaid,
            isFree: course.isFree,
            price: course.price,
            currency: course.currency,
          });
        }
      }
    }
  }

  return {
    ...playlist,
    videoEntries: entries,
    videos,
  };
}

/**
 * Get or create a learner's default playlist.
 * Learners get a single auto-created "My Playlist".
 */
export async function getOrCreateLearnerPlaylist(
  userId: string,
  organizationId: string
): Promise<IPlaylist> {
  let playlist = await Playlist.findOne({
    createdBy: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(organizationId),
    type: "learner",
  })
    .populate("createdBy", "name email avatar profilePicture")
    .lean();

  if (!playlist) {
    const newPlaylist = new Playlist({
      title: "My Playlist",
      organizationId: new Types.ObjectId(organizationId),
      createdBy: new Types.ObjectId(userId),
      type: "learner",
      isPublished: false,
      videoEntries: [],
      videoIds: [],
    });
    const saved = await newPlaylist.save();
    playlist = await Playlist.findById(saved._id)
      .populate("createdBy", "name email avatar profilePicture")
      .lean();
  }

  return playlist as IPlaylist;
}

/**
 * Get playlists visible to a user:
 * - Founders see all org playlists (their own + learner public ones are N/A, founder playlists)
 * - Learners see their own playlists + founder-published playlists
 */
export async function getPlaylists(
  organizationId: string,
  userId: string,
  isFounder: boolean
): Promise<IPlaylist[]> {
  let query: any;

  if (isFounder) {
    // Founders see all founder playlists for the org
    query = {
      organizationId: new Types.ObjectId(organizationId),
      type: "founder",
    };
  } else {
    // Learners see:  own playlists + published founder playlists
    query = {
      organizationId: new Types.ObjectId(organizationId),
      $or: [
        { createdBy: new Types.ObjectId(userId), type: "learner" },
        { type: "founder", isPublished: true },
      ],
    };
  }

  return Playlist.find(query)
    .populate("createdBy", "name email avatar profilePicture")
    .sort({ updatedAt: -1 })
    .lean();
}

export async function updatePlaylist(
  playlistId: string,
  data: Partial<{
    title: string;
    description: string;
    coverImage: string;
    isPublished: boolean;
    videoEntries: {
      videoSource: "workshop" | "standalone" | "courseVideo";
      videoId: string;
      courseId?: string;
      sectionId?: string;
      chapterId?: string;
    }[];
    // Legacy support
    videoIds: string[];
  }>
): Promise<IPlaylist | null> {
  const updateData: any = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

  if (data.videoEntries) {
    updateData.videoEntries = data.videoEntries.map((e) => ({
      videoSource: e.videoSource,
      videoId: new Types.ObjectId(e.videoId),
      courseId: e.courseId ? new Types.ObjectId(e.courseId) : undefined,
      sectionId: e.sectionId ? new Types.ObjectId(e.sectionId) : undefined,
      chapterId: e.chapterId ? new Types.ObjectId(e.chapterId) : undefined,
    }));
    updateData.videoCount = data.videoEntries.length;
    updateData.videoIds = []; // Clear legacy
  } else if (data.videoIds) {
    // Legacy: convert to videoEntries as workshop type
    updateData.videoEntries = data.videoIds.map((id) => ({
      videoSource: "workshop",
      videoId: new Types.ObjectId(id),
    }));
    updateData.videoCount = data.videoIds.length;
    updateData.videoIds = [];
  }

  return Playlist.findByIdAndUpdate(playlistId, updateData, { new: true })
    .populate("createdBy", "name email avatar profilePicture")
    .lean();
}

export async function deletePlaylist(playlistId: string): Promise<boolean> {
  const result = await Playlist.findByIdAndDelete(playlistId);
  return !!result;
}

// ============== VIDEO MANAGEMENT ==============

export async function addVideosToPlaylist(
  playlistId: string,
  entries: {
    videoSource: "workshop" | "standalone" | "courseVideo";
    videoId: string;
    courseId?: string;
    sectionId?: string;
    chapterId?: string;
  }[]
): Promise<IPlaylist | null> {
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) return null;

  // Ensure we have videoEntries (migrate if needed)
  if (
    (!playlist.videoEntries || playlist.videoEntries.length === 0) &&
    playlist.videoIds &&
    playlist.videoIds.length > 0
  ) {
    const migrated = await migrateLegacyVideoIds(playlist.toObject());
    playlist.videoEntries = migrated;
    playlist.videoIds = [];
  }

  // Build set of existing entry keys for dedup
  const existingKeys = new Set(
    (playlist.videoEntries || []).map((e) =>
      `${e.videoSource}:${e.videoId.toString()}:${(e.chapterId || "").toString()}`
    )
  );

  for (const entry of entries) {
    const key = `${entry.videoSource}:${entry.videoId}:${entry.chapterId || ""}`;
    if (!existingKeys.has(key)) {
      playlist.videoEntries.push({
        videoSource: entry.videoSource,
        videoId: new Types.ObjectId(entry.videoId),
        courseId: entry.courseId
          ? new Types.ObjectId(entry.courseId)
          : undefined,
        sectionId: entry.sectionId
          ? new Types.ObjectId(entry.sectionId)
          : undefined,
        chapterId: entry.chapterId
          ? new Types.ObjectId(entry.chapterId)
          : undefined,
      } as IVideoEntry);
      existingKeys.add(key);
    }
  }

  const saved = await playlist.save();
  return Playlist.findById(saved._id)
    .populate("createdBy", "name email avatar profilePicture")
    .lean();
}

/**
 * Legacy wrapper: add workshop/standalone IDs (auto-wraps as workshopIds, used by quick-add)
 */
export async function addVideoIdsToPlaylist(
  playlistId: string,
  workshopIds: string[]
): Promise<IPlaylist | null> {
  return addVideosToPlaylist(
    playlistId,
    workshopIds.map((id) => ({ videoSource: "workshop" as const, videoId: id }))
  );
}

export async function removeVideoFromPlaylist(
  playlistId: string,
  videoId: string,
  videoSource?: string
): Promise<IPlaylist | null> {
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) return null;

  // Ensure videoEntries are populated
  if (
    (!playlist.videoEntries || playlist.videoEntries.length === 0) &&
    playlist.videoIds &&
    playlist.videoIds.length > 0
  ) {
    const migrated = await migrateLegacyVideoIds(playlist.toObject());
    playlist.videoEntries = migrated;
    playlist.videoIds = [];
  }

  // Remove the matching entry
  playlist.videoEntries = playlist.videoEntries.filter((entry) => {
    const idMatch = entry.videoId.toString() !== videoId;
    if (!idMatch && videoSource) {
      // If videoSource is specified, only remove if source also matches
      return entry.videoSource !== videoSource;
    }
    return idMatch;
  });

  // Also clear legacy videoIds
  playlist.videoIds = playlist.videoIds.filter(
    (id) => id.toString() !== videoId
  );

  const saved = await playlist.save();
  return Playlist.findById(saved._id)
    .populate("createdBy", "name email avatar profilePicture")
    .lean();
}

export async function reorderPlaylistVideos(
  playlistId: string,
  orderedEntries: {
    videoSource: "workshop" | "standalone" | "courseVideo";
    videoId: string;
    courseId?: string;
    sectionId?: string;
    chapterId?: string;
  }[]
): Promise<IPlaylist | null> {
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) return null;

  playlist.videoEntries = orderedEntries.map((e) => ({
    videoSource: e.videoSource,
    videoId: new Types.ObjectId(e.videoId),
    courseId: e.courseId ? new Types.ObjectId(e.courseId) : undefined,
    sectionId: e.sectionId ? new Types.ObjectId(e.sectionId) : undefined,
    chapterId: e.chapterId ? new Types.ObjectId(e.chapterId) : undefined,
  })) as IVideoEntry[];

  playlist.videoIds = []; // Clear legacy

  const saved = await playlist.save();
  return Playlist.findById(saved._id)
    .populate("createdBy", "name email avatar profilePicture")
    .lean();
}

// ============== AVAILABLE VIDEOS (CATEGORIZED) ==============

/**
 * Get all available videos for playlist creation, categorized by source.
 * Used by founder when creating/editing a playlist.
 */
export async function getAvailableVideos(organizationId: string): Promise<{
  livestream: any[];
  uploaded: any[];
  courseVideos: any[];
}> {
  const orgOid = new Types.ObjectId(organizationId);

  const [workshops, standaloneVideos, courses] = await Promise.all([
    // Completed workshops (date in the past)
    Workshop.find({
      orgId: orgOid,
      isActive: true,
      date: { $lte: new Date() },
    })
      .select("title description thumbnail date startTime endTime createdAt")
      .sort({ date: -1 })
      .lean(),

    // All standalone videos
    StandaloneVideo.find({
      orgId: orgOid,
      isPublished: true,
    })
      .select(
        "title description thumbnail videoUrl videoS3Key sourceType duration createdAt"
      )
      .sort({ createdAt: -1 })
      .lean(),

    // All courses — extract video chapters
    Course.find({
      organizationId: orgOid,
      status: { $in: ["published", "draft"] },
    })
      .select("title coverImage sections isPaid isFree price currency status")
      .lean(),
  ]);

  // Extract video chapters from courses
  const courseVideos: any[] = [];
  for (const course of courses) {
    for (const section of course.sections || []) {
      for (const chapter of section.chapters || []) {
        if (
          chapter.contentType === "video" &&
          (chapter.videoUrl || chapter.videoS3Key)
        ) {
          courseVideos.push({
            _id: chapter._id,
            title: chapter.title,
            thumbnail: course.coverImage || null,
            duration: chapter.duration,
            videoUrl: chapter.videoUrl,
            videoS3Key: chapter.videoS3Key,
            courseId: course._id,
            courseTitle: course.title,
            sectionId: section._id,
            sectionTitle: section.title,
            isPaid: course.isPaid,
            isFree: course.isFree,
            price: course.price,
            currency: course.currency,
          });
        }
      }
    }
  }

  return {
    livestream: workshops,
    uploaded: standaloneVideos,
    courseVideos,
  };
}

// src/routes/playlist.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import * as playlistService from "../services/playlist";

const router = Router();

// Helper to check if user is founder in an org
async function isUserFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();
  if (!user) return false;

  // Legacy check
  if (
    user.organization?.toString() === orgId &&
    ["admin", "founder"].includes(user.role || "")
  ) {
    return true;
  }

  // New multiple org check
  if (user.organizations) {
    const membership = user.organizations.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (membership && hasFounderAccess(membership)) {
      return true;
    }
  }

  return false;
}

// ============== AVAILABLE VIDEOS (must be before /:id) ==============

/**
 * GET /available-videos
 * Founder: returns categorized video sources (livestream, uploaded, courseVideos)
 */
router.get("/available-videos", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can access this endpoint" });
    }

    const result = await playlistService.getAvailableVideos(orgId);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error fetching available videos:", error);
    res.status(500).json({ error: "Failed to fetch available videos" });
  }
});

// ============== LEARNER QUICK-ADD (must be before /:id) ==============

/**
 * POST /quick-add
 * Learner: auto-creates "My Playlist" if needed, then adds a video to it.
 * No title/description input needed from the learner.
 */
router.post("/quick-add", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { workshopId, videoEntry } = req.body;

    // Get or create the learner's personal playlist
    const learnerPlaylist = await playlistService.getOrCreateLearnerPlaylist(
      me.userId,
      orgId
    );

    // Support both new format (videoEntry) and legacy format (workshopId)
    let entries: {
      videoSource: "workshop" | "standalone" | "courseVideo";
      videoId: string;
      courseId?: string;
      sectionId?: string;
      chapterId?: string;
    }[];

    if (videoEntry) {
      entries = [videoEntry];
    } else if (workshopId) {
      entries = [{ videoSource: "workshop" as const, videoId: workshopId }];
    } else {
      return res
        .status(400)
        .json({ error: "workshopId or videoEntry is required" });
    }

    // Add the video
    const playlist = await playlistService.addVideosToPlaylist(
      learnerPlaylist._id.toString(),
      entries
    );

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error quick-adding video to playlist:", error);
    res.status(500).json({ error: "Failed to add video to playlist" });
  }
});

// ============== PLAYLIST CRUD ==============

// Create a new playlist
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const {
      title,
      description,
      coverImage,
      isPublished,
      videoEntries,
      videoIds,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Playlist title is required" });
    }

    const isFounder = await isUserFounder(me.userId, orgId);
    const type = isFounder ? "founder" : "learner";

    const playlist = await playlistService.createPlaylist({
      title: title.trim(),
      description: description?.trim(),
      coverImage,
      organizationId: orgId,
      createdBy: me.userId,
      type,
      isPublished: type === "founder" ? !!isPublished : false,
      videoEntries,
      videoIds,
    });

    res.status(201).json({ success: true, playlist });
  } catch (error) {
    console.error("Error creating playlist:", error);
    res.status(500).json({ error: "Failed to create playlist" });
  }
});

// Get playlists for the current user/org
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    const isFounder = await isUserFounder(me.userId, orgId);

    const playlists = await playlistService.getPlaylists(
      orgId,
      me.userId,
      isFounder
    );

    res.json({ success: true, playlists, isFounder });
  } catch (error) {
    console.error("Error fetching playlists:", error);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

// Get single playlist by ID (with populated videos)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const playlist = await playlistService.getPlaylistById(id);
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error fetching playlist:", error);
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});

// Update playlist (owner only)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { id } = req.params;
    const {
      title,
      description,
      coverImage,
      isPublished,
      videoEntries,
      videoIds,
    } = req.body;

    // Verify ownership
    const existing = await playlistService.getPlaylistById(id);
    if (!existing) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const orgId = (req.query.orgId as string) || me.organizationId;
    const isFounder = await isUserFounder(me.userId, orgId);

    // Only the creator (or a founder for founder playlists) can edit
    const isOwner =
      existing.createdBy._id?.toString() === me.userId ||
      (existing.type === "founder" && isFounder);

    if (!isOwner) {
      return res
        .status(403)
        .json({ error: "Not authorized to edit this playlist" });
    }

    const playlist = await playlistService.updatePlaylist(id, {
      title: title?.trim(),
      description: description?.trim(),
      coverImage,
      isPublished,
      videoEntries,
      videoIds,
    });

    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error updating playlist:", error);
    res.status(500).json({ error: "Failed to update playlist" });
  }
});

// Delete playlist (owner only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { id } = req.params;

    // Verify ownership
    const existing = await playlistService.getPlaylistById(id);
    if (!existing) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const orgId = (req.query.orgId as string) || me.organizationId;
    const isFounder = await isUserFounder(me.userId, orgId);

    const isOwner =
      existing.createdBy._id?.toString() === me.userId ||
      (existing.type === "founder" && isFounder);

    if (!isOwner) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this playlist" });
    }

    await playlistService.deletePlaylist(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting playlist:", error);
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

// ============== VIDEO MANAGEMENT ==============

// Add videos to playlist
router.post("/:id/videos", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { id } = req.params;
    const { videoEntries, workshopIds } = req.body;

    // Support both new format and legacy format
    if (
      (!videoEntries || !Array.isArray(videoEntries) || videoEntries.length === 0) &&
      (!workshopIds || !Array.isArray(workshopIds) || workshopIds.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "videoEntries or workshopIds array is required" });
    }

    // Verify ownership
    const existing = await playlistService.getPlaylistById(id);
    if (!existing) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const orgId = (req.query.orgId as string) || me.organizationId;
    const isFounder = await isUserFounder(me.userId, orgId);

    const isOwner =
      existing.createdBy._id?.toString() === me.userId ||
      (existing.type === "founder" && isFounder);

    if (!isOwner) {
      return res
        .status(403)
        .json({ error: "Not authorized to modify this playlist" });
    }

    // Convert legacy workshopIds to entries format
    const entries = videoEntries ||
      workshopIds.map((id: string) => ({
        videoSource: "workshop",
        videoId: id,
      }));

    const playlist = await playlistService.addVideosToPlaylist(id, entries);
    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error adding videos to playlist:", error);
    res.status(500).json({ error: "Failed to add videos" });
  }
});

// Remove video from playlist
router.delete("/:id/videos/:videoId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { id, videoId } = req.params;
    const videoSource = req.query.videoSource as string | undefined;

    // Verify ownership
    const existing = await playlistService.getPlaylistById(id);
    if (!existing) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const orgId = (req.query.orgId as string) || me.organizationId;
    const isFounder = await isUserFounder(me.userId, orgId);

    const isOwner =
      existing.createdBy._id?.toString() === me.userId ||
      (existing.type === "founder" && isFounder);

    if (!isOwner) {
      return res
        .status(403)
        .json({ error: "Not authorized to modify this playlist" });
    }

    const playlist = await playlistService.removeVideoFromPlaylist(
      id,
      videoId,
      videoSource
    );
    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error removing video from playlist:", error);
    res.status(500).json({ error: "Failed to remove video" });
  }
});

// Reorder videos in playlist
router.post("/:id/videos/reorder", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const { id } = req.params;
    const { videoEntries, videoIds } = req.body;

    if (
      (!videoEntries || !Array.isArray(videoEntries)) &&
      (!videoIds || !Array.isArray(videoIds))
    ) {
      return res
        .status(400)
        .json({ error: "videoEntries or videoIds array is required" });
    }

    // Verify ownership
    const existing = await playlistService.getPlaylistById(id);
    if (!existing) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    const orgId = (req.query.orgId as string) || me.organizationId;
    const isFounder = await isUserFounder(me.userId, orgId);

    const isOwner =
      existing.createdBy._id?.toString() === me.userId ||
      (existing.type === "founder" && isFounder);

    if (!isOwner) {
      return res
        .status(403)
        .json({ error: "Not authorized to modify this playlist" });
    }

    // Convert legacy videoIds to entries format
    const entries = videoEntries ||
      videoIds.map((id: string) => ({
        videoSource: "workshop",
        videoId: id,
      }));

    const playlist = await playlistService.reorderPlaylistVideos(id, entries);
    res.json({ success: true, playlist });
  } catch (error) {
    console.error("Error reordering playlist videos:", error);
    res.status(500).json({ error: "Failed to reorder videos" });
  }
});

export default router;

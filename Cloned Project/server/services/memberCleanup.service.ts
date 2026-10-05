import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Group } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";
import { Message } from "../models/message.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Booking } from "../models/booking.model";
import { Task } from "../models/task.model";
import { Todo } from "../models/todo.model";
import { Notification } from "../models/notification.model";
import { UserActivity } from "../models/userActivity.model";
import { Post } from "../models/post.model";
import { PostComment } from "../models/postComment.model";
import { PostLike } from "../models/postLike.model";
import { PostBookmark } from "../models/postBookmark.model";
import { PostRepost } from "../models/postRepost.model";
import { PollVote } from "../models/pollVote.model";
import {
  UserCabinet,
  UserFile,
  FloorCabinet,
  FloorFile,
  OrganizationCabinet,
  OrganizationFile,
} from "../models/cabinet.model";
import { s3Service } from "./s3";
import { getSocketInstance } from "./socket";
import { requestGroupTaskroomSync } from "./groupTaskroom";

/**
 * Groups matching `filter` that are linked to a Taskroom board. Read BEFORE a
 * member is pulled out of them — afterwards nothing ties those groups to the
 * member — so their boards can be reconciled once the pull is done. Never
 * throws: cleanup must not fail over a board.
 */
async function taskroomLinkedGroupIds(
  filter: Record<string, unknown>
): Promise<string[]> {
  try {
    const rows = await Group.find({
      ...filter,
      "taskroom.roomId": { $exists: true },
    })
      .select("_id")
      .lean();
    return (rows as any[]).map((row) => String(row._id));
  } catch (error: any) {
    console.error(
      "[MemberCleanup] Could not list Taskroom-linked groups:",
      error?.message || error
    );
    return [];
  }
}

/** Background board reconcile for each group (takes off whoever the sync added). */
function syncTaskroomBoards(groupIds: string[]): void {
  for (const groupId of groupIds) requestGroupTaskroomSync(groupId);
}

export interface CleanupResult {
  success: boolean;
  cleanedResources: {
    groups: number;
    channels: number;
    bookings: number;
    files: number;
    messages: number;
    tasks: number;
    notifications: number;
    posts: number;
    activities: number;
  };
  errors: string[];
}

export interface RemoveFromOrgOptions {
  userId: string;
  orgId: string;
  performedBy: string;
  reason: "kicked" | "left";
}

/**
 * Service for handling member removal and account deletion
 * Provides cleanup operations for removing users from organizations
 * and permanently deleting user accounts
 */
class MemberCleanupService {
  /**
   * Remove a user from a single organization (soft delete - preserves content)
   * Content remains visible with "Removed member" attribution
   */
  async removeFromOrganization(
    options: RemoveFromOrgOptions
  ): Promise<CleanupResult> {
    const { userId, orgId, performedBy, reason } = options;
    const userObjectId = new Types.ObjectId(userId);
    const orgObjectId = new Types.ObjectId(orgId);

    const result: CleanupResult = {
      success: false,
      cleanedResources: {
        groups: 0,
        channels: 0,
        bookings: 0,
        files: 0,
        messages: 0,
        tasks: 0,
        notifications: 0,
        posts: 0,
        activities: 0,
      },
      errors: [],
    };

    try {
      // 1. Remove from all Groups in this organization
      const linkedGroupIds = await taskroomLinkedGroupIds({
        orgId: orgObjectId,
        "members.userId": userObjectId,
      });
      const groupResult = await Group.updateMany(
        { orgId: orgObjectId, "members.userId": userObjectId },
        { $pull: { members: { userId: userObjectId } } }
      );
      result.cleanedResources.groups = groupResult.modifiedCount;
      syncTaskroomBoards(linkedGroupIds);

      // 2. Delete ChannelMembership records for this org
      const channelResult = await ChannelMembership.deleteMany({
        userId: userObjectId,
        orgId: orgObjectId,
      });
      result.cleanedResources.channels = channelResult.deletedCount;

      // 3. Cancel future bookings (set status to 'cancelled')
      const now = new Date();
      const bookingResult = await Booking.updateMany(
        {
          orgId: orgObjectId,
          $or: [{ bookerId: userObjectId }, { bookedWithId: userObjectId }],
          startTime: { $gt: now },
          status: "confirmed",
        },
        { $set: { status: "cancelled" } }
      );
      result.cleanedResources.bookings = bookingResult.modifiedCount;

      // 4. Unassign tasks assigned to this user (keep tasks created by user)
      const taskResult = await Task.updateMany(
        { orgId: orgObjectId, assignedTo: userObjectId },
        { $unset: { assignedTo: 1 } }
      );
      result.cleanedResources.tasks = taskResult.modifiedCount;

      // 5. Delete todos owned by this user in this org
      await Todo.deleteMany({
        orgId: orgObjectId,
        userId: userObjectId,
      });

      // 6. Delete notifications for this user in this org
      const notificationResult = await Notification.deleteMany({
        userId: userObjectId,
        orgId: orgObjectId,
      });
      result.cleanedResources.notifications = notificationResult.deletedCount;

      // 7. Delete user activity records for this org
      const activityResult = await UserActivity.deleteMany({
        userId: userObjectId,
        orgId: orgObjectId,
      });
      result.cleanedResources.activities = activityResult.deletedCount;

      // 8. Remove user from organization membership in User model
      await User.updateOne(
        { _id: userObjectId },
        { $pull: { organizations: { organization: orgObjectId } } }
      );

      // 9. Also remove org-specific mailbox if exists
      await User.updateOne(
        { _id: userObjectId },
        { $pull: { mailboxes: { organization: orgObjectId } } }
      );

      // 10. Emit Socket.IO events
      await this.emitMemberRemovedEvent(userId, orgId, performedBy, reason);

      // 11. Disconnect user's sockets from this org
      await this.disconnectUserFromOrg(userId, orgId);

      result.success = true;
    } catch (error: any) {
      result.errors.push(error.message || "Unknown error during org removal");
      console.error("[MemberCleanup] Error removing from org:", error);
    }

    return result;
  }

  /**
   * Permanently delete a user account (hard delete)
   * Removes all data across all organizations
   */
  async deleteAccountPermanently(
    userId: string,
    performedBy: string
  ): Promise<CleanupResult> {
    const userObjectId = new Types.ObjectId(userId);

    const result: CleanupResult = {
      success: false,
      cleanedResources: {
        groups: 0,
        channels: 0,
        bookings: 0,
        files: 0,
        messages: 0,
        tasks: 0,
        notifications: 0,
        posts: 0,
        activities: 0,
      },
      errors: [],
    };

    try {
      // Verify user exists and is not a founder
      const user = await User.findById(userId)
        .select("organizations email")
        .lean();
      if (!user) {
        result.errors.push("User not found");
        return result;
      }

      // Check if user is a founder of any organization
      const founderOrgs = (user.organizations || []).filter(
        (m: any) => m.role === "founder"
      );
      if (founderOrgs.length > 0) {
        result.errors.push(
          "Cannot delete account while holding founder roles. Transfer ownership first."
        );
        return result;
      }

      // Get all org IDs for this user (for emitting events)
      const orgIds = (user.organizations || []).map((m: any) =>
        m.organization.toString()
      );

      // 1. Remove from all Groups
      const linkedGroupIds = await taskroomLinkedGroupIds({
        "members.userId": userObjectId,
      });
      const groupResult = await Group.updateMany(
        { "members.userId": userObjectId },
        { $pull: { members: { userId: userObjectId } } }
      );
      result.cleanedResources.groups = groupResult.modifiedCount;
      syncTaskroomBoards(linkedGroupIds);

      // 2. Delete all DMs (Message model)
      const messageResult = await Message.deleteMany({
        $or: [{ from: userObjectId }, { to: userObjectId }],
      });
      result.cleanedResources.messages = messageResult.deletedCount;

      // 3. Handle GroupMessages - remove from mentions (keep messages for conversation context)
      await GroupMessage.updateMany(
        { mentions: userObjectId },
        { $pull: { mentions: userObjectId } }
      );

      // 4. Delete all channel memberships
      const channelResult = await ChannelMembership.deleteMany({
        userId: userObjectId,
      });
      result.cleanedResources.channels = channelResult.deletedCount;

      // 5. Delete all bookings
      const bookingResult = await Booking.deleteMany({
        $or: [{ bookerId: userObjectId }, { bookedWithId: userObjectId }],
      });
      result.cleanedResources.bookings = bookingResult.deletedCount;

      // 6. Delete all tasks created by or assigned to user
      const taskResult = await Task.deleteMany({
        $or: [{ createdBy: userObjectId }, { assignedTo: userObjectId }],
      });
      result.cleanedResources.tasks = taskResult.deletedCount;

      // 7. Delete all todos
      await Todo.deleteMany({
        $or: [{ userId: userObjectId }, { createdBy: userObjectId }],
      });

      // 8. Delete all notifications
      const notificationResult = await Notification.deleteMany({
        userId: userObjectId,
      });
      result.cleanedResources.notifications = notificationResult.deletedCount;

      // 9. Delete all user activity records
      const activityResult = await UserActivity.deleteMany({
        userId: userObjectId,
      });
      result.cleanedResources.activities = activityResult.deletedCount;

      // 10. Delete posts and related content
      const postResult = await Post.deleteMany({ authorId: userObjectId });
      result.cleanedResources.posts = postResult.deletedCount;

      await PostComment.deleteMany({ userId: userObjectId });
      await PostLike.deleteMany({ userId: userObjectId });
      await PostBookmark.deleteMany({ userId: userObjectId });
      await PostRepost.deleteMany({ userId: userObjectId });

      // Remove user from mentions in posts
      await Post.updateMany(
        { mentions: userObjectId },
        { $pull: { mentions: userObjectId } }
      );

      // 11. Delete poll votes
      await PollVote.deleteMany({ userId: userObjectId });

      // 12. Get user files for S3 cleanup then delete records
      const userFiles = await UserFile.find({ owner: userObjectId })
        .select("s3Key")
        .lean();
      const s3Keys = userFiles.map((f: any) => f.s3Key).filter(Boolean);

      // Delete file and cabinet records
      await UserFile.deleteMany({ owner: userObjectId });
      await UserCabinet.deleteMany({ owner: userObjectId });
      result.cleanedResources.files = userFiles.length;

      // Transfer ownership of floor/org cabinets and files to org founder or delete
      // For now, we'll just remove owner reference (files remain but become orphaned)
      await FloorCabinet.updateMany(
        { owner: userObjectId },
        { $unset: { owner: 1 } }
      );
      await FloorFile.updateMany(
        { owner: userObjectId },
        { $unset: { owner: 1 } }
      );
      await OrganizationCabinet.updateMany(
        { owner: userObjectId },
        { $unset: { owner: 1 } }
      );
      await OrganizationFile.updateMany(
        { owner: userObjectId },
        { $unset: { owner: 1 } }
      );

      // 13. Handle referral chain - reconnect referrals to the deleted user's referrer
      const deletedUser = await User.findById(userObjectId)
        .select("referredBy")
        .lean();
      if (deletedUser?.referredBy) {
        // Reconnect: point all direct referrals to the deleted user's own referrer
        await User.updateMany(
          { referredBy: userObjectId },
          { $set: { referredBy: deletedUser.referredBy } }
        );
      } else {
        // No upstream referrer - nullify to avoid dangling references
        await User.updateMany(
          { referredBy: userObjectId },
          { $unset: { referredBy: 1 } }
        );
      }

      // 14. Delete the user document
      await User.deleteOne({ _id: userObjectId });

      // 15. S3 cleanup (non-critical, log errors but don't fail)
      for (const key of s3Keys) {
        try {
          await s3Service.deleteFile(key);
        } catch (s3Error: any) {
          result.errors.push(`S3 cleanup failed for ${key}: ${s3Error.message}`);
          console.error("[MemberCleanup] S3 delete error:", s3Error);
        }
      }

      // 16. Emit events to all orgs user was in
      for (const orgId of orgIds) {
        await this.emitMemberDeletedEvent(userId, orgId);
      }

      // 17. Disconnect all user sockets
      await this.disconnectUserCompletely(userId);

      result.success = true;
    } catch (error: any) {
      result.errors.push(
        error.message || "Unknown error during account deletion"
      );
      console.error("[MemberCleanup] Error deleting account:", error);
    }

    return result;
  }

  /**
   * Check if a user is a founder of any organization
   */
  async isFounderOfAnyOrg(userId: string): Promise<{
    isFounder: boolean;
    organizations: Array<{ id: string; name: string }>;
  }> {
    const user = await User.findById(userId)
      .select("organizations")
      .populate("organizations.organization", "name")
      .lean();

    if (!user) {
      return { isFounder: false, organizations: [] };
    }

    const founderOrgs = (user.organizations || [])
      .filter((m: any) => m.role === "founder" && m.organization != null)
      .map((m: any) => ({
        id: m.organization._id?.toString() || m.organization.toString(),
        name: m.organization.name || "Unknown",
      }));

    return {
      isFounder: founderOrgs.length > 0,
      organizations: founderOrgs,
    };
  }

  /**
   * Check if a user is a member of a specific organization
   */
  async isMemberOfOrg(
    userId: string,
    orgId: string
  ): Promise<{
    isMember: boolean;
    role?: "founder" | "stakeholder";
  }> {
    const user = await User.findById(userId).select("organizations").lean();

    if (!user) {
      return { isMember: false };
    }

    const membership = (user.organizations || []).find(
      (m: any) => m.organization.toString() === orgId
    );

    if (!membership) {
      return { isMember: false };
    }

    return {
      isMember: true,
      role: membership.role,
    };
  }

  /**
   * Get user's remaining organizations after potential removal
   */
  async getRemainingOrganizations(
    userId: string,
    excludeOrgId?: string
  ): Promise<Array<{ id: string; name: string }>> {
    const user = await User.findById(userId)
      .select("organizations")
      .populate("organizations.organization", "name")
      .lean();

    if (!user) {
      return [];
    }

    return (user.organizations || [])
      .filter((m: any) => {
        if (m.organization == null) return false;
        const orgId = m.organization._id?.toString() || m.organization.toString();
        return excludeOrgId ? orgId !== excludeOrgId : true;
      })
      .map((m: any) => ({
        id: m.organization._id?.toString() || m.organization.toString(),
        name: m.organization.name || "Unknown",
      }));
  }

  /**
   * Emit Socket.IO event when member is removed from org
   */
  private async emitMemberRemovedEvent(
    userId: string,
    orgId: string,
    performedBy: string,
    reason: "kicked" | "left"
  ): Promise<void> {
    const io = getSocketInstance();
    if (!io) return;

    io.to(`org:${orgId}`).emit("member:removed", {
      userId,
      orgId,
      reason,
      performedBy,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emit Socket.IO event when member account is deleted
   */
  private async emitMemberDeletedEvent(
    userId: string,
    orgId: string
  ): Promise<void> {
    const io = getSocketInstance();
    if (!io) return;

    io.to(`org:${orgId}`).emit("member:deleted", {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Disconnect user's sockets from a specific organization
   */
  private async disconnectUserFromOrg(
    userId: string,
    orgId: string
  ): Promise<void> {
    const io = getSocketInstance();
    if (!io) return;

    const userRoom = `user:${userId}`;
    const sockets = await io.in(userRoom).fetchSockets();

    for (const socket of sockets) {
      // Check if this socket is connected to the specified org
      if ((socket.data as any)?.orgId === orgId) {
        socket.emit("session:terminated", {
          reason: "removed_from_organization",
          orgId,
          message: "Your access to this organization has been revoked.",
        });
        // Leave org-specific rooms
        socket.leave(`org:${orgId}`);
        socket.leave("workspace");
      }
    }
  }

  /**
   * Disconnect all of a user's sockets (for account deletion)
   */
  private async disconnectUserCompletely(userId: string): Promise<void> {
    const io = getSocketInstance();
    if (!io) return;

    const userRoom = `user:${userId}`;
    const sockets = await io.in(userRoom).fetchSockets();

    for (const socket of sockets) {
      socket.emit("session:terminated", {
        reason: "account_deleted",
        message: "Your account has been deleted.",
      });
      socket.disconnect(true);
    }
  }
}

export const memberCleanupService = new MemberCleanupService();

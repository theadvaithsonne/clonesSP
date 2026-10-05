import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type ActivityType =
  | "login"
  | "logout"
  | "online"
  | "offline"
  | "task_created"
  | "task_completed"
  | "task_assigned"
  | "booking_created"
  | "booking_cancelled"
  | "message_sent"
  | "file_uploaded"
  | "profile_updated"
  | "floor_assigned"
  | "group_joined"
  | "group_left"
  | "system";

export type ActivityCategory =
  | "auth"
  | "task"
  | "booking"
  | "communication"
  | "file"
  | "profile"
  | "system"
  | "presence";

export interface ActivityMetadata {
  [key: string]: any;
}

export interface CreateActivityParams {
  type: ActivityType;
  title: string;
  description: string;
  metadata?: ActivityMetadata;
  category: ActivityCategory;
  priority?: "low" | "medium" | "high";
}

/**
 * Track user activity and store it in the database
 */
export const trackActivity = async (
  params: CreateActivityParams,
): Promise<void> => {
  const orgId = localStorage.getItem("garage_org_id");
  if (!orgId) {
    console.warn("No organization ID found, skipping activity tracking");
    return;
  }

  try {
    await api(
      "/user-activity",
      {
        method: "POST",
        body: JSON.stringify({
          orgId,
          ...params,
        }),
      },
      getToken()!,
    );

    // Dispatch event for real-time updates
    window.dispatchEvent(
      new CustomEvent("activity:new", {
        detail: {
          activity: {
            _id: `temp-${Date.now()}`,
            userId: { _id: "current-user", name: "You", email: "" },
            orgId,
            ...params,
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
  } catch (error) {
    console.error("Failed to track activity:", error);
  }
};

/**
 * Predefined activity tracking functions for common actions
 */
export const ActivityTracker = {
  // Authentication activities
  login: (userId: string, userName?: string) =>
    trackActivity({
      type: "login",
      title: `${userName || "User"} logged in`,
      description: `User successfully logged into the system`,
      category: "auth",
      priority: "medium",
      metadata: { userId, userName },
    }),

  logout: (userId: string, userName?: string) =>
    trackActivity({
      type: "logout",
      title: `${userName || "User"} logged out`,
      description: `User logged out of the system`,
      category: "auth",
      priority: "low",
      metadata: { userId, userName },
    }),

  online: (userId: string, userName?: string) =>
    trackActivity({
      type: "online",
      title: `${userName || "User"} came online`,
      description: `${userName || "User"} is now online and active`,
      category: "presence",
      priority: "low",
      metadata: { userId, userName },
    }),

  offline: (userId: string, userName?: string) =>
    trackActivity({
      type: "offline",
      title: `${userName || "User"} went offline`,
      description: `${userName || "User"} is now offline`,
      category: "presence",
      priority: "low",
      metadata: { userId, userName },
    }),

  // Task activities
  taskCreated: (
    taskId: string,
    taskTitle: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "task_created",
      title: `New task created: "${taskTitle}"`,
      description: `${userName || "User"} created a new task`,
      category: "task",
      priority: "medium",
      metadata: { taskId, taskTitle, userId, userName },
    }),

  taskCompleted: (
    taskId: string,
    taskTitle: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "task_completed",
      title: `Task completed: "${taskTitle}"`,
      description: `${userName || "User"} completed a task`,
      category: "task",
      priority: "medium",
      metadata: { taskId, taskTitle, userId, userName },
    }),

  taskAssigned: (
    taskId: string,
    taskTitle: string,
    assigneeId: string,
    assigneeName?: string,
    assignerId?: string,
    assignerName?: string,
  ) =>
    trackActivity({
      type: "task_assigned",
      title: `Task assigned: "${taskTitle}"`,
      description: `Task assigned to ${assigneeName || "user"}`,
      category: "task",
      priority: "high",
      metadata: {
        taskId,
        taskTitle,
        assigneeId,
        assigneeName,
        assignerId,
        assignerName,
      },
    }),

  // Booking activities
  bookingCreated: (
    bookingId: string,
    bookingTitle: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "booking_created",
      title: `Meeting scheduled: "${bookingTitle}"`,
      description: `${userName || "User"} scheduled a meeting`,
      category: "booking",
      priority: "medium",
      metadata: { bookingId, bookingTitle, userId, userName },
    }),

  bookingCancelled: (
    bookingId: string,
    bookingTitle: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "booking_cancelled",
      title: `Meeting cancelled: "${bookingTitle}"`,
      description: `${userName || "User"} cancelled a meeting`,
      category: "booking",
      priority: "medium",
      metadata: { bookingId, bookingTitle, userId, userName },
    }),

  // Communication activities
  messageSent: (
    messageId: string,
    channelType: "dm" | "group",
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "message_sent",
      title: `Message sent in ${channelType === "dm" ? "direct message" : "group chat"}`,
      description: `${userName || "User"} sent a message`,
      category: "communication",
      priority: "low",
      metadata: { messageId, channelType, userId, userName },
    }),

  // File activities
  fileUploaded: (
    fileId: string,
    fileName: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "file_uploaded",
      title: `File uploaded: "${fileName}"`,
      description: `${userName || "User"} uploaded a file`,
      category: "file",
      priority: "medium",
      metadata: { fileId, fileName, userId, userName },
    }),

  // Profile activities
  profileUpdated: (userId: string, userName?: string, fields?: string[]) =>
    trackActivity({
      type: "profile_updated",
      title: `Profile updated`,
      description: `${userName || "User"} updated their profile${fields ? ` (${fields.join(", ")})` : ""}`,
      category: "profile",
      priority: "low",
      metadata: { userId, userName, fields },
    }),

  // Floor/Organization activities
  floorAssigned: (
    floorId: string,
    floorName: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "floor_assigned",
      title: `Floor assignment: "${floorName}"`,
      description: `${userName || "User"} was assigned to a floor`,
      category: "profile",
      priority: "medium",
      metadata: { floorId, floorName, userId, userName },
    }),

  // Group activities
  groupJoined: (
    groupId: string,
    groupName: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "group_joined",
      title: `Joined group: "${groupName}"`,
      description: `${userName || "User"} joined a group`,
      category: "communication",
      priority: "medium",
      metadata: { groupId, groupName, userId, userName },
    }),

  groupLeft: (
    groupId: string,
    groupName: string,
    userId: string,
    userName?: string,
  ) =>
    trackActivity({
      type: "group_left",
      title: `Left group: "${groupName}"`,
      description: `${userName || "User"} left a group`,
      category: "communication",
      priority: "medium",
      metadata: { groupId, groupName, userId, userName },
    }),

  // System activities
  system: (title: string, description: string, metadata?: ActivityMetadata) =>
    trackActivity({
      type: "system",
      title,
      description,
      category: "system",
      priority: "low",
      metadata,
    }),

  // Manual presence tracking (for explicit online/offline actions)
  setOnline: (userId: string, userName?: string) =>
    trackActivity({
      type: "online",
      title: `${userName || "User"} is online`,
      description: `${userName || "User"} is actively using the application`,
      category: "presence",
      priority: "low",
      metadata: { userId, userName },
    }),

  setOffline: (userId: string, userName?: string) =>
    trackActivity({
      type: "offline",
      title: `${userName || "User"} is offline`,
      description: `${userName || "User"} is no longer active`,
      category: "presence",
      priority: "low",
      metadata: { userId, userName },
    }),
};

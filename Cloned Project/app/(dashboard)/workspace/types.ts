// roam/roam-frontend/app/(dashboard)/workspace/types.ts

// Statuses a user can pick for themselves from the UI.
export type SettableUserStatus = "available" | "busy" | "afk" | "offline";

// All status values that can appear on a peer card. 'mobile' is
// server-synthesized when the user has a registered push/VoIP token but no live
// socket — rendered with a phone icon. Reachable via knock. Never set by the
// client.
export type UserStatus = SettableUserStatus | "mobile";

export type PeerState = {
  id: string;
  email: string;
  name?: string;
  profilePicture?: string;
  stream?: MediaStream;
  spaceId: string;
  status?: UserStatus;
  isScreenSharing?: boolean;
  isRecording?: boolean; // For recording indicator
  connectionStatus?: RTCPeerConnectionState; // Track connection state for recovery
  guest?: boolean; // Track if user is a guest in this organization
  // Hydrated from `/users/last-seen` for the visible cards so the lobby
  // can render "Active 3m ago" instead of the green status dot we retired.
  // Null when the user has no recorded last-seen yet.
  lastSeenAt?: string | null;
};

export type KnockRequest = {
  from: string;
  fromName: string;
};

export type TodoNotification = {
  from: string;
  fromName: string;
  task: string;
  todoId: string;
};

export type FloorMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
};

export type RoomBooking = {
  _id: string;
  orgId: string;
  creatorId: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  invitedUserIds: Array<{
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  }>;
  status: "active" | "cancelled" | "completed";
  createdAt: string;
};

export type Floor = {
  id: string;
  level: number;
  name: string;
  departments: Array<{
    name: string;
    color?: string;
    count?: number;
  }>;
  members: FloorMember[];
  pending: FloorMember[];
  createdAt: string;
  updatedAt: string;
};

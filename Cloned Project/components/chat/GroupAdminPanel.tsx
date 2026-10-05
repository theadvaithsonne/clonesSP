"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  KanbanSquare,
  Link as LinkIcon,
  ListChecks,
  Loader2,
  Megaphone,
  Paperclip,
  RefreshCw,
  Shield,
  Sparkles,
  Timer,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TaskroomLinkPicker, {
  ensureTaskroomAccount,
  openTaskroomBoard,
  type LinkChoice,
  type TaskroomBoardRef,
} from "@/components/chat/TaskroomLinkPicker";

type MemberLite = {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
};

type GroupMember = {
  userId: string;
  role?: "admin" | "member";
};

/** The group's Taskroom link, as GET /groups/:id reports it. */
export type GroupTaskroom = {
  /** AI task capture on/off. Member sync runs either way. */
  enabled: boolean;
  /** "broken": the board is gone or nobody can act on it — relink. */
  status: "active" | "broken";
  mode: "new-workspace" | "new-board" | "existing-board";
  workspaceId: string;
  workspaceName: string | null;
  spaceId: string;
  roomId: string;
  roomName: string | null;
  linkedBy: string;
  linkedByName: string | null;
  linkedAt: string;
  lastError: string | null;
  memberSync: {
    running: boolean;
    synced: number;
    failed: number;
    lastSyncAt: string | null;
    failures: { userId: string; name: string; error: string }[];
  };
};

export type GroupData = {
  id: string;
  name: string;
  description?: string | null;
  picture?: string | null;
  createdBy: string;
  members: GroupMember[];
  agentMembers?: string[];
  broadcastOnly?: boolean;
  adminOnlyFiles?: boolean;
  messageRetentionDays?: number;
  inviteCode?: string | null;
  inviteExpiry?: string | null;
  /** "support" for support chats, which have no Taskroom link. */
  kind?: string;
  /** Present only while the group is linked to a Taskroom board. */
  taskroom?: GroupTaskroom;
};

type InviteLinkResponse = {
  ok: boolean;
  inviteCode: string;
  inviteUrl: string;
  expiresAt: string | null;
};

const TOAST_STYLE = {
  background: "#1a1a22",
  border: "1px solid var(--brand-2)",
  color: "#fff",
} as const;

const RETENTION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Off (keep forever)" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "365 days" },
];

// While the backend is adding and removing board members, the group is
// re-read so the "N members synced" line catches up on its own. Capped: a
// sync still "running" after two minutes is stuck, not slow.
const SYNC_POLL_MS = 4000;
const SYNC_POLL_MAX_MS = 2 * 60 * 1000;

const NO_MEMBER_SYNC: GroupTaskroom["memberSync"] = {
  running: false,
  synced: 0,
  failed: 0,
  lastSyncAt: null,
  failures: [],
};

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** PUT / PATCH / POST sync on /groups/:id/taskroom. */
type TaskroomReply = { ok: boolean; taskroom?: GroupTaskroom };

export default function GroupAdminPanel({
  groupId,
  userMap,
  onClose,
  onGroupUpdated,
  onOpenBoard,
  me,
}: {
  groupId: string;
  userMap: Record<string, MemberLite>;
  onClose: () => void;
  onGroupUpdated?: (group: GroupData) => void;
  /** How the host opens a board (it may need to get out of the way first). */
  onOpenBoard?: (board: TaskroomBoardRef) => Promise<boolean>;
  me: string;
}) {
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingMember, setSavingMember] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string>("7"); // days as string
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [revokingInvite, setRevokingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  // Taskroom: one request at a time, whichever button started it.
  const [taskroomBusy, setTaskroomBusy] = useState<
    "link" | "toggle" | "sync" | "unlink" | null
  >(null);
  const [taskroomChoice, setTaskroomChoice] = useState<LinkChoice | null>(null);
  const [pickingBoard, setPickingBoard] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [showSyncFailures, setShowSyncFailures] = useState(false);
  // Bumped whenever a mutation kicks off a member sync, so polling gets a
  // fresh two-minute window even if the previous sync still reads "running".
  const [syncPollEpoch, setSyncPollEpoch] = useState(0);
  // A link request succeeded but the panel doesn't show the link yet. Until
  // it does, linking stays disabled — a second click would build a second
  // workspace/board.
  const [linkSaved, setLinkSaved] = useState(false);

  // Use a ref for the callback to prevent infinite re-render loops.
  // onGroupUpdated is an inline arrow from the parent; including it in
  // useCallback deps would re-create `refresh` every render, which in turn
  // re-triggers the useEffect → API call → parent state update → new
  // onGroupUpdated reference → infinite loop.
  const onGroupUpdatedRef = useRef(onGroupUpdated);
  useEffect(() => {
    onGroupUpdatedRef.current = onGroupUpdated;
  }, [onGroupUpdated]);

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    try {
      const g = await api<GroupData>(`/groups/${groupId}`, {}, getToken()!);
      setGroup(g);
      onGroupUpdatedRef.current?.(g);
    } catch (e) {
      console.error("[GroupAdminPanel] load failed", e);
      // Background polls stay silent: a blip is not worth a toast every 4s.
      if (!opts?.quiet) {
        toast.error("Failed to load group settings", { style: TOAST_STYLE });
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const syncRunning = !!group?.taskroom?.memberSync?.running;
  useEffect(() => {
    if (!syncRunning) return;
    const startedAt = Date.now();
    let inFlight = false;
    const timer = setInterval(() => {
      if (Date.now() - startedAt > SYNC_POLL_MAX_MS) {
        clearInterval(timer);
        return;
      }
      if (inFlight) return;
      inFlight = true;
      void refresh({ quiet: true }).finally(() => {
        inFlight = false;
      });
    }, SYNC_POLL_MS);
    return () => clearInterval(timer);
  }, [syncRunning, syncPollEpoch, refresh]);

  const isAdmin = useMemo(() => {
    if (!group) return false;
    if (group.createdBy === me) return true;
    const m = group.members.find((x) => x.userId === me);
    return m?.role === "admin";
  }, [group, me]);

  const inviteExpired = useMemo(() => {
    if (!group?.inviteExpiry) return false;
    return new Date(group.inviteExpiry) < new Date();
  }, [group?.inviteExpiry]);

  const updateSettings = async (patch: {
    broadcastOnly?: boolean;
    adminOnlyFiles?: boolean;
    messageRetentionDays?: number;
  }) => {
    if (!group) return;
    setSavingSettings(true);
    // Optimistic update
    const prev = group;
    setGroup({ ...group, ...patch });
    try {
      await api(
        `/groups/${groupId}/settings`,
        { method: "PUT", body: JSON.stringify(patch) },
        getToken()!
      );
      toast.success("Settings updated", { style: TOAST_STYLE });
      // Refresh so onGroupUpdated fires with the full new group
      await refresh();
    } catch (e: any) {
      console.error("[GroupAdminPanel] settings update failed", e);
      setGroup(prev);
      toast.error(e?.message || "Failed to update settings", {
        style: TOAST_STYLE,
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const changeRole = async (memberId: string, role: "admin" | "member") => {
    if (!group) return;
    setSavingMember(memberId);
    try {
      await api(
        `/groups/${groupId}/members/${memberId}/role`,
        { method: "PUT", body: JSON.stringify({ role }) },
        getToken()!
      );
      toast.success(role === "admin" ? "Promoted to admin" : "Demoted to member", {
        style: TOAST_STYLE,
      });
      await refresh();
    } catch (e: any) {
      console.error("[GroupAdminPanel] role change failed", e);
      toast.error(e?.message || "Failed to change role", { style: TOAST_STYLE });
    } finally {
      setSavingMember(null);
    }
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const days = inviteExpiry === "never" ? null : parseInt(inviteExpiry, 10);
      const res = await api<InviteLinkResponse>(
        `/groups/${groupId}/invite-link`,
        {
          method: "POST",
          body: JSON.stringify({ expiryDays: days }),
        },
        getToken()!
      );
      // Update group with new code
      if (group) {
        const next = {
          ...group,
          inviteCode: res.inviteCode,
          inviteExpiry: res.expiresAt,
        };
        setGroup(next);
        onGroupUpdated?.(next);
      }
      toast.success("Invite link generated", { style: TOAST_STYLE });
    } catch (e: any) {
      console.error("[GroupAdminPanel] generate invite failed", e);
      toast.error(e?.message || "Failed to generate link", { style: TOAST_STYLE });
    } finally {
      setGeneratingInvite(false);
    }
  };

  const revokeInvite = async () => {
    setRevokingInvite(true);
    try {
      await api(
        `/groups/${groupId}/invite-link`,
        { method: "DELETE" },
        getToken()!
      );
      if (group) {
        const next = { ...group, inviteCode: null, inviteExpiry: null };
        setGroup(next);
        onGroupUpdated?.(next);
      }
      toast.success("Invite link revoked", { style: TOAST_STYLE });
    } catch (e: any) {
      console.error("[GroupAdminPanel] revoke invite failed", e);
      toast.error(e?.message || "Failed to revoke link", { style: TOAST_STYLE });
    } finally {
      setRevokingInvite(false);
    }
  };

  const inviteUrl = useMemo(() => {
    if (!group?.inviteCode) return "";
    const base =
      (typeof window !== "undefined" && window.location.origin) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";
    return `${base}/invite/${group.inviteCode}`;
  }, [group?.inviteCode]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy link", { style: TOAST_STYLE });
    }
  };

  // The Taskroom routes answer with the fresh link summary. Show it at once
  // rather than trusting a re-read that might fail: a panel stuck on "not
  // linked" invites a second link, and a second board. The quiet refresh
  // after each mutation only catches up the rest of the group.
  const showTaskroom = (next: GroupTaskroom | undefined) => {
    setGroup((g) => (g ? { ...g, taskroom: next } : g));
  };

  // Once the panel shows a link, the post-link guard has done its job — and
  // must not linger to block linking again after a later unlink.
  const hasTaskroom = !!group?.taskroom;
  useEffect(() => {
    if (hasTaskroom) setLinkSaved(false);
  }, [hasTaskroom]);

  // Link, or relink to a different board. The backend creates whatever the
  // choice needs, writes the "linked" pill and starts the member sync.
  const linkTaskroom = async () => {
    if (!group || linkSaved) return;
    const relinking = !!group.taskroom;
    setTaskroomBusy("link");
    try {
      // Taskroom needs to know the linker before the backend can act as them.
      await ensureTaskroomAccount();
      const res = await api<TaskroomReply>(
        `/groups/${groupId}/taskroom`,
        {
          method: "PUT",
          body: JSON.stringify(taskroomChoice ?? { mode: "new-workspace" }),
        },
        getToken()!
      );
      if (!relinking) setLinkSaved(true);
      if (res.taskroom) showTaskroom(res.taskroom);
      toast.success(relinking ? "Board changed" : "Group linked to Taskroom", {
        style: TOAST_STYLE,
      });
      setPickingBoard(false);
      setTaskroomChoice(null);
      setSyncPollEpoch((n) => n + 1);
      void refresh({ quiet: true });
    } catch (e) {
      console.error("[GroupAdminPanel] taskroom link failed", e);
      toast.error(errorMessage(e, "Failed to link Taskroom"), {
        style: TOAST_STYLE,
      });
    } finally {
      setTaskroomBusy(null);
    }
  };

  const setTaskCapture = async (enabled: boolean) => {
    if (!group?.taskroom) return;
    setTaskroomBusy("toggle");
    // Optimistic, like the messaging switches above.
    const prev = group;
    setGroup({ ...group, taskroom: { ...group.taskroom, enabled } });
    try {
      const res = await api<TaskroomReply>(
        `/groups/${groupId}/taskroom`,
        { method: "PATCH", body: JSON.stringify({ enabled }) },
        getToken()!
      );
      if (res.taskroom) showTaskroom(res.taskroom);
      toast.success(
        enabled ? "Tasks will be added from chat" : "Tasks will no longer be added from chat",
        { style: TOAST_STYLE }
      );
      void refresh({ quiet: true });
    } catch (e) {
      console.error("[GroupAdminPanel] taskroom toggle failed", e);
      setGroup(prev);
      toast.error(errorMessage(e, "Failed to update Taskroom"), {
        style: TOAST_STYLE,
      });
    } finally {
      setTaskroomBusy(null);
    }
  };

  const syncTaskroomMembers = async () => {
    setTaskroomBusy("sync");
    try {
      const res = await api<TaskroomReply>(
        `/groups/${groupId}/taskroom/sync`,
        { method: "POST" },
        getToken()!
      );
      if (res.taskroom) showTaskroom(res.taskroom);
      toast.success("Syncing members to the board", { style: TOAST_STYLE });
      setSyncPollEpoch((n) => n + 1);
      void refresh({ quiet: true });
    } catch (e) {
      console.error("[GroupAdminPanel] taskroom sync failed", e);
      toast.error(errorMessage(e, "Failed to sync members"), {
        style: TOAST_STYLE,
      });
    } finally {
      setTaskroomBusy(null);
    }
  };

  // The board, its tasks and its members stay in Taskroom — only the link
  // (and with it AI capture and member sync) goes away.
  const unlinkTaskroom = async () => {
    setTaskroomBusy("unlink");
    try {
      await api(
        `/groups/${groupId}/taskroom`,
        { method: "DELETE" },
        getToken()!
      );
      showTaskroom(undefined);
      toast.success("Taskroom unlinked", { style: TOAST_STYLE });
      setConfirmUnlink(false);
      setPickingBoard(false);
      setShowSyncFailures(false);
      setTaskroomChoice(null);
      void refresh({ quiet: true });
    } catch (e) {
      console.error("[GroupAdminPanel] taskroom unlink failed", e);
      toast.error(errorMessage(e, "Failed to unlink Taskroom"), {
        style: TOAST_STYLE,
      });
    } finally {
      setTaskroomBusy(null);
    }
  };

  const startPickingBoard = () => {
    setConfirmUnlink(false);
    setTaskroomChoice(null);
    setPickingBoard(true);
  };

  // The picker opens at the bottom of the section (well below "Relink" when
  // linked) — bring it into view.
  const pickerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (pickingBoard) {
      pickerRef.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [pickingBoard]);

  const taskroom = group?.taskroom;
  // A reply without the sync block must not take the whole panel down.
  const memberSync = taskroom?.memberSync ?? NO_MEMBER_SYNC;
  const syncFailures = memberSync.failures ?? [];

  const memberRows = useMemo(() => {
    if (!group) return [];
    return group.members.map((m) => {
      const user = userMap[m.userId];
      const isCreator = m.userId === group.createdBy;
      const role: "admin" | "member" = isCreator
        ? "admin"
        : m.role === "admin"
        ? "admin"
        : "member";
      return { ...m, user, role, isCreator };
    });
  }, [group, userMap]);

  return (
    <div className="flex flex-col h-full w-full md:w-[380px] bg-[#141418] border-l border-[#2E2E2E]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2E2E2E]">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand-2" />
          <div className="text-sm font-semibold text-white">Admin Controls</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#999] hover:text-white hover:bg-[#2E2E2E]"
          aria-label="Close admin panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[#6E6E6E]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !group ? (
          <div className="text-sm text-[#9fa0b8]">Group not found.</div>
        ) : !isAdmin ? (
          <div className="text-sm text-[#9fa0b8]">
            Only group admins can view these settings.
          </div>
        ) : (
          <>
            {/* Members & Roles */}
            <section>
              <h3 className="text-xs uppercase tracking-wider text-[#9fa0b8] font-semibold mb-3">
                Members & Roles
              </h3>
              <div className="space-y-1.5">
                {memberRows.map((row) => {
                  const label =
                    row.user?.name || row.user?.email || row.userId.slice(0, 6);
                  return (
                    <div
                      key={row.userId}
                      className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[#1a1a22]"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={row.user?.profilePicture} />
                        <AvatarFallback className="text-xs bg-gradient-to-br from-brand to-brand-2 text-brand-foreground font-semibold">
                          {(row.user?.name || row.user?.email || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {label}
                          {row.isCreator && (
                            <span className="ml-2 text-[10px] text-brand-2">
                              creator
                            </span>
                          )}
                        </div>
                        {row.user?.email && row.user.name && (
                          <div className="text-[11px] text-[#6E6E6E] truncate">
                            {row.user.email}
                          </div>
                        )}
                      </div>
                      {row.isCreator ? (
                        <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-[#2E2E2E] text-white">
                          Admin
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={savingMember === row.userId}
                          onClick={() =>
                            changeRole(
                              row.userId,
                              row.role === "admin" ? "member" : "admin"
                            )
                          }
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-60 ${
                            row.role === "admin"
                              ? "bg-brand-2 text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)]"
                              : "bg-[#2E2E2E] text-white hover:bg-[#3a3a3a]"
                          }`}
                        >
                          {savingMember === row.userId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : row.role === "admin" ? (
                            "Admin"
                          ) : (
                            "Member"
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Messaging Controls */}
            <section>
              <h3 className="text-xs uppercase tracking-wider text-[#9fa0b8] font-semibold mb-3">
                Messaging Controls
              </h3>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Megaphone className="h-4 w-4 text-brand-2" />
                      Broadcast-only mode
                    </div>
                    <div className="text-[11px] text-[#6E6E6E] mt-0.5">
                      Only admins can send messages.
                    </div>
                  </div>
                  <Switch
                    checked={!!group.broadcastOnly}
                    disabled={savingSettings}
                    onCheckedChange={(v) => updateSettings({ broadcastOnly: v })}
                    className="data-[state=checked]:bg-brand-2"
                  />
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Paperclip className="h-4 w-4 text-brand-2" />
                      Restrict file sharing
                    </div>
                    <div className="text-[11px] text-[#6E6E6E] mt-0.5">
                      Only admins can share files.
                    </div>
                  </div>
                  <Switch
                    checked={!!group.adminOnlyFiles}
                    disabled={savingSettings}
                    onCheckedChange={(v) =>
                      updateSettings({ adminOnlyFiles: v })
                    }
                    className="data-[state=checked]:bg-brand-2"
                  />
                </label>
              </div>
            </section>

            {/* Taskroom — support chats never get a board */}
            {group.kind !== "support" && (
              <section>
                <h3 className="text-xs uppercase tracking-wider text-[#9fa0b8] font-semibold mb-3 flex items-center gap-2">
                  <ListChecks className="h-3.5 w-3.5" />
                  Taskroom
                </h3>
                {taskroom ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-[#0e0e12] border border-[#2a2a35] rounded-md px-3 py-2.5">
                      <KanbanSquare className="h-4 w-4 text-brand-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {taskroom.roomName || "Taskroom board"}
                        </div>
                        <div className="text-[11px] text-[#6E6E6E] truncate">
                          {taskroom.workspaceName || "Taskroom workspace"}
                          {taskroom.linkedByName &&
                            ` · linked by ${taskroom.linkedByName}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void (onOpenBoard ?? openTaskroomBoard)({
                            roomId: taskroom.roomId,
                            spaceId: taskroom.spaceId,
                            workspaceId: taskroom.workspaceId,
                          })
                        }
                        className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a] transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open board
                      </button>
                    </div>

                    {(taskroom.status === "broken" || taskroom.lastError) && (
                      <div
                        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] ${
                          taskroom.status === "broken"
                            ? "border-red-900/60 bg-red-950/30 text-red-300"
                            : "border-amber-900/50 bg-amber-950/20 text-amber-300"
                        }`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            {taskroom.status === "broken"
                              ? "New tasks can't reach this board."
                              : "Taskroom reported a problem."}
                          </div>
                          {taskroom.lastError && (
                            <div className="mt-0.5 break-words opacity-90">
                              {taskroom.lastError}
                            </div>
                          )}
                          {!pickingBoard && (
                            <button
                              type="button"
                              onClick={startPickingBoard}
                              disabled={taskroomBusy !== null}
                              className="mt-1.5 font-medium underline underline-offset-2 hover:text-white disabled:opacity-60"
                            >
                              Relink to a board
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Sparkles className="h-4 w-4 text-brand-2" />
                          Add tasks from chat automatically
                        </div>
                        <div className="text-[11px] text-[#6E6E6E] mt-0.5">
                          AI picks up tasks and issues from this chat and
                          adds them to the board.
                        </div>
                      </div>
                      <Switch
                        checked={taskroom.enabled}
                        disabled={taskroomBusy !== null}
                        onCheckedChange={(v) => setTaskCapture(v)}
                        className="data-[state=checked]:bg-brand-2"
                      />
                    </label>

                    {/* Member sync */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <Users className="h-3.5 w-3.5 text-[#9fa0b8] shrink-0" />
                        <span className="text-[#c7c7da]">
                          {memberSync.synced} member
                          {memberSync.synced === 1 ? "" : "s"} synced
                          {memberSync.failed > 0 && (
                            <span className="text-red-300">
                              {" "}
                              · {memberSync.failed} failed
                            </span>
                          )}
                        </span>
                        {syncRunning && (
                          <span className="inline-flex items-center gap-1 text-[#9fa0b8]">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Syncing…
                          </span>
                        )}
                      </div>
                      {!syncRunning && memberSync.lastSyncAt && (
                        <div className="text-[11px] text-[#6E6E6E]">
                          Last synced{" "}
                          {new Date(memberSync.lastSyncAt).toLocaleString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )}
                        </div>
                      )}
                      {syncFailures.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowSyncFailures((v) => !v)}
                            className="inline-flex items-center gap-1 text-[11px] text-[#9fa0b8] hover:text-white"
                          >
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${
                                showSyncFailures ? "rotate-180" : ""
                              }`}
                            />
                            {showSyncFailures ? "Hide" : "Show"} who
                            wasn&apos;t added
                          </button>
                          {showSyncFailures && (
                            <ul className="space-y-1 rounded-md border border-[#2a2a35] bg-[#0e0e12] px-2.5 py-2">
                              {syncFailures.map((f) => (
                                <li
                                  key={f.userId}
                                  className="text-[11px] break-words"
                                >
                                  <span className="text-white">{f.name}</span>
                                  <span className="text-[#9fa0b8]">
                                    {" "}
                                    — {f.error}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={syncTaskroomMembers}
                        disabled={taskroomBusy !== null}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a] transition-colors disabled:opacity-60"
                      >
                        {taskroomBusy === "sync" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {memberSync.failed > 0
                          ? "Retry sync"
                          : "Sync now"}
                      </button>
                    </div>

                    {pickingBoard ? (
                      <div
                        ref={pickerRef}
                        className="space-y-3 rounded-md border border-[#2a2a35] p-3"
                      >
                        <div className="text-[11px] text-[#6E6E6E]">
                          New tasks go to the board you pick. The current
                          board and its tasks stay in Taskroom.
                        </div>
                        <TaskroomLinkPicker
                          groupName={group.name}
                          value={taskroomChoice}
                          onChange={setTaskroomChoice}
                          disabled={taskroomBusy === "link"}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={linkTaskroom}
                            disabled={taskroomBusy !== null}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md bg-brand-2 text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] transition-colors disabled:opacity-60"
                          >
                            {taskroomBusy === "link" && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {taskroomBusy === "link" ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPickingBoard(false);
                              setTaskroomChoice(null);
                            }}
                            disabled={taskroomBusy === "link"}
                            className="text-xs font-medium px-3 py-2 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a] transition-colors disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : confirmUnlink ? (
                      <div className="space-y-2 rounded-md border border-red-900/50 bg-red-950/20 p-3">
                        <div className="text-[11px] text-red-200">
                          Unlink Taskroom? AI stops adding tasks and members
                          stop syncing. The board and its tasks stay in
                          Taskroom.
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={unlinkTaskroom}
                            disabled={taskroomBusy !== null}
                            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-red-900/60 text-red-100 hover:bg-red-900 transition-colors disabled:opacity-60"
                          >
                            {taskroomBusy === "unlink" && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            Unlink
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmUnlink(false)}
                            disabled={taskroomBusy === "unlink"}
                            className="text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a] transition-colors disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={startPickingBoard}
                          disabled={taskroomBusy !== null}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a] transition-colors disabled:opacity-60"
                        >
                          <KanbanSquare className="h-3 w-3" />
                          Change board
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmUnlink(true)}
                          disabled={taskroomBusy !== null}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-red-900/50 hover:text-red-300 transition-colors disabled:opacity-60"
                        >
                          <Trash2 className="h-3 w-3" />
                          Unlink
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-[11px] text-[#6E6E6E]">
                      AI picks up tasks and issues from this chat and adds
                      them to a Taskroom board. Group members get access to
                      the board.
                    </div>
                    {/* The picker only mounts on request: it reads (and on
                        first use creates) the admin's Taskroom account, which
                        merely opening Admin Controls must not do. */}
                    {pickingBoard ? (
                      <div ref={pickerRef} className="space-y-3">
                        <TaskroomLinkPicker
                          groupName={group.name}
                          value={taskroomChoice}
                          onChange={setTaskroomChoice}
                          disabled={taskroomBusy === "link"}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={linkTaskroom}
                            disabled={taskroomBusy !== null || linkSaved}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md bg-brand-2 text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] transition-colors disabled:opacity-60"
                          >
                            {taskroomBusy === "link" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ListChecks className="h-3.5 w-3.5" />
                            )}
                            {taskroomBusy === "link" ? "Linking…" : "Link Taskroom"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPickingBoard(false);
                              setTaskroomChoice(null);
                            }}
                            disabled={taskroomBusy === "link"}
                            className="text-xs font-medium px-3 py-2 rounded-md bg-[#2E2E2E] text-white hover:bg-[#3a3a3a] transition-colors disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startPickingBoard}
                        disabled={taskroomBusy !== null || linkSaved}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md bg-brand-2 text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] transition-colors disabled:opacity-60"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        {linkSaved ? "Linked" : "Link Taskroom…"}
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Invite Link */}
            <section>
              <h3 className="text-xs uppercase tracking-wider text-[#9fa0b8] font-semibold mb-3 flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5" />
                Invite Link
              </h3>
              {group.inviteCode && !inviteExpired ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[#0e0e12] border border-[#2a2a35] rounded-md px-2 py-2">
                    <div className="text-xs text-[#c7c7da] truncate flex-1">
                      {inviteUrl}
                    </div>
                    <button
                      type="button"
                      onClick={copyInvite}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#999] hover:text-white hover:bg-[#2E2E2E]"
                      title="Copy link"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {group.inviteExpiry && (
                    <div className="text-[11px] text-[#6E6E6E]">
                      Expires{" "}
                      {new Date(group.inviteExpiry).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={revokeInvite}
                    disabled={revokingInvite}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[#2E2E2E] text-white hover:bg-red-900/50 hover:text-red-300 transition-colors disabled:opacity-60"
                  >
                    {revokingInvite ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Revoke link
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {inviteExpired && (
                    <div className="text-[11px] text-amber-400">
                      Previous link has expired. Generate a new one below.
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Select value={inviteExpiry} onValueChange={setInviteExpiry}>
                      <SelectTrigger className="flex-1 bg-[#0e0e12] border-[#2a2a35] text-white">
                        <SelectValue placeholder="Expiry" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                        <SelectItem value="1">Expires in 1 day</SelectItem>
                        <SelectItem value="7">Expires in 7 days</SelectItem>
                        <SelectItem value="30">Expires in 30 days</SelectItem>
                        <SelectItem value="never">Never expires</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={generateInvite}
                      disabled={generatingInvite}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md bg-brand-2 text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] transition-colors disabled:opacity-60"
                    >
                      {generatingInvite ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LinkIcon className="h-3.5 w-3.5" />
                      )}
                      Generate
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Message Retention */}
            <section>
              <h3 className="text-xs uppercase tracking-wider text-[#9fa0b8] font-semibold mb-3 flex items-center gap-2">
                <Timer className="h-3.5 w-3.5" />
                Message Retention
              </h3>
              <Select
                value={String(group.messageRetentionDays || 0)}
                disabled={savingSettings}
                onValueChange={(v) =>
                  updateSettings({ messageRetentionDays: parseInt(v, 10) })
                }
              >
                <SelectTrigger className="w-full bg-[#0e0e12] border-[#2a2a35] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                  {RETENTION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(group.messageRetentionDays || 0) > 0 && (
                <div className="text-[11px] text-[#6E6E6E] mt-2">
                  Messages older than {group.messageRetentionDays} days are
                  auto-deleted once a day. This cannot be undone.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

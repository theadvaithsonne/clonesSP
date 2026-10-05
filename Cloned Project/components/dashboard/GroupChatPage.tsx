"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getOrgId, getToken, getUserIdFromToken } from "@/lib/auth";
import { connectSocket, getSocket } from "@/lib/socket";
import { groupConvId } from "@/lib/conv";
import { useChat } from "@/lib/chat-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Send,
  Reply,
  Edit3,
  Trash2,
  Download,
  Image,
  FileText,
  File,
  X,
  Settings,
  Loader2,
  ExternalLink,
  Smile,
  Paperclip,
  ArrowLeft,
  MoreVertical,
  Pin,
  Forward,
  MessageSquareText,
  Shield,
  Megaphone,
  CheckCheck,
  Check,
  ListChecks,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MessageActionMenu,
  MessageReactions,
  QuickReactionButton,
  SelectionToolbar,
  SelectionCheckOverlay,
  ForwardDialog,
  LongPressDiv,
  DeleteConfirmDialog,
  type ForwardTarget,
} from "@/components/chat/MessageActions";
import {
  messageExtras,
  usePinnedIds,
  FORWARDED_PREFIX,
  isForwardedText,
  stripForwarded,
  canEditMessage,
  bumpEditCount,
} from "@/lib/messageExtras";
import { Group } from "@/app/(dashboard)/layout";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FileAttachment, FilePreview } from "@/components/ui/file-attachment";
import { VoiceRecorder } from "@/components/ui/voice-recorder";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import { ScreenRecorder } from "@/components/ui/screen-recorder";
import EditGroupDialog from "./EditGroupDialog";
import ThreadPanel from "@/components/chat/ThreadPanel";
import GroupAdminPanel, { type GroupData as AdminGroupData, type GroupTaskroom } from "@/components/chat/GroupAdminPanel";
import GroupTasksPanel from "@/components/chat/GroupTasksPanel";
import {
  openTaskroomBoard,
  type TaskroomBoardRef,
} from "@/components/chat/TaskroomLinkPicker";
import { LinkPreview } from "@/components/ui/link-preview";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { getFirstUrl, extractUrls } from "@/lib/url-utils";
import { MessageContent } from "@/components/chat/MessageContent";
import { FormatToolbar } from "@/components/chat/FormatToolbar";
import { VideoMessageRecorder } from "@/components/chat/VideoMessageRecorder";
import { LocationShareButton } from "@/components/chat/LocationShareButton";
import { ContactShareButton } from "@/components/chat/ContactShareButton";
import { GifPicker } from "@/components/chat/GifPicker";
import { SlashCommandMenu } from "@/components/chat/SlashCommandMenu";
import { SlashCommandForm } from "@/components/chat/SlashCommandForm";
import { useSlashCommands } from "@/lib/hooks/useSlashCommands";
import { useSlashCardSync } from "@/lib/hooks/useSlashCardSync";
import { useTypingIndicator } from "@/lib/hooks/useTypingIndicator";
import { requestBellRefresh } from "@/lib/bell-refresh";
import { hasMarker } from "@/lib/chat-markers";

type Attachment = {
  _id?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  fileKey?: string;
  uploadedAt?: Date;
};

type Msg = {
  _id: string;
  groupId: string;
  from: string | null;
  // Group events ("X added Y"). No sender — `from` is unset and the backend
  // pre-renders `text` — so they render as a centred pill, never a bubble.
  type?: "system";
  // Which group event a system pill records ("member_added",
  // "ai_task_created", …). Unset on ordinary messages.
  event?: string;
  // Taskroom pills only ("taskroom_linked", "ai_task_created",
  // "ai_task_assigned", "ai_task_updated"): the board the pill opens.
  taskroom?: {
    taskId?: string;
    roomId?: string;
    spaceId?: string;
    workspaceId?: string;
    title?: string;
  };
  // Ordinary messages the AI turned into Taskroom tasks — one message can
  // yield several. Absent when the message never became a task.
  aiTasks?: {
    taskId?: string;
    roomId?: string;
    spaceId?: string;
    workspaceId?: string;
    title?: string;
  }[];
  text: string;
  attachments?: Attachment[];
  mentions?: string[];
  replyTo?: string;
  editedAt?: Date;
  createdAt: string;
  readAt?: Date;
  tempId?: string;
  agentMeta?: { agentId: string; agentName: string };
  threadId?: string | null;
  threadResolved?: boolean;
  replyCount?: number;
  lastThreadReply?: {
    text?: string;
    from?: string;
    createdAt?: string;
  } | null;
  threadParticipants?: string[];
  deletedAt?: string | null;
  // emoji -> array of userId strings that reacted with this emoji
  reactions?: Record<string, string[]>;
};
type MemberLite = {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
};

// The sidebar's Taskroom icon, used as a mask so the "Added to Taskroom" mark
// keeps its own colour (and hover colour) through `bg-current`.
const TASKROOM_MARK_MASK = "url(/appicons/taskroom-icon.png) center / contain no-repeat";
const TASKROOM_MARK_STYLE: CSSProperties = { WebkitMask: TASKROOM_MARK_MASK, mask: TASKROOM_MARK_MASK };

// Stable "no attachments", so the preview URLs below aren't rebuilt every render.
const NO_FILES: File[] = [];

export default function GroupPage({
  id,
  onClose,
  isMini = false,
  onTypingLabelChange,
}: {
  id: string;
  onClose?: () => void;
  isMini?: boolean;
  /** "Priya is typing…" for a host that draws its own header (the mini window). */
  onTypingLabelChange?: (label: string | null) => void;
}) {
  const groupId = id;
  const me = getUserIdFromToken()!;
  const convId = useMemo(() => groupConvId(groupId), [groupId]);

  const { setActiveConvId, clearGroupUnread, groupUnread, draftTexts, setDraftTexts, draftFiles, setDraftFiles } = useChat();

  // How many unread messages this group had when it was opened — read before
  // opening marks them read and the count is cleared. Places the "N new
  // messages" line.
  const unreadAtOpenRef = useRef<{ groupId: string; count: number } | null>(
    null
  );
  if (unreadAtOpenRef.current?.groupId !== groupId) {
    unreadAtOpenRef.current = {
      groupId,
      count: groupUnread[groupId] || 0,
    };
  }
  // The "N new messages" line: above `beforeId`, until you send or reopen.
  const [newDivider, setNewDivider] = useState<{
    beforeId: string;
    count: number;
  } | null>(null);
  // Messages that arrived while the tab was hidden, not yet marked read.
  const pendingReadRef = useRef(false);

  const chatKey = `group_${groupId}`;

  const text = draftTexts[chatKey] || "";
  const setText = (val: string | ((prev: string) => string)) => {
    setDraftTexts((prev) => {
      const current = prev[chatKey] || "";
      const nextVal = typeof val === "function" ? val(current) : val;
      return { ...prev, [chatKey]: nextVal };
    });
  };

  const attachedFiles = draftFiles[chatKey] || NO_FILES;
  const setAttachedFiles = (val: File[] | ((prev: File[]) => File[])) => {
    setDraftFiles((prev) => {
      const current = prev[chatKey] || [];
      const nextVal = typeof val === "function" ? val(current) : val;
      return { ...prev, [chatKey]: nextVal };
    });
  };

  // One object URL per attached file, made when the files change. Building it
  // inline in the preview gave the <img> a new src on every render, so each
  // keystroke reloaded the thumbnail (flicker) and its "chat-image-loaded"
  // event pulled the chat to the bottom.
  const attachedPreviewUrls = useMemo(
    () => attachedFiles.map((f) => URL.createObjectURL(f)),
    [attachedFiles]
  );
  useEffect(
    () => () => attachedPreviewUrls.forEach((u) => URL.revokeObjectURL(u)),
    [attachedPreviewUrls]
  );

  const [items, setItemsRaw] = useState<Msg[]>([]);
  const itemsRef = useRef<Msg[]>([]);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    setScrolledToBottom(false);
  }, [groupId]);
  const setItems: typeof setItemsRaw = (value) => {
    setItemsRaw((prev) => {
      const next = typeof value === "function" ? (value as (p: Msg[]) => Msg[])(prev) : value;
      itemsRef.current = next;
      return next;
    });
  };
  const lastLoadedGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    const draftKey = `chat_draft_group_${groupId}`;
    const savedDraft = localStorage.getItem(draftKey) || "";
    if (savedDraft && !draftTexts[chatKey]) {
      setText(savedDraft);
    }
    lastLoadedGroupIdRef.current = groupId;
  }, [groupId]);

  useEffect(() => {
    if (lastLoadedGroupIdRef.current !== groupId) return;
    const draftKey = `chat_draft_group_${groupId}`;
    if (text) {
      localStorage.setItem(draftKey, text);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [text, groupId]);
  const [userMap, setUserMap] = useState<Record<string, MemberLite>>({});
  const userMapRef = useRef<Record<string, MemberLite>>(userMap);
  useEffect(() => {
    userMapRef.current = userMap;
  }, [userMap]);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const groupsRef = useRef<Group[]>(groups);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  // Keep scroll at bottom when images load — only if the reader is already
  // near it. Measured on the real scroller (bottomRef's parent is the inner
  // list, which never scrolls, so the check always passed), and scrolled
  // directly: scrollIntoView also moves every scrollable ancestor, which
  // shook the page around the mini chat window.
  useEffect(() => {
    const handleImageLoaded = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const threshold = 400;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
      if (isNearBottom) {
        setTimeout(() => {
          const c = scrollContainerRef.current;
          if (c) c.scrollTop = c.scrollHeight;
        }, 50);
      }
    };

    window.addEventListener("chat-image-loaded", handleImageLoaded);
    return () => {
      window.removeEventListener("chat-image-loaded", handleImageLoaded);
    };
  }, []);

  // New state for modern features
  const { typingUsers, handleTyping, stopTyping, removeTypingUser } =
    useTypingIndicator({
      startEvent: "group:typing",
      stopEvent: "group:stopTyping",
      payload: { groupId },
      // A server that predates `groupId` on typing events sends none; those
      // are taken as before.
      accepts: (e) => (!e.groupId || e.groupId === groupId) && e.userId !== me,
      bottomRef,
    });
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [replyToMsg, setReplyToMsg] = useState<Msg | null>(null);
  const [showMessageActions, setShowMessageActions] = useState<string | null>(
    null
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [mobileMenuMessageId, setMobileMenuMessageId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardText, setForwardText] = useState("");
  const [forwardTargets, setForwardTargets] = useState<ForwardTarget[]>([]);
  const [showPinnedList, setShowPinnedList] = useState(false);
  // Delete confirmation state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // The Taskroom task an "Assign to…" menu action targets. Null closes the
  // assign picker. Group chat only.
  const [assignTarget, setAssignTarget] = useState<{
    messageId: string;
    task: {
      taskId?: string;
      roomId?: string;
      spaceId?: string;
      workspaceId?: string;
      title?: string;
    };
  } | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [activeThread, setActiveThread] = useState<{
    messageId: string;
    message: Msg;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pasteProcessingRef = useRef<boolean>(false);

  // Group + Taskroom summary (from GET /groups/:id). Declared before the slash
  // engine because the "/taskroom" command is gated on the board being linked.
  const [groupData, setGroupData] = useState<AdminGroupData | null>(null);
  // The board is usable for manual tasks when it's linked, task capture isn't
  // explicitly off, and it isn't reported broken. Gates both the "/taskroom"
  // command and the header "Tasks" button.
  const taskroomLinked = !!(
    groupData?.taskroom?.roomId &&
    groupData.taskroom.enabled !== false &&
    groupData.taskroom.status !== "broken"
  );

  // Slash-command engine. The on-clear callback strips the trailing "/..."
  // trigger so picking a command doesn't leave residue in the textarea.
  const slash = useSlashCommands({
    chatType: "group",
    taskroomEnabled: taskroomLinked,
    onClearTrigger: () => {
      setText((prev) => prev.replace(/(?:^|\n)\/\w*$/, "").trimEnd());
    },
  });
  useSlashCardSync();
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [groupMembers, setGroupMembers] = useState<string[]>([]); // Store member IDs for this group
  const [personalAgents, setPersonalAgents] = useState<Array<{ agentId: string; name: string }>>([]);
  const [agentTyping, setAgentTyping] = useState<Set<string>>(new Set());
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  // Bumped so the Tasks panel refetches after a manual task is created.
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);

  // Right-side panels are mutually exclusive: opening one closes the others.
  const openAdminPanel = () => {
    setActiveThread(null);
    setEditDialogOpen(false);
    setShowTasksPanel(false);
    setShowAdminPanel(true);
  };
  const openEditPanel = () => {
    setActiveThread(null);
    setShowAdminPanel(false);
    setShowTasksPanel(false);
    setEditDialogOpen(true);
  };
  const openThreadPanel = (payload: { messageId: string; message: Msg }) => {
    setShowAdminPanel(false);
    setEditDialogOpen(false);
    setShowTasksPanel(false);
    setActiveThread(payload);
  };
  const openTasksPanel = () => {
    setActiveThread(null);
    setEditDialogOpen(false);
    setShowAdminPanel(false);
    setShowTasksPanel(true);
  };

  const orgId = getOrgId();

  // Load workspace members to map userId -> name/email (for labels)
  useEffect(() => {
    const orgId = localStorage.getItem("garage_org_id");

    (async () => {
      try {
        const res = await api<{
          members: {
            id?: string;
            _id?: string;
            name?: string;
            email: string;
            profilePicture?: string;
          }[];
        }>("/team/list?orgId=" + orgId, {}, getToken()!);
        const map: Record<string, MemberLite> = {};
        (res.members || []).forEach((m) => {
          const id = (m.id || (m as any)._id) as string;
          if (id)
            map[id] = {
              id,
              name: m.name,
              email: m.email,
              profilePicture: m.profilePicture,
            };
        });
        setUserMap(map);
      } catch {}
    })();
  }, []);

  // Load group details (including members + admin settings).
  // Used for mention filtering AND admin-panel state (broadcastOnly, role, etc.)
  useEffect(() => {
    (async () => {
      try {
        const res = await api<{
          id: string;
          name: string;
          description?: string | null;
          picture?: string | null;
          createdBy: string;
          members: Array<{ userId: string | { toString(): string }; role?: "admin" | "member" }>;
          agentMembers?: string[];
          broadcastOnly?: boolean;
          adminOnlyFiles?: boolean;
          messageRetentionDays?: number;
          inviteCode?: string | null;
          inviteExpiry?: string | null;
          // Taskroom link summary — gates the "Tasks" button and "/taskroom".
          kind?: string;
          taskroom?: GroupTaskroom;
        }>(`/groups/${groupId}`, {}, getToken()!);
        // Normalize members.userId to string so the admin panel can use it directly.
        const normalized: AdminGroupData = {
          id: res.id,
          name: res.name,
          description: res.description,
          picture: res.picture,
          createdBy: res.createdBy,
          agentMembers: res.agentMembers,
          broadcastOnly: res.broadcastOnly,
          adminOnlyFiles: res.adminOnlyFiles,
          messageRetentionDays: res.messageRetentionDays,
          inviteCode: res.inviteCode,
          inviteExpiry: res.inviteExpiry,
          kind: res.kind,
          taskroom: res.taskroom,
          members: (res.members || []).map((m) => ({
            userId: typeof m.userId === "string" ? m.userId : m.userId.toString(),
            role: m.role,
          })),
        };
        setGroupData(normalized);
        const memberIds = normalized.members.map((m) => m.userId);
        setGroupMembers([...memberIds, ...(res.agentMembers || [])]);
      } catch (err) {
        console.error("Failed to load group details:", err);
      }
    })();
  }, [groupId]);

  const isGroupAdmin = useMemo(() => {
    if (!groupData) return false;
    if (groupData.createdBy === me) return true;
    const meMember = groupData.members.find((m) => m.userId === me);
    return meMember?.role === "admin";
  }, [groupData, me]);

  const broadcastBlocked = !!(groupData?.broadcastOnly && !isGroupAdmin);
  const filesBlocked = !!(groupData?.adminOnlyFiles && !isGroupAdmin);

  // Load personal agents for mention suggestions
  useEffect(() => {
    const tok = getToken();
    if (!tok) return;
    const url = new URL("/api/openclaw/agent", window.location.origin);
    if (orgId) url.searchParams.set("org_id", orgId);
    fetch(url.toString(), { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.agents) {
          setPersonalAgents(
            d.agents.map((a: any) => ({ agentId: a.agent_id, name: a.name }))
          );
        }
      })
      .catch(() => {});
  }, [orgId]);

  // History
  useEffect(() => {
    (async () => {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ items: Msg[]; nextCursor: string | null }>(
        `/groups/${groupId}/messages?orgId=${orgId}`,
        {},
        getToken()!
      );
      const loaded = res.items || [];
      setItems(loaded);
      setNextCursor(res.nextCursor);
      setHasMoreMessages(loaded.length >= 40);

      // "N new messages" goes above the Nth-newest message from someone else.
      // Your own messages and group events never count as unread (the server
      // skips both), so they're skipped here too. If the first unread is older
      // than this page, the line sits on the oldest one loaded.
      const unread =
        unreadAtOpenRef.current?.groupId === groupId
          ? unreadAtOpenRef.current.count
          : 0;
      let firstUnreadId: string | null = null;
      if (unread > 0) {
        let counted = 0;
        for (let i = loaded.length - 1; i >= 0 && counted < unread; i--) {
          const x = loaded[i];
          if (x.threadId || x.from === me || x.type === "system") continue;
          counted++;
          firstUnreadId = x._id;
        }
      }
      setNewDivider(
        firstUnreadId ? { beforeId: firstUnreadId, count: unread } : null
      );

      setTimeout(
        () => {
          // Open at the line when there is one, as WhatsApp does; otherwise at
          // the newest message.
          const lineAt = firstUnreadId
            ? messageRefs.current.get(firstUnreadId)
            : null;
          if (lineAt) lineAt.scrollIntoView({ block: "start" });
          else bottomRef.current?.scrollIntoView({ behavior: "auto" });
          setScrolledToBottom(true);
        },
        10
      );
    })();
  }, [groupId]);

  // Load more messages (older)
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !nextCursor) return;

    setIsLoadingMore(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ items: Msg[]; nextCursor: string | null }>(
        `/groups/${groupId}/messages?orgId=${orgId}&cursor=${nextCursor}`,
        {},
        getToken()!
      );

      const olderMessages = res.items || [];
      if (olderMessages.length > 0) {
        setItems((prev) => [...olderMessages, ...prev]);
        setNextCursor(res.nextCursor);
        setHasMoreMessages(olderMessages.length >= 40);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Mark the group read up to `upTo` (default: now) and clear its entries from
  // the notification bell — on open, for each message seen while open, and on
  // coming back to a tab that was hidden when messages arrived.
  const markGroupRead = (upTo?: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    api(
      `/groups/${groupId}/read?orgId=${orgId}`,
      { method: "POST", body: JSON.stringify(upTo ? { upTo } : {}) },
      getToken()!
    )
      .catch((err) =>
        console.error("[GroupChatPage] Failed to mark group read:", err)
      )
      .finally(() => clearGroupUnread(groupId));
    api(
      `/user-notifications/group/${groupId}?orgId=${orgId}`,
      { method: "DELETE" },
      getToken()!
    )
      .then(() => requestBellRefresh())
      .catch((err) =>
        console.error("[GroupChatPage] Error clearing group notifications:", err)
      );
  };

  // Back to the tab: what arrived while it was hidden has now been seen.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && pendingReadRef.current) {
        pendingReadRef.current = false;
        markGroupRead();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [groupId]);

  // Socket + mark read
  useEffect(() => {
    const s = connectSocket();
    const join = () => s.emit("group:join", { groupId });
    if (s.connected) join();
    s.on("connect", join);
    s.on("reconnect", join);

    const onMsg = async (m: Msg) => {
      console.log("[GroupChatPage] Message received:", {
        m,
        groupId,
        currentGroupId: m.groupId,
        userMapSize: Object.keys(userMapRef.current).length,
        groupsCount: groupsRef.current.length,
      });

      if (m.groupId !== groupId) return;

      // Group events have no sender: nothing to mark read or notify about.
      // The backend keeps them out of unread counts and pushes as well.
      const isSystem = m.type === "system";

      // Check if current user is mentioned - show toast immediately
      if (m.mentions?.includes(me) && m.from !== me) {
        const sender = userMapRef.current[m.from];
        const senderName = sender?.name || sender?.email || "Someone";
        const groupName =
          groupsRef.current?.find((g) => g.id === groupId)?.name || "a group";
        toast.success(`${senderName} mentioned you in ${groupName}`, {
          description: m.text?.substring(0, 100) || "Shared a file",
          duration: 6000,
          style: {
            background: "#1a1a22",
            border: "1px solid var(--brand-2)",
            color: "#fff",
          },
        });
      }

      // Show it first. Marking it read is a round trip to the server, and the
      // message used to wait for that before it appeared at all.
      setItems((prev) => {
        if (m.tempId) {
          const i = prev.findIndex((x) => x.tempId === m.tempId);
          if (i >= 0) {
            const copy = [...prev];
            copy[i] = m;
            return copy;
          }
          if (prev.some((x) => x._id === m._id)) return prev;
          return [...prev, m];
        }
        if (prev.some((x) => x._id === m._id)) return prev;
        return [...prev, m];
      });
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      // Their message has landed, so they're no longer typing it.
      if (m.from) removeTypingUser(m.from);

      if (!isSystem && m.from !== me) {
        if (document.visibilityState === "hidden") {
          // Nobody is looking: leave it unread and mark where the unseen run
          // starts. It's read when the tab comes back into view.
          if (!pendingReadRef.current) {
            pendingReadRef.current = true;
            setNewDivider({ beforeId: m._id, count: 1 });
          } else {
            setNewDivider((d) =>
              d ? { ...d, count: d.count + 1 } : { beforeId: m._id, count: 1 }
            );
          }
        } else {
          markGroupRead(m.createdAt);
        }
      }

      // Show browser notification if message is from someone else (always, regardless of tab focus)
      console.log("[GroupChatPage] ===== NOTIFICATION CHECK START =====");
      console.log("[GroupChatPage] Checking notification eligibility:", {
        messageFrom: m.from,
        me,
        isFromMe: m.from === me,
        windowDefined: typeof window !== "undefined",
        notificationAvailable:
          typeof window !== "undefined" && "Notification" in window,
        notificationPermission: typeof window !== "undefined" && "Notification" in window ? Notification.permission : "N/A",
        userMapSize: Object.keys(userMapRef.current).length,
        groupsCount: groupsRef.current.length,
      });

      if (
        !isSystem &&
        m.from !== me &&
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        // Check notification permission
        const permission = Notification.permission;

        // Show notification if permission is granted (always, even when tab is focused)
        const shouldNotify = permission === "granted";

        console.log("[GroupChatPage] Notification check:", {
          permission,
          shouldNotify,
          messageFrom: m.from,
          me,
        });

        if (shouldNotify) {
          const sender = userMapRef.current[m.from];
          const senderName = sender?.name || sender?.email || "Someone";
          const groupName =
            groupsRef.current?.find((g) => g.id === groupId)?.name || "Group";
          const isMentioned = m.mentions?.includes(me);

          const messagePreview = m.text
            ? m.text.length > 50
              ? m.text.substring(0, 50) + "..."
              : m.text
            : m.attachments && m.attachments.length > 0
            ? `Sent ${m.attachments.length} file${
                m.attachments.length > 1 ? "s" : ""
              }`
            : "New message";

          try {
            console.log("[GroupChatPage] Showing notification:", {
              senderName,
              groupName,
              messagePreview,
              isMentioned,
            });

            const notificationTitle = isMentioned
              ? `${senderName} mentioned you in ${groupName}`
              : `${senderName} in ${groupName}`;

            const notification = new Notification(notificationTitle, {
              body: messagePreview,
              icon: sender?.profilePicture || undefined,
              badge: "/logo.svg",
              tag: `group-${m.groupId}`, // Group notifications by conversation
              requireInteraction: false,
            });

            // Auto-close notification after 5 seconds
            setTimeout(() => {
              notification.close();
            }, 5000);

            // Click handler to focus the window
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
          } catch (error) {
            console.error("[GroupChatPage] Failed to show notification:", error);
          }
        } else {
          console.log(
            "[GroupChatPage] Notification not shown - permission:",
            permission
          );
        }
      }
    };

    // Handle notifications (mentions, etc.)
    const onMentionNotification = (data: any) => {
      // Refresh count or toast if we are active
      console.log("[GroupChatPage] Realtime notification received:", data);
    };

    // Thread updates
    const onThreadUpdate = (data: {
      groupId: string;
      messageId: string;
      replyCount: number;
      lastThreadReply: any;
      threadParticipants: string[];
      threadResolved: boolean;
    }) => {
      if (data.groupId !== groupId) return;
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? {
                ...msg,
                replyCount: data.replyCount,
                lastThreadReply: data.lastThreadReply,
                threadParticipants: data.threadParticipants,
                threadResolved: data.threadResolved,
              }
            : msg
        )
      );
    };

    const onThreadReply = (m: Msg) => {
      // Handled if thread drawer is open; but we also want to update the local thread count
      // if it wasn't caught by group:thread-update
      console.log("[GroupChatPage] Thread reply received:", m);
    };

    // Soft delete
    const onDeleted = (data: {
      messageId: string;
      groupId: string;
      deletedAt: string;
    }) => {
      if (data.groupId !== groupId) return;
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, deletedAt: data.deletedAt, text: "", attachments: [] }
            : msg
        )
      );
    };

    // Reactions
    const onReactions = (data: {
      messageId: string;
      groupId: string;
      reactions: Record<string, string[]>;
    }) => {
      if (data.groupId !== groupId) return;
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    };

    // The AI turned a message into Taskroom task(s) — usually a few seconds
    // after the message itself arrived. The payload is the message's full
    // list, so it replaces rather than appends.
    const onMessageTask = (data: {
      groupId: string;
      messageId: string;
      aiTasks: NonNullable<Msg["aiTasks"]>;
    }) => {
      if (data.groupId !== groupId) return;
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId ? { ...msg, aiTasks: data.aiTasks } : msg
        )
      );
    };

    // Message rejected
    const onRejected = (data: {
      groupId: string;
      reason: "broadcast_only" | "file_only";
    }) => {
      if (data.groupId !== groupId) return;
      const msg =
        data.reason === "broadcast_only"
          ? "Only admins can send messages in this group"
          : "Only admins can share files in this group";
      toast.error(msg, {
        style: {
          background: "#1a1a22",
          border: "1px solid var(--brand-2)",
          color: "#fff",
        },
      });
    };

    s.on("group:message", onMsg);
    s.on("notification:new", onMentionNotification);
    s.on("group:thread-update", onThreadUpdate);
    s.on("group:thread-reply", onThreadReply);
    s.on("group:message-deleted", onDeleted);
    s.on("group:message-reactions", onReactions);
    s.on("group:message-task", onMessageTask);
    s.on("group:message-rejected", onRejected);

    markGroupRead();

    setActiveConvId(convId);

    return () => {
      s.off("connect", join);
      s.off("reconnect", join);
      s.off("group:message", onMsg);
      s.off("notification:new", onMentionNotification);
      s.off("group:thread-update", onThreadUpdate);
      s.off("group:thread-reply", onThreadReply);
      s.off("group:message-deleted", onDeleted);
      s.off("group:message-reactions", onReactions);
      s.off("group:message-task", onMessageTask);
      s.off("group:message-rejected", onRejected);
      setActiveConvId(undefined);
    };
  }, [groupId, convId, me, setActiveConvId, clearGroupUnread]);

  // File upload function
  const uploadFile = async (file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append("file", file);

    console.log("Uploading file:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Upload failed:", errorData);
      throw new Error(errorData.error || "Upload failed");
    }

    const result = await response.json();
    console.log("Upload successful:", result);
    return {
      fileName: result.fileName,
      fileSize: result.fileSize,
      fileType: result.fileType,
      fileUrl: result.url,
      fileKey: result.key || result.fileKey,
      uploadedAt: new Date(),
    };
  };

  // Switching group: forget the previous one's "new messages" line.
  useEffect(() => {
    setNewDivider(null);
    pendingReadRef.current = false;
  }, [groupId]);

  // "Priya is typing…" — first names, the way WhatsApp shows them.
  const typingLabel = useMemo(() => {
    if (typingUsers.length === 0) return null;
    const names = typingUsers.map(
      (u) =>
        (userMap[u.userId]?.name || u.userName || "Someone")
          .trim()
          .split(/\s+/)[0]
    );
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  }, [typingUsers, userMap]);

  useEffect(() => {
    onTypingLabelChange?.(typingLabel);
  }, [typingLabel, onTypingLabelChange]);
  useEffect(() => () => onTypingLabelChange?.(null), [onTypingLabelChange]);

  // Send a marker-encoded message (location card, contact card) directly,
  // bypassing the textarea so existing edit/mention/upload logic is unaffected.
  const sendMarker = (encoded: string) => {
    const s = getSocket();
    const tempId = `tmp_mk_${Date.now()}`;
    const optimistic: Msg = {
      _id: tempId,
      tempId,
      groupId,
      from: me,
      text: encoded,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [...prev, optimistic]);
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      10
    );
    s.emit(
      "group:message",
      { groupId, text: encoded, tempId },
      (ack: any) => {
        if (!ack?.ok) {
          console.error("[CLIENT] group sendMarker ack error", ack?.error);
          toast.error("Failed to share");
          setItems((prev) => prev.filter((m) => m.tempId !== tempId));
        } else {
          setItems((prev) => prev.map((m) => (m.tempId === tempId ? ack.msg : m)));
        }
      }
    );
  };

  async function send() {
    const s = getSocket();
    const t = text.trim();

    // Edit mode: route to editMessage and exit.
    if (editingMessage) {
      if (!t) return;
      const original = items.find((x) => x._id === editingMessage);
      const wasForwarded = original ? isForwardedText(original.text) : false;
      const finalText = wasForwarded ? FORWARDED_PREFIX + t : t;
      await editMessage(editingMessage, finalText);
      bumpEditCount(editingMessage);
      setEditingMessage(null);
      setEditingText("");
      setText("");
      stopTyping();
      if (inputRef.current) inputRef.current.style.height = "auto";
      return;
    }

    if (!t && attachedFiles.length === 0) return;
    if (isSending) return; // Prevent double sending

    // Admin-control guards (server enforces too — this just gives instant feedback)
    if (broadcastBlocked) {
      toast.error("Only admins can send messages in this group", {
        style: { background: "#1a1a22", border: "1px solid var(--brand-2)", color: "#fff" },
      });
      return;
    }
    if (filesBlocked && attachedFiles.length > 0) {
      toast.error("Only admins can share files in this group", {
        style: { background: "#1a1a22", border: "1px solid var(--brand-2)", color: "#fff" },
      });
      return;
    }

    setIsSending(true);
    // Sent — the others' "typing…" should end now, not after the idle pause
    // (or after a slow upload).
    stopTyping();
    // Replying means you've caught up: the "new messages" line goes.
    setNewDivider(null);

    const tempId = `tmp_${Date.now()}`;

    // Upload files if any
    let attachments: Attachment[] = [];
    if (attachedFiles.length > 0) {
      try {
        attachments = await Promise.all(attachedFiles.map(uploadFile));
      } catch (error) {
        console.error("File upload failed:", error);
        setIsSending(false);
        return;
      }
    }

    const optimistic: Msg = {
      _id: tempId,
      tempId,
      groupId,
      from: me,
      text: t,
      attachments: attachments.length > 0 ? attachments : undefined,
      replyTo: replyToMsg?._id,
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => [...prev, optimistic]);
    setText("");
    setAttachedFiles([]);
    setReplyToMsg(null);

    // Reset textarea height after sending
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      10
    );

    s.emit(
      "group:message",
      {
        groupId,
        text: t,
        tempId,
        attachments: attachments.length > 0 ? attachments : undefined,
        replyTo: replyToMsg?._id,
      },
      async (ack: any) => {
        setIsSending(false);
        if (!ack?.ok) {
          console.error("[CLIENT][group:message] send error:", ack?.error);
          setItems((prev) => prev.filter((m) => m.tempId !== tempId));
          return;
        }
        setItems((prev) =>
          prev.map((m) => (m.tempId === tempId ? ack.msg : m))
        );

        // Detect @agent mentions and trigger agent replies
        const mentionedAgents = personalAgents.filter(
          (a) =>
            groupMembers.includes(`openclaw_agent_${a.agentId}`) &&
            t.toLowerCase().includes(`@${a.name.toLowerCase()}`)
        );
        if (mentionedAgents.length === 0) return;

        const tok = getToken();
        if (!tok) return;

        // Build history from current items ref (avoid setItems side-effect anti-pattern)
        const history = itemsRef.current
          .filter((m) => !m.agentMeta && m.type !== "system" && m.text)
          .slice(-10)
          .map((m) => ({
            role: m.from === me ? "user" : "assistant",
            content: m.text,
          }));

        // Trigger each mentioned agent (fire-and-forget, no setState as side-effect)
        for (const agent of mentionedAgents) {
          setAgentTyping((prev) => new Set([...prev, agent.agentId]));

          const chatUrl = new URL("/api/openclaw/chat", window.location.origin);
          if (orgId) chatUrl.searchParams.set("org_id", orgId);
          fetch(chatUrl.toString(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tok}`,
            },
            body: JSON.stringify({
              message: t,
              personalAgentId: agent.agentId,
              orgId: orgId,
              sessionId: `group_${groupId}_${agent.agentId}`,
              history,
            }),
          })
            .then((r) => r.json())
            .then((data) => {
              const reply: string = data?.reply || data?.message || data?.response || "";
              if (!reply) return;
              
              const replyUrl = new URL("/api/openclaw/group-agent-reply", window.location.origin);
              if (orgId) replyUrl.searchParams.set("org_id", orgId);
              return fetch(replyUrl.toString(), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${tok}`,
                },
                body: JSON.stringify({
                  groupId,
                  text: reply,
                  agentId: agent.agentId,
                  agentName: agent.name,
                  orgId: orgId,
                }),
              });
            })
            .catch((err) => console.error("[agent-reply] error:", err))
            .finally(() => {
              setAgentTyping((prev) => {
                const next = new Set(prev);
                next.delete(agent.agentId);
                return next;
              });
            });
        }
      }
    );
  }

  // Helper functions
  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const handleFileSelect = (file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
  };

  // Handle paste event for media files
  const handlePaste = (e: ClipboardEvent) => {
    // Prevent duplicate processing
    if (pasteProcessingRef.current) {
      console.log("Group paste already being processed, skipping");
      return;
    }

    pasteProcessingRef.current = true;
    console.log("Group paste event detected", e);

    const items = e.clipboardData?.items;
    if (!items) {
      console.log("No clipboard items found");
      pasteProcessingRef.current = false;
      return;
    }

    console.log("Group clipboard items:", items.length);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log("Group item type:", item.type, "kind:", item.kind);

      if (item.kind === "file") {
        const file = item.getAsFile();
        console.log("Group file found:", file?.name, file?.type);

        if (
          file &&
          (file.type.startsWith("image/") ||
            file.type.startsWith("video/") ||
            file.type.startsWith("audio/") ||
            file.type.startsWith("application/pdf") ||
            file.type.includes("document") ||
            file.type.includes("text/") ||
            file.type.includes("application/"))
        ) {
          console.log("Adding file to group attachments:", file.name);
          setAttachedFiles((prev) => [...prev, file]);
        }
      }
    }

    // Reset processing flag after a short delay
    setTimeout(() => {
      pasteProcessingRef.current = false;
    }, 100);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const editMessage = async (messageId: string, newText: string) => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const response = await api(
        `/groups/${groupId}/message/${messageId}?orgId=${orgId}`,
        {
          method: "PUT",
          body: JSON.stringify({ text: newText }),
        },
        getToken()!
      );

      if ((response as any).ok) {
        setItems((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? { ...msg, text: newText, editedAt: new Date() }
              : msg
          )
        );
        setEditingMessage(null);
      }
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const response = await api(
        `/groups/${groupId}/message/${messageId}?orgId=${orgId}`,
        { method: "DELETE" },
        getToken()!
      );

      if ((response as any).ok) {
        // Soft-delete: keep the row, just mark deleted so a placeholder renders
        setItems((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  deletedAt: new Date().toISOString(),
                  text: "",
                  attachments: [],
                  mentions: [],
                  reactions: {},
                }
              : msg
          )
        );
        setShowMessageActions(null);
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const handleReplyToMessage = (message: Msg) => {
    setReplyToMsg(message);
  };

  // Toggle an emoji reaction on a group message. Server is authoritative —
  // the broadcast back via `group:message-reactions` re-syncs everyone.
  // Update optimistically so the picker feels instant.
  const reactToMessage = (messageId: string, emoji: string) => {
    setItems((prev) =>
      prev.map((msg) => {
        if (msg._id !== messageId) return msg;
        const current = { ...(msg.reactions || {}) };
        let removingOwnSame = false;
        for (const [e, users] of Object.entries(current)) {
          const filtered = (users || []).filter((u) => u !== me);
          if (e === emoji && (users || []).includes(me)) removingOwnSame = true;
          if (filtered.length > 0) current[e] = filtered;
          else delete current[e];
        }
        if (!removingOwnSame) {
          current[emoji] = [...(current[emoji] || []), me];
        }
        return { ...msg, reactions: current };
      })
    );
    const s = getSocket();
    s.emit("group:react", { messageId, emoji }, (ack: any) => {
      if (!ack?.ok) {
        console.error("[CLIENT] group:react error", ack?.error);
      }
    });
  };

  // Opening a board switches the dashboard to Taskroom, but the full-page
  // chat is an opaque overlay above it — so that one steps aside once the
  // board is ready. The mini window floats beside Taskroom and stays open.
  const openBoard = async (board: TaskroomBoardRef) => {
    const ok = await openTaskroomBoard(board);
    if (ok && !isMini) onClose?.();
    return ok;
  };

  // Take a message's task(s) back out of Taskroom; the message stays. Cleared
  // up front so the mark and the menu row go at once. The server's
  // `group:message-task` then sets the real list — it may keep a task it
  // couldn't delete — and a failed request puts the old list back.
  const removingTaskRef = useRef<Set<string>>(new Set());
  const removeFromTaskroom = async (
    messageId: string,
    previous: NonNullable<Msg["aiTasks"]>
  ) => {
    if (removingTaskRef.current.has(messageId)) return;
    removingTaskRef.current.add(messageId);
    const cleared: NonNullable<Msg["aiTasks"]> = [];
    setItems((prev) =>
      prev.map((msg) =>
        msg._id === messageId ? { ...msg, aiTasks: cleared } : msg
      )
    );
    try {
      await api(
        `/groups/${groupId}/message/${messageId}/taskroom`,
        { method: "DELETE" },
        getToken()!
      );
      toast.success("Removed from Taskroom");
    } catch (error) {
      console.error("Failed to remove from Taskroom:", error);
      // Undo only our own clear: anything the socket set since is newer.
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === messageId && msg.aiTasks === cleared
            ? { ...msg, aiTasks: previous }
            : msg
        )
      );
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to remove from Taskroom"
      );
    } finally {
      removingTaskRef.current.delete(messageId);
    }
  };

  // ── Message-action helpers ────────────────────────────────────────────
  const copyMessageText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Copies the SAME short share-URL Taskroom's Share button produces (mirrors
  // components/athena/components/card-modal.tsx). Falls back to the long URL if
  // the short-URL service is unavailable.
  const copyTaskLink = async (task: {
    taskId?: string;
    roomId?: string;
    spaceId?: string;
    workspaceId?: string;
    title?: string;
  }) => {
    if (!task.taskId) return;
    try {
      const org = getOrgId();
      const og = { title: task.title || "Task" };
      const params = new URLSearchParams();
      if (org) params.set("orgId", org);
      if (task.workspaceId) params.set("workspaceId", task.workspaceId);
      if (task.spaceId) params.set("spaceId", task.spaceId);
      if (task.roomId) params.set("roomId", task.roomId);
      params.set("shareTask", task.taskId);
      params.set("og", encodeURIComponent(JSON.stringify(og)));
      const longUrl = `https://my.garage.app/taskroom/backOffice/athena?${params.toString()}`;
      const base =
        process.env.NEXT_PUBLIC_TASKROOM_URL ||
        "https://my.garage.app/taskroomv2/v2/";
      const token = getToken();
      const res = await fetch(`${base}short/urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ longurl: longUrl, og }),
      });
      const data = await res.json().catch(() => ({}));
      const shortUrl =
        data?.shortUrl ||
        data?.shortURL ||
        data?.url ||
        data?.data?.shortUrl ||
        longUrl;
      await navigator.clipboard.writeText(shortUrl);
      toast.success("Task link copied");
    } catch {
      toast.error("Couldn't copy the task link");
    }
  };

  const openForwardFor = (text: string) => {
    const targets: ForwardTarget[] = Object.values(userMap)
      .filter((u) => u.id && u.id !== me)
      .map((u) => ({
        id: u.id,
        kind: "dm" as const,
        label: u.name || u.email || "Unknown",
      }));
    setForwardTargets(targets);
    setForwardText(text);
    setForwardOpen(true);
  };

  const sendForward = (target: ForwardTarget) => {
    if (!forwardText.trim()) return;
    const body = forwardText.startsWith(FORWARDED_PREFIX)
      ? forwardText
      : FORWARDED_PREFIX + forwardText;
    if (target.kind === "dm") {
      const s = getSocket();
      const tempId = `tmp_fwd_${Date.now()}`;
      s.emit(
        "dm:message",
        { otherId: target.id, text: body, tempId },
        (ack: any) => {
          if (!ack?.ok) {
            console.error("[CLIENT] forward dm ack error", ack?.error);
            toast.error("Forward failed");
          } else {
            toast.success(`Forwarded to ${target.label}`);
          }
        }
      );
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectedMessages = () => items.filter((m) => selectedIds.has(m._id));

  const copySelection = async () => {
    const text = selectedMessages()
      .map((m) => m.text || "")
      .filter(Boolean)
      .join("\n");
    if (!text) return;
    await copyMessageText(text);
    exitSelectionMode();
  };

  const forwardSelection = () => {
    const text = selectedMessages()
      .map((m) => m.text || "")
      .filter(Boolean)
      .join("\n");
    if (!text) return;
    openForwardFor(text);
  };

  const deleteSelection = async () => {
    const own = selectedMessages().filter((m) => m.from === me);
    if (own.length === 0) {
      toast.error("You can only delete your own messages");
      return;
    }
    // Show confirmation dialog for bulk delete
    setPendingBulkDelete(true);
  };

  const confirmBulkDelete = async () => {
    const own = selectedMessages().filter((m) => m.from === me);
    await Promise.all(own.map((m) => deleteMessage(m._id)));
    own.forEach((m) => messageExtras.removeMessage(m._id));
    exitSelectionMode();
    setPendingBulkDelete(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-3 w-3" />;
    if (type.startsWith("video/")) return <FileText className="h-3 w-3" />;
    if (type.startsWith("audio/")) return <FileText className="h-3 w-3" />;
    if (type.includes("pdf")) return <FileText className="h-3 w-3" />;
    if (type.includes("word") || type.includes("document"))
      return <FileText className="h-3 w-3" />;
    if (type.includes("zip") || type.includes("rar"))
      return <FileText className="h-3 w-3" />;
    return <File className="h-3 w-3" />;
  };

  // Helpers
  const labelFor = (userId: string) => {
    if (userId === me) return "You";
    const u = userMap[userId];
    return u?.name || u?.email || userId.slice(0, 6);
  };
  const initialsFor = (userId: string) => {
    const u = userMap[userId];
    const base = u?.name || u?.email || userId;
    return base.trim().slice(0, 2).toUpperCase();
  };
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  // Helper function to format date labels
  const formatDateLabel = (dateString: string): string => {
    const messageDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time to compare only dates
    const resetTime = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const messageDateOnly = resetTime(messageDate);
    const todayOnly = resetTime(today);
    const yesterdayOnly = resetTime(yesterday);

    if (messageDateOnly.getTime() === todayOnly.getTime()) {
      return "Today";
    } else if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
      return "Yesterday";
    } else {
      return messageDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year:
          messageDate.getFullYear() !== today.getFullYear()
            ? "numeric"
            : undefined,
      });
    }
  };

  // Scroll to a specific message and highlight it
  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current.get(messageId);
    const scrollContainer = scrollContainerRef.current;
    if (messageElement && scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const messageRect = messageElement.getBoundingClientRect();
      const offsetTop = messageRect.top - containerRect.top + scrollContainer.scrollTop;
      const targetScroll = offsetTop - containerRect.height / 2 + messageRect.height / 2;

      scrollContainer.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });

      setHighlightedMessageId(messageId);
      // Remove highlight after 2.5 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2500);
    }
  };

  // Helper function to check if two messages are on different days
  const isDifferentDay = (date1: string, date2: string): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate()
    );
  };

  // Render text with URLs as clickable links
  const renderTextWithUrls = (
    text: string,
    isOwnMessage: boolean = false
  ): React.ReactNode => {
    if (!text) return text;

    const urls = extractUrls(text);
    if (urls.length === 0) return text;

    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    // Sort URLs by position in text (earliest first)
    const urlMatches: Array<{ url: string; index: number; length: number }> =
      [];
    for (const url of urls) {
      const index = text.indexOf(url, lastIndex);
      if (index !== -1) {
        urlMatches.push({ url, index, length: url.length });
      }
    }
    urlMatches.sort((a, b) => a.index - b.index);

    for (const match of urlMatches) {
      // Add text before URL
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add clickable URL with conditional color
      parts.push(
        <a
          key={match.index}
          href={match.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline transition-colors break-all ${
            isOwnMessage
              ? "text-indigo-200 hover:text-purple-200"
              : "text-indigo-400 hover:text-purple-400"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {match.url}
        </a>
      );

      lastIndex = match.index + match.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
  };

  // Render text with highlighted mentions and URLs
  const renderTextWithMentions = (
    text: string,
    mentions: string[],
    userMap: Record<string, MemberLite>,
    currentUserId?: string,
    isOwnMessage: boolean = false
  ) => {
    if (!text) return text;
    if (!mentions || mentions.length === 0) {
      return renderTextWithUrls(text, isOwnMessage);
    }

    // Get all URLs first
    const urls = extractUrls(text);
    const urlMatches: Array<{ url: string; index: number; length: number }> =
      [];
    for (const url of urls) {
      const index = text.indexOf(url);
      if (index !== -1) {
        urlMatches.push({ url, index, length: url.length });
      }
    }

    // Get all mention positions
    const mentionMatches: Array<{
      index: number;
      length: number;
      element: React.ReactElement;
    }> = [];
    let textIndex = 0;
    while (textIndex < text.length) {
      const atIndex = text.indexOf("@", textIndex);
      if (atIndex === -1) break;

      const textAfterAt = text.substring(atIndex + 1);
      let bestMatch: { user: MemberLite; matchedText: string } | null = null;

      const allUsers = Object.values(userMap);
      const sortedUsers = [
        ...allUsers.filter((u) => mentions.includes(u.id)),
        ...allUsers.filter((u) => !mentions.includes(u.id)),
      ];

      for (const user of sortedUsers) {
        if (!user) continue;
        const userName = user.name || "";
        const userEmail = user.email || "";

        if (userName) {
          const nameLower = userName.toLowerCase();
          const nameMatch = textAfterAt.match(
            new RegExp(
              `^${nameLower.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}(?:\\s|$|[.,!?;:])`,
              "i"
            )
          );
          if (nameMatch) {
            const matchedLength = nameMatch[0].trimEnd().length;
            if (!bestMatch || matchedLength > bestMatch.matchedText.length) {
              bestMatch = { user, matchedText: userName };
            }
          }
        }

        if (userEmail) {
          const emailLower = userEmail.toLowerCase();
          const emailMatch = textAfterAt.match(
            new RegExp(
              `^${emailLower.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
              )}(?:\\s|$|[.,!?;:])`,
              "i"
            )
          );
          if (emailMatch) {
            const matchedLength = emailMatch[0].trimEnd().length;
            if (!bestMatch || matchedLength > bestMatch.matchedText.length) {
              bestMatch = { user, matchedText: userEmail };
            }
          }
        }
      }

      if (bestMatch && mentions.includes(bestMatch.user.id)) {
        const isCurrentUserMentioned =
          currentUserId && bestMatch.user.id === currentUserId;
        const length = 1 + bestMatch.matchedText.length;
        mentionMatches.push({
          index: atIndex,
          length,
          element: (
            <span
              key={atIndex}
              className={`font-semibold text-[12px] px-1.5 py-0.5 rounded-md ${
                isOwnMessage
                  ? "bg-white/20 text-white"
                  : isCurrentUserMentioned
                  ? "bg-purple-500/20 text-purple-300"
                  : "bg-brand-2/40 text-brand"
              }`}
            >
              @{bestMatch.matchedText}
            </span>
          ),
        });
        textIndex = atIndex + length;
      } else {
        // Check for special @all / @here keywords
        const specialMatch = textAfterAt.match(/^(all|here)(?:\s|$|[.,!?;:])/i);
        if (specialMatch) {
          const keyword = specialMatch[1].toLowerCase();
          const length = 1 + keyword.length;
          mentionMatches.push({
            index: atIndex,
            length,
            element: (
              <span
                key={`special-${atIndex}`}
                className={`font-bold text-[12px] px-1.5 py-0.5 rounded-md ${
                  keyword === "all"
                    ? isOwnMessage ? "bg-white/25 text-white" : "bg-red-500/20 text-red-300"
                    : isOwnMessage ? "bg-white/25 text-white" : "bg-green-500/20 text-green-300"
                }`}
              >
                @{keyword}
              </span>
            ),
          });
          textIndex = atIndex + length;
        } else {
          textIndex = atIndex + 1;
        }
      }
    }

    // Combine and sort all matches (mentions and URLs)
    const allMatches: Array<{
      index: number;
      length: number;
      element?: React.ReactElement;
      url?: string;
    }> = [
      ...mentionMatches.map((m) => ({ ...m })),
      ...urlMatches.map((u) => ({
        index: u.index,
        length: u.length,
        url: u.url,
      })),
    ];
    allMatches.sort((a, b) => a.index - b.index);

    // Remove overlaps (prioritize earlier matches)
    const filteredMatches: typeof allMatches = [];
    let lastEnd = 0;
    for (const match of allMatches) {
      if (match.index >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.index + match.length;
      }
    }

    // Build final parts
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;

    for (const match of filteredMatches) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add the match (mention or URL)
      if (match.element) {
        parts.push(match.element);
      } else if (match.url) {
        parts.push(
          <a
            key={match.index}
            href={match.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline transition-colors break-all ${
              isOwnMessage
                ? "text-[#000] hover:text-[#000]/80"
                : "text-indigo-400 hover:text-purple-400"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {match.url}
          </a>
        );
      }

      lastIndex = match.index + match.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return <>{parts}</>;
  };

  async function loadGroups() {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      // Bail rather than sending the literal string "null" as orgId.
      if (!orgId) {
        setGroups([]);
        return;
      }
      const res = await api<{ groups: Group[] }>(
        `/groups?orgId=${orgId}`,
        {},
        getToken()!
      );
      setGroups(res.groups || []);
    } catch (err) {
      console.error("Failed to load groups:", err);
    }
  }

  useEffect(() => {
    loadGroups();

    // Request notification permission on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          console.log("[GroupChatPage] Notification permission:", permission);
        });
      }
    }
  }, []);

  // Add paste event listener for media files
  useEffect(() => {
    // Note: We're using onPaste prop on the textarea component instead of document listener
    // to avoid duplicate events
    console.log("Group paste functionality initialized");
  }, []);

  // Reset textarea height when text is cleared
  useEffect(() => {
    if (!text && inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [text]);

  const currentGroup = groups?.find((g) => g.id === groupId);
  const groupName = currentGroup?.name || "Group";
  const groupDescription = (currentGroup as any)?.description;
  const groupPicture = (currentGroup as any)?.picture;

  const handleGroupUpdated = () => {
    loadGroups();
  };

  const pinnedMsgIds = usePinnedIds();
  const pinnedMessages = items.filter((m) => pinnedMsgIds.includes(m._id));

  return (
    <div className="relative h-full overflow-hidden bg-[#0e0e12] flex flex-row">
      <div className="relative flex-1 min-w-0 flex flex-col">
      {selectionMode && (
        <SelectionToolbar
          count={selectedIds.size}
          onCancel={exitSelectionMode}
          onCopy={copySelection}
          onForward={forwardSelection}
          onDelete={deleteSelection}
        />
      )}
      <ForwardDialog
        open={forwardOpen}
        text={forwardText}
        targets={forwardTargets}
        onClose={() => setForwardOpen(false)}
        onSend={sendForward}
      />
      {/* Single message delete confirmation */}
      <DeleteConfirmDialog
        open={!!pendingDeleteId}
        onConfirm={() => {
          if (pendingDeleteId) {
            deleteMessage(pendingDeleteId);
            messageExtras.removeMessage(pendingDeleteId);
          }
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
      {/* Bulk delete confirmation */}
      <DeleteConfirmDialog
        open={pendingBulkDelete}
        count={selectedMessages().filter((m) => m.from === me).length}
        onConfirm={confirmBulkDelete}
        onCancel={() => setPendingBulkDelete(false)}
      />
      {/* Header - Mobile: full-width bar */}
      {!isMini && (
        <div className="sticky top-0 z-20">
          {/* Mobile header — matches DM */}
          <div className="md:hidden flex items-center gap-3 bg-[#0e0e12] border-b border-[#2E2E2E] px-3 py-2.5">
            <button
              onClick={onClose}
              className="shrink-0 h-8 w-8 flex items-center justify-center text-[#999] hover:text-white rounded-md hover:bg-[#2E2E2E] transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Avatar className="shrink-0 w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
              <AvatarImage src={groupPicture} />
              <AvatarFallback className="text-xs text-white font-medium bg-[#2E2E2E]">
                {groupName?.charAt(0) || "G"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1" onClick={openEditPanel}>
              <div className="text-[11px] font-medium truncate text-white">
                {groupName}
              </div>
              <div className={cn("text-[10px] truncate", typingLabel ? "text-brand" : "text-[#6E6E6E]")}>
                {typingLabel ??
                  (groupMembers.length > 0
                    ? `${groupMembers.length} member${groupMembers.length !== 1 ? "s" : ""}`
                    : groupDescription || "Group")}
              </div>
            </div>
            <button
              onClick={() => setShowMediaGallery(!showMediaGallery)}
              className="shrink-0 h-8 w-8 flex items-center justify-center text-[#999] hover:text-white rounded-md hover:bg-[#2E2E2E] transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>

          {/* Desktop header — flat strip matching DM */}
          <div className="hidden md:flex items-center justify-between bg-[#0e0e12] border-b border-[#2E2E2E] px-4 py-2.5">
            <div className="min-w-0 flex items-center gap-3">
              <Avatar className="w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
                <AvatarImage src={groupPicture} />
                <AvatarFallback className="text-xs text-white font-medium bg-[#2E2E2E]">
                  {groupName?.charAt(0) || "G"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-[11px] font-medium truncate text-white">
                  {groupName}
                </div>
                <div className={cn("text-[10px] truncate", typingLabel ? "text-brand" : "text-[#6E6E6E]")}>
                  {typingLabel ??
                    (groupMembers.length > 0
                      ? `${groupMembers.length} member${groupMembers.length !== 1 ? "s" : ""}`
                      : groupDescription || "")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isGroupAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 w-7 p-0 rounded-md ${
                    showAdminPanel
                      ? "text-brand-2 bg-[#2E2E2E]"
                      : "text-[#999] hover:text-white hover:bg-[#2E2E2E]"
                  }`}
                  title="Admin Controls"
                  onClick={() =>
                    showAdminPanel ? setShowAdminPanel(false) : openAdminPanel()
                  }
                >
                  <Shield className="h-3.5 w-3.5" />
                </Button>
              )}
              {taskroomLinked && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`h-7 w-7 p-0 rounded-md ${
                    showTasksPanel
                      ? "text-brand-2 bg-[#2E2E2E]"
                      : "text-[#999] hover:text-white hover:bg-[#2E2E2E]"
                  }`}
                  title="Tasks"
                  onClick={() =>
                    showTasksPanel ? setShowTasksPanel(false) : openTasksPanel()
                  }
                >
                  <ListChecks className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className={`h-7 w-7 p-0 rounded-md ${
                  editDialogOpen
                    ? "text-brand-2 bg-[#2E2E2E]"
                    : "text-[#999] hover:text-white hover:bg-[#2E2E2E]"
                }`}
                title="Group Settings"
                onClick={() =>
                  editDialogOpen ? setEditDialogOpen(false) : openEditPanel()
                }
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#999] hover:text-white hover:bg-[#2E2E2E] rounded-md"
                title="View Media & Files"
                onClick={() => setShowMediaGallery(!showMediaGallery)}
              >
                <Image className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#999] hover:text-white hover:bg-[#2E2E2E] rounded-md"
                title="Close"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
      {pinnedMessages.length > 0 && (
        <div className="shrink-0 bg-[#1F1F1F] border-b border-[#2E2E2E] px-3 py-1.5 flex items-center gap-2">
          <Pin className="h-3 w-3 text-blue-400 shrink-0" />
          <button
            type="button"
            onClick={() => setShowPinnedList((s) => !s)}
            className="flex-1 text-left text-[10px] text-white truncate hover:text-brand"
            title="Show pinned"
          >
            {pinnedMessages.length} pinned message
            {pinnedMessages.length === 1 ? "" : "s"} — {pinnedMessages[0].text?.slice(0, 60) || "(media)"}
          </button>
          <button
            type="button"
            onClick={() => setShowPinnedList((s) => !s)}
            className="text-[9px] text-[#999] hover:text-white"
          >
            {showPinnedList ? "Hide" : "View"}
          </button>
        </div>
      )}
      {showPinnedList && pinnedMessages.length > 0 && (
        <div className="shrink-0 max-h-32 overflow-y-auto bg-[#15151b] border-b border-[#2E2E2E]">
          {pinnedMessages.map((pm) => (
            <div key={pm._id} className="flex items-start gap-2 px-3 py-2 border-b border-[#2E2E2E] last:border-b-0">
              <Pin className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 text-[10px] text-white">
                <div className="truncate">{pm.text || "(media)"}</div>
                <div className="text-[9px] text-[#6E6E6E] mt-0.5">
                  {new Date(pm.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => messageExtras.togglePin(pm._id)}
                className="text-[9px] text-[#999] hover:text-white shrink-0"
              >
                Unpin
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 min-h-0 bg-[#0e0e12]">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-5 py-2 chat-font screen-capture-protected transition-opacity duration-75"
          style={{ opacity: scrolledToBottom ? 1 : 0 }}
        >
          <div className="space-y-1 pt-2">
            {/* Load More Button */}
            {hasMoreMessages && (
              <div className="flex justify-center py-3">
                <Button
                  onClick={loadMoreMessages}
                  disabled={isLoadingMore}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E] rounded-md px-4 py-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    "Load older messages"
                  )}
                </Button>
              </div>
            )}
            {/* A group event with no text is one the retention sweeper
                soft-deleted — there is nothing left to show, not even a
                "deleted" placeholder. */}
            {items.filter((m) => !m.threadId && !(m.type === "system" && !m.text)).map((m, index, feed) => {
              const isAgentMsg = !!m.agentMeta;
              const mine = !isAgentMsg && m.from === me;
              const sender = m.from ? userMap[m.from] : undefined;
              const repliedToMessage = m.replyTo
                ? (typeof m.replyTo === "object"
                  ? (m.replyTo as any)
                  : items.find((item) => item._id === m.replyTo))
                : null;

              // Check if this is a consecutive message from the same user
              const prevMessage = index > 0 ? feed[index - 1] : null;
              const isConsecutive =
                prevMessage &&
                (isAgentMsg
                  ? prevMessage.agentMeta?.agentId === m.agentMeta?.agentId
                  : prevMessage.from === m.from);

              // Check if we need to show a date separator
              const showDateSeparator =
                index === 0 ||
                (prevMessage &&
                  isDifferentDay(prevMessage.createdAt, m.createdAt));

              const dateSeparator = showDateSeparator && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#2E2E2E]" />
                  <span className="text-[11px] text-[#8E8E93] font-medium px-3 py-1 rounded-full bg-[#1a1a22] border border-[#2E2E2E] shrink-0">
                    {formatDateLabel(m.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-[#2E2E2E]" />
                </div>
              );

              // Group event ("X added Y"): a centred line of text. It has no
              // sender, so none of the bubble chrome (avatar, name, actions,
              // reactions) applies.
              if (m.type === "system") {
                // Taskroom pills ("Task added to Taskroom: …") point at a
                // board, so they open it. Every other event — including
                // "Task removed from Taskroom" — stays plain text.
                const boardRoomId =
                  m.event === "ai_task_created" ||
                  m.event === "ai_task_assigned" ||
                  m.event === "ai_task_updated" ||
                  m.event === "manual_task_created" ||
                  m.event === "taskroom_linked"
                    ? m.taskroom?.roomId
                    : undefined;
                return (
                  <div key={m._id}>
                    {dateSeparator}
                    <div className="flex justify-center my-2 px-2">
                      {boardRoomId ? (
                        <button
                          type="button"
                          onClick={() =>
                            void openBoard({
                              roomId: boardRoomId,
                              spaceId: m.taskroom?.spaceId,
                              workspaceId: m.taskroom?.workspaceId,
                            })
                          }
                          title="Open the board in Taskroom"
                          className="max-w-[85%] inline-flex items-center gap-1.5 text-center text-[12px] leading-snug text-[#8E8E93] px-3 py-1.5 rounded-lg bg-[#1a1a22] hover:bg-[#23232d] hover:text-[#c7c7da] transition-colors cursor-pointer"
                        >
                          <ListChecks className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0">{m.text}</span>
                        </button>
                      ) : (
                        <span className="max-w-[85%] text-center text-[12px] leading-snug text-[#8E8E93] px-3 py-1.5 rounded-lg bg-[#1a1a22]">
                          {m.text}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              const isHighlighted = highlightedMessageId === m._id;
              const isSelected = selectedIds.has(m._id);

              // "This message became a Taskroom task": a small green mark
              // under the bubble that opens the board. People's messages only
              // — agent replies are never captured — and gone once deleted.
              const aiTasks = isAgentMsg || m.deletedAt ? [] : m.aiTasks ?? [];
              const taskBoard = aiTasks.find((t) => t.roomId);
              const taskRoomId = taskBoard?.roomId;
              const taskLabel =
                aiTasks.length > 1
                  ? `Added to Taskroom: ${aiTasks.length} tasks`
                  : aiTasks[0]?.title
                  ? `Added to Taskroom: "${aiTasks[0].title}"`
                  : "Added to Taskroom";
              const taskTooltip = [
                taskLabel,
                ...(aiTasks.length > 1
                  ? aiTasks.filter((t) => t.title).map((t) => `• ${t.title}`)
                  : []),
              ].join("\n");

              const menuCtx = {
                messageId: m._id,
                text: stripForwarded(m.text),
                isMine: mine,
                canEdit: mine && !isAgentMsg && canEditMessage(m, mine).ok,
                canDelete: mine && !isAgentMsg,
                onReply: () => handleReplyToMessage(m),
                onThread: isAgentMsg
                  ? undefined
                  : () =>
                      openThreadPanel({
                        messageId: m._id,
                        message: m,
                      }),
                onForward: () => openForwardFor(stripForwarded(m.text)),
                onCopy: () => copyMessageText(stripForwarded(m.text)),
                onEdit: () => {
                  const check = canEditMessage(m, mine);
                  if (!check.ok) {
                    toast.error(check.reason || "Cannot edit");
                    return;
                  }
                  setEditingMessage(m._id);
                  setEditingText(stripForwarded(m.text));
                  setText(stripForwarded(m.text));
                  setReplyToMsg(null);
                  setTimeout(() => inputRef.current?.focus(), 0);
                },
                onDelete: () => {
                  setPendingDeleteId(m._id);
                },
                onEnterSelectionMode: () => {
                  setSelectionMode(true);
                  setSelectedIds(new Set([m._id]));
                },
                onReact: (emoji) => reactToMessage(m._id, emoji),
                // Its sender or a group admin may take the task back out.
                onRemoveFromTaskroom:
                  aiTasks.length > 0 && (mine || isGroupAdmin)
                    ? () => void removeFromTaskroom(m._id, aiTasks)
                    : undefined,
                // Assign the task this message created to group members.
                onAssignTask:
                  aiTasks.length > 0 && taskBoard
                    ? () =>
                        setAssignTarget({
                          messageId: m._id,
                          task: {
                            taskId: taskBoard.taskId,
                            roomId: taskBoard.roomId,
                            spaceId: taskBoard.spaceId,
                            workspaceId: taskBoard.workspaceId,
                            title: aiTasks[0]?.title,
                          },
                        })
                    : undefined,
              };

              return (
                <div
                  key={m._id}
                  ref={(el) => {
                    if (el) {
                      messageRefs.current.set(m._id, el);
                    } else {
                      messageRefs.current.delete(m._id);
                    }
                  }}
                  className={`rounded-lg transition-colors duration-500 ${
                    isHighlighted ? "bg-brand-2/10" : ""
                  } ${isSelected ? "bg-brand-2/5" : ""}`}
                >
                  {/* Date Separator */}
                  {dateSeparator}

                  {/* "N new messages" — where the unread run starts */}
                  {newDivider?.beforeId === m._id && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-red-500/60" />
                      <span className="text-[11px] text-red-400 font-semibold px-3 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 shrink-0">
                        {newDivider.count} new message{newDivider.count === 1 ? "" : "s"}
                      </span>
                      <div className="flex-1 h-px bg-red-500/60" />
                    </div>
                  )}

                  {/* Message — mine on right, others on left */}
                  <div
                    className={`group flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${
                      isConsecutive ? "mt-0.5" : "mt-2"
                    }`}
                  >
                    {/* Avatar — others only, first message of a run (WhatsApp) */}
                    {!isConsecutive && !mine && (
                      <div className="flex-shrink-0 mr-2">
                        {isAgentMsg ? (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xs font-bold border border-violet-500/30">
                            {m.agentMeta!.agentName?.charAt(0)?.toUpperCase() || "A"}
                          </div>
                        ) : (
                          <Avatar className="w-9 h-9 border border-[#2E2E2E] bg-[#282828]">
                            <AvatarImage src={sender?.profilePicture || ""} />
                            <AvatarFallback className="text-xs text-white font-bold bg-[#2E2E2E]">
                              {sender?.name?.charAt(0) ||
                                sender?.email?.charAt(0) ||
                                "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}

                    {/* Spacer for consecutive messages */}
                    {isConsecutive && !mine && <div className="w-9 mr-2" />}

                    <div className={cn(
                      "flex min-w-0 flex-col",
                      mine ? "items-end" : "items-start",
                      isMini ? "max-w-[80%]" : "max-w-[65%]"
                    )}>
                      {/* Reply indicator */}
                      {repliedToMessage && (
                        <div
                          className="mb-1 px-2 py-1 rounded-md bg-[#2E2E2E]/60 border-l-2 border-brand/60 text-xs overflow-hidden cursor-pointer hover:bg-[#2E2E2E]/80 transition-colors mr-2"
                          onClick={() => scrollToMessage(repliedToMessage._id)}
                        >
                          <div className="text-[#6E6E6E]">
                            Replying to{" "}
                            {repliedToMessage.from === me
                              ? "yourself"
                              : labelFor(repliedToMessage.from)}
                          </div>
                          <div className="text-[#999] truncate break-words w-48">
                            {repliedToMessage.text}
                          </div>
                        </div>
                      )}

                      {/* Bubble + side smiley */}
                      {m.deletedAt ? (
                        <div className={`flex items-center gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                          <div className="rounded-lg px-3 py-2 text-xs border border-[#2E2E2E] bg-transparent select-none">
                            <div className="flex items-center gap-1.5 italic text-[#6E6E6E]">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="opacity-60"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                              <span>
                                {mine
                                  ? "You deleted this message"
                                  : "This message was deleted"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                      <div className={`flex max-w-full items-center gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Message bubble */}
                      <LongPressDiv
                        onLongPress={() => {
                          if (editingMessage === m._id) return;
                          if (selectionMode) {
                            toggleSelected(m._id);
                            return;
                          }
                          setMobileMenuMessageId(m._id);
                        }}
                        onClick={() => {
                          if (selectionMode) toggleSelected(m._id);
                        }}
                        className={`relative min-w-0 max-w-full rounded-xl px-2 pb-1 pt-1 text-[13.5px] font-normal shadow-sm transition-all duration-200 select-none text-white/90 ${
                          // A photo/video bubble keeps a phone-like width; in the wide
                          // full view the 65% cap would stretch the image into a strip.
                          editingMessage !== m._id &&
                          m.attachments?.some((a) => a.fileType?.startsWith("image/") || a.fileType?.startsWith("video/"))
                            ? "w-[22rem]"
                            : ""
                        } ${
                          mine
                            ? "bg-[color:color-mix(in_srgb,var(--brand)_18%,#17171d)]"
                            : "bg-[#1f1f27]"
                        } ${
                          !isConsecutive ? (mine ? "rounded-tr-[4px]" : "rounded-tl-[4px]") : ""
                        } ${
                          messageExtras.isPinned(m._id)
                            ? "ring-1 ring-blue-500/40"
                            : ""
                        }`}
                      >
                        {selectionMode && <SelectionCheckOverlay selected={isSelected} />}
                        {/* Sender name inside the bubble, first message of a run (WhatsApp groups) */}
                        {!isConsecutive && !mine && (
                          <div className="flex items-center gap-1.5 pr-5 text-[12.5px] font-semibold leading-5 text-brand">
                            <span className="truncate">
                              {isAgentMsg
                                ? m.agentMeta!.agentName
                                : sender?.name || sender?.email || "Unknown"}
                            </span>
                            {isAgentMsg && (
                              <span className="text-[9px] px-1 py-0 rounded border border-violet-500/40 text-violet-300 leading-tight">
                                AI
                              </span>
                            )}
                          </div>
                        )}
                        {/* Chevron menu trigger - inside bubble, top-right on hover */}
                        {editingMessage !== m._id && (
                          <div
                            className={`absolute top-0.5 right-0.5 z-10 rounded-full ${
                              mine ? "bg-[color:color-mix(in_srgb,var(--brand)_18%,#17171d)]" : "bg-[#1f1f27]"
                            } ${
                              mobileMenuMessageId === m._id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            } transition-opacity`}
                          >
                            <MessageActionMenu
                              meId={me}
                              align={mine ? "right" : "left"}
                              triggerVariant="inside"
                              forceOpen={
                                mobileMenuMessageId === m._id ? true : undefined
                              }
                              onClose={() => setMobileMenuMessageId(null)}
                              ctx={menuCtx}
                            />
                          </div>
                        )}
                        {/* Forwarded indicator */}
                        {isForwardedText(m.text) && (
                          <div className="flex items-center gap-1 text-[10px] italic text-white/60 mb-0.5">
                            <Forward className="h-2.5 w-2.5" />
                            <span>Forwarded</span>
                          </div>
                        )}
                        {/* Attachments FIRST (image on top) - hide when editing */}
                        {editingMessage !== m._id &&
                          m.attachments &&
                          m.attachments.length > 0 && (
                            <div className="mb-0.5 space-y-0.5 -mx-1.5 -mt-1">
                              {m.attachments.map((attachment, attIndex) => {
                                const isImage = attachment.fileType?.startsWith("image/");
                                const isVideo = attachment.fileType?.startsWith("video/");
                                const isAudio = attachment.fileType?.startsWith("audio/");
                                const isMedia = isImage || isVideo;
                                if (isMedia) {
                                  return (
                                    <MediaThumbnail
                                      key={attachment._id || attIndex}
                                      src={attachment.fileUrl}
                                      type={attachment.fileType}
                                      alt={attachment.fileName}
                                      // `isolate` keeps the thumbnail's z-20 hover overlay
                                      // inside the thumbnail, so the bubble's z-10 menu
                                      // chevron stays clickable over an image.
                                      className="w-full max-h-60 rounded-t-lg isolate"
                                      onClick={() => setMediaPreview({ url: attachment.fileUrl, type: attachment.fileType, name: attachment.fileName })}
                                    />
                                  );
                                }
                                if (isAudio) {
                                  return <VoiceMessagePlayer key={attachment._id || attIndex} src={attachment.fileUrl} isOwnMessage={mine} />;
                                }
                                return (
                                  <div
                                    key={attachment._id || attIndex}
                                    className={`flex items-center gap-2 p-1.5 mx-1.5 rounded-md border cursor-pointer ${mine ? "bg-black/10 border-black/20" : "bg-white/5 border-white/10"}`}
                                    onClick={() => window.open(attachment.fileUrl, "_blank")}
                                  >
                                    <div className="text-[#6E6E6E]">{getFileIcon(attachment.fileType)}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium truncate text-white">{attachment.fileName}</div>
                                      <div className="text-[10px] text-white/60">{formatFileSize(attachment.fileSize)}</div>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); window.open(attachment.fileUrl, "_blank"); }} className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10">
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        {/* Link previews - hide when editing or when the
                            message is a marker (location/contact) card */}
                        {editingMessage !== m._id &&
                          m.text &&
                          !hasMarker(m.text) &&
                          extractUrls(m.text).length > 0 && (
                            <div className="mb-1.5">
                              {extractUrls(m.text).map((url, idx) => (
                                <LinkPreview key={idx} url={url} />
                              ))}
                            </div>
                          )}

                        {/* Message text with time + ticks tucked into the bottom-right
                            corner (WhatsApp). An invisible copy of the metadata
                            reserves room at the end of the last line so the text
                            never runs under the visible one. */}
                        {(() => {
                          const meta = (
                            <>
                              {m.editedAt && <span className="italic">edited</span>}
                              {messageExtras.isPinned(m._id) && <Pin className="h-2.5 w-2.5 text-blue-400/70" />}
                              {messageExtras.isStarred(m._id) && <span className="text-yellow-400/70 text-[8px]">★</span>}
                              <span>
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {mine && (m.readAt
                                ? <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
                                : <Check className="h-3.5 w-3.5" />)}
                            </>
                          );
                          return (
                            <div className="relative px-0.5 leading-[1.45]">
                              <span className="whitespace-pre-wrap break-words">
                                <MessageContent
                                  text={stripForwarded(m.text)}
                                  isOwnMessage={mine}
                                  mentions={m.mentions}
                                  userMap={userMap as any}
                                  currentUserId={me}
                                />
                              </span>
                              <span aria-hidden className="invisible ml-2 inline-flex items-center gap-1 text-[10.5px] leading-none whitespace-nowrap select-none">
                                {meta}
                              </span>
                              <span className="absolute bottom-0 right-0 inline-flex items-center gap-1 text-[10.5px] leading-none text-white/45 whitespace-nowrap select-none">
                                {meta}
                              </span>
                            </div>
                          );
                        })()}
                      </LongPressDiv>

                      {/* Side smiley reaction button (opposite of bubble) */}
                      {!isAgentMsg && (
                        <div
                          className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`}
                        >
                          <QuickReactionButton
                            messageId={m._id}
                            meId={me}
                            openTo={mine ? "left" : "right"}
                            onReact={(emoji) => reactToMessage(m._id, emoji)}
                          />
                        </div>
                      )}
                      </div>
                      )}

                      {/* Added to Taskroom — renders nothing (and takes no
                          space) unless the message became a task. The column
                          already lines it up with the bubble's edge. The mark
                          sits beside a small "Copy link" control that copies the
                          same short share-URL Taskroom's Share button produces. */}
                      {aiTasks.length > 0 && (
                        <div
                          className={`mx-1 mt-1 inline-flex items-center gap-1.5 ${
                            mine ? "self-end" : "self-start"
                          }`}
                        >
                          {taskRoomId ? (
                            <button
                              type="button"
                              title={taskTooltip}
                              aria-label={taskLabel}
                              onClick={() => {
                                // In selection mode a tap selects the message,
                                // as a tap on its bubble does.
                                if (selectionMode) {
                                  toggleSelected(m._id);
                                  return;
                                }
                                void openBoard({
                                  roomId: taskRoomId,
                                  spaceId: taskBoard?.spaceId,
                                  workspaceId: taskBoard?.workspaceId,
                                });
                              }}
                              // The pseudo-element widens the hit area without
                              // adding height under the bubble.
                              className="relative inline-flex text-[#22c55e] hover:text-[#4ade80] transition-colors cursor-pointer after:absolute after:-inset-1.5"
                            >
                              <span aria-hidden className="h-3.5 w-3.5 bg-current" style={TASKROOM_MARK_STYLE} />
                            </button>
                          ) : (
                            <span title={taskTooltip} className="inline-flex text-[#22c55e]">
                              <span aria-hidden className="h-3.5 w-3.5 bg-current" style={TASKROOM_MARK_STYLE} />
                            </span>
                          )}
                          <button
                            type="button"
                            title="Copy task link"
                            aria-label="Copy task link"
                            onClick={(e) => {
                              e.stopPropagation();
                              void copyTaskLink({
                                taskId: taskBoard?.taskId,
                                roomId: taskRoomId,
                                spaceId: taskBoard?.spaceId,
                                workspaceId: taskBoard?.workspaceId,
                                title: aiTasks[0]?.title,
                              });
                            }}
                            className="inline-flex text-[#6E6E6E] hover:text-[#22c55e] transition-colors cursor-pointer"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Thread preview indicator */}
                      {(m.replyCount ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            openThreadPanel({ messageId: m._id, message: m })
                          }
                          className={`mt-1 max-w-xs w-full text-left rounded-md border-l-2 border-brand-2 bg-[#1F1F1F] hover:bg-[#262630] transition-colors px-2 py-1.5 ${
                            mine ? "self-end" : "self-start"
                          }`}
                          title="Open thread"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-white">
                              <MessageSquareText className="h-3 w-3 text-brand-2" />
                              <span className="font-medium">
                                {m.replyCount} {m.replyCount === 1 ? "reply" : "replies"}
                              </span>
                              {(m.threadParticipants?.length ?? 0) > 0 && (
                                <span className="text-[#6E6E6E]">
                                  · {m.threadParticipants!.length} {m.threadParticipants!.length === 1 ? "person" : "people"}
                                </span>
                              )}
                              {m.threadResolved && (
                                <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 border border-green-600/30">
                                  Resolved
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-brand-2 hover:text-brand shrink-0">
                              View →
                            </span>
                          </div>
                          {m.lastThreadReply?.text && (
                            <div className="mt-0.5 text-[10px] text-[#999] truncate">
                              <span className="text-white">
                                {m.lastThreadReply.from
                                  ? labelFor(m.lastThreadReply.from)
                                  : "Someone"}
                                :
                              </span>{" "}
                              {m.lastThreadReply.text}
                            </div>
                          )}
                        </button>
                      )}

                      {/* Reactions display (hidden on deleted messages) */}
                      {!m.deletedAt && (
                        <MessageReactions
                          messageId={m._id}
                          meId={me}
                          align={mine ? "right" : "left"}
                          reactions={m.reactions}
                          onReact={(emoji) => reactToMessage(m._id, emoji)}
                          userMap={userMap}
                        />
                      )}

                    </div>
                  </div>
                </div>
              );
            })}

            {/* Agent typing indicator */}
            {agentTyping.size > 0 && (
              <div className="flex gap-2 mt-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-[10px] font-bold border border-violet-500/30 flex-shrink-0">
                  AI
                </div>
                <div className="bg-[#2E2E2E]/80 border border-[#2E2E2E] text-white rounded-xl px-3 py-2 text-sm backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-0.5">
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[#999] text-xs">
                      {[...agentTyping].map((id) => personalAgents.find((a) => a.agentId === id)?.name || "Ai Employee").join(", ")} is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Typing indicator — WhatsApp-style: the typists' faces and a
                bubble of dots. Their names are in the header. */}
            {typingUsers.length > 0 && (
              <div className="flex items-end gap-2 mt-3" aria-live="polite" aria-label={typingLabel ?? undefined}>
                <div className="flex -space-x-2 shrink-0">
                  {typingUsers.slice(0, 3).map((u) => {
                    const member = userMap[u.userId];
                    const name = member?.name || u.userName || "?";
                    return (
                      <Avatar key={u.userId} title={name} className="w-7 h-7 border-2 border-[#0e0e12] bg-[#282828]">
                        <AvatarImage src={member?.profilePicture || ""} />
                        <AvatarFallback className="text-[10px] text-white font-semibold bg-[#2E2E2E]">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                </div>
                <div className="bg-[#1F1F1F] border border-[#2E2E2E] rounded-2xl rounded-bl-md px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input Area — flat strip pinned to bottom, matches DM */}
      <div className="shrink-0 z-20 px-2.5 sm:px-4 pb-2.5 pt-1.5 bg-[#0e0e12] border-t border-[#2E2E2E]">
        <div className="px-1 py-1">
          {editingMessage && (
            <div className="mb-2 p-2 bg-[#2E2E2E]/60 border-l-2 border-brand-2/70 rounded-md overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-brand-2 font-medium flex items-center gap-1">
                    <Edit3 className="h-3 w-3" />
                    Editing message
                  </div>
                  <div className="text-xs text-[#999] truncate break-words">
                    {stripForwarded(
                      items.find((x) => x._id === editingMessage)?.text || ""
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingMessage(null);
                    setEditingText("");
                    setText("");
                  }}
                  className="h-5 w-5 p-0 text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E]"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          {/* Broadcast-only notice — non-admins can't send */}
          {broadcastBlocked && (
            <div className="mb-2 p-2 bg-[#2E2E2E]/60 border-l-2 border-brand-2/60 rounded-md flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 text-brand-2 shrink-0" />
              <div className="text-xs text-[#c7c7da]">
                Broadcast-only — only admins can send messages here.
              </div>
            </div>
          )}
          {/* Reply indicator */}
          {replyToMsg && !editingMessage && (
            <div className="mb-2 p-2 bg-[#2E2E2E]/60 border-l-2 border-[#007AFF]/60 rounded-md overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#6E6E6E]">
                    Replying to{" "}
                    {replyToMsg.from === me
                      ? "yourself"
                      : labelFor(replyToMsg.from)}
                  </div>
                  <div className="text-xs text-[#999] truncate break-words">
                    {stripForwarded(replyToMsg.text)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setReplyToMsg(null)}
                  className="h-5 w-5 p-0 text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E]"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Link preview in input */}
          {text && extractUrls(text).length > 0 && (
            <div className="mb-2">
              {extractUrls(text).map((url, idx) => (
                <LinkPreview key={idx} url={url} />
              ))}
            </div>
          )}

          {/* File attachments preview */}
          {attachedFiles.length > 0 && (
            <div className="mb-2 space-y-1">
              {attachedFiles.map((file, index) => {
                const isImage = file.type?.startsWith("image/");
                const isVideo = file.type?.startsWith("video/");
                const isMedia = isImage || isVideo;

                return (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 p-1.5 rounded-md border bg-white/5 border-white/10"
                  >
                    {isMedia ? (
                      <MediaThumbnail
                        src={attachedPreviewUrls[index]}
                        type={file.type}
                        alt={file.name}
                        className="h-20 w-20"
                        onClick={() => {
                          setMediaPreview({
                            url: attachedPreviewUrls[index],
                            type: file.type,
                            name: file.name,
                          });
                        }}
                      />
                    ) : (
                      <div className="text-[#6E6E6E]">
                        {getFileIcon(file.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate text-white">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-white/60">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAttachedFile(index);
                      }}
                      className="h-6 w-6 p-0 text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E]"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating formatting toolbar */}
          <FormatToolbar inputRef={inputRef} value={text} onChange={setText} />

          {/* Input controls — Figma pill layout */}
          <div className="flex flex-col gap-1.5">
            {/* Main pill row */}
            <div className="flex items-center gap-2">
              {/* Pill input */}
              <div className="relative flex-1 flex items-center gap-1.5 rounded-[18px] border border-[#2E2E2E] bg-[#181818] px-3 py-2 min-h-[38px]">
                <SlashCommandMenu
                  open={slash.menuOpen}
                  commands={slash.filteredCommands}
                  selectedIndex={slash.selectedIndex}
                  onSelect={slash.selectCommand}
                  onClose={slash.closeMenu}
                  anchorRef={inputRef}
                />
                <textarea
                  ref={inputRef}
                  placeholder={
                    broadcastBlocked
                      ? "Only admins can send messages in this group"
                      : "Write a message..."
                  }
                  disabled={broadcastBlocked}
                  value={text}
                  onChange={(e) => {
                    const newText = e.target.value;
                    setText(newText);
                    slash.handleInputChange(newText);
                    handleTyping(newText);

                    // Check for @ mention
                    const cursorPos = (e.target as HTMLTextAreaElement).selectionStart;
                    const textBeforeCursor = newText.substring(0, cursorPos);
                    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

                    if (lastAtIndex !== -1) {
                      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
                        setMentionQuery(textAfterAt);
                        setMentionStartIndex(lastAtIndex);
                        setShowMentionSuggestions(true);
                        const textarea = e.target;
                        const rect = textarea.getBoundingClientRect();
                        setMentionPosition({ top: rect.top + (textarea.scrollTop || 0) - 200, left: rect.left });
                      } else {
                        setShowMentionSuggestions(false);
                      }
                    } else {
                      setShowMentionSuggestions(false);
                    }

                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (
                      showMentionSuggestions &&
                      (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Tab")
                    ) {
                      e.preventDefault();
                      if (e.key === "Enter" || e.key === "Tab") {
                        const q = mentionQuery.toLowerCase();
                        const filteredMembers = Object.values(userMap).filter(
                          // Self is included so you can @-mention yourself (e.g. to
                          // assign an AI-captured task to yourself). @all/@here still
                          // exclude you — that's handled server-side.
                          (m) => groupMembers.includes(m.id) &&
                            (m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
                        );
                        const filteredAgents = personalAgents.filter(
                          (a) => groupMembers.includes(`openclaw_agent_${a.agentId}`) && a.name.toLowerCase().includes(q)
                        );
                        const firstMember = filteredMembers[0];
                        const firstAgent = filteredAgents[0];
                        const mentionName = firstMember ? firstMember.name || firstMember.email : firstAgent?.name;
                        if (mentionName) {
                          const mentionText = `@${mentionName}`;
                          const newText = text.substring(0, mentionStartIndex) + mentionText + " " + text.substring((e.target as HTMLTextAreaElement).selectionStart);
                          setText(newText);
                          setShowMentionSuggestions(false);
                          setTimeout(() => {
                            if (inputRef.current) {
                              const newPos = mentionStartIndex + mentionText.length + 1;
                              inputRef.current.setSelectionRange(newPos, newPos);
                            }
                          }, 0);
                        }
                      }
                      return;
                    }

                    if (slash.handleKeyDown(e)) return;
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  onPaste={(e) => {
                    handlePaste(e.nativeEvent);
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.style.height = "auto";
                        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
                      }
                    }, 0);
                  }}
                  maxLength={2000}
                  className="flex-1 w-full min-w-0 text-[12px] bg-transparent text-white min-h-[20px] max-h-[120px] resize-none placeholder:text-[#6E6E6E] focus:outline-none overflow-y-auto leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={1}
                />

                {/* Mention suggestions dropdown */}
                {showMentionSuggestions && (() => {
                  const q = mentionQuery.toLowerCase();
                  const memberSuggestions = Object.values(userMap).filter((m) => groupMembers.includes(m.id) && (m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))).slice(0, 5);
                  const agentSuggestions = personalAgents.filter((a) => groupMembers.includes(`openclaw_agent_${a.agentId}`) && a.name.toLowerCase().includes(q)).slice(0, 3);
                  const insertMention = (name: string) => {
                    const mentionText = `@${name}`;
                    const newText = text.substring(0, mentionStartIndex) + mentionText + " " + text.substring(inputRef.current?.selectionStart || text.length);
                    setText(newText);
                    setShowMentionSuggestions(false);
                    setTimeout(() => {
                      if (inputRef.current) {
                        const newPos = mentionStartIndex + mentionText.length + 1;
                        inputRef.current.setSelectionRange(newPos, newPos);
                        inputRef.current.focus();
                      }
                    }, 0);
                  };
                  return (
                    <div className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto rounded-md border border-[#2E2E2E] bg-[#1F1F1F] shadow-lg z-50">
                      {("all".includes(q) || q === "") && (
                        <button key="__all" type="button" onClick={() => insertMention("all")} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#15151b] text-left border-b border-[#2E2E2E]/50">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">@</div>
                          <div className="flex-1 min-w-0"><div className="text-sm text-white font-medium">@all</div><div className="text-[10px] text-[#6E6E6E]">Notify all members</div></div>
                        </button>
                      )}
                      {("here".includes(q) || q === "") && (
                        <button key="__here" type="button" onClick={() => insertMention("here")} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#15151b] text-left border-b border-[#2E2E2E]/50">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">@</div>
                          <div className="flex-1 min-w-0"><div className="text-sm text-white font-medium">@here</div><div className="text-[10px] text-[#6E6E6E]">Notify online members</div></div>
                        </button>
                      )}
                      {memberSuggestions.map((member) => (
                        <button key={member.id} type="button" onClick={() => insertMention(member.name || member.email)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#15151b] text-left">
                          <Avatar className="w-6 h-6 border border-[#2E2E2E]">
                            <AvatarImage src={member.profilePicture} />
                            <AvatarFallback className="text-xs text-white bg-[#2E2E2E]">{member.name?.charAt(0) || member.email?.charAt(0) || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{member.name || member.email}</div>
                            {member.name && <div className="text-[11px] text-[#6E6E6E] truncate">{member.email}</div>}
                          </div>
                        </button>
                      ))}
                      {agentSuggestions.map((agent) => (
                        <button key={agent.agentId} type="button" onClick={() => insertMention(agent.name)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#15151b] text-left">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-[10px] font-bold border border-violet-500/30 shrink-0">{agent.name?.charAt(0)?.toUpperCase() || "A"}</div>
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                            <div className="text-sm text-white truncate">{agent.name}</div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#3d3d51] text-[#c9c9ee] shrink-0">STK</span>
                          </div>
                        </button>
                      ))}
                      {memberSuggestions.length === 0 && agentSuggestions.length === 0 && !("all".includes(q) || q === "") && !("here".includes(q) || q === "") && (
                        <div className="px-3 py-2 text-sm text-[#6E6E6E]">No members found</div>
                      )}
                    </div>
                  );
                })()}

                {/* Emoji + Attachment inside pill */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <EmojiPickerComponent onEmojiSelect={handleEmojiSelect} align="right" width={isMini ? 260 : 320} height={isMini ? 280 : 320} />
                  {filesBlocked ? (
                    <button type="button" disabled title="Only admins can share files in this group" className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#6E6E6E] opacity-50 cursor-not-allowed">
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <FileAttachment onFileSelect={handleFileSelect} />
                  )}
                </div>
              </div>

              {/* Send button outside pill */}
              <button
                onClick={send}
                disabled={(!text.trim() && attachedFiles.length === 0) || isSending}
                className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-full bg-[#1C1C1E] border border-[#2C2C2E] text-white/70 hover:text-white hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Send"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Secondary icon row */}
            <div className="flex items-center gap-0.5 px-1">
              <VoiceRecorder onRecordingComplete={handleFileSelect} onSend={async (file) => { handleFileSelect(file); setTimeout(() => send(), 100); }} />
              <VideoMessageRecorder onRecordingComplete={handleFileSelect} onSend={async (file) => { handleFileSelect(file); setTimeout(() => send(), 100); }} />
              <GifPicker onShare={sendMarker} />
              <LocationShareButton onShare={sendMarker} />
              <ContactShareButton
                members={Object.values(userMap).map((u) => ({ id: u.id, name: u.name, email: u.email, profilePicture: u.profilePicture }))}
                excludeIds={[me]}
                onShare={sendMarker}
              />
              <div className="hidden sm:block">
                <ScreenRecorder onRecordingComplete={handleFileSelect} onSend={async (file) => { handleFileSelect(file); setTimeout(() => send(), 100); }} target={{ type: "group", id: groupId, name: groupName }} />
              </div>
              <span className={`ml-auto text-[9px] tabular-nums ${text.replace(/\s/g, "").length >= 1900 ? "text-red-400" : "text-[#444]"}`}>
                {text.replace(/\s/g, "").length}/2000
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Media Preview Modal */}
      <MediaPreviewModal
        media={mediaPreview}
        onClose={() => setMediaPreview(null)}
      />

      {/* Slash-command form modal (task, poll, meet, …). Members default to
          the group's roster minus the current user. Group chats allow
          assigning one task to multiple members at once. */}
      <SlashCommandForm
        command={slash.activeCommand}
        orgId={orgId || undefined}
        members={Object.values(userMap)
          .filter((m) => m.id !== me && groupMembers.includes(m.id))
          .map((m) => ({ id: m.id, name: m.name, email: m.email }))}
        multiAssign
        onSubmit={(encoded) => {
          sendMarker(encoded);
          slash.closeForm();
        }}
        onClose={slash.closeForm}
        // "/taskroom" only: post straight to the linked board (no chat marker),
        // then refresh the Tasks panel if it's open.
        groupId={groupId}
        uploadFile={uploadFile}
        onCreated={() => setTasksRefreshKey((k) => k + 1)}
        currentUser={
          me
            ? { id: me, name: Object.values(userMap).find((u) => u.id === me)?.name || "You" }
            : undefined
        }
      />

      {/* Media Gallery Popup */}
      {showMediaGallery && (
        <div className="absolute top-[66px] right-0 w-full h-screen bg-[#1F1F1F] border border-[#2E2E2E] shadow-lg overflow-hidden z-30">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">
                Media & Files
              </h3>
            </div>
            <Button
              onClick={() => setShowMediaGallery(false)}
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-[#2E2E2E]"
            >
              <X className="h-3 w-3 text-gray-400" />
            </Button>
          </div>
          <div className="overflow-y-auto max-h-[440px] p-3">
            {(() => {
              // Get all attachments from messages
              const allAttachments = items
                .filter((msg) => msg.attachments && msg.attachments.length > 0)
                .flatMap((msg) =>
                  msg.attachments!.map((att) => ({
                    ...att,
                    messageId: msg._id,
                    createdAt: msg.createdAt,
                  }))
                )
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
                );

              if (allAttachments.length === 0) {
                return (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No media or files</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Files shared in this group will appear here
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-3 gap-2">
                  {allAttachments.map((attachment, index) => {
                    const isImage = attachment.fileType?.startsWith("image/");
                    const isVideo = attachment.fileType?.startsWith("video/");
                    const isMedia = isImage || isVideo;

                    if (isMedia) {
                      return (
                        <MediaThumbnail
                          key={`${attachment._id}-${index}`}
                          src={attachment.fileUrl}
                          type={attachment.fileType}
                          alt={attachment.fileName}
                          className="aspect-square"
                          onClick={() => {
                            setMediaPreview({
                              url: attachment.fileUrl,
                              type: attachment.fileType,
                              name: attachment.fileName,
                            });
                            setShowMediaGallery(false);
                          }}
                        />
                      );
                    }

                    return (
                      <div
                        key={`${attachment._id}-${index}`}
                        className="relative aspect-square rounded-lg overflow-hidden border border-[#2E2E2E] bg-[#15151b] cursor-pointer hover:border-blue-400 transition-colors group"
                        onClick={() => {
                          window.open(attachment.fileUrl, "_blank");
                        }}
                      >
                        <div className="w-full h-full flex flex-col items-center justify-center p-2">
                          <FileText className="h-8 w-8 text-blue-400 mb-1" />
                          <span className="text-[8px] text-gray-400 text-center truncate w-full">
                            {attachment.fileName}
                          </span>
                        </div>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      </div>

      {/* Edit-Group panel — slides in from the right */}
      {editDialogOpen && (
        <div className="absolute inset-0 md:static md:inset-auto md:h-full md:shrink-0 z-40">
          <EditGroupDialog
            groupId={groupId}
            onClose={() => setEditDialogOpen(false)}
            onUpdated={handleGroupUpdated}
          />
        </div>
      )}

      {/* Admin panel — slides in from the right (mutually exclusive with thread/edit) */}
      {!editDialogOpen && showAdminPanel && (
        <div className="absolute inset-0 md:static md:inset-auto md:h-full md:shrink-0 z-40">
          <GroupAdminPanel
            groupId={groupId}
            userMap={userMap}
            me={me}
            onClose={() => setShowAdminPanel(false)}
            onGroupUpdated={(g) => setGroupData(g)}
            onOpenBoard={openBoard}
          />
        </div>
      )}

      {/* Thread panel — slides in from the right */}
      {!editDialogOpen && !showAdminPanel && activeThread && (
        <div className="absolute inset-0 md:static md:inset-auto md:h-full md:shrink-0 z-40">
          <ThreadPanel
            groupId={groupId}
            parentMessage={activeThread.message}
            userMap={userMap}
            onClose={() => setActiveThread(null)}
            onParentUpdated={(update) => {
              setItems((prev) =>
                prev.map((msg) =>
                  msg._id === activeThread.messageId
                    ? {
                        ...msg,
                        replyCount: update.replyCount ?? msg.replyCount,
                        threadResolved:
                          update.threadResolved ?? msg.threadResolved,
                        lastThreadReply:
                          update.lastThreadReply ?? msg.lastThreadReply,
                        threadParticipants:
                          update.threadParticipants ?? msg.threadParticipants,
                      }
                    : msg
                )
              );
            }}
          />
        </div>
      )}

      {/* Tasks panel — slides in from the right (mutually exclusive with the
          others; only when the group's Taskroom board is linked + enabled) */}
      {!editDialogOpen && !showAdminPanel && !activeThread && showTasksPanel && (
        <div className="absolute inset-0 md:static md:inset-auto md:h-full md:shrink-0 z-40">
          <GroupTasksPanel
            groupId={groupId}
            isMini={isMini}
            refreshKey={tasksRefreshKey}
            onOpenBoard={openBoard}
            onClose={() => setShowTasksPanel(false)}
          />
        </div>
      )}

      {/* Assign-task picker — assigns the Taskroom task a message created to
          group members. Group chat only. Keyed so it resets per task. */}
      {assignTarget && (
        <AssignTaskDialog
          key={assignTarget.messageId}
          groupId={groupId}
          me={me}
          task={assignTarget.task}
          members={Object.values(userMap).filter(
            (u) =>
              groupMembers.includes(u.id) &&
              !u.id.startsWith("openclaw_agent_")
          )}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Assign-task picker (group chat only) ──────────────────────────────────
// Self-contained member picker for "Assign to…". Rendered only while a task is
// targeted, and keyed by message id so its selection resets each time it opens.
function AssignTaskDialog({
  groupId,
  me,
  task,
  members,
  onClose,
}: {
  groupId: string;
  me: string;
  task: {
    taskId?: string;
    roomId?: string;
    spaceId?: string;
    workspaceId?: string;
    title?: string;
  };
  members: MemberLite[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }, [members, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!task.taskId || selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await api<{
        ok: boolean;
        assigned?: { userId: string; name: string }[];
        already?: { userId: string; name: string }[];
        notAssigned?: { userId: string; name: string }[];
        failed?: { userId: string; name: string }[];
      }>(
        `/groups/${groupId}/taskroom/tasks/${task.taskId}/assign`,
        { method: "PUT", body: JSON.stringify({ assigneeUserIds: [...selected] }) },
        getToken()!
      );
      const n = res.assigned?.length ?? 0;
      const skipped = res.notAssigned?.length ?? 0;
      let msg = n > 0 ? `Assigned to ${n}` : "No new assignments";
      if (skipped > 0) msg += ` — ${skipped} not on the board skipped`;
      toast.success(msg);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Couldn't assign"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="bg-[#0e0e12] border border-[#2E2E2E] text-white p-0 gap-0 overflow-hidden flex flex-col w-[calc(100%-2rem)] max-w-sm max-h-[85vh]">
        <DialogHeader className="shrink-0 px-4 py-3 border-b border-[#2E2E2E] space-y-0.5">
          <DialogTitle className="text-sm font-medium text-white">
            Assign task
          </DialogTitle>
          {task.title && (
            <p className="text-xs text-[#8E8E93] truncate" title={task.title}>
              {task.title}
            </p>
          )}
        </DialogHeader>
        <div className="shrink-0 px-3 py-2 border-b border-[#2E2E2E]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            className="w-full bg-[#141418] border border-[#2E2E2E] text-white rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#22c55e]"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#6E6E6E]">
              No members
            </div>
          ) : (
            filtered.map((u) => {
              const checked = selected.has(u.id);
              const label =
                (u.name || u.email || u.id) + (u.id === me ? " (you)" : "");
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggle(u.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[#141418] transition-colors"
                >
                  <span
                    className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                      checked
                        ? "bg-[#22c55e] border-[#22c55e]"
                        : "border-[#3a3a3a]"
                    }`}
                  >
                    {checked && (
                      <Check className="h-3 w-3 text-black" strokeWidth={3} />
                    )}
                  </span>
                  <span className="text-xs text-white truncate">{label}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="shrink-0 px-4 py-3 border-t border-[#2E2E2E] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-md border border-[#3a3a3a] text-xs text-white/80 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || selected.size === 0}
            className="h-8 px-3 rounded-md bg-[#22c55e] text-xs font-medium text-black hover:bg-[#4ade80] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Assigning…"
              : `Assign${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

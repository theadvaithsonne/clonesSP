// Garage 2.0-frontend/app/(dashboard)/dashboard/dm/[id]/page.tsx

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken, getUserDataFromToken, getOrgId } from "@/lib/auth";
import { connectSocket, getSocket } from "@/lib/socket";
import { dmConvId } from "@/lib/conv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChat } from "@/lib/chat-context";
import { useWebRTC } from "@/lib/webrtc-context";
import {
  MoreHorizontal,
  Phone,
  Send,
  Image as ImageIcon,
  FileText,
  Download,
  Trash2,
  Edit3,
  Reply,
  MoreVertical,
  X,
  Loader2,
  ExternalLink,
  Smile,
  Paperclip,
  Bookmark,
  Copy,
  AtSign,
  ThumbsUp,
  Pin,
  Forward,
  ArrowLeft,
  Check,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
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
import { Member } from "@/app/(dashboard)/layout";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FileAttachment, FilePreview } from "@/components/ui/file-attachment";
import { VoiceRecorder } from "@/components/ui/voice-recorder";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import { ScreenRecorder } from "@/components/ui/screen-recorder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// Prefix used for virtual per-agent DM IDs in the sidebar
const OPENCLAW_AGENT_PREFIX = "openclaw_agent_";

type Msg = {
  _id: string;
  convId: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
  tempId?: string;
  attachments?: FileAttachment[];
  replyTo?: string;
  editedAt?: string;
  deletedAt?: string | null;
  // emoji -> array of userId strings that reacted with this emoji
  reactions?: Record<string, string[]>;
};

type FileAttachment = {
  _id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
};

export default function DMPage({
  id,
  onClose,
  isMini = false,
  onTypingLabelChange,
}: {
  id: string;
  onClose?: () => void;
  isMini?: boolean;
  /** "typing…" for a host that draws its own header (the mini window). */
  onTypingLabelChange?: (label: string | null) => void;
}) {
  const otherId = id;
  const me = getUserIdFromToken()!;

  // Detect OpenClaw virtual agent IDs (openclaw_agent_${agentId})
  const isVirtualAgent = otherId.startsWith(OPENCLAW_AGENT_PREFIX);
  const virtualAgentId = isVirtualAgent ? otherId.slice(OPENCLAW_AGENT_PREFIX.length) : null;
  // isOpenClaw covers both the legacy single-agent ID and the new virtual IDs
  const isOpenClaw = isVirtualAgent;

  // For virtual agents, use the agentId as the conversation key; otherwise use dmConvId
  const convId = useMemo(
    () => (isVirtualAgent ? virtualAgentId! : dmConvId(me, otherId)),
    [me, otherId, isVirtualAgent, virtualAgentId]
  );
  const [members, setMembers] = useState<Member[]>([]);
  const membersRef = useRef<Member[]>([]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const [isOpenClawThinking, setIsOpenClawThinking] = useState(false);

  // Session ID for Agent-Manager memory — generated once per agent, persisted in localStorage.
  // Kept in a ref so it never causes re-renders and is only touched client-side.
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isVirtualAgent || !virtualAgentId) return;
    const key = `openclaw_session_${virtualAgentId}`;
    const existing = localStorage.getItem(key);
    if (existing) {
      sessionIdRef.current = existing;
    } else {
      const id = `${virtualAgentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(key, id);
      sessionIdRef.current = id;
    }
  }, [isVirtualAgent, virtualAgentId]);

  // For virtual agents the agentId and name come directly from the ID; no extra fetch needed
  const personalAgentId: string | null = virtualAgentId;
  const [agentName, setAgentName] = useState<string | null>(null);
  const orgId = getOrgId();

  // Resolve agent name: for virtual agents, look it up from sidebar data via custom event
  useEffect(() => {
    if (!isVirtualAgent || !virtualAgentId) return;
    // Try to read from localStorage cache
    const cached = localStorage.getItem(`openclaw_agent_name_${virtualAgentId}`);
    if (cached) setAgentName(cached);
    // Listen for updates from settings page
    const handler = (e: CustomEvent) => {
      const agents: { agent_id: string; name: string }[] = e.detail?.agents || [];
      const found = agents.find((a) => a.agent_id === virtualAgentId);
      if (found) {
        setAgentName(found.name);
        localStorage.setItem(`openclaw_agent_name_${virtualAgentId}`, found.name);
      }
    };
    window.addEventListener("openclaw:agents-updated", handler as EventListener);
    return () => window.removeEventListener("openclaw:agents-updated", handler as EventListener);
  }, [isVirtualAgent, virtualAgentId]);

  // Fetch agent name from backend on mount (if not in cache yet)
  useEffect(() => {
    if (!isVirtualAgent || !virtualAgentId || agentName) return;

    const url = new URL("/api/openclaw/agent", window.location.origin);
    if (orgId) url.searchParams.set("org_id", orgId);

    fetch(url.toString(), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then((d) => {
        const found = (d.agents || []).find((a: any) => a.agent_id === virtualAgentId);
        if (found) {
          setAgentName(found.name);
          localStorage.setItem(`openclaw_agent_name_${virtualAgentId}`, found.name);
        }
      })
      .catch(() => {});
  }, [isVirtualAgent, virtualAgentId, orgId]);

  // Load OpenClaw chat history from DB on mount
  useEffect(() => {
    if (!isVirtualAgent || !virtualAgentId) return;
    const url = new URL("/api/openclaw/messages", window.location.origin);
    url.searchParams.set("agentId", virtualAgentId);
    if (orgId) url.searchParams.set("org_id", orgId);
    
    fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((d) => {
        const msgs: Msg[] = (d.messages || []).map((m: any) => {
          // Extract [Attached: file1, file2] markers saved in history
          const attachedMatch = m.content?.match(/\[Attached: ([^\]]+)\]/);
          const cleanText = m.content?.replace(/\n?\[Attached: [^\]]+\]/g, "").trim() || "";
          const attachedNames: string[] = attachedMatch
            ? attachedMatch[1].split(", ").map((n: string) => n.trim())
            : [];
          return {
            _id: m._id,
            convId: virtualAgentId,
            from: m.role === "user" ? me : otherId,
            to: m.role === "user" ? otherId : me,
            text: cleanText,
            createdAt: m.createdAt,
            // Reconstruct attachment chips so the file name is visible in history
            ...(attachedNames.length > 0
              ? {
                  attachments: attachedNames.map((name, i) => ({
                    _id: `hist_${m._id}_${i}`,
                    fileName: name,
                    fileSize: 0,
                    fileType: name.match(/\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)$/i)
                      ? `image/${name.split(".").pop()}`
                      : "application/octet-stream",
                    fileUrl: "",  // no URL — file was deleted from agent workspace
                    uploadedAt: m.createdAt,
                  })),
                }
              : {}),
          };
        });
        // Merge: don't overwrite session messages (e.g. optimistic + AI response)
        // that may have been added before this async fetch completed.
        const historyIds = new Set(msgs.map((m) => m._id));
        setItems((prev) => {
          const sessionMsgs = prev.filter((m) => !historyIds.has(m._id));
          return [...msgs, ...sessionMsgs];
        });
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
          setScrolledToBottom(true);
        }, 50);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVirtualAgent, virtualAgentId]);

  const { setActiveConvId, clearDmUnread, dmUnread, draftTexts, setDraftTexts, draftFiles, setDraftFiles } = useChat();
  const { startCall, inCall } = useWebRTC();

  const chatKey = virtualAgentId ? `dm_${otherId}_${virtualAgentId}` : `dm_${otherId}`;

  const text = draftTexts[chatKey] || "";
  const setText = (val: string | ((prev: string) => string)) => {
    setDraftTexts((prev) => {
      const current = prev[chatKey] || "";
      const nextVal = typeof val === "function" ? val(current) : val;
      return { ...prev, [chatKey]: nextVal };
    });
  };

  const attachedFiles = draftFiles[chatKey] || [];
  const setAttachedFiles = (val: File[] | ((prev: File[]) => File[])) => {
    setDraftFiles((prev) => {
      const current = prev[chatKey] || [];
      const nextVal = typeof val === "function" ? val(current) : val;
      return { ...prev, [chatKey]: nextVal };
    });
  };

  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [items, setItems] = useState<Msg[]>([]);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    setScrolledToBottom(false);
  }, [otherId, virtualAgentId]);
  // How many unread messages this chat had when it was opened — read before
  // opening marks them read and the count is cleared. Places the "N new
  // messages" line. (Reading `readAt` off the loaded history raced the
  // mark-read call made on open, so the line often never appeared.)
  const unreadAtOpenRef = useRef<{ otherId: string; count: number } | null>(
    null
  );
  if (unreadAtOpenRef.current?.otherId !== otherId) {
    unreadAtOpenRef.current = { otherId, count: dmUnread[otherId] || 0 };
  }
  // The "N new messages" line: above `beforeId`, until you send or reopen.
  const [newDivider, setNewDivider] = useState<{
    beforeId: string;
    count: number;
  } | null>(null);
  const newDividerRef = useRef<HTMLDivElement | null>(null);
  // Messages that arrived while the tab was hidden, not yet marked read.
  const pendingReadRef = useRef(false);
  const lastLoadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const draftKey = `chat_draft_dm_${otherId}`;
    const savedDraft = localStorage.getItem(draftKey) || "";
    if (savedDraft && !draftTexts[chatKey]) {
      setText(savedDraft);
    }
    lastLoadedIdRef.current = otherId;
  }, [otherId]);

  useEffect(() => {
    if (lastLoadedIdRef.current !== otherId) return;
    const draftKey = `chat_draft_dm_${otherId}`;
    if (text) {
      localStorage.setItem(draftKey, text);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [text, otherId]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<Msg | null>(null);
  const [showMessageActions, setShowMessageActions] = useState<string | null>(
    null
  );
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
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { typingUsers, handleTyping, stopTyping, removeTypingUser } =
    useTypingIndicator({
      startEvent: "dm:typing",
      stopEvent: "dm:stopTyping",
      payload: { otherId },
      // Only the person this chat is with — the socket also sits in the rooms
      // of DMs opened earlier, and their typing arrives here too.
      accepts: (e) => e.userId === otherId,
      enabled: !isOpenClaw,
      bottomRef,
    });
  const otherTyping = typingUsers.length > 0;
  useEffect(() => {
    onTypingLabelChange?.(otherTyping ? "typing…" : null);
  }, [otherTyping, onTypingLabelChange]);
  useEffect(() => () => onTypingLabelChange?.(null), [onTypingLabelChange]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pasteProcessingRef = useRef<boolean>(false);

  // Slash-command engine. Strips the "/" trigger from the textarea when a
  // command is picked so it doesn't get sent as plain text. AI-agent DMs
  // intentionally skip the engine since slash cards don't apply there.
  const slash = useSlashCommands({
    chatType: "dm",
    onClearTrigger: () => {
      setText((prev) => prev.replace(/(?:^|\n)\/\w*$/, "").trimEnd());
    },
  });

  // Single global socket subscription that keeps slash card state fresh.
  // Idempotent across the three chat pages.
  useSlashCardSync();

  // Keep scroll at bottom when images load
  useEffect(() => {
    const handleImageLoaded = () => {
      const container = bottomRef.current?.parentElement;
      if (container) {
        const threshold = 400;
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
        if (isNearBottom) {
          setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
          }, 50);
        }
      }
    };

    window.addEventListener("chat-image-loaded", handleImageLoaded);
    return () => {
      window.removeEventListener("chat-image-loaded", handleImageLoaded);
    };
  }, []);

  // Adjust input position when mobile keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function onResize() {
      const offset = window.innerHeight - vv!.height;
      setKeyboardOffset(offset > 0 ? offset : 0);
    }

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  // Load message history (skip for AI agent chats — messages are local only)
  useEffect(() => {
    if (isOpenClaw) return;
    (async () => {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ items: Msg[]; nextCursor: string | null }>(
        `/dm/${otherId}/messages?orgId=${orgId}`,
        {},
        getToken()!
      );
      const loaded = res.items || [];
      setItems(loaded);

      // "N new messages" goes above the Nth-newest message from them. If that
      // is older than this page, the line sits on the oldest one loaded.
      const unread =
        unreadAtOpenRef.current?.otherId === otherId
          ? unreadAtOpenRef.current.count
          : 0;
      let firstUnreadId: string | null = null;
      if (unread > 0) {
        let counted = 0;
        for (let i = loaded.length - 1; i >= 0 && counted < unread; i--) {
          if (loaded[i].from === me) continue;
          counted++;
          firstUnreadId = loaded[i]._id;
        }
      }
      setNewDivider(
        firstUnreadId ? { beforeId: firstUnreadId, count: unread } : null
      );

      setNextCursor(res.nextCursor);
      setHasMoreMessages(loaded.length >= 40);
      setTimeout(
        () => {
          // Open at the line when there is one, as WhatsApp does; otherwise at
          // the newest message.
          if (firstUnreadId && newDividerRef.current) {
            newDividerRef.current.scrollIntoView({ block: "start" });
          } else {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
          }
          setScrolledToBottom(true);
        },
        10
      );
    })();
  }, [otherId]);

  // Load more messages (older)
  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !nextCursor) return;

    setIsLoadingMore(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ items: Msg[]; nextCursor: string | null }>(
        `/dm/${otherId}/messages?orgId=${orgId}&cursor=${nextCursor}`,
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

  // Mark the chat read up to `upTo` (default: now) and clear its entries from
  // the notification bell — on open, for each message seen while open, and on
  // coming back to a tab that was hidden when messages arrived.
  const markDmRead = (upTo?: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    api(
      `/dm/${otherId}/read?orgId=${orgId}`,
      { method: "POST", body: JSON.stringify(upTo ? { upTo } : {}) },
      getToken()!
    ).catch(() => {});
    api(`/user-notifications/dm/${otherId}?orgId=${orgId}`, { method: "DELETE" }, getToken()!)
      .then(() => requestBellRefresh())
      .catch(() => {});
    clearDmUnread(otherId);
  };

  // Mark messages as read + clear notifications (skip for AI agent chats)
  useEffect(() => {
    setActiveConvId(convId);
    if (!isOpenClaw) markDmRead();
    return () => setActiveConvId(undefined);
  }, [convId, otherId, isOpenClaw, setActiveConvId, clearDmUnread]);

  // Switching chat: forget the previous one's "new messages" line.
  useEffect(() => {
    setNewDivider(null);
    pendingReadRef.current = false;
  }, [otherId]);

  // Back to the tab: what arrived while it was hidden has now been seen.
  useEffect(() => {
    if (isOpenClaw) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible" && pendingReadRef.current) {
        pendingReadRef.current = false;
        markDmRead();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [otherId, isOpenClaw]);

  // Effect for real-time socket listeners (skip for AI agent chats)
  useEffect(() => {
    if (isOpenClaw) return;
    const s = connectSocket();

    // Join the specific DM room
    const join = () => s.emit("dm:join", { otherId });
    if (s.connected) join();
    s.on("connect", join);
    s.on("reconnect", join);

    // Handle incoming messages
    const onMsg = (m: Msg) => {
      console.log("[DMPage] Message received:", {
        m,
        convId,
        currentConvId: m.convId,
        membersCount: membersRef.current.length,
      });

      // Only process messages for the current conversation
      if (m.convId !== convId) {
        console.log("[DMPage] Message ignored - different conversation");
        return;
      }

      // Their message has landed, so they're no longer typing it.
      if (m.from === otherId) removeTypingUser(otherId);

      // Optimistically update UI if it's a confirmation of a temp message
      if (m.tempId) {
        setItems((prev) => {
          const i = prev.findIndex((x) => x.tempId === m.tempId);
          if (i >= 0) {
            const copy = [...prev];
            copy[i] = m;
            return copy;
          }
          if (prev.some((x) => x._id === m._id)) return prev;
          return [...prev, m];
        });
      } else {
        // Add new message with duplicate check
        setItems((prev) => {
          if (prev.some((x) => x._id === m._id)) return prev;
          return [...prev, m];
        });
      }

      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      if (m.to === me) {
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
          // Seen now: mark it read, and take it off the bell — it used to
          // stay counted there until the chat was next opened.
          markDmRead(m.createdAt);
        }
      }

      // Show browser notification if message is from someone else (always, regardless of tab focus)
      console.log("[DMPage] ===== NOTIFICATION CHECK START =====");
      console.log("[DMPage] Checking notification eligibility:", {
        messageFrom: m.from,
        me,
        isFromMe: m.from === me,
        windowDefined: typeof window !== "undefined",
        notificationAvailable:
          typeof window !== "undefined" && "Notification" in window,
        notificationPermission: typeof window !== "undefined" && "Notification" in window ? Notification.permission : "N/A",
        membersCount: membersRef.current.length,
      });

      if (
        m.from !== me &&
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        // Check notification permission
        const permission = Notification.permission;

        // Show notification if permission is granted (always, even when tab is focused)
        const shouldNotify = permission === "granted";

        console.log("[DMPage] Notification check:", {
          permission,
          shouldNotify,
          messageFrom: m.from,
          messageTo: m.to,
          me,
        });

        if (shouldNotify) {
          const sender = membersRef.current.find((member) => member._id === m.from);
          const senderName = sender?.name || sender?.email || "Someone";
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
            console.log("[DMPage] Showing notification:", {
              senderName,
              messagePreview,
            });

            const notification = new Notification(senderName, {
              body: messagePreview,
              icon: sender?.profilePicture || undefined,
              badge: "/logo.svg",
              tag: `dm-${m.convId}`, // Group notifications by conversation
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
            console.error("[DMPage] Failed to show notification:", error);
          }
        } else {
          console.log(
            "[DMPage] Notification not shown - permission:",
            permission
          );
        }
      }
    };

    // Handle soft-deleted messages so the recipient sees a "deleted" placeholder
    const onDeleted = (data: {
      messageId: string;
      convId: string;
      deletedAt: string;
    }) => {
      if (data.convId !== convId) return;
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, deletedAt: data.deletedAt, text: "", attachments: [] }
            : msg
        )
      );
    };

    // Server is the source of truth for reactions; both sides re-render here.
    const onReactions = (data: {
      messageId: string;
      convId: string;
      reactions: Record<string, string[]>;
    }) => {
      if (data.convId !== convId) return;
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    };

    s.on("dm:message", onMsg);
    s.on("dm:message-deleted", onDeleted);
    s.on("dm:message-reactions", onReactions);

    // Cleanup listeners
    return () => {
      s.off("connect", join);
      s.off("reconnect", join);
      s.off("dm:message", onMsg);
      s.off("dm:message-deleted", onDeleted);
      s.off("dm:message-reactions", onReactions);
    };
  }, [otherId, convId, me, setActiveConvId, clearDmUnread]); // members removed from deps

  // Real-time socket listener for injected OpenClaw agent messages (e.g. cron job reports)
  useEffect(() => {
    if (!isOpenClaw || !virtualAgentId) return;
    const s = connectSocket();

    const onAgentMsg = (data: { agentId: string; role: string; content: string; createdAt: any; _id: any }) => {
      console.log("[DMPage] openclaw:new-message received", data);
      if (data.agentId !== virtualAgentId) return;
      setItems((prev) => [
        ...prev,
        {
          _id: String(data._id),
          convId: virtualAgentId,
          from: otherId,
          to: me,
          text: data.content,
          createdAt: data.createdAt,
        } as any,
      ]);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    s.on("openclaw:new-message", onAgentMsg);
    return () => { s.off("openclaw:new-message", onAgentMsg); };
  }, [isOpenClaw, virtualAgentId, otherId, me]);

  // Upload file to S3
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    console.log("Uploading file:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    try {
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

      const data = await response.json();
      console.log("Upload successful:", data);
      return data.url;
    } catch (error) {
      console.error("File upload error:", error);
      throw error;
    }
  };

  async function send() {
    const s = getSocket();
    const t = text.trim();

    // Edit mode: route to editMessage and exit. Preserve original Forwarded marker.
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
      if (inputRef.current) inputRef.current.style.height = "auto";
      return;
    }

    if (!t && attachedFiles.length === 0) return;
    if (isSending) return; // Prevent double sending

    setIsSending(true);

    const tempId = `tmp_${Date.now()}`;
    const filesToUpload = [...attachedFiles]; // Store files before clearing state

    const optimistic: Msg = {
      _id: tempId,
      tempId,
      convId,
      from: me,
      to: otherId,
      text: t,
      createdAt: new Date().toISOString(),
      attachments: filesToUpload.map((file) => ({
        _id: `temp_${Date.now()}_${Math.random()}`,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileUrl: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
      })),
      replyTo: replyToMsg?._id,
    };

    setItems((prev) => [...prev, optimistic]);
    setText("");
    setAttachedFiles([]);

    // ── OpenClaw AI: route message to AI gateway instead of socket ──
    if (isOpenClaw && (t || filesToUpload.length > 0)) {
      setIsSending(false);
      setReplyToMsg(null);
      if (inputRef.current) inputRef.current.style.height = "auto";
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);

      const tokenData = getUserDataFromToken();
      setIsOpenClawThinking(true);
      try {
        let res: Response;
        if (filesToUpload.length > 0 && personalAgentId) {
          // Send as multipart so the agent-manager can save and process files
          const fd = new FormData();
          fd.append("message", t || "Please process the attached file.");
          if (tokenData.email) fd.append("userEmail", tokenData.email);
          if (tokenData.userId) fd.append("userId", tokenData.userId);
          if (orgId) fd.append("orgId", orgId);
          fd.append("personalAgentId", personalAgentId);
          if (sessionIdRef.current) fd.append("sessionId", sessionIdRef.current);
          filesToUpload.forEach((file) => fd.append("files", file, file.name));
          
          const url = new URL("/api/openclaw/chat", window.location.origin);
          if (orgId) url.searchParams.set("org_id", orgId);
          res = await fetch(url.toString(), { method: "POST", body: fd });
        } else {
          const url = new URL("/api/openclaw/chat", window.location.origin);
          if (orgId) url.searchParams.set("org_id", orgId);
          res = await fetch(url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: t,
              userEmail: tokenData.email,
              userId: tokenData.userId,
              orgId: orgId,
              personalAgentId: personalAgentId ?? undefined,
              sessionId: sessionIdRef.current ?? undefined,
            }),
          });
        }

        const data = await res.json();
        const reply: string = data.response || data.error || "Sorry, I couldn't process that.";

        // Inject the AI response as a message in the UI
        const aiMsg: Msg = {
          _id: `ai_${Date.now()}`,
          convId,
          from: otherId,
          to: me,
          text: reply,
          createdAt: new Date().toISOString(),
        };
        setItems((prev) => [...prev, aiMsg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 10);

        // Persist both turns to DB
        const sid = sessionIdRef.current;
        if (personalAgentId && sid) {
          fetch("/api/openclaw/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              agentId: personalAgentId,
              sessionId: sid,
              messages: [
                {
                  role: "user",
                  content: [
                    t,
                    filesToUpload.length > 0
                      ? `[Attached: ${filesToUpload.map((f) => f.name).join(", ")}]`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n") || "(file attached)",
                },
                { role: "assistant", content: reply },
              ],
            }),
          }).catch((err) => console.error("[OpenClaw] Failed to save history:", err));
        }
      } catch (err) {
        console.error("[OpenClaw] Failed to get AI response:", err);
        const errMsg: Msg = {
          _id: `ai_err_${Date.now()}`,
          convId,
          from: otherId,
          to: me,
          text: "⚠️ Failed to reach OpenClaw. Please try again.",
          createdAt: new Date().toISOString(),
        };
        setItems((prev) => [...prev, errMsg]);
      } finally {
        setIsOpenClawThinking(false);
      }
      return;
    }
    setReplyToMsg(null);

    // Reset textarea height after sending
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Stop typing indicator
    stopTyping();
    // Replying means you've caught up: the "new messages" line goes.
    setNewDivider(null);

    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      10
    );

    try {
      // Upload files first, then send message
      if (filesToUpload.length > 0) {
        const uploadPromises = filesToUpload.map((file) => uploadFile(file));
        const uploadedUrls = await Promise.all(uploadPromises);

        s.emit(
          "dm:message",
          {
            otherId,
            text: t,
            tempId,
            attachments: uploadedUrls.map((url, index) => ({
              fileName: filesToUpload[index].name,
              fileSize: filesToUpload[index].size,
              fileType: filesToUpload[index].type,
              fileUrl: url,
            })),
            replyTo: replyToMsg?._id,
          },
          (ack: any) => {
            setIsSending(false);
            if (!ack?.ok) {
              console.error("[CLIENT] dm:message ack error", ack?.error);
            }
          }
        );
      } else {
        s.emit(
          "dm:message",
          {
            otherId,
            text: t,
            tempId,
            replyTo: replyToMsg?._id,
          },
          (ack: any) => {
            setIsSending(false);
            if (!ack?.ok) {
              console.error("[CLIENT] dm:message ack error", ack?.error);
            }
          }
        );
      }
    } catch (error) {
      console.error("File upload failed:", error);
      // Still send the message without attachments
      s.emit(
        "dm:message",
        {
          otherId,
          text: t,
          tempId,
          replyTo: replyToMsg?._id,
        },
        (ack: any) => {
          setIsSending(false);
          if (!ack?.ok) {
            console.error("[CLIENT] dm:message ack error", ack?.error);
          }
        }
      );
    }
  }

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  // Send a marker-encoded message (location card, contact card, etc.)
  // immediately, bypassing the textarea. Skipped for AI agent chats.
  const sendMarker = (encoded: string) => {
    if (isOpenClaw) {
      toast.error("Not supported in AI agent chats");
      return;
    }
    const s = getSocket();
    const tempId = `tmp_mk_${Date.now()}`;
    const optimistic: Msg = {
      _id: tempId,
      tempId,
      convId,
      from: me,
      to: otherId,
      text: encoded,
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [...prev, optimistic]);
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      10
    );
    s.emit(
      "dm:message",
      { otherId, text: encoded, tempId },
      (ack: any) => {
        if (!ack?.ok) {
          console.error("[CLIENT] sendMarker ack error", ack?.error);
          toast.error("Failed to share");
        }
      }
    );
  };

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
  };

  // Handle paste event for media files
  const handlePaste = (e: ClipboardEvent) => {
    // Prevent duplicate processing
    if (pasteProcessingRef.current) {
      console.log("Paste already being processed, skipping");
      return;
    }

    pasteProcessingRef.current = true;
    console.log("Paste event detected", e);

    const items = e.clipboardData?.items;
    if (!items) {
      console.log("No clipboard items found");
      pasteProcessingRef.current = false;
      return;
    }

    console.log("Clipboard items:", items.length);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log("Item type:", item.type, "kind:", item.kind);

      if (item.kind === "file") {
        const file = item.getAsFile();
        console.log("File found:", file?.name, file?.type);

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
          console.log("Adding file to attachments:", file.name);
          setAttachedFiles((prev) => [...prev, file]);
        }
      }
    }

    // Reset processing flag after a short delay
    setTimeout(() => {
      pasteProcessingRef.current = false;
    }, 100);
  };

  // Remove attached file
  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Edit message
  const editMessage = async (messageId: string, newText: string) => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const response = await api(
        `/dm/message/${messageId}?orgId=${orgId}`,
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
              ? { ...msg, text: newText, editedAt: new Date().toISOString() }
              : msg
          )
        );
        setEditingMessage(null);
        setEditingText("");
      }
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
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

      // Add clickable URL
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

  // Delete message
  const deleteMessage = async (messageId: string) => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const response = await api(
        `/dm/message/${messageId}?orgId=${orgId}`,
        { method: "DELETE" },
        getToken()!
      );

      if ((response as any).ok) {
        setItems((prev) =>
          prev.map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  deletedAt: new Date().toISOString(),
                  text: "",
                  attachments: [],
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

  // Reply to message
  const handleReplyToMessage = (message: Msg) => {
    setReplyToMsg(message);
  };

  // Toggle an emoji reaction on a message. Server is authoritative — the
  // socket broadcasts the new reaction map back, which both clients apply.
  // We optimistically update locally so the picker feels instant.
  const reactToMessage = (messageId: string, emoji: string) => {
    if (isOpenClaw) return; // No reactions on AI agent chats
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
    s.emit("dm:react", { messageId, emoji }, (ack: any) => {
      if (!ack?.ok) {
        console.error("[CLIENT] dm:react error", ack?.error);
      }
    });
  };

  // ── New message-action helpers ─────────────────────────────────────────
  const copyMessageText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const openForwardFor = (text: string) => {
    const targets: ForwardTarget[] = (members || [])
      .filter((m) => m._id && m._id !== me)
      .map((m) => ({
        id: m._id,
        kind: "dm" as const,
        label: m.name || m.email || "Unknown",
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

  const selectedMessages = () =>
    items.filter((m) => selectedIds.has(m._id));

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

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get file icon
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (type.startsWith("video/")) return <FileText className="h-4 w-4" />;
    if (type.startsWith("audio/")) return <FileText className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

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

  async function loadMembers() {
    const orgId = localStorage.getItem("garage_org_id");

    try {
      const res = await api<{ members: Member[] }>(
        `/team/list?orgId=${orgId}`,
        {},
        getToken()!
      );
      setMembers(res.members || []);
    } catch (err) {
      console.error("Failed to load members", err);
    }
  }

  useEffect(() => {
    loadMembers();

    // Request notification permission on mount
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          console.log("[DMPage] Notification permission:", permission);
        });
      }
    }
  }, []);

  // Add paste event listener for media files
  useEffect(() => {
    // Note: We're using onPaste prop on the textarea component instead of document listener
    // to avoid duplicate events
    console.log("Paste functionality initialized");
  }, []);

  // Reset textarea height when text is cleared
  useEffect(() => {
    if (!text && inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [text]);

  const otherUser = members?.find((item) => item?._id === otherId);

  const pinnedMsgIds = usePinnedIds();
  const pinnedMessages = items.filter((m) => pinnedMsgIds.includes(m._id));

  return (
    <div className="relative h-full overflow-hidden bg-[#0e0e12] flex flex-col" onClick={() => activeMenuMessageId && setActiveMenuMessageId(null)}>
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
        <div className="sticky top-0 z-20 shrink-0">
          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-3 bg-[#0e0e12] border-b border-[#2E2E2E] px-3 py-2.5">
            <button
              onClick={onClose}
              className="shrink-0 h-8 w-8 flex items-center justify-center text-[#999] hover:text-white rounded-md hover:bg-[#2E2E2E] transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative shrink-0">
              {!isOpenClaw && otherUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="cursor-pointer hover:opacity-85 transition-opacity">
                      <Avatar className="w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
                        <AvatarImage src={otherUser?.profilePicture || ""} />
                        <AvatarFallback className="text-xs text-white font-medium bg-[#2E2E2E]">
                          {otherUser?.name?.charAt(0) ||
                            otherUser?.email?.charAt(0) ||
                            "?"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#1b1b24] border border-[#2f2f3b] text-white">
                    <DropdownMenuItem
                      className="cursor-pointer hover:bg-[#2c2c3a] focus:bg-[#2c2c3a] focus:text-white text-xs"
                      onClick={() => {
                        if (otherUser?._id) {
                          window.dispatchEvent(
                            new CustomEvent("affiliate-profile:open", {
                              detail: { userId: otherUser._id },
                            })
                          );
                        }
                      }}
                    >
                      View Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Avatar className="w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
                  <AvatarImage src={otherUser?.profilePicture || ""} />
                  <AvatarFallback className="text-xs text-white font-medium bg-[#2E2E2E]">
                    {otherUser?.name?.charAt(0) ||
                      otherUser?.email?.charAt(0) ||
                      "?"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium truncate text-white">
                {isOpenClaw && agentName ? agentName : (otherUser?.name || otherUser?.email || "Unknown")}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[#6E6E6E] truncate">
                {isOpenClaw ? (
                  <span>Ai Employee</span>
                ) : otherTyping ? (
                  <span className="text-brand">typing…</span>
                ) : null}
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

          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between bg-[#0e0e12] border-b border-[#2E2E2E] px-4 py-2.5">
            <div className="min-w-0 flex items-center gap-3">
              <div className="relative">
                {!isOpenClaw && otherUser ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="cursor-pointer hover:opacity-85 transition-opacity">
                        <Avatar className="w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
                          <AvatarImage src={otherUser?.profilePicture || ""} />
                          <AvatarFallback className="text-xs text-white font-medium bg-[#2E2E2E]">
                            {otherUser?.name?.charAt(0) ||
                              otherUser?.email?.charAt(0) ||
                              "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-[#1b1b24] border border-[#2f2f3b] text-white">
                      <DropdownMenuItem
                        className="cursor-pointer hover:bg-[#2c2c3a] focus:bg-[#2c2c3a] focus:text-white text-xs"
                        onClick={() => {
                          if (otherUser?._id) {
                            window.dispatchEvent(
                              new CustomEvent("affiliate-profile:open", {
                                detail: { userId: otherUser._id },
                              })
                            );
                          }
                        }}
                      >
                        View Profile
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Avatar className="w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
                    <AvatarImage src={otherUser?.profilePicture || ""} />
                    <AvatarFallback className="text-xs text-white font-medium bg-[#2E2E2E]">
                      {otherUser?.name?.charAt(0) ||
                        otherUser?.email?.charAt(0) ||
                        "?"}
                    </AvatarFallback>
                  </Avatar>
                )}
                {isOpenClaw ? (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-violet-500 items-center justify-center text-[6px] text-white font-bold">AI</span>
                  </span>
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-[11px] font-medium truncate text-white">
                    {isOpenClaw && agentName ? agentName : (otherUser?.name || otherUser?.email || "Unknown")}
                  </div>
                  {isOpenClaw && (
                    <span className="text-[9px] bg-violet-600/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-medium">
                      Ai Employee
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[#6E6E6E]">
                  {isOpenClaw ? (
                    <span>AI Agent</span>
                  ) : otherTyping ? (
                    <span className="text-brand">typing…</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#999] hover:text-white hover:bg-[#2E2E2E] rounded-md"
                title="View Media & Files"
                onClick={() => setShowMediaGallery(!showMediaGallery)}
              >
                <ImageIcon className="h-3.5 w-3.5" />
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
          className="h-full overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-5 py-2 chat-font screen-capture-protected transition-opacity duration-75"
          style={{ opacity: scrolledToBottom ? 1 : 0 }}
        >
          <div className="space-y-0">
            {/* Load More Button */}
            {hasMoreMessages && (
              <div className="flex justify-center py-2 sm:py-3">
                <Button
                  onClick={loadMoreMessages}
                  disabled={isLoadingMore}
                  variant="ghost"
                  size="sm"
                  className="text-[10px] sm:text-xs text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E] rounded-md px-3 sm:px-4 py-1.5 sm:py-2 h-7 sm:h-8"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1 sm:mr-2" />
                      Loading...
                    </>
                  ) : (
                    "Load older messages"
                  )}
                </Button>
              </div>
            )}
            {items.map((m, index) => {
              const mine = m.from === me;
              const sender = members?.find((member) => member._id === m.from);
              const repliedToMessage = m.replyTo
                ? (typeof m.replyTo === "object"
                  ? (m.replyTo as any)
                  : items.find((item) => item._id === m.replyTo))
                : null;

              // Check if this is a consecutive message from the same user
              const prevMessage = index > 0 ? items[index - 1] : null;
              const isConsecutive = prevMessage && prevMessage.from === m.from;

              // Check if we need to show a date separator
              const showDateSeparator =
                index === 0 ||
                (prevMessage &&
                  isDifferentDay(prevMessage.createdAt, m.createdAt));

              const isSelected = selectedIds.has(m._id);

              const menuCtx = {
                messageId: m._id,
                text: stripForwarded(m.text),
                isMine: mine,
                canEdit: mine && !isOpenClaw && canEditMessage(m, mine).ok,
                canDelete: mine && !isOpenClaw,
                onReply: () => handleReplyToMessage(m),
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
              };

              return (
                <div key={m._id}>
                  {/* Date Separator */}
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-[#2E2E2E]" />
                      <span className="text-[11px] text-[#8E8E93] font-medium px-3 py-1 rounded-full bg-[#1a1a22] border border-[#2E2E2E] shrink-0">
                        {formatDateLabel(m.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-[#2E2E2E]" />
                    </div>
                  )}

                  {/* "N new messages" — where the unread run starts */}
                  {newDivider?.beforeId === m._id && (
                    <div ref={newDividerRef} className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-red-500/60" />
                      <span className="text-[11px] text-red-400 font-semibold px-3 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 shrink-0">
                        {newDivider.count} new message{newDivider.count === 1 ? "" : "s"}
                      </span>
                      <div className="flex-1 h-px bg-red-500/60" />
                    </div>
                  )}

                  {/* Message */}
                  <div
                    className={`group flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${
                      isConsecutive ? "mt-0.5" : "mt-2"
                    } ${
                      isSelected ? "bg-brand-2/5 rounded-md px-1 -mx-1" : ""
                    }`}
                  >
                    {/* Avatar — the other person only, first message of a run (as in groups) */}
                    {!isConsecutive && !mine && (
                      <div className="flex-shrink-0 mr-2">
                        {!mine && sender ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="cursor-pointer hover:opacity-85 transition-opacity">
                                <Avatar className="w-9 h-9 border border-[#2E2E2E] bg-[#282828]">
                                  <AvatarImage src={sender?.profilePicture || ""} />
                                  <AvatarFallback className="text-xs text-white font-bold bg-[#2E2E2E]">
                                    {sender?.name?.charAt(0) ||
                                      sender?.email?.charAt(0) ||
                                      "?"}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="bg-[#1b1b24] border border-[#2f2f3b] text-white">
                              <DropdownMenuItem
                                className="cursor-pointer hover:bg-[#2c2c3a] focus:bg-[#2c2c3a] focus:text-white text-xs"
                                onClick={() => {
                                  if (sender?._id) {
                                    window.dispatchEvent(
                                      new CustomEvent("affiliate-profile:open", {
                                        detail: { userId: sender._id },
                                      })
                                    );
                                  }
                                }}
                              >
                                View Profile
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                        <div className="mb-1 px-2 py-1 rounded-md bg-[#1F1F1F] border-l-2 border-brand-2/70 text-xs overflow-hidden mr-2">
                          <div className="text-brand-2 text-[10px] font-medium">
                            Replying to{" "}
                            {repliedToMessage.from === me
                              ? "yourself"
                              : members?.find((member) => member._id === repliedToMessage.from)?.name || "Unknown"}
                          </div>
                          <div className="text-[#999] truncate break-words w-48 text-[10px]">
                            {repliedToMessage.text}
                          </div>
                        </div>
                      )}

                      {/* Bubble + side smiley */}
                      {m.deletedAt ? (
                        <div className={`flex items-center gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                          <div className="rounded-lg px-3 py-2 text-xs border border-[#2E2E2E] bg-transparent select-none">
                            <div className="flex items-center gap-1.5 italic text-[#6E6E6E]">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                              <span>{mine ? "You deleted this message" : "This message was deleted"}</span>
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
                                if (!attachment.fileUrl) {
                                  return (
                                    <div
                                      key={attachment._id || attIndex}
                                      className="flex items-center gap-1.5 text-[11px] text-white/50 italic px-1.5"
                                    >
                                      <Paperclip className="h-3 w-3 shrink-0" />
                                      {attachment.fileName}
                                    </div>
                                  );
                                }
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
                                      // `isolate` keeps the thumbnail's z-20 hover overlay inside it,
                                      // so the bubble's z-10 menu chevron stays clickable.
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
                                    <div className="text-white/70">{getFileIcon(attachment.fileType)}</div>
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
                            message is a special marker (location/contact) */}
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
                            corner (WhatsApp, as in group chat). An invisible copy of the
                            metadata reserves room at the end of the last line so the text
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

                        {/* Attachments are now rendered ABOVE the text content */}
                      </LongPressDiv>

                      {/* Side smiley reaction button */}
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
                      </div>
                      )}
                      {/* Reactions display (hidden on deleted messages) */}
                      {!m.deletedAt && (
                        <MessageReactions
                          messageId={m._id}
                          meId={me}
                          align={mine ? "right" : "left"}
                          reactions={m.reactions}
                          onReact={(emoji) => reactToMessage(m._id, emoji)}
                          userMap={Object.fromEntries(
                            (members || []).map(u => [u._id || u.id, { name: u.name, email: u.email, profilePicture: u.profilePicture }])
                          )}
                        />
                      )}


                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator — WhatsApp-style: their face and a bubble of
                dots ("typing…" is in the header). */}
            {typingUsers.length > 0 && (
              <div className="flex items-end gap-2 mt-3" aria-live="polite" aria-label="typing…">
                <Avatar className="w-7 h-7 border border-[#2E2E2E] bg-[#282828] shrink-0">
                  <AvatarImage src={otherUser?.profilePicture || ""} />
                  <AvatarFallback className="text-[10px] text-white font-semibold bg-[#2E2E2E]">
                    {(otherUser?.name || otherUser?.email || typingUsers[0]?.userName || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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

            {/* OpenClaw AI thinking indicator */}
            {isOpenClawThinking && (
              <div className="flex gap-2 mt-3">
                <div className="relative flex-shrink-0">
                  <Avatar className="w-7 h-7 border border-violet-500/30 bg-[#282828]">
                    <AvatarFallback className="text-[8px] text-white font-bold bg-violet-600">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-violet-500 border border-[#0c0c11] animate-pulse" />
                </div>
                <div className="bg-[#1F1F1F] border border-[#2E2E2E] text-white rounded-lg px-3 py-2.5 text-[10px]">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-0.5">
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[#6E6E6E] text-[10px]">{agentName || "Ai Employee"} is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div
        className="shrink-0 z-20 px-3 pb-3 pt-2 bg-[#0e0e12]"
        style={{ marginBottom: keyboardOffset > 0 ? `${keyboardOffset}px` : undefined }}
      >
        <div className="flex flex-col gap-1.5">
          {editingMessage && (
            <div className="mb-2 p-2 bg-[#181818] border-l-2 border-brand-2/70 rounded-md overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-brand-2 font-medium flex items-center gap-1">
                    <Edit3 className="h-2.5 w-2.5" />
                    Editing message
                  </div>
                  <div className="text-[10px] text-[#999] truncate break-words">
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
          {replyToMsg && !editingMessage && (
            <div className="mb-2 p-2 bg-[#181818] border-l-2 border-brand-2/70 rounded-md overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-brand-2 font-medium">
                    Replying to{" "}
                    {replyToMsg.from === me
                      ? "yourself"
                      : otherUser?.name || "Unknown"}
                  </div>
                  <div className="text-[10px] text-[#999] truncate break-words">
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
                        src={URL.createObjectURL(file)}
                        type={file.type}
                        alt={file.name}
                        className="h-20 w-20"
                        onClick={() => {
                          setMediaPreview({
                            url: URL.createObjectURL(file),
                            type: file.type,
                            name: file.name,
                          });
                        }}
                      />
                    ) : (
                      <div className="text-white/70">
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
                      className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input controls - Figma pill layout */}
          <div className="flex flex-col gap-1.5">
            {/* Floating formatting toolbar */}
            <FormatToolbar inputRef={inputRef} value={text} onChange={setText} />

            {/* Main pill row: input + emoji + attach + send */}
            <div className="flex items-center gap-2">
              {/* Pill input */}
              <div className="relative flex-1 flex items-center gap-1.5 rounded-[18px] border border-[#2E2E2E] bg-[#181818] px-3 py-2 min-h-[38px]">
                {/* Slash command menu anchored above */}
                {!isOpenClaw && (
                  <SlashCommandMenu
                    open={slash.menuOpen}
                    commands={slash.filteredCommands}
                    selectedIndex={slash.selectedIndex}
                    onSelect={slash.selectCommand}
                    onClose={slash.closeMenu}
                    anchorRef={inputRef}
                  />
                )}
                <textarea
                  ref={inputRef}
                  placeholder="Write a message..."
                  value={text}
                  onChange={(e) => {
                    if (e.target.value.replace(/\s/g, "").length > 2000) return;
                    setText(e.target.value);
                    if (!isOpenClaw) slash.handleInputChange(e.target.value);
                    handleTyping(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (!isOpenClaw && slash.handleKeyDown(e)) return;
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
                  className="flex-1 w-full min-w-0 text-[12px] bg-transparent text-white min-h-[20px] max-h-[120px] resize-none placeholder:text-[#6E6E6E] focus:outline-none overflow-y-auto leading-relaxed"
                  rows={1}
                />
                {/* Emoji + Attachment inside pill */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <EmojiPickerComponent
                    onEmojiSelect={handleEmojiSelect}
                    align="right"
                    width={isMini ? 260 : 320}
                    height={isMini ? 280 : 400}
                  />
                  <FileAttachment onFileSelect={handleFileSelect} />
                </div>
              </div>

              {/* Send button outside pill */}
              <button
                onClick={send}
                disabled={(!text.trim() && attachedFiles.length === 0) || isSending}
                className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-full bg-[#1C1C1E] border border-[#2C2C2E] text-white/70 hover:text-white hover:bg-[#2C2C2E] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Send"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Secondary toolbar — extra features in a slim icon row */}
            <div className="flex items-center gap-0.5 px-1">
              <VoiceRecorder
                onRecordingComplete={handleFileSelect}
                onSend={async (file) => {
                  handleFileSelect(file);
                  setTimeout(() => send(), 100);
                }}
              />
              <VideoMessageRecorder
                onRecordingComplete={handleFileSelect}
                onSend={async (file) => {
                  handleFileSelect(file);
                  setTimeout(() => send(), 100);
                }}
              />
              {!isOpenClaw && (
                <>
                  <GifPicker onShare={sendMarker} />
                  <LocationShareButton onShare={sendMarker} />
                  <ContactShareButton
                    members={members.map((m) => ({
                      id: m._id,
                      name: m.name,
                      email: m.email,
                      profilePicture: m.profilePicture,
                      role: (m as any).role,
                    }))}
                    excludeIds={[me, otherId]}
                    onShare={sendMarker}
                  />
                </>
              )}
              <div className="hidden sm:block">
                <ScreenRecorder
                  onRecordingComplete={handleFileSelect}
                  onSend={async (file) => {
                    handleFileSelect(file);
                    setTimeout(() => send(), 100);
                  }}
                  target={{
                    type: "dm",
                    id: otherId,
                    name: otherUser?.name || otherUser?.email || "DM",
                  }}
                />
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

      {/* Slash-command form (task, poll, meet, …). Hidden for AI agent chats. */}
      {!isOpenClaw && (
        <SlashCommandForm
          command={slash.activeCommand}
          orgId={orgId || undefined}
          members={members
            .filter((m) => m._id !== me)
            .map((m) => ({ id: m._id, name: m.name, email: m.email }))}
          // DM is 1-on-1 — the only sensible assignee is the other user.
          lockedAssignee={
            otherUser
              ? {
                  id: otherUser._id,
                  name: otherUser.name,
                  email: otherUser.email,
                }
              : undefined
          }
          onSubmit={(encoded) => {
            sendMarker(encoded);
            slash.closeForm();
          }}
          onClose={slash.closeForm}
        />
      )}

      {/* Media Gallery Popup */}
      {showMediaGallery && (
        <div className="absolute top-0 right-0 w-full h-full bg-[#0e0e12] border-l border-[#2E2E2E] overflow-hidden z-30">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#007AFF]" />
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
                      Files shared in this chat will appear here
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
                        className="relative aspect-square rounded-lg overflow-hidden border border-[#2a2a35] bg-[#15151b] cursor-pointer hover:border-blue-400 transition-colors group"
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
  );
}

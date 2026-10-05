// Global DM Page - Cross-organization direct messaging

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { connectSocket, getSocket } from "@/lib/socket";
import { globalDmConvId } from "@/lib/conv";
import { Button } from "@/components/ui/button";
import { useChat } from "@/lib/chat-context";
import {
  Send,
  Image as ImageIcon,
  FileText,
  Download,
  Trash2,
  Edit3,
  Reply,
  X,
  Loader2,
  ExternalLink,
  ArrowLeft,
  MoreVertical,
  Pin,
  Forward,
  Paperclip,
  Check,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPickerComponent } from "@/components/ui/emoji-picker";
import { FileAttachment, FilePreview } from "@/components/ui/file-attachment";
import { VoiceRecorder } from "@/components/ui/voice-recorder";
import { VoiceMessagePlayer } from "@/components/ui/voice-message-player";
import { ScreenRecorder } from "@/components/ui/screen-recorder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkPreview } from "@/components/ui/link-preview";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { extractUrls } from "@/lib/url-utils";
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
import { hasMarker } from "@/lib/chat-markers";
import { toast } from "sonner";
import { Member } from "@/app/(dashboard)/layout";
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

type Msg = {
  _id: string;
  convId: string;
  from: string;
  to: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
  tempId?: string;
  attachments?: FileAttachmentType[];
  replyTo?: string;
  editedAt?: string;
};

type FileAttachmentType = {
  _id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
};

type GlobalUser = {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
  city?: string;
  state?: string;
  country?: string;
};

export default function GlobalDMPage({
  id,
  onClose,
  otherUserData,
  isMini = false,
  onTypingLabelChange,
}: {
  id: string;
  onClose?: () => void;
  otherUserData?: GlobalUser | null;
  isMini?: boolean;
  /** "typing…" for a host that draws its own header (the mini window). */
  onTypingLabelChange?: (label: string | null) => void;
}) {
  const otherId = id;
  const me = getUserIdFromToken()!;
  const convId = useMemo(() => globalDmConvId(me, otherId), [me, otherId]);

  const { setActiveConvId, clearGlobalDmUnread, draftTexts, setDraftTexts, draftFiles, setDraftFiles } = useChat();

  const chatKey = `global-dm_${otherId}`;

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

  const [otherUser, setOtherUser] = useState<GlobalUser | null>(otherUserData || null);
  const otherUserRef = useRef<GlobalUser | null>(otherUser);
  useEffect(() => {
    otherUserRef.current = otherUser;
  }, [otherUser]);
  const [meUser, setMeUser] = useState<GlobalUser | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [items, setItems] = useState<Msg[]>([]);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    setScrolledToBottom(false);
  }, [otherId]);
  const lastLoadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const draftKey = `chat_draft_global-dm_${otherId}`;
    const savedDraft = localStorage.getItem(draftKey) || "";
    if (savedDraft && !draftTexts[chatKey]) {
      setText(savedDraft);
    }
    lastLoadedIdRef.current = otherId;
  }, [otherId]);

  useEffect(() => {
    if (lastLoadedIdRef.current !== otherId) return;
    const draftKey = `chat_draft_global-dm_${otherId}`;
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
  const [replyToMsg, setReplyToMsg] = useState<Msg | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  // States aligned with DMPage
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [mobileMenuMessageId, setMobileMenuMessageId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardText, setForwardText] = useState("");
  const [forwardTargets, setForwardTargets] = useState<ForwardTarget[]>([]);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { typingUsers, handleTyping, stopTyping, removeTypingUser } =
    useTypingIndicator({
      startEvent: "global-dm:typing",
      stopEvent: "global-dm:stopTyping",
      payload: { otherId },
      // Only the person this chat is with — the socket also sits in the rooms
      // of chats opened earlier, and their typing arrives here too.
      accepts: (e) => e.userId === otherId,
      bottomRef,
    });
  const otherTyping = typingUsers.length > 0;
  useEffect(() => {
    onTypingLabelChange?.(otherTyping ? "typing…" : null);
  }, [otherTyping, onTypingLabelChange]);
  useEffect(() => () => onTypingLabelChange?.(null), [onTypingLabelChange]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pasteProcessingRef = useRef<boolean>(false);

  const pinnedMsgIds = usePinnedIds();
  const pinnedMessages = items.filter((m) => pinnedMsgIds.includes(m._id));

  // Cross-org chat — only commands flagged orgOnly:false are visible.
  const slash = useSlashCommands({
    chatType: "global-dm",
    onClearTrigger: () => {
      setText((prev) => prev.replace(/(?:^|\n)\/\w*$/, "").trimEnd());
    },
  });

  useSlashCardSync();

  const sendMarker = (encoded: string) => {
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
      "global-dm:message",
      { otherId, text: encoded, tempId },
      (ack: { ok?: boolean; error?: string }) => {
        if (!ack?.ok) {
          console.error("[CLIENT] global-dm sendMarker ack error", ack?.error);
          toast.error("Failed to share");
        }
      }
    );
  };

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

  // Fetch other user's profile if not provided
  useEffect(() => {
    if (!otherUserData) {
      api<{ user: GlobalUser }>(
        `/users/discover/${otherId}`,
        {},
        getToken()!
      )
        .then((res) => setOtherUser(res.user))
        .catch(console.error);
    }
  }, [otherId, otherUserData]);

  // Fetch current user's profile for avatar display
  useEffect(() => {
    api<{ user: GlobalUser }>(
      `/users/discover/${me}`,
      {},
      getToken()!
    )
      .then((res) => setMeUser(res.user))
      .catch(console.error);
  }, [me]);

  // Load message history
  useEffect(() => {
    (async () => {
      const res = await api<{ items: Msg[]; nextCursor: string | null }>(
        `/global-dm/${otherId}/messages`,
        {},
        getToken()!
      );
      setItems(res.items || []);
      setNextCursor(res.nextCursor);
      setHasMoreMessages((res.items || []).length >= 40);
      setTimeout(
        () => {
          bottomRef.current?.scrollIntoView({ behavior: "auto" });
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
      const res = await api<{ items: Msg[]; nextCursor: string | null }>(
        `/global-dm/${otherId}/messages?cursor=${nextCursor}`,
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

  // Mark messages as read when opening conversation
  useEffect(() => {
    api(
      `/global-dm/${otherId}/read`,
      { method: "POST", body: JSON.stringify({}) },
      getToken()!
    ).catch(console.error);

    api(
      `/user-notifications/global-dm/${otherId}`,
      { method: "DELETE" },
      getToken()!
    )
      .then(() => {
        window.dispatchEvent(new CustomEvent("notifications:refresh"));
      })
      .catch(console.error);

    clearGlobalDmUnread(otherId);
    setActiveConvId(convId);

    return () => {
      setActiveConvId(undefined);
    };
  }, [convId, otherId, setActiveConvId, clearGlobalDmUnread]);

  // Socket listeners for real-time messaging
  useEffect(() => {
    const s = connectSocket();

    const join = () => s.emit("global-dm:join", { otherId });
    if (s.connected) join();
    s.on("connect", join);
    s.on("reconnect", join);

    const onMsg = (m: Msg) => {
      if (m.convId !== convId) return;

      // Their message has landed, so they're no longer typing it.
      if (m.from === otherId) removeTypingUser(otherId);

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
        setItems((prev) => {
          if (prev.some((x) => x._id === m._id)) return prev;
          return [...prev, m];
        });
      }

      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      if (m.to === me) {
        api(
          `/global-dm/${otherId}/read`,
          { method: "POST", body: JSON.stringify({ upTo: m.createdAt }) },
          getToken()!
        ).catch(console.error);
      }

      if (
        m.from !== me &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const senderName = otherUserRef.current?.name || otherUserRef.current?.email || "Someone";
        const messagePreview = m.text
          ? m.text.length > 50
            ? m.text.substring(0, 50) + "..."
            : m.text
          : m.attachments && m.attachments.length > 0
          ? `Sent ${m.attachments.length} file${m.attachments.length > 1 ? "s" : ""}`
          : "New message";

        try {
          const notification = new Notification(`Global: ${senderName}`, {
            body: messagePreview,
            icon: otherUserRef.current?.profilePicture || undefined,
            tag: `global-dm-${m.convId}`,
          });
          setTimeout(() => notification.close(), 5000);
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch (error) {
          console.error("Failed to show notification:", error);
        }
      }
    };

    const onEdited = (data: { messageId: string; text: string; editedAt: string; convId: string }) => {
      if (data.convId !== convId) return;
      setItems((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, text: data.text, editedAt: data.editedAt }
            : msg
        )
      );
    };

    const onDeleted = (data: { messageId: string; convId: string }) => {
      if (data.convId !== convId) return;
      setItems((prev) => prev.filter((msg) => msg._id !== data.messageId));
      messageExtras.removeMessage(data.messageId);
    };

    s.on("global-dm:message", onMsg);
    s.on("global-dm:edited", onEdited);
    s.on("global-dm:deleted", onDeleted);

    return () => {
      s.off("connect", join);
      s.off("reconnect", join);
      s.off("global-dm:message", onMsg);
      s.off("global-dm:edited", onEdited);
      s.off("global-dm:deleted", onDeleted);
    };
  }, [otherId, convId, me]); // otherUser removed from deps

  // Upload file to S3
  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

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
      throw new Error("Upload failed");
    }

    const data = await response.json();
    return data.url;
  };

  // Send message
  async function send() {
    const s = getSocket();
    const t = text.trim();

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
    if (isSending) return;

    setIsSending(true);

    const tempId = `tmp_${Date.now()}`;
    const filesToUpload = [...attachedFiles];

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
    setReplyToMsg(null);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    stopTyping();

    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      10
    );

    try {
      if (filesToUpload.length > 0) {
        const uploadPromises = filesToUpload.map((file) => uploadFile(file));
        const uploadedUrls = await Promise.all(uploadPromises);

        s.emit(
          "global-dm:message",
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
              console.error("[CLIENT] global-dm:message ack error", ack?.error);
            }
          }
        );
      } else {
        s.emit(
          "global-dm:message",
          {
            otherId,
            text: t,
            tempId,
            replyTo: replyToMsg?._id,
          },
          (ack: any) => {
            setIsSending(false);
            if (!ack?.ok) {
              console.error("[CLIENT] global-dm:message ack error", ack?.error);
            }
          }
        );
      }
    } catch (error) {
      console.error("File upload failed:", error);
      s.emit(
        "global-dm:message",
        {
          otherId,
          text: t,
          tempId,
          replyTo: replyToMsg?._id,
        },
        (ack: any) => {
          setIsSending(false);
        }
      );
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  const handleFileSelect = (file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
  };

  const handlePaste = (e: ClipboardEvent) => {
    if (pasteProcessingRef.current) return;
    pasteProcessingRef.current = true;

    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            setAttachedFiles((prev) => [...prev, file]);
          }
        }
      }
    }

    setTimeout(() => {
      pasteProcessingRef.current = false;
    }, 100);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const editMessage = async (messageId: string, newText: string) => {
    try {
      const response = await api(
        `/global-dm/message/${messageId}`,
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

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await api(
        `/global-dm/message/${messageId}`,
        { method: "DELETE" },
        getToken()!
      );

      if ((response as any).ok) {
        setItems((prev) => prev.filter((msg) => msg._id !== messageId));
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

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
        "global-dm:message",
        { otherId: target.id, text: body, tempId },
        (ack: any) => {
          if (!ack?.ok) {
            console.error("[CLIENT] forward global-dm ack error", ack?.error);
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
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const formatDateLabel = (dateString: string): string => {
    const messageDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

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

  const isDifferentDay = (date1: string, date2: string): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate()
    );
  };

  const handleReplyToMessage = (message: Msg) => {
    setReplyToMsg(message);
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

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!text && inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [text]);

  return (
    <div
      className="relative h-full overflow-hidden bg-[#0e0e12] flex flex-col"
      onClick={() => activeMenuMessageId && setActiveMenuMessageId(null)}
    >
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
            {otherUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="cursor-pointer hover:opacity-85 transition-opacity">
                    <Avatar className="shrink-0 w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
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
              <Avatar className="shrink-0 w-8 h-8 border border-[#2E2E2E] bg-[#282828]">
                <AvatarImage src={otherUser?.profilePicture || ""} />
                <AvatarFallback className="text-xs text-white font-medium bg-[#2E2E2E]">
                  {otherUser?.name?.charAt(0) ||
                    otherUser?.email?.charAt(0) ||
                    "?"}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium truncate text-white flex items-center gap-1.5">
                {otherUser?.name || otherUser?.email || "Unknown"}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
                  Global
                </span>
              </div>
              <div className={cn("text-[10px] truncate", otherTyping ? "text-brand" : "text-[#6E6E6E]")}>
                {otherTyping
                  ? "typing…"
                  : otherUser?.city
                  ? [otherUser.city, otherUser.state, otherUser.country].filter(Boolean).join(", ")
                  : "Global Contact"}
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
              {otherUser ? (
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
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-[11px] font-medium truncate text-white">
                    {otherUser?.name || otherUser?.email || "Unknown"}
                  </div>
                  <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full font-medium">
                    Global
                  </span>
                </div>
                <div className={cn("text-[10px]", otherTyping ? "text-brand" : "text-[#6E6E6E]")}>
                  {otherTyping
                    ? "typing…"
                    : otherUser?.city
                    ? [otherUser.city, otherUser.state, otherUser.country].filter(Boolean).join(", ")
                    : "Global Contact"}
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
              const repliedToMessage = m.replyTo
                ? (typeof m.replyTo === "object"
                  ? (m.replyTo as any)
                  : items.find((item) => item._id === m.replyTo))
                : null;

              const prevMessage = index > 0 ? items[index - 1] : null;
              const isConsecutive = prevMessage && prevMessage.from === m.from;

              const showDateSeparator =
                index === 0 ||
                (prevMessage && isDifferentDay(prevMessage.createdAt, m.createdAt));

              const isSelected = selectedIds.has(m._id);

              const menuCtx = {
                messageId: m._id,
                text: stripForwarded(m.text),
                isMine: mine,
                canEdit: mine && canEditMessage(m, mine).ok,
                canDelete: mine,
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
                        {!mine && otherUser ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="cursor-pointer hover:opacity-85 transition-opacity">
                                <Avatar className="w-9 h-9 border border-[#2E2E2E] bg-[#282828]">
                                  <AvatarImage
                                    src={
                                      mine
                                        ? meUser?.profilePicture || ""
                                        : otherUser?.profilePicture || ""
                                    }
                                  />
                                  <AvatarFallback className="text-xs text-white font-bold bg-[#2E2E2E]">
                                    {mine
                                      ? meUser?.name?.charAt(0) || meUser?.email?.charAt(0) || "Me"
                                      : otherUser?.name?.charAt(0) || otherUser?.email?.charAt(0) || "?"}
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
                          <Avatar className="w-9 h-9 border border-[#2E2E2E] bg-[#282828]">
                            <AvatarImage
                              src={
                                mine
                                  ? meUser?.profilePicture || ""
                                  : otherUser?.profilePicture || ""
                              }
                            />
                            <AvatarFallback className="text-xs text-white font-bold bg-[#2E2E2E]">
                              {mine
                                ? meUser?.name?.charAt(0) || meUser?.email?.charAt(0) || "Me"
                                : otherUser?.name?.charAt(0) || otherUser?.email?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}

                    {isConsecutive && !mine && <div className="w-9 mr-2" />}

                    <div className={cn(
                      "flex min-w-0 flex-col",
                      mine ? "items-end" : "items-start",
                      isMini ? "max-w-[80%]" : "max-w-[65%]"
                    )}>
                      {/* Reply Indicator */}
                      {repliedToMessage && (
                        <div className="mb-1 px-2 py-1 rounded-md bg-[#1F1F1F] border-l-2 border-brand-2/70 text-xs overflow-hidden mr-2">
                          <div className="text-brand-2 text-[10px] font-medium">
                            Replying to{" "}
                            {repliedToMessage.from === me
                              ? "yourself"
                              : otherUser?.name || "Unknown"}
                          </div>
                          <div className="text-[#999] truncate break-words w-48 text-[10px]">
                            {repliedToMessage.text}
                          </div>
                        </div>
                      )}

                      {/* Bubble + side smiley */}
                      <div className={`flex max-w-full items-center gap-1.5 ${mine ? "flex-row-reverse" : "flex-row"}`}>
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

                          {isForwardedText(m.text) && (
                            <div className="flex items-center gap-1 text-[10px] italic text-white/60 mb-0.5">
                              <Forward className="h-2.5 w-2.5" />
                              <span>Forwarded</span>
                            </div>
                          )}

                          {/* Attachments preview */}
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
                        </LongPressDiv>

                        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <QuickReactionButton
                            messageId={m._id}
                            meId={me}
                            openTo={mine ? "left" : "right"}
                          />
                        </div>
                      </div>

                      {/* Reactions display */}
                      <MessageReactions
                        messageId={m._id}
                        meId={me}
                        align={mine ? "right" : "left"}
                        userMap={Object.fromEntries(
                          (members || []).map(u => [u._id || u.id, { name: u.name, email: u.email, profilePicture: u.profilePicture }])
                        )}
                      />
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
            <div className="mb-1 p-2 bg-[#181818] border-l-2 border-brand-2/70 rounded-md overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-brand-2 font-medium flex items-center gap-1">
                    <Edit3 className="h-2.5 w-2.5" />
                    Editing message
                  </div>
                  <div className="text-[10px] text-[#999] truncate break-words">
                    {stripForwarded(items.find((x) => x._id === editingMessage)?.text || "")}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setEditingMessage(null); setEditingText(""); setText(""); }} className="h-5 w-5 p-0 text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E]">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {replyToMsg && !editingMessage && (
            <div className="mb-1 p-2 bg-[#181818] border-l-2 border-brand-2/70 rounded-md overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-brand-2 font-medium">
                    Replying to {replyToMsg.from === me ? "yourself" : otherUser?.name || "Unknown"}
                  </div>
                  <div className="text-[10px] text-[#999] truncate break-words">{stripForwarded(replyToMsg.text)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setReplyToMsg(null)} className="h-5 w-5 p-0 text-[#6E6E6E] hover:text-white hover:bg-[#2E2E2E]">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {text && extractUrls(text).length > 0 && (
            <div className="mb-1">
              {extractUrls(text).map((url, idx) => (<LinkPreview key={idx} url={url} />))}
            </div>
          )}

          {attachedFiles.length > 0 && (
            <div className="mb-1 space-y-1">
              {attachedFiles.map((file, index) => {
                const isImage = file.type?.startsWith("image/");
                const isVideo = file.type?.startsWith("video/");
                const isMedia = isImage || isVideo;
                return (
                  <div key={`${file.name}-${index}`} className="flex items-center gap-2 p-1.5 rounded-md border bg-white/5 border-white/10">
                    {isMedia ? (
                      <MediaThumbnail src={URL.createObjectURL(file)} type={file.type} alt={file.name} className="h-20 w-20" onClick={() => setMediaPreview({ url: URL.createObjectURL(file), type: file.type, name: file.name })} />
                    ) : (
                      <div className="text-white/70">{getFileIcon(file.type)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate text-white">{file.name}</div>
                      <div className="text-[10px] text-white/60">{formatFileSize(file.size)}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeAttachedFile(index); }} className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input controls - Figma pill layout */}
          <div className="flex flex-col gap-1.5">
            <FormatToolbar inputRef={inputRef} value={text} onChange={setText} />

            {/* Main pill row */}
            <div className="flex items-center gap-2">
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
                  placeholder="Write a message..."
                  value={text}
                  onChange={(e) => {
                    if (e.target.value.replace(/\s/g, "").length > 2000) return;
                    setText(e.target.value);
                    slash.handleInputChange(e.target.value);
                    handleTyping(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (slash.handleKeyDown(e)) return;
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
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
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <EmojiPickerComponent onEmojiSelect={handleEmojiSelect} align="right" width={isMini ? 260 : 320} height={isMini ? 280 : 320} />
                  <FileAttachment onFileSelect={handleFileSelect} />
                </div>
              </div>

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
                members={members.map((m) => ({ id: m._id, name: m.name, email: m.email, profilePicture: m.profilePicture, role: (m as any).role }))}
                excludeIds={[me, otherId]}
                onShare={sendMarker}
              />
              <div className="hidden sm:block">
                <ScreenRecorder onRecordingComplete={handleFileSelect} onSend={async (file) => { handleFileSelect(file); setTimeout(() => send(), 100); }} target={{ type: "dm", id: otherId, name: otherUser?.name || otherUser?.email || "Global DM" }} />
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

      {/* Slash-command form */}
      <SlashCommandForm
        command={slash.activeCommand}
        members={[]}
        onSubmit={(encoded) => {
          sendMarker(encoded);
          slash.closeForm();
        }}
        onClose={slash.closeForm}
      />

      {/* Media Gallery Popup */}
      {showMediaGallery && (
        <div className="absolute top-0 right-0 w-full h-full bg-[#0e0e12] border-l border-[#2E2E2E] overflow-hidden z-30">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#007AFF]" />
              <h3 className="text-sm font-semibold text-white">Media & Files</h3>
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
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

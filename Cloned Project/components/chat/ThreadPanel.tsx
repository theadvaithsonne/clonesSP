"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { connectSocket, getSocket } from "@/lib/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Send, X, Check, Loader2 } from "lucide-react";

type Attachment = {
  _id?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
};

type ThreadMsg = {
  _id: string;
  groupId: string;
  from: string | null;
  text: string;
  attachments?: Attachment[];
  mentions?: string[];
  replyTo?: string;
  threadId?: string | null;
  threadResolved?: boolean;
  replyCount?: number;
  createdAt: string;
  tempId?: string;
  agentMeta?: { agentId: string; agentName: string };
};

type MemberLite = {
  id: string;
  name?: string;
  email: string;
  profilePicture?: string;
};

type Props = {
  groupId: string;
  parentMessage: ThreadMsg;
  userMap: Record<string, MemberLite>;
  onClose: () => void;
  onParentUpdated?: (update: {
    replyCount?: number;
    threadResolved?: boolean;
    lastThreadReply?: { text?: string; from?: string; createdAt?: string };
    threadParticipants?: string[];
  }) => void;
};

export default function ThreadPanel({
  groupId,
  parentMessage,
  userMap,
  onClose,
  onParentUpdated,
}: Props) {
  const me = getUserIdFromToken()!;
  const [parent, setParent] = useState<ThreadMsg>(parentMessage);
  const [replies, setReplies] = useState<ThreadMsg[]>([]);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setParent(parentMessage);
  }, [parentMessage._id, parentMessage]);

  // Fetch thread replies on open
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await api<{ parent: ThreadMsg; items: ThreadMsg[] }>(
          `/groups/${groupId}/thread/${parentMessage._id}`,
          {},
          getToken()!
        );
        if (cancelled) return;
        if (res.parent) setParent(res.parent);
        setReplies(res.items || []);
        setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "auto" }),
          10
        );
      } catch (err) {
        console.error("[ThreadPanel] Failed to load thread:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, parentMessage._id]);

  // Listen for real-time thread events
  useEffect(() => {
    const s = connectSocket();

    const onReply = (m: ThreadMsg) => {
      if (m.groupId !== groupId) return;
      if (m.threadId !== parentMessage._id) return;
      setReplies((prev) => {
        if (m.tempId) {
          const i = prev.findIndex((x) => x.tempId === m.tempId);
          if (i >= 0) {
            const copy = [...prev];
            copy[i] = m;
            return copy;
          }
        }
        if (prev.some((x) => x._id === m._id)) return prev;
        return [...prev, m];
      });
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        10
      );
    };

    const onUpdate = (u: {
      groupId: string;
      messageId: string;
      replyCount?: number;
      threadResolved?: boolean;
      lastThreadReply?: any;
      threadParticipants?: string[];
    }) => {
      if (u.groupId !== groupId) return;
      if (u.messageId !== parentMessage._id) return;
      setParent((p) => ({
        ...p,
        replyCount: u.replyCount ?? p.replyCount,
        threadResolved: u.threadResolved ?? p.threadResolved,
      }));
      onParentUpdated?.({
        replyCount: u.replyCount,
        threadResolved: u.threadResolved,
        lastThreadReply: u.lastThreadReply,
        threadParticipants: u.threadParticipants,
      });
    };

    s.on("group:thread-reply", onReply);
    s.on("group:thread-update", onUpdate);

    return () => {
      s.off("group:thread-reply", onReply);
      s.off("group:thread-update", onUpdate);
    };
  }, [groupId, parentMessage._id, onParentUpdated]);

  const labelFor = (userId: string | null | undefined) => {
    if (!userId) return "Unknown";
    if (userId === me) return "You";
    const u = userMap[userId];
    return u?.name || u?.email || userId.slice(0, 6);
  };

  const senderFor = (userId: string | null | undefined) =>
    userId ? userMap[userId] : undefined;

  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const send = () => {
    const t = text.trim();
    if (!t || isSending) return;

    setIsSending(true);
    const tempId = `tmp_thread_${Date.now()}`;

    const optimistic: ThreadMsg = {
      _id: tempId,
      tempId,
      groupId,
      from: me,
      text: t,
      threadId: parentMessage._id,
      createdAt: new Date().toISOString(),
    };
    setReplies((prev) => [...prev, optimistic]);
    setText("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      10
    );

    const s = getSocket();
    s.emit(
      "group:message",
      {
        groupId,
        text: t,
        tempId,
        threadId: parentMessage._id,
      },
      (ack: any) => {
        setIsSending(false);
        if (!ack?.ok) {
          console.error("[ThreadPanel] reply error:", ack?.error);
          setReplies((prev) => prev.filter((m) => m.tempId !== tempId));
          return;
        }
        setReplies((prev) =>
          prev.map((m) => (m.tempId === tempId ? ack.msg : m))
        );
      }
    );
  };

  const toggleResolved = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const res = await api<{ ok: boolean; threadResolved: boolean }>(
        `/groups/${groupId}/thread/${parentMessage._id}/resolve`,
        { method: "PATCH" },
        getToken()!
      );
      setParent((p) => ({ ...p, threadResolved: res.threadResolved }));
      onParentUpdated?.({ threadResolved: res.threadResolved });
    } catch (err) {
      console.error("[ThreadPanel] Failed to toggle resolved:", err);
    } finally {
      setIsToggling(false);
    }
  };

  const allMessages = useMemo(
    () => [{ ...parent, _isParent: true } as ThreadMsg & { _isParent?: boolean }, ...replies],
    [parent, replies]
  );

  const renderBubble = (m: ThreadMsg, isParent: boolean) => {
    const isAgentMsg = !!m.agentMeta;
    const mine = !isAgentMsg && m.from === me;
    const sender = senderFor(m.from);
    return (
      <div
        key={m._id}
        className={`flex gap-2 ${isParent ? "pb-3 mb-2 border-b border-[#2E2E2E]" : ""}`}
      >
        <div className="flex-shrink-0">
          {isAgentMsg ? (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-[10px] font-bold border border-violet-500/30">
              {m.agentMeta!.agentName?.charAt(0)?.toUpperCase() || "A"}
            </div>
          ) : (
            <Avatar className="w-7 h-7 border border-[#2E2E2E] bg-[#282828]">
              <AvatarImage src={sender?.profilePicture || ""} />
              <AvatarFallback className="text-xs text-white font-semibold bg-[#2E2E2E]">
                {sender?.name?.charAt(0) ||
                  sender?.email?.charAt(0) ||
                  (m.from ? m.from.charAt(0) : "?")}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-medium text-white">
              {isAgentMsg
                ? m.agentMeta!.agentName
                : mine
                ? "You"
                : sender?.name || sender?.email || labelFor(m.from)}
            </span>
            <span className="text-[10px] text-[#6E6E6E]">
              {timeOf(m.createdAt)}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-white whitespace-pre-wrap break-words">
            {m.text}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full md:w-[380px] bg-[#141418] border-l border-[#2E2E2E]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#2E2E2E]">
        <div className="text-sm font-semibold text-white">Thread</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleResolved}
            disabled={isToggling}
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
              parent.threadResolved
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-[#2E2E2E] text-white hover:bg-[#3a3a3a]"
            } disabled:opacity-60`}
            title={parent.threadResolved ? "Mark Unresolved" : "Mark Resolved"}
          >
            <Check className="h-3 w-3" />
            {parent.threadResolved ? "Resolved" : "Mark Resolved"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#999] hover:text-white hover:bg-[#2E2E2E]"
            aria-label="Close thread"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {renderBubble(parent, true)}

        <div className="text-[11px] text-[#6E6E6E] mb-2">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-[#6E6E6E]">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((m) => renderBubble(m, false))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-2 border-t border-[#2E2E2E]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            placeholder="Reply in thread…"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 text-sm bg-transparent border border-[#2E2E2E] text-white min-h-[36px] max-h-24 resize-none rounded-md px-3 py-2 placeholder:text-[#6E6E6E] focus-visible:ring-2 focus-visible:ring-[#007AFF]/10 focus-visible:border-[#5b2aa8] focus-visible:outline-none overflow-y-auto"
            rows={1}
          />
          <Button
            onClick={send}
            disabled={!text.trim() || isSending}
            className="h-9 px-3 bg-[#007AFF] hover:bg-[#0066DD] border border-[#007AFF]/60 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

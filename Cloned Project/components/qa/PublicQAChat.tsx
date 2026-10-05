"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Loader2, RotateCcw, Send } from "lucide-react";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

interface AgentInfo {
  agent_id: string;
  title: string;
  subtitle?: string | null;
  welcome_message?: string | null;
}

// Simple RFC4122-v4ish UUID. crypto.randomUUID is available in all
// modern browsers and in the Node runtime Next.js uses; fall back to
// a Math.random() string only if it's missing.
function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {}
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PublicQAChat({ agentId }: { agentId: string }) {
  const historyKey = useMemo(() => `qa:${agentId}:history`, [agentId]);
  const sessionKey = useMemo(() => `qa:${agentId}:session_id`, [agentId]);

  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Load persisted state from localStorage on mount ──
  useEffect(() => {
    try {
      const rawHist = localStorage.getItem(historyKey);
      if (rawHist) {
        const parsed = JSON.parse(rawHist);
        if (Array.isArray(parsed)) setMessages(parsed.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"));
      }
      let sid = localStorage.getItem(sessionKey);
      if (!sid) {
        sid = newSessionId();
        localStorage.setItem(sessionKey, sid);
      }
      setSessionId(sid);
    } catch {
      // localStorage unavailable (private mode, etc) — fall back to ephemeral
      setSessionId(newSessionId());
    }
  }, [historyKey, sessionKey]);

  // ── Fetch info (branding) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/openclaw/qa/${agentId}/info`);
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 404) setInfoError("Assistant not found.");
          else setInfoError("Assistant unavailable. Please try again later.");
          setInfoLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setInfo(data);
        setInfoLoading(false);
      } catch {
        if (cancelled) return;
        setInfoError("Assistant unavailable. Please try again later.");
        setInfoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  // ── Persist messages on change ──
  useEffect(() => {
    if (!messages.length) return;
    try {
      localStorage.setItem(historyKey, JSON.stringify(messages));
    } catch {}
  }, [messages, historyKey]);

  // ── Auto-scroll on new content ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    try {
      localStorage.removeItem(historyKey);
      const fresh = newSessionId();
      localStorage.setItem(sessionKey, fresh);
      setSessionId(fresh);
    } catch {
      setSessionId(newSessionId());
    }
  }, [historyKey, sessionKey]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !sessionId) return;

    setError(null);
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch(`/api/openclaw/qa/${agentId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          // Only forward the prior turns — the current user message is
          // sent as `message`, not as the last history entry.
          history: messages,
          session_id: sessionId,
        }),
      });

      if (!res.ok || !res.body) {
        // Try to extract a visitor-safe detail string from the error body.
        let detail = "Something went wrong. Please try again.";
        try {
          const err = await res.json();
          if (typeof err?.detail === "string") detail = err.detail;
        } catch {}
        setError(detail);
        // Roll back the empty assistant placeholder.
        setMessages(nextHistory);
        setIsStreaming(false);
        return;
      }

      // Parse SSE frames and append delta.content to the last assistant message.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 2);

          // Each SSE frame may contain multiple "data: …" lines. Extract
          // each one and try to parse JSON; anything that doesn't parse
          // as OpenAI-style chunk shape is silently skipped.
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed?.error) {
                setError(typeof parsed.message === "string" ? parsed.message : "Rate limit or upstream error.");
                continue;
              }
              const delta =
                parsed?.choices?.[0]?.delta?.content ??
                parsed?.choices?.[0]?.message?.content ??
                "";
              if (typeof delta === "string" && delta) {
                assistantContent += delta;
                setMessages((prev) => {
                  const copy = prev.slice();
                  copy[copy.length - 1] = { role: "assistant", content: assistantContent };
                  return copy;
                });
              }
            } catch {
              // non-JSON SSE frame, skip
            }
          }
        }
      }

      // If we never received any content, show a friendly message.
      if (!assistantContent) {
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = {
            role: "assistant",
            content: "_No response received. Please try again._",
          };
          return copy;
        });
      }
    } catch {
      setError("Connection interrupted. Please try again.");
      setMessages(nextHistory);
    } finally {
      setIsStreaming(false);
    }
  }, [agentId, input, isStreaming, messages, sessionId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (infoLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (infoError || !info) {
    return (
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="max-w-md text-center space-y-3">
          <Bot className="h-12 w-12 text-[#9fa0b8] mx-auto" />
          <h1 className="text-lg font-semibold text-white">
            {infoError || "Assistant unavailable"}
          </h1>
          <p className="text-sm text-[#9fa0b8]">
            The link you followed may be incorrect, or the assistant owner may have
            disabled it.
          </p>
        </div>
      </div>
    );
  }

  // Render the assistant welcome as a pseudo-first-message if we have no
  // history yet and the owner configured one.
  const displayMessages: ChatMessage[] =
    messages.length === 0 && info.welcome_message
      ? [{ role: "assistant", content: info.welcome_message }]
      : messages;

  return (
    <div className="flex flex-col min-h-screen max-w-3xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <header className="flex items-center justify-between py-5 border-b border-[#2a2a35]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-brand/15 border border-brand/40 flex items-center justify-center flex-shrink-0">
            <Bot className="h-5 w-5 text-brand" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-white truncate">{info.title}</h1>
            {info.subtitle && (
              <p className="text-xs text-[#9fa0b8] truncate">{info.subtitle}</p>
            )}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            disabled={isStreaming}
            className="flex items-center gap-1.5 text-[11px] text-[#9fa0b8] hover:text-white px-2.5 py-1.5 rounded-md border border-[#2a2a35] hover:border-[#3a3a45] transition-colors disabled:opacity-50"
            title="Clear conversation"
          >
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        )}
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-6 space-y-4"
      >
        {displayMessages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-brand text-brand-foreground font-medium"
                  : "bg-[#16161f] text-[#d8d9eb] border border-[#2a2a35]"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="markdown-preview text-[13px] leading-[1.7]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content || "…"}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1].content && (
          <div className="flex justify-start">
            <div className="bg-[#16161f] border border-[#2a2a35] rounded-2xl px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-[#9fa0b8]" />
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-0 mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="pb-6 pt-2">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your question…"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg bg-[#16161f] border border-[#2a2a35] text-white placeholder:text-[#5a5a72] text-sm px-4 py-3 outline-none focus:border-brand/50 disabled:opacity-60 max-h-[160px]"
            style={{ minHeight: "48px" }}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="h-12 w-12 rounded-lg bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] text-brand-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            title="Send"
          >
            {isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#5a5a72] mt-2 text-center">
          This is an AI assistant. Responses may be inaccurate — verify important information.
        </p>
      </div>
    </div>
  );
}

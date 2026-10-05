"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Send, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { generateAskCabinetPrompt } from "@/lib/askCabinetUtils";
import { useAIProvider } from "@/lib/hooks/useAIProvider";
import AIProviderRequiredModal from "./AIProviderRequiredModal";
import AIProviderSelector from "./AIProviderSelector";

/**
 * Formats markdown text for display
 * Handles bold (**text**), links, and bullet points
 */
function FormattedAnswer({ text }: { text: string }) {
  // Split by lines and process each
  const lines = text.split("\n");

  return (
    <div className="text-xs text-gray-300 leading-relaxed space-y-1.5">
      {lines.map((line, idx) => {
        // Skip empty lines
        if (!line.trim()) return <div key={idx} className="h-1" />;

        // Handle bullet points
        if (
          line.trim().startsWith("•") ||
          line.trim().startsWith("-") ||
          line.trim().startsWith("*")
        ) {
          return (
            <div key={idx} className="flex gap-2">
              <span className="text-gray-500">•</span>
              <span className="flex-1">
                {formatInlineMarkdown(line.replace(/^[•\-\*]\s*/, ""))}
              </span>
            </div>
          );
        }

        // Handle numbered lists
        if (/^\d+\.\s/.test(line.trim())) {
          return (
            <div key={idx} className="flex gap-2">
              <span className="text-gray-500">{line.match(/^\d+\./)?.[0]}</span>
              <span className="flex-1">
                {formatInlineMarkdown(line.replace(/^\d+\.\s*/, ""))}
              </span>
            </div>
          );
        }

        // Regular line
        return <div key={idx}>{formatInlineMarkdown(line)}</div>;
      })}
    </div>
  );
}

/**
 * Formats inline markdown (bold, links)
 */
function formatInlineMarkdown(text: string) {
  // Replace **Link:** with just "Link:"
  let processed = text.replace(/\*\*Link:\*\*/gi, "Link:");

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;

  // Find all matches for bold and URLs
  const boldPattern = /\*\*([^*]+?)\*\*/g;
  const urlPattern = /(https?:\/\/[^\s\)\]\.,;:!?<>]+)/gi;

  type Match = {
    type: "bold" | "url";
    start: number;
    end: number;
    content: string;
  };
  const matches: Match[] = [];

  // Collect all bold matches
  let match;
  while ((match = boldPattern.exec(processed)) !== null) {
    matches.push({
      type: "bold",
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    });
  }

  // Collect all URL matches
  urlPattern.lastIndex = 0;
  while ((match = urlPattern.exec(processed)) !== null) {
    // Check if URL overlaps with any bold match
    const overlapsBold = matches.some(
      (m) =>
        m.type === "bold" &&
        match.index < m.end &&
        match.index + match[0].length > m.start
    );
    if (!overlapsBold) {
      matches.push({
        type: "url",
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }
  }

  // Sort by position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlaps (prioritize URLs)
  const finalMatches: Match[] = [];
  for (const m of matches) {
    const overlaps = finalMatches.some(
      (existing) => m.start < existing.end && m.end > existing.start
    );
    if (!overlaps) {
      finalMatches.push(m);
    }
  }

  // Build parts
  for (const match of finalMatches) {
    // Add text before match
    if (match.start > lastIndex) {
      const before = processed.substring(lastIndex, match.start);
      parts.push(...formatBoldInText(before));
    }

    // Add formatted match
    if (match.type === "bold") {
      parts.push(
        <strong
          key={`bold-${match.start}`}
          className="text-white font-semibold"
        >
          {match.content}
        </strong>
      );
    } else {
      parts.push(
        <a
          key={`url-${match.start}`}
          href={match.content}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline break-all"
        >
          {match.content}
        </a>
      );
    }

    lastIndex = match.end;
  }

  // Add remaining text
  if (lastIndex < processed.length) {
    const remaining = processed.substring(lastIndex);
    parts.push(...formatBoldInText(remaining));
  }

  return parts.length > 0 ? <>{parts}</> : <>{processed}</>;
}

/**
 * Formats bold text in a string
 */
function formatBoldInText(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const boldPattern = /\*\*([^*]+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <strong key={`bold-inline-${key++}`} className="text-white font-semibold">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Q&A Accordion component for asking questions about a file
 */
function FileQnAAccordion({
  fileId,
  fileName,
  itemId,
  messages,
  setMessages,
  question,
  setQuestion,
  sending,
  setSending,
  hasAnyKey,
  selectedProvider,
  onShowAPIKeyModal,
}: {
  fileId: string;
  fileName?: string;
  itemId: string;
  messages: AskMessage[];
  setMessages: (msgs: AskMessage[]) => void;
  question: string;
  setQuestion: (q: string | ((prev: string) => string)) => void;
  sending: boolean;
  setSending: (s: boolean) => void;
  hasAnyKey: boolean;
  selectedProvider: string | null;
  onShowAPIKeyModal: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
  }, [messages]);

  // Pre-fetch blob to get MIME type for prompt generation
  useEffect(() => {
    const fetchBlobType = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const orgId = localStorage.getItem("garage_org_id");
        const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const dlUrl =
          `${base}/cabinet/files/${fileId}/stream` +
          (orgId ? `?organizationId=${orgId}` : "");
        const dlRes = await fetch(dlUrl, {
          headers: {
            Authorization: `Bearer ${token}`,          },
        });
        if (dlRes.ok) {
          const blobData = await dlRes.blob();
          setBlob(blobData);
          // Set default prompt if question is empty
          setQuestion((prev) => {
            if (!prev || prev.trim() === "") {
              return generateAskCabinetPrompt(
                fileName || "file",
                blobData.type
              );
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to fetch blob type:", err);
      }
    };
    void fetchBlobType();
  }, [fileId, fileName, setQuestion]);

  const ask = async () => {
    if (!fileId) return;
    const q = String(question ?? "").trim();
    if (!q || sending) return;

    // Check if user has configured any AI provider keys
    if (!hasAnyKey) {
      onShowAPIKeyModal();
      return;
    }

    const id = Math.random().toString(36).slice(2);
    const newMessages: AskMessage[] = [
      ...messages,
      { id: id + "-u", role: "user", text: q, createdAt: Date.now() },
      {
        id: id + "-l",
        role: "assistant",
        text: "Thinking…",
        createdAt: Date.now(),
      },
    ];
    setMessages(newMessages);
    setQuestion("");
    if (inputRef.current) {
      inputRef.current.style.height = "40px";
    }

    try {
      setSending(true);
      const token = getToken()!;
      const orgId = localStorage.getItem("garage_org_id");
      // Download the file blob
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const dlUrl =
        `${base}/cabinet/files/${fileId}/stream` +
        (orgId ? `?organizationId=${orgId}` : "");
      const dlRes = await fetch(dlUrl, {
        headers: {
          Authorization: `Bearer ${token}`,        },
      });
      if (!dlRes.ok) throw new Error("Failed to download file for analysis");
      const blob = await dlRes.blob();

      // Send to ask-cabinet endpoint
      const form = new FormData();
      form.append("file", blob, fileName || "file.webm");
      form.append("question", q);
      if (selectedProvider) {
        form.append("provider", selectedProvider);
      }
      const data = await api<{ answer: string }>("/ask-cabinet", {
        method: "POST",
        body: form,
      });

      const answer = data?.answer || "";
      setMessages(
        newMessages.map((m) =>
          m.id === id + "-l" ? { ...m, text: answer } : m
        )
      );
    } catch (err: any) {
      console.error(err);
      const errText = err?.message || "Failed to get answer";
      toast.error(errText);
      setMessages(
        newMessages.map((m) =>
          m.id === id + "-l" ? { ...m, text: errText } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  function TypingBubble() {
    return (
      <div className="inline-flex items-center gap-1 bg-[#1a1a22] text-gray-200 border border-[#2a2a35] px-3 py-2 rounded-lg">
        <span className="sr-only">Assistant typing</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#c7c7da] animate-bounce [animation-delay:-0.2s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#c7c7da] animate-bounce" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#c7c7da] animate-bounce [animation-delay:0.2s]" />
      </div>
    );
  }

  return (
    <div className="border-t border-[#2a2a35] bg-[#0c0c10]">
      <div className="p-3 space-y-3">
        {/* Messages */}
        <div className="max-h-60 overflow-y-auto space-y-2 border border-[#2a2a35] rounded-md bg-[#0a0a0e] p-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "user" ? "text-right" : "text-left"}
            >
              <div className="inline-flex flex-col items-start max-w-[85%]">
                <div
                  className={
                    m.role === "user"
                      ? "self-end bg-yellow-500/20 text-yellow-100 border border-yellow-400/30 px-2 py-1.5 rounded-lg text-[12px]"
                      : "self-start bg-[#1a1a22] text-gray-200 border border-[#2a2a35] px-2 py-1.5 rounded-lg text-[12px]"
                  }
                >
                  {m.text === "Thinking…" && m.role === "assistant" ? (
                    <TypingBubble />
                  ) : m.role === "assistant" ? (
                    <FormattedAnswer text={m.text} />
                  ) : (
                    m.text
                  )}
                </div>
                <span
                  className={
                    "mt-0.5 text-[10px] text-[#9fa0b8] " +
                    (m.role === "user" ? "self-end" : "self-start")
                  }
                >
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={String(question ?? "")}
              onChange={(e) => {
                setQuestion(e.target.value);
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 100) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
              placeholder="Ask a question about this file..."
              disabled={sending}
              rows={2}
              className="w-full resize-none rounded-md bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 px-2 py-1.5 text-xs focus:outline-none focus:border-brand/50"
            />
          </div>
          <button
            onClick={ask}
            disabled={!String(question ?? "").trim() || sending}
            className="inline-flex items-center gap-1.5 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] disabled:opacity-50 disabled:cursor-not-allowed text-brand-foreground border border-brand/30 text-xs px-2 py-1.5 rounded"
          >
            <Send className="h-3 w-3" /> Ask
          </button>
        </div>
      </div>
    </div>
  );
}

type AskItem = {
  id: string;
  question: string;
  answer?: string;
  fileName?: string; // Add fileName field
  fileId?: string; // Add fileId for asking questions
  createdAt: number;
};

function loadItems(): AskItem[] {
  try {
    const raw = localStorage.getItem("ask-cabinet-items") || "[]";
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveItems(items: AskItem[]) {
  try {
    localStorage.setItem(
      "ask-cabinet-items",
      JSON.stringify(items.slice(-200))
    );
  } catch {}
}

type AskMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export default function AskCabinetSidebar({
  onClose,
}: {
  onClose?: () => void;
}) {
  const [items, setItems] = useState<AskItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [messagesMap, setMessagesMap] = useState<Record<string, AskMessage[]>>(
    {}
  );
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});
  const [sendingMap, setSendingMap] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement | null>(null);
  const [showAPIKeyModal, setShowAPIKeyModal] = useState(false);

  const {
    keys: aiProviderKeys,
    selectedProvider,
    isLoading: isLoadingAIProvider,
    hasAnyKey,
    setSelectedProvider,
    refetch: refetchAIProviders,
    isFounder,
  } = useAIProvider();

  useEffect(() => {
    const loadedItems = loadItems();
    setItems(loadedItems);

    // Try to fetch fileId for items that don't have it by searching in cabinet
    loadedItems.forEach(async (item) => {
      if (!item.fileId && item.fileName) {
        try {
          const token = getToken();
          if (!token) return;
          const orgId = localStorage.getItem("garage_org_id");
          if (!orgId) return;

          // Search for the file by name
          try {
            const searchResponse = await api<{ success: boolean; data: any[] }>(
              `/cabinet/search?query=${encodeURIComponent(
                item.fileName
              )}&organizationId=${orgId}`,
              {},
              token
            );

            if (searchResponse?.success && searchResponse?.data?.length > 0) {
              // Find exact match by name
              const matchingFile = searchResponse.data.find(
                (f: any) =>
                  f.name === item.fileName || f.originalName === item.fileName
              );

              if (matchingFile) {
                const foundFileId = matchingFile._id || matchingFile.id;
                if (foundFileId) {
                  console.log(
                    "Found fileId for",
                    item.fileName,
                    ":",
                    foundFileId
                  );
                  // Update the item with fileId
                  setItems((prev) => {
                    const updated = prev.map((i) =>
                      i.id === item.id ? { ...i, fileId: foundFileId } : i
                    );
                    // Save to localStorage
                    saveItems(updated);
                    return updated;
                  });
                }
              }
            }
          } catch (searchErr) {
            // Search might not be available, that's okay
            console.log("Could not search for file:", searchErr);
          }
        } catch (err) {
          console.error("Failed to fetch fileId:", err);
        }
      }
    });
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail as AskItem | undefined;
      if (!detail) return;
      setItems((prev) => {
        const idx = prev.findIndex((x) => x.id === detail.id);
        let next: AskItem[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = { ...prev[idx], ...detail };
        } else {
          next = [...prev, detail];
        }
        saveItems(next);
        return next;
      });
      setTimeout(
        () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    };
    window.addEventListener("ask-cabinet:new", handler as any);
    return () => window.removeEventListener("ask-cabinet:new", handler as any);
  }, []);

  useEffect(() => {
    setTimeout(
      () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
  }, [items]);

  return (
    <div className="flex h-full flex-col bg-[#0e0e12]">
      {/* Header (match ActivityPage) */}
      <div className="px-3 pt-4 pb-3 border-b border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur flex items-center justify-between">
        <div className="text-sm font-medium text-white">MonitorToPurchase</div>
        <div className="flex items-center gap-2">
          {!isLoadingAIProvider && (
            <AIProviderSelector
              keys={aiProviderKeys}
              selectedProvider={selectedProvider}
              onProviderChange={setSelectedProvider}
            />
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-[#9fa0b8] hover:text-white hover:bg-[#1a1a22] border border-[#2a2a35] hover:border-[#3a3a45] rounded-md px-2 py-1 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Body (match ActivityPage spacing and card feel) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Bot className="h-8 w-8 mb-2" />
            <p>No questions yet</p>
            <p className="text-sm">Your asked questions will appear here</p>
          </div>
        ) : null}

        {items.map((it) => {
          const isExpanded = expandedItems.has(it.id);
          const messages = messagesMap[it.id] || [];
          const question = questionMap[it.id] || "";
          const sending = sendingMap[it.id] || false;

          return (
            <div
              key={it.id}
              className="rounded-lg border-l-4 bg-[#111116] hover:bg-[#1a1a1f] transition-colors border-l-yellow-500"
            >
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(it.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Clickable filename header */}
                <div
                  onClick={() => {
                    if (it.fileId) {
                      setExpandedItems((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(it.id)) {
                          newSet.delete(it.id);
                        } else {
                          newSet.add(it.id);
                          // Initialize messages if not exists
                          if (!messagesMap[it.id]) {
                            setMessagesMap((prev) => ({
                              ...prev,
                              [it.id]: [],
                            }));
                          }
                        }
                        return newSet;
                      });
                    } else {
                      console.log("No fileId for item:", it.id, it);
                    }
                  }}
                  className={`w-full flex items-start gap-2 ${
                    it.fileId
                      ? "cursor-pointer hover:opacity-80 transition-opacity"
                      : "cursor-default"
                  }`}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2a2a35] text-gray-200 mt-0.5 flex-shrink-0">
                    {/* {it.fileId &&
                      (isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ))} */}
                    {!it.fileId && <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 text-left p-2 rounded-lg bg-[#111116] text-gray-300 border border-[#2a2a35] text-sm">
                    <div className="font-medium text-white mb-2 flex items-center gap-2">
                      {it.fileName || "Recording"}
                      {it.fileId && (
                        <span className="text-xs text-gray-500">
                          (Click to ask questions)
                        </span>
                      )}
                      {!it.fileId && (
                        <span className="text-xs text-red-400">
                          (fileId missing - cannot ask questions)
                        </span>
                      )}
                    </div>
                    {it.answer ? (
                      <FormattedAnswer text={it.answer} />
                    ) : (
                      <div className="text-xs text-gray-400 mt-1">
                        Analyzing...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Accordion content - Q&A interface */}
              {isExpanded && it.fileId && (
                <FileQnAAccordion
                  fileId={it.fileId}
                  fileName={it.fileName || "Recording"}
                  itemId={it.id}
                  messages={messages}
                  setMessages={(msgs) =>
                    setMessagesMap((prev) => ({ ...prev, [it.id]: msgs }))
                  }
                  question={question}
                  setQuestion={(q) =>
                    setQuestionMap((prev) => ({
                      ...prev,
                      [it.id]:
                        typeof q === "function"
                          ? (q as (prev: string) => string)(prev[it.id] || "")
                          : q,
                    }))
                  }
                  sending={sending}
                  setSending={(s) =>
                    setSendingMap((prev) => ({ ...prev, [it.id]: s }))
                  }
                  hasAnyKey={hasAnyKey}
                  selectedProvider={selectedProvider}
                  onShowAPIKeyModal={() => setShowAPIKeyModal(true)}
                />
              )}
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* API Key Required Modal */}
      <AIProviderRequiredModal
        open={showAPIKeyModal}
        onOpenChange={(open) => {
          setShowAPIKeyModal(open);
          if (!open) {
            // Refetch keys when modal closes in case user configured them
            refetchAIProviders();
          }
        }}
        featureName="Monitor to Purchase"
        isFounder={isFounder}
      />
    </div>
  );
}

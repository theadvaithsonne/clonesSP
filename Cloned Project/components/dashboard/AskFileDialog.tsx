"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { generateAskCabinetPrompt } from "@/lib/askCabinetUtils";

type AskMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export function AskFileDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fileId: string | null;
  fileName?: string;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevFileIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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

  useEffect(() => {
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50
    );
  }, [messages, open]);

  // Track blob type for prompt generation
  const [blob, setBlob] = useState<Blob | null>(null);
  
  // Reset conversation when switching to a different file
  useEffect(() => {
    if (!fileId) return;
    if (prevFileIdRef.current !== fileId) {
      setMessages([]);
      setQuestion("");
      setBlob(null);
      prevFileIdRef.current = fileId;
    }
  }, [fileId]);
  
  // Pre-fetch blob to get MIME type for prompt generation
  useEffect(() => {
    if (!fileId || prevFileIdRef.current === fileId) return;
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
          // Set default prompt based on file type
          setQuestion((prev) => {
            if (!prev || prev.trim() === "") {
              return generateAskCabinetPrompt(fileName || "file", blobData.type);
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Failed to fetch blob type:", err);
      }
    };
    void fetchBlobType();
  }, [fileId, fileName]);

  const ask = async () => {
    if (!fileId) return;
    const q = question.trim();
    if (!q || sending) return;
    const id = Math.random().toString(36).slice(2);
    setMessages((prev) => [
      ...prev,
      { id: id + "-u", role: "user", text: q, createdAt: Date.now() },
      {
        id: id + "-l",
        role: "assistant",
        text: "Thinking…",
        createdAt: Date.now(),
      },
    ]);
    setQuestion("");
    if (inputRef.current) {
      inputRef.current.style.height = "40px";
    }

    try {
      setSending(true);
      const token = getToken()!;
      const orgId = localStorage.getItem("garage_org_id");
      // 1) Download the file blob from cabinet stream endpoint (needs organizationId)
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

      // 2) Send to ask-cabinet endpoint with the question
      const form = new FormData();
      form.append("file", blob, fileName || "file.webm");
      form.append("question", q);
      const data = await api<{ answer: string }>("/ask-cabinet", {
        method: "POST",
        body: form,
      });

      const answer = data?.answer || "";
      setMessages((prev) =>
        prev.map((m) => (m.id === id + "-l" ? { ...m, text: answer } : m))
      );
    } catch (err: any) {
      console.error(err);
      const errText = err?.message || "Failed to get answer";
      toast.error(errText);
      setMessages((prev) =>
        prev.map((m) => (m.id === id + "-l" ? { ...m, text: errText } : m))
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[680px] bg-[#0e0e12] border border-[#2a2a35] text-[#d2d2e6] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2 text-white text-sm">
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] bg-[#1a1a22] border border-[#2a2a35] text-[#c7c7da]">
                File
              </span>
              <span className="truncate max-w-[420px] text-[#e5e5f0] text-[13px]">
                {fileName || fileId}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 h-[64vh]">
          <div className="flex-1 overflow-y-auto space-y-3 p-3 border border-[#2a2a35] rounded-md bg-[#0c0c10]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <div className="inline-flex flex-col items-start max-w-[80%]">
                  <div
                    className={
                      m.role === "user"
                        ? "self-end bg-yellow-500/20 text-yellow-100 border border-yellow-400/30 px-3 py-2 rounded-lg text-[13px]"
                        : "self-start bg-[#1a1a22] text-gray-200 border border-[#2a2a35] px-3 py-2 rounded-lg text-[13px]"
                    }
                  >
                    {m.text === "Thinking…" && m.role === "assistant" ? (
                      <TypingBubble />
                    ) : (
                      m.text
                    )}
                  </div>
                  <span
                    className={
                      "mt-1 text-[10px] text-[#9fa0b8] " +
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
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
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
                className="w-full resize-none rounded-md bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 px-3 py-2 text-sm focus:outline-none focus:border-brand/50"
              />
            </div>
            <Button
              onClick={ask}
              disabled={!question.trim()}
              className="inline-flex items-center gap-2 bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 text-sm"
            >
              <Send className="h-4 w-4" /> Ask
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

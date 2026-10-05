"use client";

import { useState } from "react";
import { ChevronUp, CheckCircle } from "lucide-react";
import useWebinarStore from "@/store/webinarStore";
import type { Socket } from "socket.io-client";

interface QAPanelProps {
  socket: Socket | null;
  webinarId: string;
}

export default function QAPanel({ socket, webinarId }: QAPanelProps) {
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qaQuestions = useWebinarStore((s) => s.qaQuestions);
  const role = useWebinarStore((s) => s.role);

  const submitQuestion = () => {
    if (!question.trim() || !socket || submitting) return;
    setSubmitting(true);
    socket.emit(
      "webinar:sendQA",
      { webinarId, question: question.trim() },
      (res: { success?: boolean }) => {
        setSubmitting(false);
        if (res?.success !== false) setQuestion("");
      }
    );
  };

  const upvote = (questionId: string) =>
    socket?.emit("webinar:upvoteQA", { webinarId, questionId });

  const markAnswered = (questionId: string) =>
    socket?.emit("webinar:answerQA", { webinarId, questionId });

  const sorted = [...qaQuestions].sort(
    (a, b) => (b.upvotes || 0) - (a.upvotes || 0)
  );
  const isHost = role === "host" || role === "panelist";

  return (
    <div className="flex flex-col h-full bg-[#282828]">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-white font-semibold text-sm">
          Q&amp;A
          {sorted.length > 0 && (
            <span className="ml-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
              {sorted.length}
            </span>
          )}
        </h3>
        {isHost && (
          <p className="text-zinc-500 text-xs mt-0.5">
            Attendees ask - you can mark as answered
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-zinc-500 text-sm">No questions yet</p>
            <p className="text-zinc-500 text-xs mt-1">
              {isHost
                ? "Attendees can ask questions below"
                : "Be the first to ask!"}
            </p>
          </div>
        )}

        {sorted.map((qa) => {
          const answered = !!qa.answer || (qa as any).answered;
          return (
            <div
              key={qa.id}
              className={`rounded-lg p-3 text-sm transition-opacity ${
                answered ? "bg-zinc-900 opacity-60" : "bg-zinc-900"
              }`}
            >
              <p className="text-zinc-200 mb-1 leading-snug">
                {qa.text || (qa as any).question}
              </p>
              <p className="text-zinc-500 text-xs mb-2">- {qa.name}</p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => upvote(qa.id)}
                  className="flex items-center gap-1 text-xs text-zinc-500 hover:text-blue-400 transition-colors bg-white/10 px-2 py-1 rounded"
                >
                  <ChevronUp className="w-3 h-3" />
                  {qa.upvotes || 0}
                </button>

                {answered && (
                  <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Answered
                  </span>
                )}

                {isHost && !answered && (
                  <button
                    onClick={() => markAnswered(qa.id)}
                    className="ml-auto text-xs text-yellow-400 hover:text-yellow-300 bg-yellow-900/20 hover:bg-yellow-900/40 px-2 py-0.5 rounded transition-colors"
                  >
                    Mark answered
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQuestion()}
          placeholder={isHost ? "Post a question..." : "Ask a question..."}
          className="flex-1 bg-zinc-950 border border-white/10 text-white text-sm px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-white/25 placeholder-zinc-500"
        />
        <button
          onClick={submitQuestion}
          disabled={!question.trim() || submitting}
          className="bg-zinc-900 hover:bg-white/20 border border-white/15 disabled:opacity-40 text-white px-3 py-2 rounded text-sm transition-colors"
        >
          {submitting ? "..." : "Ask"}
        </button>
      </div>
    </div>
  );
}

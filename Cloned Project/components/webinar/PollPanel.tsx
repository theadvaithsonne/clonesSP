"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import useWebinarStore from "@/store/webinarStore";
import type { Socket } from "socket.io-client";

interface PollPanelProps {
  socket: Socket | null;
  webinarId: string;
}

export default function PollPanel({ socket, webinarId }: PollPanelProps) {
  const polls = useWebinarStore((s) => s.polls);
  const role = useWebinarStore((s) => s.role);

  // Create poll form state
  const [showForm, setShowForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});

  const addOption = () => setPollOptions([...pollOptions, ""]);
  const updateOption = (i: number, val: string) => {
    const copy = [...pollOptions];
    copy[i] = val;
    setPollOptions(copy);
  };
  const removeOption = (i: number) =>
    setPollOptions(pollOptions.filter((_, idx) => idx !== i));

  const createPoll = () => {
    const options = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim() || options.length < 2) return;
    socket?.emit("webinar:createPoll", {
      webinarId,
      question: pollQuestion.trim(),
      options,
    });
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowForm(false);
  };

  const vote = (pollId: string, optionId: string) => {
    if (votedPolls[pollId]) return;
    socket?.emit(
      "webinar:submitVote",
      { webinarId, pollId, optionId },
      (res: { success?: boolean }) => {
        if (res?.success)
          setVotedPolls((prev) => ({ ...prev, [pollId]: optionId }));
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#282828]">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Polls</h3>
        {role === "host" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {showForm ? "Cancel" : "+ New Poll"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {/* Create poll form */}
        {showForm && role === "host" && (
          <div className="bg-zinc-900 rounded-lg p-3 space-y-2">
            <input
              type="text"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Poll question..."
              className="w-full bg-zinc-950 border border-white/10 text-white text-sm px-3 py-2 rounded focus:outline-none focus:ring-1 focus:ring-white/25 placeholder-zinc-500"
            />
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-zinc-950 border border-white/10 text-white text-sm px-3 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-white/25 placeholder-zinc-500"
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="text-red-400 hover:text-red-300 text-xs px-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={addOption}
                className="text-xs text-zinc-500 hover:text-zinc-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add option
              </button>
              <button
                onClick={createPoll}
                className="ml-auto bg-zinc-900 hover:bg-white/20 border border-white/15 text-white text-xs px-3 py-1.5 rounded transition-colors"
              >
                Launch Poll
              </button>
            </div>
          </div>
        )}

        {polls.length === 0 && !showForm && (
          <p className="text-zinc-500 text-xs text-center mt-4">
            No polls yet
          </p>
        )}

        {polls.map((poll) => {
          const totalVotes = poll.options.reduce(
            (sum, o) => sum + o.votes,
            0
          );
          const hasVoted = !!votedPolls[poll.id];
          const isHost = role === "host";
          const showResults = hasVoted || isHost;

          return (
            <div key={poll.id} className="bg-zinc-900 rounded-lg p-3">
              <p className="text-white text-sm font-medium mb-3">
                {poll.question}
              </p>
              <div className="space-y-2">
                {poll.options.map((opt) => {
                  const pct =
                    totalVotes > 0
                      ? Math.round((opt.votes / totalVotes) * 100)
                      : 0;
                  const isMyVote = votedPolls[poll.id] === (opt as any).id;
                  return (
                    <div key={(opt as any).id || opt.text}>
                      <button
                        onClick={() =>
                          !hasVoted && vote(poll.id, (opt as any).id || opt.text)
                        }
                        disabled={hasVoted}
                        className={`w-full text-left text-sm px-3 py-2 rounded transition-colors ${
                          isMyVote
                            ? "bg-blue-600 text-white"
                            : hasVoted
                              ? "bg-zinc-800 text-zinc-300 cursor-default"
                              : "bg-zinc-800 hover:bg-white/15 text-zinc-200"
                        }`}
                      >
                        <span className="flex justify-between">
                          <span>{opt.text}</span>
                          {showResults && (
                            <span className="text-xs opacity-70">
                              {opt.votes}
                            </span>
                          )}
                        </span>
                      </button>
                      {showResults && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded overflow-hidden">
                            <div
                              className={`h-full rounded transition-all duration-500 ${
                                isMyVote ? "bg-blue-400" : "bg-zinc-400"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                {isHost && !hasVoted && (
                  <span className="ml-2 text-yellow-500">(live)</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

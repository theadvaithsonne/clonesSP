"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { voteOnPoll, type Poll, type PollOption } from "@/lib/feed-api";

interface PollDisplayProps {
  poll: Poll;
  onVote?: (updatedPoll: Poll) => void;
}

export function PollDisplay({ poll: initialPoll, onVote }: PollDisplayProps) {
  const [poll, setPoll] = useState(initialPoll);
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    initialPoll.userVotedOptions || []
  );
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(initialPoll.hasVoted || false);

  // Calculate time remaining
  const getTimeRemaining = () => {
    const now = new Date();
    const endsAt = new Date(poll.endsAt);
    const diff = endsAt.getTime() - now.getTime();

    if (diff <= 0) return "Poll ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining());
    }, 60000);
    return () => clearInterval(interval);
  }, [poll.endsAt]);

  const isPollExpired = new Date(poll.endsAt) <= new Date();
  const showResults = hasVoted || isPollExpired;

  const handleOptionClick = async (optionId: string) => {
    if (isPollExpired || isVoting) return;

    if (poll.isMultipleChoice) {
      // Toggle selection for multiple choice
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Single choice - immediately vote
      setIsVoting(true);
      try {
        const { poll: updatedPoll } = await voteOnPoll(poll._id, [optionId]);
        setPoll(updatedPoll);
        setHasVoted(true);
        setSelectedOptions([optionId]);
        onVote?.(updatedPoll);
      } catch (error) {
        console.error("Failed to vote:", error);
      } finally {
        setIsVoting(false);
      }
    }
  };

  const handleMultipleChoiceSubmit = async () => {
    if (selectedOptions.length === 0 || isVoting || isPollExpired) return;

    setIsVoting(true);
    try {
      const { poll: updatedPoll } = await voteOnPoll(poll._id, selectedOptions);
      setPoll(updatedPoll);
      setHasVoted(true);
      onVote?.(updatedPoll);
    } catch (error) {
      console.error("Failed to vote:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const getPercentage = (option: PollOption) => {
    if (poll.totalVotes === 0) return 0;
    return Math.round((option.votesCount / poll.totalVotes) * 100);
  };

  return (
    <div className="mt-3 mb-3">
      {/* Poll Question */}
      {poll.question && (
        <p className="text-white font-medium mb-3">{poll.question}</p>
      )}

      {/* Poll Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const percentage = getPercentage(option);
          const isSelected = selectedOptions.includes(option._id);
          const isWinning =
            showResults &&
            option.votesCount ===
              Math.max(...poll.options.map((o) => o.votesCount)) &&
            option.votesCount > 0;

          return (
            <button
              key={option._id}
              onClick={() => handleOptionClick(option._id)}
              disabled={isPollExpired || (hasVoted && !poll.isMultipleChoice)}
              className={cn(
                "w-full relative rounded-lg border transition-all text-left overflow-hidden",
                showResults
                  ? "border-[#2a2a35] cursor-default"
                  : isSelected
                    ? "border-brand bg-brand/10"
                    : "border-[#2a2a35] hover:border-[#3a3a45] hover:bg-[#1a1a22] cursor-pointer"
              )}
            >
              {/* Progress Bar Background */}
              {showResults && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "absolute inset-y-0 left-0",
                    isWinning ? "bg-brand/20" : "bg-[#2a2a35]/50"
                  )}
                />
              )}

              <div className="relative px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Checkbox/Radio indicator */}
                  {!showResults && (
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-brand bg-brand"
                          : "border-[#6E767D]"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}

                  {/* Check mark for voted options */}
                  {showResults && isSelected && (
                    <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  <span
                    className={cn(
                      "text-[15px]",
                      isWinning ? "text-white font-semibold" : "text-white"
                    )}
                  >
                    {option.text}
                  </span>
                </div>

                {/* Percentage */}
                {showResults && (
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isWinning ? "text-brand" : "text-[#9fa0b8]"
                    )}
                  >
                    {percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Vote button for multiple choice */}
      {poll.isMultipleChoice && !hasVoted && !isPollExpired && (
        <button
          onClick={handleMultipleChoiceSubmit}
          disabled={selectedOptions.length === 0 || isVoting}
          className={cn(
            "mt-3 w-full py-2.5 rounded-full font-semibold transition-colors",
            selectedOptions.length > 0
              ? "bg-brand text-brand-foreground hover:opacity-90"
              : "bg-[#2a2a35] text-[#6E767D] cursor-not-allowed"
          )}
        >
          {isVoting ? "Voting..." : "Vote"}
        </button>
      )}

      {/* Poll Footer */}
      <div className="flex items-center gap-4 mt-3 text-[#9fa0b8] text-sm">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>
            {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>{timeRemaining}</span>
        </div>
        {poll.isMultipleChoice && (
          <span className="text-[#6E767D]">Multiple choice</span>
        )}
      </div>
    </div>
  );
}

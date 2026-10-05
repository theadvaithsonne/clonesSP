"use client";

import { useState } from "react";
import { X, Plus, Clock, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PollOption {
  id: string;
  text: string;
}

interface PollData {
  question: string;
  options: string[];
  durationHours: number;
  isMultipleChoice: boolean;
}

interface PollCreatorProps {
  onPollChange: (poll: PollData | null) => void;
  onRemove: () => void;
}

const DURATION_OPTIONS = [
  { label: "1 hour", value: 1 },
  { label: "6 hours", value: 6 },
  { label: "12 hours", value: 12 },
  { label: "1 day", value: 24 },
  { label: "3 days", value: 72 },
  { label: "7 days", value: 168 },
];

export function PollCreator({ onPollChange, onRemove }: PollCreatorProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<PollOption[]>([
    { id: "1", text: "" },
    { id: "2", text: "" },
  ]);
  const [durationHours, setDurationHours] = useState(24);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);

  const updatePollData = (
    newQuestion?: string,
    newOptions?: PollOption[],
    newDuration?: number,
    newMultiple?: boolean
  ) => {
    const q = newQuestion ?? question;
    const opts = newOptions ?? options;
    const dur = newDuration ?? durationHours;
    const multi = newMultiple ?? isMultipleChoice;

    const validOptions = opts.filter((o) => o.text.trim()).map((o) => o.text.trim());

    if (validOptions.length >= 2) {
      onPollChange({
        question: q.trim(),
        options: validOptions,
        durationHours: dur,
        isMultipleChoice: multi,
      });
    } else {
      onPollChange(null);
    }
  };

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
    updatePollData(value);
  };

  const handleOptionChange = (id: string, value: string) => {
    const newOptions = options.map((o) => (o.id === id ? { ...o, text: value } : o));
    setOptions(newOptions);
    updatePollData(undefined, newOptions);
  };

  const addOption = () => {
    if (options.length < 4) {
      const newOptions = [...options, { id: Date.now().toString(), text: "" }];
      setOptions(newOptions);
    }
  };

  const removeOption = (id: string) => {
    if (options.length > 2) {
      const newOptions = options.filter((o) => o.id !== id);
      setOptions(newOptions);
      updatePollData(undefined, newOptions);
    }
  };

  const handleDurationChange = (value: number) => {
    setDurationHours(value);
    setShowDurationDropdown(false);
    updatePollData(undefined, undefined, value);
  };

  const handleMultipleChoiceChange = () => {
    const newValue = !isMultipleChoice;
    setIsMultipleChoice(newValue);
    updatePollData(undefined, undefined, undefined, newValue);
  };

  const getDurationLabel = () => {
    const option = DURATION_OPTIONS.find((o) => o.value === durationHours);
    return option?.label || "1 day";
  };

  return (
    <div className="border border-[#2a2a35] rounded-xl p-4 bg-[#0e0e12]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-brand">
          <BarChart3 className="w-5 h-5" />
          <span className="font-medium">Create Poll</span>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-full hover:bg-[#1a1a22] text-[#9fa0b8] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Question Input */}
      <Input
        placeholder="Ask a question..."
        value={question}
        onChange={(e) => handleQuestionChange(e.target.value)}
        className="bg-transparent border-[#2a2a35] text-white placeholder:text-[#6E767D] mb-4 text-base"
        maxLength={280}
      />

      {/* Options */}
      <div className="space-y-2 mb-4">
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder={`Option ${index + 1}`}
                value={option.text}
                onChange={(e) => handleOptionChange(option.id, e.target.value)}
                className="bg-transparent border-[#2a2a35] text-white placeholder:text-[#6E767D] pr-8"
                maxLength={25}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6E767D]">
                {option.text.length}/25
              </span>
            </div>
            {options.length > 2 && (
              <button
                onClick={() => removeOption(option.id)}
                className="p-2 rounded-full hover:bg-[#1a1a22] text-[#6E767D] hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Option Button */}
      {options.length < 4 && (
        <button
          onClick={addOption}
          className="flex items-center gap-2 text-brand hover:opacity-80 transition-colors mb-4"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add option</span>
        </button>
      )}

      {/* Poll Settings */}
      <div className="flex items-center justify-between pt-4 border-t border-[#2a2a35]">
        {/* Duration Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDurationDropdown(!showDurationDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a22] border border-[#2a2a35] text-white hover:bg-[#2a2a35] transition-colors"
          >
            <Clock className="w-4 h-4 text-[#9fa0b8]" />
            <span className="text-sm">{getDurationLabel()}</span>
          </button>

          {showDurationDropdown && (
            <div className="absolute left-0 top-full mt-1 w-32 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-xl overflow-hidden z-50">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleDurationChange(option.value)}
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left hover:bg-[#2a2a35] transition-colors",
                    durationHours === option.value
                      ? "text-brand bg-brand/10"
                      : "text-white"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Multiple Choice Toggle */}
        <button
          onClick={handleMultipleChoiceChange}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
            isMultipleChoice
              ? "bg-brand/10 border-brand text-brand"
              : "bg-[#1a1a22] border-[#2a2a35] text-[#9fa0b8] hover:text-white hover:bg-[#2a2a35]"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
              isMultipleChoice
                ? "border-brand bg-brand"
                : "border-[#6E767D]"
            )}
          >
            {isMultipleChoice && (
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
              </svg>
            )}
          </div>
          <span className="text-sm">Multiple choice</span>
        </button>
      </div>
    </div>
  );
}

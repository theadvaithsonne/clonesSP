"use client";

import Image from "next/image";
import { Building2 } from "lucide-react";
import type { TickerMessage, TabType } from "./types";

interface GlobeTickerProps {
  messages: TickerMessage[];
  activeTab: TabType;
  onMessageClick: (message: TickerMessage) => void;
}

export function GlobeTicker({
  messages,
  activeTab,
  onMessageClick,
}: GlobeTickerProps) {
  if (messages.length === 0) {
    return null;
  }

  // Calculate animation duration based on message count
  const getDuration = () => {
    switch (activeTab) {
      case "hqs":
        return "60s";
      case "founders":
        return "60s";
      case "stakeholders":
        return messages.length > 50 ? "340s" : "120s";
      default:
        return "60s";
    }
  };

  // Double the messages for seamless loop
  const doubledMessages = [...messages, ...messages];

  return (
    <div className="w-full bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 overflow-hidden">
      <div
        className="flex animate-marquee whitespace-nowrap py-2"
        style={{ "--marquee-duration": getDuration() } as React.CSSProperties}
      >
        {doubledMessages.map((message, index) => (
          <button
            key={`${message.id}-${index}`}
            onClick={() => onMessageClick(message)}
            className="flex items-center gap-2 px-4 mx-2 py-1 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors cursor-pointer shrink-0"
          >
            {/* Icon/Avatar */}
            <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-brand-2/50">
              {message.icon ? (
                <Image
                  src={message.icon}
                  alt={message.name}
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                  <Building2 className="w-3 h-3 text-zinc-400" />
                </div>
              )}
            </div>

            {/* Name */}
            <span className="text-sm font-medium text-white">
              {message.companyName}
            </span>

            {/* Location */}
            <span className="text-xs text-zinc-500">{message.locationText}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

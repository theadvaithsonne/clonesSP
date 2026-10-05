"use client";

import { Building2, Users, UserCheck } from "lucide-react";
import type { TabType } from "./types";

interface GlobeTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  counts?: {
    hqs: number;
    founders: number;
    stakeholders: number;
  };
}

export function GlobeTabs({ activeTab, onTabChange, counts }: GlobeTabsProps) {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: "hqs",
      label: "HQs",
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: "founders",
      label: "Founders",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "stakeholders",
      label: "Stakeholders",
      icon: <UserCheck className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex flex-col gap-1 bg-zinc-900/80 rounded-lg p-1 backdrop-blur-sm border border-zinc-800 w-full">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? "bg-brand-2 text-brand-foreground"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
        >
          {tab.icon}
          <span className="flex-1 text-left">{tab.label}</span>
          {counts && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full min-w-[24px] text-center ${
                activeTab === tab.id
                  ? "bg-black/20 text-black"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {counts[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

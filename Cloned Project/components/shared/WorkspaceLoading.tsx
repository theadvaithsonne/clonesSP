"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  List,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Video,
  Users,
  Clock,
} from "lucide-react";

interface WorkspaceLoadingProps {
  message?: string;
  backgroundClass?: string;
  textClass?: string;
  cycleIntervalMs?: number;
}

type LoadingIcon = {
  icon: LucideIcon;
  gradient: string;
  glow: string;
};

const LOADING_ICONS: LoadingIcon[] = [
  { icon: LayoutGrid, gradient: "from-amber-400 to-orange-500", glow: "rgba(251,191,36,0.45)" },
  { icon: List, gradient: "from-lime-400 to-emerald-500", glow: "rgba(132,204,22,0.45)" },
  { icon: Calendar, gradient: "from-sky-400 to-blue-500", glow: "rgba(56,189,248,0.45)" },
  { icon: BarChart3, gradient: "from-violet-400 to-purple-600", glow: "rgba(167,139,250,0.45)" },
  { icon: FileSpreadsheet, gradient: "from-emerald-400 to-teal-500", glow: "rgba(52,211,153,0.45)" },
  { icon: FileText, gradient: "from-slate-300 to-slate-500", glow: "rgba(148,163,184,0.4)" },
  { icon: Video, gradient: "from-red-400 to-rose-600", glow: "rgba(248,113,113,0.45)" },
  { icon: Users, gradient: "from-yellow-300 to-amber-500", glow: "rgba(253,224,71,0.45)" },
  { icon: Clock, gradient: "from-fuchsia-400 to-pink-500", glow: "rgba(232,121,249,0.45)" },
];

export function WorkspaceLoading({
  message = "Loading your Workspace",
  backgroundClass = "bg-[#0a0a0d]",
  textClass = "text-white/50",
  cycleIntervalMs = 750,
}: WorkspaceLoadingProps) {
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % LOADING_ICONS.length);
      setAnimKey((prev) => prev + 1);
    }, cycleIntervalMs);

    return () => clearInterval(timer);
  }, [cycleIntervalMs]);

  const current = LOADING_ICONS[index];
  const Icon = current.icon;

  return (
    <>
      <style>{`
        @keyframes workspace-icon-pop {
          0% {
            opacity: 0;
            transform: scale(0.45) rotate(-14deg);
          }
          55% {
            opacity: 1;
            transform: scale(1.12) rotate(3deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes workspace-icon-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes workspace-glow-pulse {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.08);
          }
        }

        .workspace-loading-icon {
          animation: workspace-icon-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .workspace-loading-float {
          animation: workspace-icon-float 2.4s ease-in-out infinite;
        }

        .workspace-loading-glow {
          animation: workspace-glow-pulse 2.4s ease-in-out infinite;
        }
      `}</style>

      <div
        className={`fixed inset-0 ${backgroundClass} z-[9999] flex flex-col items-center justify-center`}
      >
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
          <div className="relative mb-8 workspace-loading-float">
            <div
              className="absolute inset-0 rounded-[22px] blur-2xl workspace-loading-glow transition-colors duration-500"
              style={{ backgroundColor: current.glow }}
            />

            <div
              key={animKey}
              className={`relative h-[72px] w-[72px] overflow-hidden rounded-[22px] bg-gradient-to-br ${current.gradient} shadow-2xl flex items-center justify-center workspace-loading-icon transition-all duration-500`}
            >
              <Icon className="h-8 w-8 text-white drop-shadow-md" strokeWidth={2.25} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
            </div>
            <p className={`text-sm font-medium tracking-wide uppercase ${textClass}`}>
              {message}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

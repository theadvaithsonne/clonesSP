"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Bell, Calendar, Crosshair, FileText, Globe, Hexagon, Image, LayoutGrid, Link2, MessageCircle, Music, Paperclip, Plus, RefreshCw, Sigma, Trash2, User, Video } from "lucide-react";
import { insertOrUpdateBlock as _insertOrUpdateBlock } from "@blocknote/core";
import { toast } from "sonner";

const insertOrUpdateBlock = _insertOrUpdateBlock as any;

interface DatabaseViewsSectionProps {
  editor: any;
  block: any;
  onBack: () => void;
  onClose?: () => void;
}

export function Tag({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-0.5 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-2.5 py-0.5 rounded shrink-0 leading-5 pointer-events-none">
      <span className="text-emerald-500/70">/</span>
      {name}
    </div>
  );
}

export function TablePreview({ onSelect }: { onSelect: () => void }) {
  const headers = ["Name", "Status", "Due Date"];
  const rows = [
    ["Project Alpha", "In Progress", "Jun 20"],
    ["Design Review", "Done", "Jun 18"],
    ["Sprint Planning", "Todo", "Jun 25"],
  ];

  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="table" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-1.5 tracking-wide">Data Table</div>
        <div className="grid grid-cols-3 gap-px bg-zinc-800 rounded overflow-hidden text-[11px]">
          {headers.map((h) => (
            <div key={h} className="bg-[#1E1E1E] px-2 py-1 text-zinc-500 font-medium">{h}</div>
          ))}
          {rows.map((row, ri) =>
            row.map((cell, ci) => (
              <div
                key={`${ri}-${ci}`}
                className={`px-2 py-1 text-zinc-300 ${ri % 2 === 0 ? "bg-[#232323]" : "bg-[#1E1E1E]"}`}
              >
                {cell}
              </div>
            ))
          )}
        </div>
      </div>
    </button>
  );
}

export function BoardPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="board" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-2 tracking-wide">Kanban Board</div>
        <div className="flex gap-1.5">
          {[
            { title: "Todo", items: ["Research brief"], color: "text-zinc-300" },
            { title: "In Progress", items: ["Draft copy"], color: "text-zinc-300" },
            { title: "Done", items: ["Logo design"], color: "text-emerald-300" },
          ].map((col) => (
            <div key={col.title} className="flex-1 bg-zinc-800/40 rounded p-1.5">
              <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">{col.title}</div>
              <div className={`bg-zinc-700/40 rounded px-1.5 py-1 text-[10px] ${col.color}`}>{col.items[0]}</div>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

export function GalleryPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="gallery" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-2 tracking-wide">Grid Layout</div>
        <div className="grid grid-cols-4 gap-1.5">
          {["Card 1", "Card 2", "Card 3", "Card 4"].map((card) => (
            <div key={card} className="aspect-square bg-zinc-800/50 rounded-md relative overflow-hidden border border-zinc-700/30">
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                <span className="text-[9px] text-zinc-300 font-medium">{card}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

export function ListPreview({ onSelect }: { onSelect: () => void }) {
  const items = ["Meeting Notes", "Project Tracker", "Research Doc"];
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="list" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-2 tracking-wide">Document / File List</div>
        <div className="flex flex-col">
          {items.map((item, i) => (
            <React.Fragment key={item}>
              <div className="flex items-center gap-2 px-1.5 py-1.5">
                <FileText className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-zinc-300">{item}</span>
              </div>
              {i < items.length - 1 && <div className="h-px bg-zinc-800 mx-1.5" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </button>
  );
}

export function CalendarPreview({ onSelect }: { onSelect: () => void }) {
  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const dates = [15, 16, 17, 18, 19, 20, 21];
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="calendar" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-1.5 tracking-wide">June 2026</div>
        <div className="flex items-center gap-1">
          {days.map((day, i) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-zinc-500">{day}</span>
              <span
                className={`text-[10px] w-6 h-6 flex items-center justify-center font-medium ${
                  dates[i] === 18
                    ? "bg-emerald-500 text-white rounded-full"
                    : "text-zinc-300"
                }`}
              >
                {dates[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

export function TimelinePreview({ onSelect }: { onSelect: () => void }) {
  const points = ["Jun 1", "Jun 10", "Jun 18", "Jun 25"];
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="timeline" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-2.5 tracking-wide">Gantt / Progress Timeline</div>
        <div className="relative h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full w-[72%] bg-emerald-500 rounded-full" />
        </div>
        <div className="flex justify-between mt-1">
          {points.map((p) => (
            <span key={p} className="text-[8px] text-zinc-500">{p}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

export function ChartPreview({ onSelect }: { onSelect: () => void }) {
  const bars = [
    { h: 28, color: "bg-emerald-500" },
    { h: 18, color: "bg-sky-400" },
    { h: 32, color: "bg-violet-400" },
    { h: 14, color: "bg-emerald-500" },
    { h: 24, color: "bg-sky-400" },
    { h: 36, color: "bg-violet-400" },
    { h: 20, color: "bg-emerald-500" },
    { h: 26, color: "bg-sky-400" },
  ];

  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="chart" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-2 tracking-wide">Bar Chart Preview</div>
        <div className="flex items-end gap-[3px] h-[40px]">
          {bars.map((bar, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${bar.color} opacity-80`}
              style={{ height: `${bar.h}px` }}
            />
          ))}
        </div>
      </div>
    </button>
  );
}

export function LinkedViewPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="linked view" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-1.5 tracking-wide">Link Info Box</div>
        <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700/40 rounded px-2.5 py-1.5">
          <Link2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-zinc-300 truncate font-medium">Linked to: Project Tracker Database</span>
        </div>
      </div>
    </button>
  );
}

export function CommentPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="comment" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <span className="text-[11px] text-zinc-300 leading-relaxed">This looks great! I think we should move it up.</span>
        </div>
      </div>
    </button>
  );
}

export function DuplicatePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="duplicate" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Crosshair className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Duplicate this block</span>
        </div>
      </div>
    </button>
  );
}

export function MoveToPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="move to" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <ArrowRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Move to: Another Page</span>
        </div>
      </div>
    </button>
  );
}

export function DeletePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="delete" />
      <div className="flex-1 bg-red-950/40 rounded-lg p-3 border border-red-900/30 group-hover:border-red-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Trash2 className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <span className="text-[11px] text-red-300">Delete this block</span>
        </div>
      </div>
    </button>
  );
}

export function TemplatePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="template" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <LayoutGrid className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Insert a template block</span>
        </div>
      </div>
    </button>
  );
}

export function ButtonPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="button" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-3 py-1">
          <Plus className="h-3 w-3 text-emerald-400" />
          <span className="text-[11px] text-emerald-400 font-medium">Create Task</span>
        </div>
      </div>
    </button>
  );
}

export function SyncedBlockPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="synced block" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-emerald-500/40 group-hover:border-emerald-400/60 transition-colors">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-emerald-300">Synced from: Source Page — changes reflect everywhere</span>
        </div>
      </div>
    </button>
  );
}

export function PagePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="page" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-medium text-white leading-tight">Untitled Page</span>
            <span className="text-[10px] text-zinc-500 leading-tight mt-0.5">Nested page — click to open</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function LinkToPagePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-center w-full text-left group cursor-pointer">
      <Tag name="link to page" />
      <div className="inline-flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/25 rounded-full px-2.5 py-1">
        <Link2 className="h-3 w-3 text-blue-400 shrink-0" />
        <span className="text-[11px] text-blue-300 font-medium">Project Overview</span>
      </div>
    </button>
  );
}

export function MentionPersonPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-center w-full text-left group cursor-pointer">
      <Tag name="mention person" />
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
        <span>Assigned to</span>
        <span className="inline-flex items-center gap-1.5 bg-blue-900/30 border border-blue-800/40 rounded-full px-2 py-0.5">
          <span className="w-3.5 h-3.5 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
            <User className="h-2 w-2 text-white" />
          </span>
          <span className="text-blue-200 font-medium">@John Smith</span>
        </span>
      </div>
    </button>
  );
}

export function MentionPagePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-center w-full text-left group cursor-pointer">
      <Tag name="mention page" />
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
        <span>See also:</span>
        <span className="inline-flex items-center gap-1.5 bg-zinc-800/70 border border-zinc-700/50 rounded-full px-2 py-0.5">
          <FileText className="h-3 w-3 text-zinc-400 shrink-0" />
          <span className="text-zinc-200 font-medium">Design System Docs</span>
        </span>
      </div>
    </button>
  );
}

export function DatePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-center w-full text-left group cursor-pointer">
      <Tag name="date" />
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
        <span>Due:</span>
        <span className="inline-flex items-center gap-1.5 bg-zinc-800/70 border border-zinc-700/50 rounded-full px-2 py-0.5">
          <span className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <span className="absolute text-[5px] font-bold text-zinc-400 top-1/2 left-1/2 -translate-x-1/2 -translate-y-[1px]">17</span>
          </span>
          <span className="text-zinc-200 font-medium">June 18, 2026</span>
        </span>
      </div>
    </button>
  );
}

export function ReminderPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-center w-full text-left group cursor-pointer">
      <Tag name="reminder" />
      <span className="inline-flex items-center gap-1.5 bg-amber-900/30 border border-amber-800/30 rounded-full px-2.5 py-1">
        <Bell className="h-3 w-3 text-red-400 shrink-0" />
        <span className="text-[11px] text-amber-300 font-medium">Remind me: Tomorrow at 9:00 AM</span>
      </span>
    </button>
  );
}

export function TableOfContentsPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="table of contents" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium tracking-wide mb-2">Table of Contents</div>
        <div className="flex flex-col gap-1 text-[11px]">
          <span className="text-zinc-300">Introduction</span>
          <span className="text-zinc-300">Getting Started</span>
          <span className="text-zinc-300 ml-3">Basic Blocks</span>
          <span className="text-zinc-300 ml-3">Advanced Features</span>
          <span className="text-zinc-500 ml-6">AI Tools</span>
        </div>
      </div>
    </button>
  );
}

function AISummarizePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="summarize" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">✨ Summarize the content of this page automatically</span>
      </div>
    </button>
  );
}

function AIActionItemsPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="action items" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">✅ Extract and list all action items from this content</span>
      </div>
    </button>
  );
}

function AICustomBlockPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="custom AI block" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">🤖 Write a custom AI instruction for any task...</span>
      </div>
    </button>
  );
}

function AIImproveWritingPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="improve writing" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">✍️ Improve the clarity and flow of selected text</span>
      </div>
    </button>
  );
}

function AIFixSpellingPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="fix spelling" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">🔤 Fix spelling and grammar issues in selected text</span>
      </div>
    </button>
  );
}

function AIMakeShorterPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="make shorter" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">⇄ Make the selected content more concise</span>
      </div>
    </button>
  );
}

function AIMakeLongerPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="make longer" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">↔️ Expand and elaborate on the selected content</span>
      </div>
    </button>
  );
}

function AITranslatePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="translate" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">🌐 Translate selected text to another language</span>
      </div>
    </button>
  );
}

function AIExplainThisPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="explain this" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">💭 Explain this concept or topic in simple terms</span>
      </div>
    </button>
  );
}

function AIFindActionItemsPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="find action items" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors">
        <span className="text-[11px] text-zinc-300">🎯 Find and extract all action items from content</span>
      </div>
    </button>
  );
}

export function MediaImagePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="image" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-dashed border-zinc-700/60 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Image className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Add an image — upload or paste a URL</span>
        </div>
      </div>
    </button>
  );
}

export function MediaVideoPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="video" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-dashed border-zinc-700/60 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Video className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Embed a video from YouTube, Vimeo, or Loom</span>
        </div>
      </div>
    </button>
  );
}

export function MediaAudioPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="audio" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-dashed border-zinc-700/60 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Music className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Attach an audio file or recording</span>
        </div>
      </div>
    </button>
  );
}

export function MediaFilePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="file" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-dashed border-zinc-700/60 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Paperclip className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Upload any file attachment</span>
        </div>
      </div>
    </button>
  );
}

export function MediaPDFPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="pdf" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-dashed border-zinc-700/60 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Embed a PDF document inline</span>
        </div>
      </div>
    </button>
  );
}

export function MediaWebPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="web" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-dashed border-zinc-700/60 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Embed a website preview via URL</span>
        </div>
      </div>
    </button>
  );
}

export function MediaEmbedPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="embed" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-dashed border-zinc-700/60 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Hexagon className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <span className="text-[11px] text-zinc-300">Paste any embed link — Figma, CodePen, etc.</span>
        </div>
      </div>
    </button>
  );
}

export function MediaCodePreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="code" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="text-[10px] text-zinc-500 font-medium mb-1.5 tracking-wide">javascript</div>
        <div className="bg-[#0d0d0d] rounded-md p-2.5 font-mono text-[11px] leading-relaxed">
          <div>
            <span className="text-emerald-400">const</span>
            <span className="text-white"> </span>
            <span className="text-blue-400">greeting</span>
            <span className="text-zinc-400"> = </span>
            <span className="text-emerald-400">&quot;Hello, World!&quot;</span>
            <span className="text-zinc-400">;</span>
          </div>
          <div>
            <span className="text-blue-400">console</span>
            <span className="text-zinc-400">.</span>
            <span className="text-blue-400">log</span>
            <span className="text-zinc-400">(</span>
            <span className="text-blue-400">greeting</span>
            <span className="text-zinc-400">);</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function MediaMathPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="math" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-2.5">
          <Sigma className="h-3.5 w-3.5 text-zinc-400 shrink-0 self-start mt-0.5" />
          <span className="text-[13px] text-zinc-200 font-mono tracking-wide">{"∫₀^∞ e^{-x²} dx = √π / 2"}</span>
        </div>
      </div>
    </button>
  );
}

export function MediaInlineEquationPreview({ onSelect }: { onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="flex gap-3 items-start w-full text-left group cursor-pointer">
      <Tag name="inline equation" />
      <div className="flex-1 bg-[#1E1E1E] rounded-lg p-3 border border-zinc-800/80 group-hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-300 flex-wrap">
          <span>Inline formula:</span>
          <span className="inline-flex items-center bg-zinc-800/70 border border-zinc-700/50 rounded-md px-2 py-0.5 font-mono text-emerald-300 text-[11px]">E = mc²</span>
          <span>embedded in text.</span>
        </div>
      </div>
    </button>
  );
}

export default function DatabaseViewsSection({ editor, block, onBack, onClose }: DatabaseViewsSectionProps) {
  const execute = (action: (ed: any, blk: any) => void) => {
    editor.focus();
    try {
      editor.setTextCursorPosition(block.id, "end");
    } catch {
      // cursor position is a best-effort
    }
    action(editor, block);
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white rounded hover:bg-white/5 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase">
          Database Views
        </span>
      </div>

      <div className="overflow-y-auto flex-1 space-y-2.5 pr-1 custom-scrollbar">
        <TablePreview onSelect={() => execute((ed) => insertOrUpdateBlock(ed, { type: "tableView" } as any))} />
        <BoardPreview
          onSelect={() =>
            execute((ed) =>
              insertOrUpdateBlock(ed, { type: "boardView" } as any)
            )
          }
        />
        <GalleryPreview
          onSelect={() =>
            execute((ed) =>
              insertOrUpdateBlock(ed, { type: "galleryView" } as any)
            )
          }
        />
        <ListPreview
          onSelect={() =>
            execute((ed) =>
              insertOrUpdateBlock(ed, { type: "documentList" } as any)
            )
          }
        />
        <CalendarPreview
          onSelect={() =>
            execute((ed) =>
              insertOrUpdateBlock(ed, { type: "calendarView" } as any)
            )
          }
        />
        <TimelinePreview
          onSelect={() =>
            execute((ed) =>
              insertOrUpdateBlock(ed, { type: "timelineView" } as any)
            )
          }
        />
        <ChartPreview
          onSelect={() =>
            execute((ed) =>
              insertOrUpdateBlock(ed, { type: "chartView" } as any)
            )
          }
        />
        <LinkedViewPreview
          onSelect={() =>
            execute((ed) =>
              insertOrUpdateBlock(ed, { type: "linkedView" } as any)
            )
          }
        />

        {/* Advanced Blocks */}
        <div className="border-t border-zinc-800/60 pt-2.5 mt-1">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1">
            Advanced Blocks
          </div>
          <div className="space-y-2.5">
            <CommentPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "comment" } as any)
                )
              }
            />
            <DuplicatePreview
              onSelect={() =>
                execute((ed) => {
                  const currentBlock = ed.getTextCursorPosition().block;
                  const clone = JSON.parse(JSON.stringify(currentBlock));
                  delete clone.id;
                  clone.children = (clone.children || []).map((c: any) => { const { id, ...rest } = c; return rest; });
                  ed.insertBlocks([clone], currentBlock, "after");
                })
              }
            />
            <MoveToPreview
              onSelect={() =>
                toast.info("Select a destination page to move this block.")
              }
            />
            <DeletePreview
              onSelect={() =>
                execute((ed) => {
                  const currentBlock = ed.getTextCursorPosition().block;
                  ed.removeBlocks([currentBlock]);
                })
              }
            />
            <TemplatePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "template" } as any)
                )
              }
            />
            <ButtonPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "button" } as any)
                )
              }
            />
            <SyncedBlockPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "syncedBlock" } as any)
                )
              }
            />
          </div>
        </div>

        {/* Links & References */}
        <div className="border-t border-zinc-800/60 pt-2.5 mt-1">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1">
            Links & References
          </div>
          <div className="space-y-2.5">
            <PagePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Untitled Page", styles: {} }],
                  })
                )
              }
            />
            <LinkToPagePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Project Overview", styles: {} }],
                  })
                )
              }
            />
            <MentionPersonPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Assigned to @John Smith", styles: {} }],
                  })
                )
              }
            />
            <MentionPagePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "See also: Design System Docs", styles: {} }],
                  })
                )
              }
            />
            <DatePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Due: June 18, 2026", styles: {} }],
                  })
                )
              }
            />
            <ReminderPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Remind me: Tomorrow at 9:00 AM", styles: {} }],
                  })
                )
              }
            />
            <TableOfContentsPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Table of Contents", styles: {} }],
                  })
                )
              }
            />
          </div>
        </div>

        {/* AI Blocks */}
        <div className="border-t border-zinc-800/60 pt-2.5 mt-1">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1">
            AI Blocks
          </div>
          <div className="space-y-2.5">
            <AISummarizePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Summarize the content of this page automatically", styles: {} }],
                  })
                )
              }
            />
            <AIActionItemsPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Extract and list all action items from this content", styles: {} }],
                  })
                )
              }
            />
            <AICustomBlockPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Write a custom AI instruction for any task...", styles: {} }],
                  })
                )
              }
            />
            <AIImproveWritingPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Improve the clarity and flow of selected text", styles: {} }],
                  })
                )
              }
            />
            <AIFixSpellingPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Fix spelling and grammar issues in selected text", styles: {} }],
                  })
                )
              }
            />
            <AIMakeShorterPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Make the selected content more concise", styles: {} }],
                  })
                )
              }
            />
            <AIMakeLongerPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Expand and elaborate on the selected content", styles: {} }],
                  })
                )
              }
            />
            <AITranslatePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Translate selected text to another language", styles: {} }],
                  })
                )
              }
            />
            <AIExplainThisPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Explain this concept or topic in simple terms", styles: {} }],
                  })
                )
              }
            />
            <AIFindActionItemsPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "paragraph",
                    content: [{ type: "text", text: "Find and extract all action items from content", styles: {} }],
                  })
                )
              }
            />
          </div>
        </div>

        {/* Media & Embeds */}
        <div className="border-t border-zinc-800/60 pt-2.5 mt-1">
          <div className="text-[10px] tracking-wider text-zinc-500 font-bold uppercase mb-1.5 px-1">
            Media & Embeds
          </div>
          <div className="space-y-2.5">
            <MediaImagePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "image",
                    props: { url: "", caption: "", previewWidth: 512 },
                  })
                )
              }
            />
            <MediaVideoPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "video",
                    props: { url: "", caption: "", previewWidth: 512, showPreview: true },
                  })
                )
              }
            />
            <MediaAudioPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, {
                    type: "audio",
                    props: { url: "", caption: "", showPreview: true },
                  })
                )
              }
            />
            <MediaFilePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "file" })
                )
              }
            />
            <MediaPDFPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "file" })
                )
              }
            />
            <MediaWebPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "webBookmark" } as any)
                )
              }
            />
            <MediaEmbedPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "embed" } as any)
                )
              }
            />
            <MediaCodePreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "codeBlock" })
                )
              }
            />
            <MediaMathPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "math" } as any)
                )
              }
            />
            <MediaInlineEquationPreview
              onSelect={() =>
                execute((ed) =>
                  insertOrUpdateBlock(ed, { type: "math" } as any)
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

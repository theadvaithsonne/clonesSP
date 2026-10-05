"use client";

import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Film,
  HelpCircle,
  Plus,
  Trash2,
  MessageSquareText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FunnelNode, FunnelTemplate } from "@/lib/funnel-tree";
import { type Path, pathsEqual } from "./tree-ops";

interface Handlers {
  selected: Path | null;
  onSelect: (path: Path | null) => void;
  onAddChild: (parent: Path) => void;
  onDelete: (path: Path) => void;
  onMove: (path: Path, dir: "up" | "down") => void;
}

interface StructureTreeProps extends Handlers {
  template: FunnelTemplate;
  onAddOption: () => void;
}

export function StructureTree({
  template,
  onAddOption,
  ...h
}: StructureTreeProps) {
  const rootSelected = h.selected === null;
  return (
    <div className="space-y-1">
      {/* Opening question — the shared root every visitor sees first */}
      <button
        onClick={() => h.onSelect(null)}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
          rootSelected
            ? "border-brand/60 bg-brand/10"
            : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <HelpCircle className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
            Opening question
          </span>
          <span className="block truncate text-sm text-white">
            {template.rootQuestion || "Untitled question"}
          </span>
        </span>
        <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
          {template.options.length} option{template.options.length === 1 ? "" : "s"}
        </span>
      </button>

      {/* Top-level options branch off the opening question */}
      <TreeLevel nodes={template.options} basePath={[]} {...h} />

      <AddButton onClick={onAddOption} label="Add option" indented={template.options.length > 0} />
    </div>
  );
}

/** A guided list of sibling nodes: a vertical trunk + an elbow to each row so
 *  the parent→child relationship is unmistakable. */
function TreeLevel({
  nodes,
  basePath,
  ...h
}: Handlers & { nodes: FunnelNode[]; basePath: Path }) {
  if (nodes.length === 0) return null;
  return (
    <div className="relative ml-4 mt-1 space-y-1 border-l border-white/[0.1] pl-5">
      {nodes.map((node, i) => {
        const isLast = i === nodes.length - 1;
        return (
          <div key={i} className="relative">
            {/* elbow from the trunk to this row */}
            <span className="pointer-events-none absolute -left-5 top-[18px] h-px w-5 bg-white/[0.1]" />
            {/* trim the trunk tail below the last child's elbow */}
            {isLast && (
              <span className="pointer-events-none absolute -left-5 top-[19px] -bottom-1 w-px bg-[#080808]" />
            )}
            <NodeRow
              node={node}
              path={[...basePath, i]}
              siblingCount={nodes.length}
              {...h}
            />
          </div>
        );
      })}
    </div>
  );
}

function NodeRow({
  node,
  path,
  siblingCount,
  ...h
}: Handlers & { node: FunnelNode; path: Path; siblingCount: number }) {
  const isSelected = pathsEqual(h.selected, path);
  const idx = path[path.length - 1];
  const vids = node.videos.length;
  const kids = node.children.length;

  return (
    <div>
      <motion.div layout>
        <div
          className={cn(
            "group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors",
            isSelected
              ? "border-brand/60 bg-brand/10"
              : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
          )}
        >
          <button
            onClick={() => h.onSelect(path)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                isSelected ? "bg-brand text-brand-foreground" : "bg-white/[0.06] text-zinc-400"
              )}
            >
              {idx + 1}
            </span>
            <span className="truncate text-sm text-white">
              {node.label || <span className="text-zinc-500">Untitled option</span>}
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            {vids > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-300">
                <Film className="h-3 w-3" />
                {vids}
              </span>
            )}
            {kids > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-300">
                <MessageSquareText className="h-3 w-3" />
                {kids}
              </span>
            )}
          </div>

          <div
            className={cn(
              "flex shrink-0 items-center gap-0.5 transition-opacity",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <IconBtn title="Move up" disabled={idx === 0} onClick={() => h.onMove(path, "up")}>
              <ChevronUp className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn
              title="Move down"
              disabled={idx === siblingCount - 1}
              onClick={() => h.onMove(path, "down")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Add sub-option" onClick={() => h.onAddChild(path)}>
              <Plus className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Delete" danger onClick={() => h.onDelete(path)}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>
      </motion.div>

      {/* branch → a sub-question that owns its own set of options */}
      {node.children.length > 0 && (
        <div className="relative ml-4 mt-1 border-l border-white/[0.1] pl-5">
          {/* elbow: option → sub-question; trim the trunk tail below it */}
          <span className="pointer-events-none absolute -left-5 top-[18px] h-px w-5 bg-white/[0.1]" />
          <span className="pointer-events-none absolute -left-5 top-[19px] -bottom-1 w-px bg-[#080808]" />
          <button
            onClick={() => h.onSelect(path)}
            className="flex w-full items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-2.5 py-1.5 text-left transition-colors hover:border-white/15"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand/15 text-brand">
              <HelpCircle className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] uppercase tracking-widest text-zinc-500">
                Sub-question
              </span>
              <span className="block truncate text-xs text-zinc-300">
                {node.prompt || "Untitled question"}
              </span>
            </span>
          </button>
          {/* the sub-question's own options */}
          <TreeLevel nodes={node.children} basePath={path} {...h} />
        </div>
      )}
    </div>
  );
}

function AddButton({
  onClick,
  label,
  indented,
  small,
}: {
  onClick: () => void;
  label: string;
  indented?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 font-medium text-zinc-400 transition-colors hover:border-brand/50 hover:text-brand",
        small ? "mt-1 py-1.5 text-[11px]" : "mt-1 py-2.5 text-xs",
        indented && "ml-4"
      )}
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/10",
        danger && "hover:bg-red-500/15 hover:text-red-400",
        disabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}

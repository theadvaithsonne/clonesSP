"use client";

import { Folder, FolderPlus, Globe, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DsFolder, FolderFilter } from "@/lib/docusign/types";

interface FolderRailProps {
  folders: DsFolder[];
  // Which flow's documents this rail is filtering. Folders are shared by both, but each tab lists
  // only one kind — so the badge has to count that kind, or it promises documents the list can't
  // show (a folder reading "24" on External that then lists 2, because 22 of them are internal).
  scope: "internal" | "external";
  unfiledCount: number;
  maxFolders: number;
  isLoading: boolean;
  // undefined = every folder (nothing highlighted).
  selected: FolderFilter | undefined;
  onSelect: (next: FolderFilter | undefined) => void;
  onCreate: () => void;
  onRename: (folder: DsFolder) => void;
  onDelete: (folder: DsFolder) => void;
}

const countPill = (active: boolean) =>
  cn(
    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
    active ? "bg-brand/15 text-brand" : "bg-[#2a2a35] text-[#8a8a9b]"
  );

// The founder/admin folder list that sits under the status filters. Clicking the highlighted row again
// clears the folder filter (back to every folder).
export function FolderRail({ folders, scope, unfiledCount, maxFolders, isLoading, selected, onSelect, onCreate, onRename, onDelete }: FolderRailProps) {
  // Falls back to the combined total when the backend hasn't been updated yet — the old,
  // wrong-but-familiar number rather than a badge that silently reads 0.
  const countOf = (f: DsFolder) => (scope === "internal" ? f.internalCount : f.externalCount) ?? f.documentCount;
  const toggle = (value: FolderFilter) => onSelect(selected === value ? undefined : value);
  const atLimit = folders.length >= maxFolders;

  const rowClass = (active: boolean) =>
    cn(
      "group relative flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-[13px] transition-colors",
      active
        ? "bg-white/[0.06] text-white/90 before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand"
        : "text-[#8a8a9b] hover:bg-white/[0.03] hover:text-white/80"
    );

  return (
    <div className="mt-3 border-t border-[#2a2a35] pt-3">
      <div className="mb-1 flex items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Folders</span>
        <div className="flex items-center gap-1">
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#7a7a90]" />}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCreate}
            disabled={atLimit}
            aria-label="New folder"
            title={atLimit ? `Limit of ${maxFolders} folders reached` : "New folder"}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="max-h-72 space-y-0.5 overflow-y-auto">
        <button type="button" onClick={() => toggle("unfiled")} className={rowClass(selected === "unfiled")} aria-pressed={selected === "unfiled"}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="truncate">Global (no folder)</span>
          </span>
          {!!unfiledCount && <span className={countPill(selected === "unfiled")}>{unfiledCount}</span>}
        </button>

        {folders.map((folder) => {
          const active = selected === folder._id;
          return (
            <div key={folder._id} className={cn(rowClass(active), "pr-1.5")}>
              <button type="button" onClick={() => toggle(folder._id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-pressed={active}>
                <Folder className="h-4 w-4 shrink-0" />
                <span className="truncate" title={folder.name}>
                  {folder.name}
                </span>
              </button>
              {!!countOf(folder) && <span className={countPill(active)}>{countOf(folder)}</span>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                    aria-label={`Options for ${folder.name}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onRename(folder)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onDelete(folder)} className="text-red-400 focus:text-red-300">
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {!folders.length && !isLoading && (
          <p className="px-3 py-2 text-xs text-[#8a8a9b]">No folders yet. Create one to organise your agreements.</p>
        )}
      </div>
    </div>
  );
}

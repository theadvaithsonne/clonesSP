"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  Search,
} from "lucide-react";
import { CATEGORY_COLORS } from "./constants";
import type { CampaignTemplateItem } from "./types";

function CategoryTag({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.General;
  return (
    <span
      className={`shrink-0 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
    >
      {category}
    </span>
  );
}

export function TemplatePickerDropdown({
  templates,
  loading,
  selectedId,
  selectedName,
  onSelect,
  onCreateNew,
  label = "Select template",
  hint = "Opens a template picker",
  placeholder = "Choose a template...",
}: {
  templates: CampaignTemplateItem[];
  loading?: boolean;
  selectedId: string;
  selectedName: string;
  onSelect: (id: string, name: string) => void;
  onCreateNew?: () => void;
  /** Field label. Overridden by the product form, which labels this "Email Template". */
  label?: string;
  /** Helper line under the trigger. Pass "" to hide it. */
  hint?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const displayLabel = selectedName || placeholder;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-[#a8a8a8] mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-11 px-3.5 rounded-lg border border-white/10 bg-white/[0.04] text-sm flex items-center justify-between gap-2 cursor-pointer outline-none focus:outline-none focus-visible:outline-none transition-colors hover:border-white/20 ${
          selectedId ? "text-white" : "text-[#7a7a7a]"
        }`}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <FileText
            className={`h-4 w-4 shrink-0 ${selectedId ? "text-brand" : "text-[#7a7a7a]"}`}
          />
          <span className={`truncate ${selectedId ? "text-white" : ""}`}>
            {displayLabel}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#7a7a7a] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {hint ? <p className="text-xs text-[#7a7a7a] mt-1.5">{hint}</p> : null}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          <div className="p-2.5 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7a7a7a]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-white/40 outline-none focus:outline-none focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="max-h-[240px] overflow-y-auto custom-scrollbar py-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[#7a7a7a]">
                No templates found
              </p>
            ) : (
              filtered.map((template) => {
                const selected = selectedId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onSelect(template.id, template.name);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                      selected ? "bg-brand/10" : "hover:bg-white/[0.06]"
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selected ? "bg-brand/15" : "bg-white/[0.06]"
                      }`}
                    >
                      <FileText
                        className={`h-4 w-4 ${selected ? "text-brand" : "text-[#7a7a7a]"}`}
                      />
                    </div>
                    <p className="text-sm text-white truncate flex-1 min-w-0">
                      {template.name}
                    </p>
                    <CategoryTag category={template.category} />
                  </button>
                );
              })
            )}
          </div>

          {onCreateNew && (
            <div className="border-t border-white/10 p-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateNew();
                }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors cursor-pointer"
              >
                Create new template
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

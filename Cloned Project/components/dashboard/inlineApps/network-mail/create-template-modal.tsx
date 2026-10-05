"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, X } from "lucide-react";

const CREATE_CATEGORIES = ["Marketing", "General", "Promotional", "Transactional"] as const;

export function CreateTemplateModal({
  onClose,
  onCreate,
  zIndex = 100,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; category: string }) => Promise<void>;
  zIndex?: number;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Marketing");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[#111111] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 w-[min(420px,90vw)] animate-[fadeIn_0.2s_ease-out]">
        <div className="flex items-start justify-between px-6 sm:px-7 pt-6 sm:pt-7 pb-0">
          <div>
            <h3 className="text-[17px] font-semibold text-white">
              Create new template
            </h3>
            <p className="text-[13px] text-[#7a7a7a] mt-0.5">
              Name your template and choose a category
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer -mt-1 -mr-1"
          >
            <X className="h-4 w-4 text-[#7a7a7a] hover:text-white transition-colors" />
          </button>
        </div>

        <div className="px-6 sm:px-7 pt-5 pb-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-[#a8a8a8]">
                Template name
              </label>
              <span
                className={`text-[11px] ${name.length >= 35 ? "text-red-400 font-medium" : "text-[#7a7a7a]"}`}
              >
                {name.length}/35
              </span>
            </div>
            <input
              type="text"
              value={name}
              maxLength={35}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Launch — May 2026"
              className="w-full h-11 px-3.5 rounded-lg border border-white/10 bg-white/[0.04] text-[14px] text-white placeholder:text-white/30 outline-none transition-colors"
            />
          </div>

          <div className="relative">
            <label className="block text-[13px] font-medium text-[#a8a8a8] mb-1.5">
              Category
            </label>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={`w-full h-11 px-3.5 rounded-lg border bg-white/[0.04] text-[14px] text-white flex items-center justify-between cursor-pointer outline-none transition-colors ${
                dropdownOpen
                  ? "border-white/20"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              {category}
              <ChevronDown
                className={`h-4 w-4 text-[#7a7a7a] transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-[9]"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl shadow-black/40 py-1.5 z-10 overflow-hidden">
                  {CREATE_CATEGORIES.map((cat) => {
                    const selected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategory(cat);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-[14px] transition-colors cursor-pointer flex items-center justify-between ${
                          selected
                            ? "bg-brand/15 text-brand font-medium"
                            : "text-[#a8a8a8] hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {cat}
                        {selected && (
                          <div className="h-2 w-2 rounded-full bg-brand" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex items-center justify-end gap-3 px-6 sm:px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-lg text-[14px] font-medium text-[#a8a8a8] hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || creating}
            onClick={async () => {
              if (!name.trim() || creating) return;
              setCreating(true);
              try {
                await onCreate({ name: name.trim(), category });
                onClose();
              } catch {
                /* parent shows toast */
              } finally {
                setCreating(false);
              }
            }}
            className="h-10 px-5 rounded-lg bg-brand text-brand-foreground text-[14px] font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_87%,black)] active:scale-[0.97] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create Template"}
            {!creating && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

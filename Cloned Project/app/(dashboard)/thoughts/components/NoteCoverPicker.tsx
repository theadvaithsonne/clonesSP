"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { uploadFiles } from "@/utils/uploadthing";
import {
  COVER_GRADIENTS,
  COVER_PHOTOS,
  gradientCss,
} from "../lib/noteCoverGallery";

type Tab = "gallery" | "upload" | "link" | "unsplash";

interface NoteCoverPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (coverUrl: string) => void;
  onRemove: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export default function NoteCoverPicker({
  open,
  onClose,
  onSelect,
  onRemove,
  anchorRef,
}: NoteCoverPickerProps) {
  const [tab, setTab] = useState<Tab>("gallery");
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  const rect = anchorRef.current?.getBoundingClientRect();
  const top = rect ? Math.min(rect.bottom + 8, window.innerHeight - 420) : 80;
  const left = rect
    ? Math.min(Math.max(12, rect.right - 420), window.innerWidth - 432)
    : 80;

  const tabs: { id: Tab; label: string }[] = [
    { id: "gallery", label: "Gallery" },
    { id: "upload", label: "Upload" },
    { id: "link", label: "Link" },
    { id: "unsplash", label: "Unsplash" },
  ];

  const handleUpload = async (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const response = await uploadFiles("postImages", { files: [file] });
      const url = response?.[0]?.ufsUrl || response?.[0]?.url;
      if (url) {
        onSelect(url);
        onClose();
      }
    } catch (err) {
      console.error("Cover upload failed:", err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[100000] w-[420px] max-h-[400px] rounded-[10px] border border-white/[0.1] bg-[#202020] shadow-[0_16px_48px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col"
      style={{ top, left }}
    >
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-0 border-b border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1.5 text-[13px] transition-colors duration-[20ms] ease-in border-b-2 -mb-px ${
              tab === t.id
                ? "text-white border-white"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onRemove();
            onClose();
          }}
          className="ml-auto text-[12px] text-zinc-500 hover:text-zinc-200 px-2 py-1 rounded transition-colors duration-[20ms] ease-in"
        >
          Remove
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "gallery" && (
          <div className="space-y-4">
            <section>
              <h4 className="text-[11px] font-medium text-zinc-500 mb-2 px-0.5">
                Color & Gradient
              </h4>
              <div className="grid grid-cols-4 gap-1.5">
                {COVER_GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    title={g.label}
                    onClick={() => {
                      onSelect(g.value);
                      onClose();
                    }}
                    className="h-14 rounded-[4px] border border-white/[0.06] hover:ring-2 hover:ring-white/30 transition-all duration-[20ms] ease-in"
                    style={{ backgroundImage: gradientCss(g.value) }}
                  />
                ))}
              </div>
            </section>
            <section>
              <h4 className="text-[11px] font-medium text-zinc-500 mb-2 px-0.5">
                Photos
              </h4>
              <div className="grid grid-cols-4 gap-1.5">
                {COVER_PHOTOS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.label}
                    onClick={() => {
                      onSelect(p.value);
                      onClose();
                    }}
                    className="h-14 rounded-[4px] border border-white/[0.06] overflow-hidden hover:ring-2 hover:ring-white/30 transition-all duration-[20ms] ease-in bg-zinc-800"
                  >
                    <img
                      src={p.value}
                      alt={p.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "upload" && (
          <div className="py-8 flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-[6px] bg-white/[0.08] hover:bg-white/[0.12] text-[13px] text-zinc-200 transition-colors duration-[20ms] ease-in"
            >
              {uploading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </span>
              ) : (
                "Upload file"
              )}
            </button>
            <p className="text-[11px] text-zinc-500">Images up to ~5MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {tab === "link" && (
          <div className="py-4 space-y-3">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste an image link…"
              className="w-full bg-[#151515] border border-white/[0.08] rounded-[6px] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && link.trim()) {
                  onSelect(link.trim());
                  onClose();
                }
              }}
            />
            <button
              type="button"
              disabled={!link.trim()}
              onClick={() => {
                if (!link.trim()) return;
                onSelect(link.trim());
                onClose();
              }}
              className="w-full h-8 rounded-[6px] bg-blue-600/80 hover:bg-blue-600 disabled:opacity-40 text-[13px] text-white transition-colors duration-[20ms] ease-in"
            >
              Submit
            </button>
          </div>
        )}

        {tab === "unsplash" && (
          <div className="space-y-2">
            <p className="text-[11px] text-zinc-500 px-0.5 mb-2">
              Curated Unsplash photos
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {COVER_PHOTOS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.label}
                  onClick={() => {
                    onSelect(p.value);
                    onClose();
                  }}
                  className="h-20 rounded-[4px] overflow-hidden border border-white/[0.06] hover:ring-2 hover:ring-white/30 transition-all duration-[20ms] ease-in"
                >
                  <img
                    src={p.value}
                    alt={p.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
